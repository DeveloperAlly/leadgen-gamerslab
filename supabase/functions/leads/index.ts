/**
 * leads — Gate B surface. Reads discovered leads from `publishers`, mapped to the UI's
 * Lead shape; approve/reject writes back to `pipeline_status`.
 *
 *   GET    /leads?verified=true&sort=desc   -> { leads: Lead[], foundCount: number }
 *   PATCH  /leads/:id   { status }          -> Lead
 *   POST   /leads/export   { ids[] }        -> { url }   (CSV data URL in v1)
 *
 * Contract: ui-design/lead-pipeline/docs/ENDPOINTS.md §6.
 */

import { admin, errBody, json, lastSegment, preflight, requireBearer } from "../_shared/http.ts";
import { PUBLISHER_SELECT, type PublisherRow, toLead } from "../_shared/mapper.ts";
import type { LeadStatus } from "../_shared/types.ts";

// UI status -> publishers.pipeline_status. Only review transitions are writable here.
const STATUS_TO_DB: Record<LeadStatus, string> = {
  approved: "approved",
  rejected: "rejected",
  pending: "draft",
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();
  const url = new URL(req.url);

  // ---- GET /leads ----
  if (req.method === "GET") {
    const verifiedOnly = url.searchParams.get("verified") === "true";
    const sort = url.searchParams.get("sort") === "asc" ? true : false;

    let q = db
      .from("publishers")
      .select(PUBLISHER_SELECT)
      // Only rows that reached drafting are "leads"; backlog/skip rows are not surfaced.
      .in("pipeline_status", ["draft", "approved", "rejected", "sent", "replied"])
      .order("fit_score", { ascending: sort, nullsFirst: false });

    if (verifiedOnly) q = q.eq("email_valid", true);

    const { data, error } = await q;
    if (error) return errBody("db_error", error.message, 500);

    const leads = (data as unknown as PublisherRow[]).map(toLead);
    return json({ leads, foundCount: leads.length });
  }

  // ---- PATCH /leads/:id ----
  if (req.method === "PATCH") {
    const id = lastSegment(req.url);
    if (!id || id === "leads") return errBody("bad_request", "Missing lead id", 400);

    let body: { status?: LeadStatus };
    try {
      body = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const target = body.status && STATUS_TO_DB[body.status];
    if (!target) return errBody("unprocessable", "status must be approved|rejected|pending", 422);

    const { data, error } = await db
      .from("publishers")
      .update({ pipeline_status: target })
      .eq("id", id)
      .select(PUBLISHER_SELECT)
      .single();
    if (error) return errBody("db_error", error.message, error.code === "PGRST116" ? 404 : 500);

    return json(toLead(data as unknown as PublisherRow));
  }

  // ---- POST /leads/export ----
  if (req.method === "POST" && url.pathname.endsWith("/export")) {
    let body: { ids?: string[] };
    try {
      body = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const ids = body.ids ?? [];
    if (ids.length === 0) return errBody("unprocessable", "ids[] required", 422);

    const { data, error } = await db
      .from("publishers")
      .select(PUBLISHER_SELECT)
      .in("id", ids);
    if (error) return errBody("db_error", error.message, 500);

    const rows = (data as unknown as PublisherRow[]).map(toLead);
    const headers = ["name", "score", "verified", "venue", "reason"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((l) => [l.name, l.score, l.verified, l.venue, l.reason].map(esc).join(",")),
    ].join("\n");
    // v1: inline data URL (no Storage bucket dependency). v2 -> signed Storage URL.
    const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    return json({ url: dataUrl });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
