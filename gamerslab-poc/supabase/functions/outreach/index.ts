/**
 * outreach — Gate C board. A/B message variants + prospect states, read from `message`.
 *
 *   GET   /outreach                       -> OutreachItem[]   (one item per publisher; A/B variants inside)
 *   PATCH /outreach/message/:messageId    -> OutreachItem     (edit one variant; writes the publisher column)
 *   POST  /outreach/:publisherId/approve  -> OutreachItem     (approve; fires the n8n send)
 *   POST  /outreach/:publisherId/skip     -> OutreachItem     (move to lost)
 *
 * `message` is a derived read-model kept in sync from `publishers` by the DB trigger
 * `trg_sync_publisher_message`. Editing therefore writes the `publishers` column for the
 * variant (A -> approved_subject, B -> approved_subject_b, body -> approved_body) and the
 * trigger mirrors it back into `message`. Approve marks the publisher approved and, when
 * N8N_SEND_WEBHOOK_URL is set, fires the n8n Send workflow (non-fatal).
 * Design: how/pipeline_messaging_ab_sequencing_DRAFT.md. Send: how/email_send_pipeline_DRAFT.md.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { MESSAGE_SELECT, type MessageRow, toOutreachItems } from "../_shared/mapper.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Segments after "outreach": /outreach/message/:id -> ["message", id]; /outreach/:id/approve -> [id, "approve"].
const parsePath = (url: string): { seg1?: string; seg2?: string } => {
  const parts = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const i = parts.indexOf("outreach");
  return { seg1: parts[i + 1], seg2: parts[i + 2] };
};

/** Re-read one publisher's outreach item (the board groups by publisher). */
async function publisherItem(db: SupabaseClient, publisherId: string) {
  const { data, error } = await db
    .from("message")
    .select(MESSAGE_SELECT)
    .eq("publisher_id", publisherId)
    .order("variant", { ascending: true });
  if (error) return { error };
  const items = toOutreachItems((data ?? []) as unknown as MessageRow[]);
  return { item: items[0] ?? null };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();

  // ---- GET /outreach ----
  if (req.method === "GET") {
    const { data, error } = await db
      .from("message")
      .select(MESSAGE_SELECT)
      .eq("step", 1)
      // Only actionable rows with real content: drop skip/backlog tiers and empty drafts (matches v1).
      .in("status", ["draft", "approved", "rejected", "sent", "replied"])
      .neq("body", "")
      .order("publisher_id", { ascending: true })
      .order("variant", { ascending: true });
    if (error) return errBody("db_error", error.message, 500);
    return json(toOutreachItems((data ?? []) as unknown as MessageRow[]));
  }

  // ---- PATCH /outreach/message/:messageId ---- edit one A/B variant.
  if (req.method === "PATCH") {
    const { seg1, seg2: messageId } = parsePath(req.url);
    if (seg1 !== "message" || !messageId) {
      return errBody("bad_request", "Use PATCH /outreach/message/:messageId", 400);
    }
    let payload: { subject?: unknown; body?: unknown };
    try {
      payload = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }

    // Resolve which publisher + variant this message belongs to.
    const { data: msg, error: mErr } = await db
      .from("message")
      .select("publisher_id,variant")
      .eq("id", messageId)
      .single();
    if (mErr) return errBody("db_error", mErr.message, mErr.code === "PGRST116" ? 404 : 500);

    const patch: Record<string, string> = {};
    if (typeof payload.subject === "string") {
      // The B variant edits its own subject column; A (control) edits the primary.
      patch[msg.variant === "B" ? "approved_subject_b" : "approved_subject"] = payload.subject;
    }
    if (typeof payload.body === "string") patch.approved_body = payload.body; // body is shared
    if (Object.keys(patch).length === 0) {
      return errBody("bad_request", "Provide subject and/or body", 400);
    }

    // Write the publishers column; the sync trigger mirrors it into `message`.
    const { error: uErr } = await db.from("publishers").update(patch).eq("id", msg.publisher_id);
    if (uErr) return errBody("db_error", uErr.message, 500);

    const { item, error } = await publisherItem(db, msg.publisher_id);
    if (error) return errBody("db_error", error.message, 500);
    return json(item);
  }

  // ---- POST /outreach/:publisherId/{approve,skip} ----
  if (req.method === "POST") {
    const { seg1: id, seg2: action } = parsePath(req.url);
    if (!id) return errBody("bad_request", "Missing publisher id", 400);
    if (action !== "approve" && action !== "skip") {
      return errBody("bad_request", "action must be approve or skip", 400);
    }

    // Guard: never approve-and-send a publisher with no recipient. Approval fires the
    // send workflow, so an empty contact_email would dispatch into the void. Block it
    // here (server-side) so the UI guard can't be bypassed.
    if (action === "approve") {
      const { data: pub, error: pErr } = await db
        .from("publishers")
        .select("contact_email")
        .eq("id", id)
        .single();
      if (pErr) return errBody("db_error", pErr.message, pErr.code === "PGRST116" ? 404 : 500);
      if (!pub?.contact_email?.trim()) {
        return errBody("no_recipient", "This publisher has no contact email — cannot send", 422);
      }
    }

    const patch = action === "approve"
      ? { pipeline_status: "approved" }
      : { pipeline_status: "rejected" };

    const { error } = await db.from("publishers").update(patch).eq("id", id);
    if (error) return errBody("db_error", error.message, error.code === "PGRST116" ? 404 : 500);

    // On approve, fire the n8n Send workflow (non-fatal). It reads the connected inbox's
    // token, sends, and stamps sent_at. If unreachable, the row stays 'approved' for retry.
    if (action === "approve") {
      const sendUrl = Deno.env.get("N8N_SEND_WEBHOOK_URL");
      if (sendUrl) {
        const secret = Deno.env.get("N8N_WEBHOOK_SECRET");
        try {
          await fetch(sendUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(secret ? { "x-webhook-secret": secret } : {}),
            },
            body: JSON.stringify({ publisher_id: id }),
          });
        } catch (_e) {
          // Swallowed by design — approval succeeds even if the send fire fails.
        }
      }
    }

    const { item, error: rErr } = await publisherItem(db, id);
    if (rErr) return errBody("db_error", rErr.message, 500);
    return json(item);
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
