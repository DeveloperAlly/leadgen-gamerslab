/**
 * context — the editable CAG business-context block.
 *
 * This is the single source of truth for the GamersLab product brief the n8n workflow
 * injects when scoring publishers and drafting emails. The "Business context" page in the
 * web app reads and edits it here; the workflow's `Get Drafted IDs` query reads the same
 * row each run, so an edit here changes the next run's scoring + drafts.
 *
 *   GET /context              -> { cagBlock: string, updatedAt: string | null }
 *   PUT /context { cagBlock } -> { cagBlock: string, updatedAt: string }
 *
 * Single-file (helpers inlined) so it deploys without a relative _shared import.
 * Auth mirrors the sibling functions: static API_BEARER, service-role DB client.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

const errBody = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status);

const requireBearer = (req: Request): Response | null => {
  const expected = Deno.env.get("API_BEARER");
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || got !== expected) {
    return errBody("unauthorized", "Missing or invalid bearer token", 401);
  }
  return null;
};

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();

  // ---- GET /context ----
  if (req.method === "GET") {
    const { data, error } = await db
      .from("cag_context")
      .select("cag_block, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return errBody("db_error", error.message, 500);
    return json({ cagBlock: data?.cag_block ?? "", updatedAt: data?.updated_at ?? null });
  }

  // ---- PUT /context ----
  if (req.method === "PUT") {
    let body: { cagBlock?: string };
    try {
      body = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const cagBlock = typeof body.cagBlock === "string" ? body.cagBlock : "";
    if (!cagBlock.trim()) return errBody("unprocessable", "cagBlock must be a non-empty string", 422);

    // Single-row table: update the existing row, or insert the first one.
    const { data: existing, error: selErr } = await db
      .from("cag_context")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr) return errBody("db_error", selErr.message, 500);

    const row = existing
      ? await db
          .from("cag_context")
          .update({ cag_block: cagBlock, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("cag_block, updated_at")
          .single()
      : await db
          .from("cag_context")
          .insert({ cag_block: cagBlock })
          .select("cag_block, updated_at")
          .single();

    if (row.error) return errBody("db_error", row.error.message, 500);
    return json({ cagBlock: row.data.cag_block, updatedAt: row.data.updated_at });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
