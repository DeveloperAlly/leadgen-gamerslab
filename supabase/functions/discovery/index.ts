/**
 * discovery — starts and polls a discovery run.
 *
 *   POST /discovery/run   { mode }   -> 202 { jobId }
 *   GET  /discovery/:jobId            -> running: { status:"running", pct, stage }
 *                                        done:    { status:"done", pct:100,
 *                                                   result: { leads, foundCount } }
 *
 * POST creates a `runs` row (queued) and fires the n8n v10 webhook, which runs the long
 * discover→enrich→draft job and posts progress back to the `n8n-status` function. n8n has
 * no REST execute endpoint, so a Webhook Trigger is the entry point (architecture spec §6).
 *
 * Contract: ui-design/lead-pipeline/docs/ENDPOINTS.md §6.
 */

import { admin, errBody, json, lastSegment, preflight, requireBearer } from "../_shared/http.ts";
import { PUBLISHER_SELECT, type PublisherRow, toLead } from "../_shared/mapper.ts";

const STAGE_FOR = (pct: number): string => {
  if (pct < 15) return "Searching Steam";
  if (pct < 40) return "Mining contacts";
  if (pct < 65) return "Harvesting intel";
  if (pct < 85) return "Scoring fit";
  return "Drafting outreach";
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();
  const url = new URL(req.url);

  // ---- POST /discovery/run ----
  if (req.method === "POST" && url.pathname.endsWith("/run")) {
    let body: { mode?: string } = {};
    try {
      body = await req.json();
    } catch { /* empty body is fine */ }
    const mode = body.mode === "investors" ? "investors" : "customers";

    // One active run at a time (architecture spec §13).
    const { data: active } = await db
      .from("runs")
      .select("id")
      .in("status", ["queued", "running"])
      .limit(1);
    if (active && active.length > 0) {
      return json({ jobId: active[0].id }, 202); // reuse the in-flight run
    }

    const { data: run, error } = await db
      .from("runs")
      .insert({ kind: "discovery", status: "queued", progress: 0 })
      .select("id")
      .single();
    if (error) return errBody("db_error", error.message, 500);

    const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    const secret = Deno.env.get("N8N_WEBHOOK_SECRET");
    if (!webhookUrl) return errBody("config_error", "N8N_WEBHOOK_URL not set", 500);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-webhook-secret": secret } : {}),
        },
        body: JSON.stringify({ run_id: run.id, mode }),
      });
      if (!res.ok) throw new Error(`n8n returned ${res.status}`);
    } catch (e) {
      await db.from("runs").update({
        status: "failed",
        error: `Failed to start workflow: ${(e as Error).message}`,
      }).eq("id", run.id);
      return errBody("workflow_unreachable", "Could not start discovery workflow", 502);
    }

    return json({ jobId: run.id }, 202);
  }

  // ---- GET /discovery/:jobId ----
  if (req.method === "GET") {
    const id = lastSegment(req.url);
    if (!id || id === "discovery") return errBody("bad_request", "Missing job id", 400);

    const { data: run, error } = await db
      .from("runs")
      .select("status, progress, counts, error")
      .eq("id", id)
      .single();
    if (error) return errBody("db_error", error.message, error.code === "PGRST116" ? 404 : 500);

    if (run.status === "failed") {
      return json({ status: "failed", pct: run.progress, error: run.error });
    }
    if (run.status !== "completed") {
      return json({ status: "running", pct: run.progress, stage: STAGE_FOR(run.progress) });
    }

    // Completed: return the leads produced by this run's batch.
    const { data, error: lerr } = await db
      .from("publishers")
      .select(PUBLISHER_SELECT)
      .in("pipeline_status", ["draft", "approved", "rejected", "sent", "replied"])
      .order("fit_score", { ascending: false, nullsFirst: false });
    if (lerr) return errBody("db_error", lerr.message, 500);

    const leads = (data as unknown as PublisherRow[]).map(toLead);
    return json({ status: "done", pct: 100, result: { leads, foundCount: leads.length } });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
