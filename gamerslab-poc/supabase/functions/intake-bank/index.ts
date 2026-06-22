/**
 * intake-bank — the structured intake answer bank + source-derived suggestions.
 *
 * Answers live in `intake_answer` (keyed). The Source Ingestion workflow writes
 * `intake_suggestion` rows for questions already answered (the INFORM layer); empty
 * questions it fills directly. On any change we ping the Context Builder so the CAG
 * recomposes.
 *
 *   GET  /intake-bank              -> { answers, suggestions[], updatedAt }
 *   PUT  /intake-bank { answers }  -> { answers, suggestions[], updatedAt }
 *   POST /intake-bank/accept  { id } -> applies a suggestion into the answer + recomposes
 *   POST /intake-bank/dismiss { id } -> drops a suggestion
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CONTEXT_BUILD_WEBHOOK = "https://n8n-j39n.sliplane.app/webhook/context-build";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const errBody = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status);
const requireBearer = (req: Request): Response | null => {
  const expected = Deno.env.get("API_BEARER");
  const raw = req.headers.get("authorization") || "";
  const got = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  if (!expected || got !== expected) return errBody("unauthorized", "Missing or invalid bearer token", 401);
  return null;
};
const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

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

// deno-lint-ignore no-explicit-any
async function readBank(db: any, tenantId: string) {
  const { data: ans } = await db
    .from("intake_answer")
    .select("question_key, answer, updated_at")
    .eq("tenant_id", tenantId);
  const answers: Record<string, string> = {};
  let updatedAt: string | null = null;
  for (const r of (ans ?? []) as { question_key: string; answer: string; updated_at: string }[]) {
    answers[r.question_key] = r.answer;
    if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at;
  }
  const { data: sug } = await db
    .from("intake_suggestion")
    .select("id, question_key, suggested_answer, source_label, confidence, quote")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return { answers, suggestions: sug ?? [], updatedAt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();
  const { data: t } = await db.from("tenant").select("id").limit(1).maybeSingle();
  const tenantId = t?.id as string | undefined;
  if (!tenantId) return errBody("no_tenant", "No tenant configured", 500);

  let path = new URL(req.url).pathname;
  while (path.endsWith("/")) path = path.slice(0, -1);
  const action = path.endsWith("/accept") ? "accept" : path.endsWith("/dismiss") ? "dismiss" : null;

  if (req.method === "GET") return json(await readBank(db, tenantId));

  if (req.method === "POST" && action) {
    let body: { id?: string };
    try { body = await req.json(); } catch { return errBody("bad_request", "Invalid JSON body", 400); }
    if (!body.id) return errBody("unprocessable", "id is required", 422);

    const { data: sug } = await db
      .from("intake_suggestion")
      .select("id, question_key, suggested_answer")
      .eq("tenant_id", tenantId)
      .eq("id", body.id)
      .maybeSingle();
    if (!sug) return errBody("not_found", "Suggestion not found", 404);

    if (action === "accept") {
      await db.from("intake_answer").upsert(
        { tenant_id: tenantId, question_key: sug.question_key, answer: sug.suggested_answer, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,question_key" },
      );
      await db.from("intake_suggestion").update({ status: "accepted" }).eq("id", body.id);
      await triggerRebuild();
    } else {
      await db.from("intake_suggestion").update({ status: "dismissed" }).eq("id", body.id);
    }
    return json(await readBank(db, tenantId));
  }

  if (req.method === "PUT") {
    let body: { answers?: Record<string, unknown> };
    try { body = await req.json(); } catch { return errBody("bad_request", "Invalid JSON body", 400); }
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
    return json(await readBank(db, tenantId));
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
