/**
 * sources — context source registry (real, DB-backed) with document upload.
 *
 *   GET    /sources                    -> Source[]
 *   POST   /sources  (json)            { type, label }  -> 201 Source (queued)
 *   POST   /sources  (multipart)       file + label     -> 201 Source (document uploaded to Storage)
 *   DELETE /sources/:id                -> 204
 *
 * Documents upload to the `sources` Storage bucket; a 7-day signed URL is stored on the row
 * so the n8n "Source Ingestion" workflow can fetch the bytes without Storage credentials.
 * Any add pings the ingestion webhook. Single-file (helpers inlined).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SOURCE_INGEST_WEBHOOK = "https://n8n-j39n.sliplane.app/webhook/source-ingest";

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
  const raw = req.headers.get("authorization") || "";
  const got = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  if (!expected || got !== expected) return errBody("unauthorized", "Missing or invalid bearer token", 401);
  return null;
};
const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
const lastSeg = (url: string): string => {
  let p = new URL(url).pathname;
  while (p.endsWith("/")) p = p.slice(0, -1);
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
};

type Row = { id: string; type: string; label: string; parsing: boolean; done: boolean };
const toSource = (r: Row) => ({ id: r.id, type: r.type, label: r.label, parsing: r.parsing, done: r.done });
const VALID_TYPES = new Set(["file", "url", "social"]);

async function triggerIngest(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3000);
    await fetch(SOURCE_INGEST_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trigger: "source-add" }),
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

  const ct = req.headers.get("content-type") || "";

  // ---- POST multipart: document upload ----
  if (req.method === "POST" && ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return errBody("unprocessable", "file is required", 422);
    const label = (form.get("label") as string) || file.name;
    const id = crypto.randomUUID();
    const path = `${tenantId}/${id}/${file.name}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const up = await db.storage.from("sources").upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (up.error) return errBody("storage_error", up.error.message, 500);
    const signed = await db.storage.from("sources").createSignedUrl(path, 60 * 60 * 24 * 7);
    const { data, error } = await db
      .from("source")
      .insert({
        id, tenant_id: tenantId, type: "file", label, storage_path: path,
        download_url: signed.data?.signedUrl ?? null, mime: file.type || null,
        bytes: file.size, parsing: false, done: false, status: "queued",
      })
      .select("id, type, label, parsing, done")
      .single();
    if (error) return errBody("db_error", error.message, 500);
    void triggerIngest();
    return json(toSource(data as Row), 201);
  }

  if (req.method === "GET") {
    const { data, error } = await db
      .from("source")
      .select("id, type, label, parsing, done")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) return errBody("db_error", error.message, 500);
    return json((data as Row[]).map(toSource));
  }

  // ---- POST json: website / social ----
  if (req.method === "POST") {
    let body: { type?: string; label?: string } = {};
    try { body = await req.json(); } catch { /* tolerate empty */ }
    const type = body.type ?? "url";
    const label = (body.label ?? "").trim();
    if (!VALID_TYPES.has(type)) return errBody("unprocessable", "type must be file|url|social", 422);
    if (!label) return errBody("unprocessable", "label is required", 422);
    const { data, error } = await db
      .from("source")
      .insert({ tenant_id: tenantId, type, label, parsing: false, done: false, status: "queued" })
      .select("id, type, label, parsing, done")
      .single();
    if (error) return errBody("db_error", error.message, 500);
    void triggerIngest();
    return json(toSource(data as Row), 201);
  }

  if (req.method === "DELETE") {
    const id = lastSeg(req.url);
    if (!id || id === "sources") return errBody("bad_request", "Missing source id", 400);
    const { error } = await db.from("source").delete().eq("tenant_id", tenantId).eq("id", id);
    if (error) return errBody("db_error", error.message, 500);
    return new Response(null, { status: 204, headers: cors });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
