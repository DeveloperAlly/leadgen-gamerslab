/**
 * outreach — Gate C board. Drafts and prospect states from `publishers`.
 *
 *   GET   /outreach              -> OutreachItem[]
 *   POST  /outreach/:id/approve  -> OutreachItem   (v1: approves the draft, no send)
 *   POST  /outreach/:id/skip     -> OutreachItem   (moves to lost)
 *
 * v1 never sends email (the pipeline drafts only). Approve marks the draft approved;
 * a later phase wires an actual send + reply tracking. Contract: ENDPOINTS.md §7.
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

    return json(toOutreachItem(data as unknown as PublisherRow));
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
