/**
 * venues — search venues. v1 serves GamersLab's fixed venue map (Steam primary); PATCH
 * echoes (the v10 workflow always searches Steam in v1). Contract: ENDPOINTS.md §4.
 *
 *   GET   /venues           -> Venue[]
 *   PATCH /venues  Venue[]  -> Venue[]
 */

import { errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { VENUES } from "../_shared/gamerslab-config.ts";
import type { Venue } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  if (req.method === "GET") return json(VENUES);

  if (req.method === "PATCH") {
    let body: Venue[] = [];
    try {
      body = await req.json();
    } catch { /* tolerate empty */ }
    return json(Array.isArray(body) && body.length > 0 ? body : VENUES); // echo; not persisted in v1
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
