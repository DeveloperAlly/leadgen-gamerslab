/**
 * Shared HTTP plumbing for every Edge Function: CORS, JSON responses, bearer auth,
 * and a service-role Supabase client.
 *
 * Auth model (v1 POC, per architecture spec §9): the integration layer is the trust
 * boundary. The web app sends a static `Authorization: Bearer <API_BEARER>`; functions
 * reject mismatches. The `publishers` table is single-tenant, so no tenant pinning is
 * needed in v1. v2 swaps this check for a Supabase JWT + RLS — the function surface is
 * unchanged.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

export const noContent = (): Response => new Response(null, { status: 204, headers: cors });

export const errBody = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status);

/** Handle the CORS preflight. Returns a Response to short-circuit, or null to continue. */
export const preflight = (req: Request): Response | null =>
  req.method === "OPTIONS" ? new Response(null, { status: 204, headers: cors }) : null;

/** Validate the static bearer. Returns null when OK, or a 401 Response when not. */
export const requireBearer = (req: Request): Response | null => {
  const expected = Deno.env.get("API_BEARER");
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || got !== expected) {
    return errBody("unauthorized", "Missing or invalid bearer token", 401);
  }
  return null;
};

/** Service-role client — server-side only, never shipped to the browser. */
export const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

/** Last path segment, e.g. /leads/abc -> "abc". Empty string if none. */
export const lastSegment = (url: string): string => {
  const path = new URL(url).pathname.replace(/\/+$/, "");
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
};
