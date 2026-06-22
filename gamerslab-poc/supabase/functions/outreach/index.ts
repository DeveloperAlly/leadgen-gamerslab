/**
 * outreach — Gate C board. Drafts and prospect states from `publishers`.
 *
 *   GET   /outreach              -> OutreachItem[]
 *   PATCH /outreach/:id          -> OutreachItem   (persists an edited subject/body)
 *   POST  /outreach/:id/approve  -> OutreachItem   (approves the draft; fires the n8n send)
 *   POST  /outreach/:id/skip     -> OutreachItem   (moves to lost)
 *
 * Approve marks the draft approved and, when an inbox is connected and N8N_SEND_WEBHOOK_URL
 * is set, fires the n8n Send workflow (which reads the per-tenant token, sends, and stamps
 * sent_at). The fire is non-fatal: if n8n is unreachable the row stays 'approved' and can be
 * retried. Send + reply tracking design: how/email_send_pipeline_DRAFT.md. Contract: ENDPOINTS.md §7.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { PUBLISHER_SELECT, type PublisherRow, toOutreachItem } from "../_shared/mapper.ts";

// /outreach/:id/approve -> ["outreach", ":id", "approve"]
const parsePath = (url: string): { id?: string; action?: string } => {
  const parts = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const i = parts.indexOf("outreach");
  return { id: parts[i + 1], action: parts[i + 2] };
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();

  // ---- GET /outreach ----
  if (req.method === "GET") {
    const { data, error } = await db
      .from("publishers")
      .select(PUBLISHER_SELECT)
      // Board shows anything with a draft or further along; backlog/skip-tier rows excluded.
      .in("pipeline_status", ["draft", "approved", "rejected", "sent", "replied"])
      .order("created_at", { ascending: false });
    if (error) return errBody("db_error", error.message, 500);

    // Only surface rows that actually have a draft to act on.
    const items = (data as unknown as PublisherRow[])
      .filter((p) => p.draft_body || p.approved_body)
      .map(toOutreachItem);
    return json(items);
  }

  // ---- PATCH /outreach/:id ---- persist an edited subject/body to the approved_* columns.
  if (req.method === "PATCH") {
    const { id } = parsePath(req.url);
    if (!id) return errBody("bad_request", "Missing outreach id", 400);
    let payload: { subject?: unknown; body?: unknown };
    try {
      payload = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const patch: Record<string, string> = {};
    if (typeof payload.subject === "string") patch.approved_subject = payload.subject;
    if (typeof payload.body === "string") patch.approved_body = payload.body;
    if (Object.keys(patch).length === 0) {
      return errBody("bad_request", "Provide subject and/or body", 400);
    }

    const { data, error } = await db
      .from("publishers")
      .update(patch)
      .eq("id", id)
      .select(PUBLISHER_SELECT)
      .single();
    if (error) return errBody("db_error", error.message, error.code === "PGRST116" ? 404 : 500);
    return json(toOutreachItem(data as unknown as PublisherRow));
  }

  // ---- POST /outreach/:id/{approve,skip} ----
  if (req.method === "POST") {
    const { id, action } = parsePath(req.url);
    if (!id) return errBody("bad_request", "Missing outreach id", 400);
    if (action !== "approve" && action !== "skip") {
      return errBody("bad_request", "action must be approve or skip", 400);
    }

    const patch = action === "approve"
      ? { pipeline_status: "approved" }
      : { pipeline_status: "rejected" };

    const { data, error } = await db
      .from("publishers")
      .update(patch)
      .eq("id", id)
      .select(PUBLISHER_SELECT)
      .single();
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

    return json(toOutreachItem(data as unknown as PublisherRow));
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
