/**
 * n8n-status — progress callback from the n8n v10 workflow.
 *
 *   POST /n8n-status   { run_id, status, progress, counts?, error? }   -> 200
 *
 * The workflow posts here at start, per batch, and on finish/fail. Authenticated by a
 * shared secret header (N8N_STATUS_SECRET), NOT the UI bearer — this is a server↔server
 * call. Updates the `runs` row the UI polls. (Architecture spec §5, §6 step 11.)
 */

import { admin, errBody, json, preflight } from "../_shared/http.ts";

type Incoming = {
  run_id?: string;
  status?: "queued" | "running" | "completed" | "failed" | "canceled";
  progress?: number;
  counts?: { found?: number; verified?: number; approved?: number };
  error?: string;
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return errBody("method_not_allowed", "POST only", 405);

  const expected = Deno.env.get("N8N_STATUS_SECRET");
  const got = req.headers.get("x-status-secret");
  if (!expected || got !== expected) {
    return errBody("unauthorized", "Invalid status secret", 401);
  }

  let body: Incoming;
  try {
    body = await req.json();
  } catch {
    return errBody("bad_request", "Invalid JSON body", 400);
  }
  if (!body.run_id) return errBody("unprocessable", "run_id required", 422);

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (typeof body.progress === "number") {
    patch.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
  }
  if (body.counts) patch.counts = body.counts;
  if (body.error) patch.error = body.error;
  if (body.status === "running" && body.progress != null && body.progress <= 1) {
    patch.started_at = new Date().toISOString();
  }
  if (body.status === "completed" || body.status === "failed" || body.status === "canceled") {
    patch.finished_at = new Date().toISOString();
    if (body.status === "completed") patch.progress = 100;
  }

  const { error } = await admin().from("runs").update(patch).eq("id", body.run_id);
  if (error) return errBody("db_error", error.message, 500);

  return json({ ok: true });
});
