/**
 * intake-bank — the structured intake answer bank (the question-bank answers).
 *
 * Reads/writes `intake_answer` (keyed question_key -> answer). On PUT it pings the n8n
 * "Context Builder" webhook, which recomposes the CAG from these answers and writes the
 * live cag_context — so editing an answer updates what the pipeline reads on the next run.
 *
 *   GET /intake-bank              -> { answers: { [key]: string }, updatedAt: string|null }
 *   PUT /intake-bank { answers }  -> { answers: { [key]: string }, updatedAt: string }
 *
 * (Distinct from the legacy `intake` function, which serves the 5-field onboarding shape.)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CONTEXT_BUILD_WEBHOOK = "https://n8n-j39n.sliplane.app/webhook/context-build";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const errBody = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status);
const requireBearer = (req: Request): Response | null => {
  const expected = Deno.env.get("API_BEARER");
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || got !== expected) return errBody("unauthorized", "Missing or invalid bearer token", 401);
  return null;
};
const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// Fire the Context Builder so the CAG recomposes. Best-effort; never blocks the response on failure.
async function triggerRebuild(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    await fetch(CONTEXT_BUILD_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trigger: "intake-save" }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
  } catch { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();
  const { data: t } = await db.from("tenant").select("id").limit(1).maybeSingle();
  const tenantId = t?.id as string | undefined;
  if (!tenantId) return errBody("no_tenant", "No tenant configured", 500);

  if (req.method === "GET") {
    const { data, error } = await db
      .from("intake_answer")
      .select("question_key, answer, updated_at")
      .eq("tenant_id", tenantId);
    if (error) return errBody("db_error", error.message, 500);
    const answers: Record<string, string> = {};
    let updatedAt: string | null = null;
    for (const r of data as { question_key: string; answer: string; updated_at: string }[]) {
      answers[r.question_key] = r.answer;
      if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at;
    }
    return json({ answers, updatedAt });
  }

  if (req.method === "PUT") {
    let body: { answers?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const answers = body.answers ?? {};
    const rows = Object.entries(answers)
      .filter(([k]) => typeof k === "string" && k.length > 0)
      .map(([question_key, answer]) => ({
        tenant_id: tenantId,
        question_key,
        answer: typeof answer === "string" ? answer : String(answer ?? ""),
        updated_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return errBody("unprocessable", "answers object is required", 422);

    const { error } = await db.from("intake_answer").upsert(rows, { onConflict: "tenant_id,question_key" });
    if (error) return errBody("db_error", error.message, 500);

    await triggerRebuild();

    const { data } = await db
      .from("intake_answer")
      .select("question_key, answer, updated_at")
      .eq("tenant_id", tenantId);
    const out: Record<string, string> = {};
    let updatedAt: string | null = null;
    for (const r of (data ?? []) as { question_key: string; answer: string; updated_at: string }[]) {
      out[r.question_key] = r.answer;
      if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at;
    }
    return json({ answers: out, updatedAt });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
