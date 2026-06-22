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
 *
 * The message->OutreachItem mapping lives inline here (not in _shared/mapper.ts) so the
 * board contract is self-contained and deploys without the shared mapper.
 * Design: how/pipeline_messaging_ab_sequencing_DRAFT.md. Send: how/email_send_pipeline_DRAFT.md.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/** A `message` row joined with its publisher's display + recipient fields. */
interface MessageRow {
  id: string;
  publisher_id: string;
  step: number;
  variant: string;
  is_control: boolean;
  subject: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
  replied_at: string | null;
  publishers:
    | {
      publisher_name: string | null;
      game_name: string | null;
      contact_email: string | null;
      email_valid: boolean | null;
    }
    | null;
}

/** Columns to SELECT from `message` (with the publisher name + recipient embedded). */
const MESSAGE_SELECT =
  "id,publisher_id,step,variant,is_control,subject,body,status,sent_at,replied_at," +
  "publishers(publisher_name,game_name,contact_email,email_valid)";

const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

const relDate = (iso: string | null): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
};

/** message.status -> OutreachStage (Gate C board). */
const statusToStage = (s: string | null): string => {
  switch (s) {
    case "won":
      return "success";
    case "lost":
      return "lost";
    case "replied":
      return "replied";
    case "sent":
      return "contacted";
    // V1-GAP: approving is the terminal action in v1; it shows on the board as "contacted".
    case "approved":
      return "contacted";
    case "rejected":
    case "skip":
      return "lost";
    default:
      return "awaiting"; // draft / null — has a draft awaiting approval
  }
};

/** Group `message` rows by publisher into the UI's OutreachItem shape (A/B variants inside). */
function toOutreachItems(rows: MessageRow[]): unknown[] {
  const byPublisher = new Map<string, MessageRow[]>();
  for (const r of rows) {
    const list = byPublisher.get(r.publisher_id) ?? [];
    list.push(r);
    byPublisher.set(r.publisher_id, list);
  }

  const items: unknown[] = [];
  for (const [publisherId, msgs] of byPublisher) {
    const pub = msgs[0]!.publishers;
    const name = pub?.publisher_name || pub?.game_name || "Unknown publisher";
    const control = msgs.find((m) => m.is_control) ?? msgs[0]!;

    const variants = msgs
      .filter((m) => m.step === 1)
      .sort((a, b) => a.variant.localeCompare(b.variant))
      .map((m) => ({
        messageId: m.id,
        variant: m.variant,
        isControl: m.is_control,
        step: m.step,
        subject: m.subject ?? undefined,
        body: m.body ?? undefined,
        sentCount: m.sent_at ? 1 : 0,
        replyCount: m.replied_at ? 1 : 0,
      }));

    let last: string | undefined;
    if (control.replied_at) last = `Replied ${relDate(control.replied_at)}`;
    else if (control.sent_at) last = `Sent ${relDate(control.sent_at)}`;

    items.push({
      id: publisherId,
      name,
      initials: initialsOf(name),
      channel: "Email",
      stage: statusToStage(control.status),
      // Empty string means no contact found — normalize to undefined so the UI's
      // "no recipient, can't send" branch fires instead of rendering a blank address.
      toEmail: pub?.contact_email?.trim() ? pub.contact_email.trim() : undefined,
      emailValid: pub?.email_valid ?? undefined,
      subject: control.subject ?? undefined,
      body: control.body ?? undefined,
      variants,
      last,
    });
  }
  return items;
}

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
      .in("status", ["draft", "approved", "rejected", "sent", "replied", "won", "lost"])
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
    if (!["approve", "skip", "won", "lost"].includes(action ?? "")) {
      return errBody("bad_request", "action must be approve, skip, won, or lost", 400);
    }

    // Outcome on a replied prospect. Persist to publishers + message (the board reads
    // message.status); this is the outcome data the learning loop reads. publishers first
    // so the sync trigger can't clobber the message stamp.
    if (action === "won" || action === "lost") {
      const status = action;
      const { error: pErr } = await db.from("publishers").update({ pipeline_status: status }).eq("id", id);
      if (pErr) return errBody("db_error", pErr.message, pErr.code === "PGRST116" ? 404 : 500);
      const { error: mErr } = await db.from("message").update({ status }).eq("publisher_id", id).eq("step", 1);
      if (mErr) return errBody("db_error", mErr.message, 500);
      const { item, error: rErr } = await publisherItem(db, id);
      if (rErr) return errBody("db_error", rErr.message, 500);
      return json(item);
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
