/**
 * sources — context source registry (real, DB-backed).
 *
 * Reads/writes the `source` table (the documents, websites, and socials the client adds).
 * Documents' bytes upload to the `sources` Storage bucket; extraction into the structured
 * context tables (intake / business_summary / document chunks) is done by the n8n
 * "Context Builder" workflow. New sources land as status "queued" until that runs — the UI
 * shows that honestly (no fake "Indexed").
 *
 *   GET    /sources        -> Source[]            (id, type, label, parsing, done)
 *   POST   /sources        { type, label }        -> 201 Source  (queued)
 *   DELETE /sources/:id    -> 204
 *
 * Single-file (helpers inlined) so it deploys without a relative _shared import.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

const lastSegment = (url: string): string => {
  const path = new URL(url).pathname.replace(/\/+$/, "");
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
};

type Row = { id: string; type: string; label: string; parsing: boolean; done: boolean };
const toSource = (r: Row) => ({ id: r.id, type: r.type, label: r.label, parsing: r.parsing, done: r.done });
const VALID_TYPES = new Set(["file", "url", "social"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();
  // v1 is single-tenant: resolve the one tenant. v2 derives this from the JWT.
  const { data: t } = await db.from("tenant").select("id").limit(1).maybeSingle();
  const tenantId = t?.id as string | undefined;
  if (!tenantId) return errBody("no_tenant", "No tenant configured", 500);

  if (req.method === "GET") {
    const { data, error } = await db
      .from("source")
      .select("id, type, label, parsing, done")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) return errBody("db_error", error.message, 500);
    return json((data as Row[]).map(toSource));
  }

  if (req.method === "POST") {
    let body: { type?: string; label?: string } = {};
    try {
      body = await req.json();
    } catch { /* tolerate empty */ }
    const type = body.type ?? "url";
    const label = (body.label ?? "").trim();
    if (!VALID_TYPES.has(type)) return errBody("unprocessable", "type must be file|url|social", 422);
    if (!label) return errBody("unprocessable", "label is required", 422);

    // Queued: registered but not yet processed by the Context Builder workflow.
    const { data, error } = await db
      .from("source")
      .insert({ tenant_id: tenantId, type, label, parsing: false, done: false })
      .select("id, type, label, parsing, done")
      .single();
    if (error) return errBody("db_error", error.message, 500);
    return json(toSource(data as Row), 201);
  }

  if (req.method === "DELETE") {
    const id = lastSegment(req.url);
    if (!id || id === "sources") return errBody("bad_request", "Missing source id", 400);
    const { error } = await db.from("source").delete().eq("tenant_id", tenantId).eq("id", id);
    if (error) return errBody("db_error", error.message, 500);
    return new Response(null, { status: 204, headers: cors });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
