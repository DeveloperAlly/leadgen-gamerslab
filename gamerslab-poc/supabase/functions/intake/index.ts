/**
 * intake — guided intake answers. v1 serves GamersLab's fixed intake; PUT echoes (no
 * per-user persistence in v1). Contract: ENDPOINTS.md §3.
 *
 *   GET /intake          -> Intake
 *   PUT /intake  Intake  -> Intake
 */

import { errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { INTAKE } from "../_shared/gamerslab-config.ts";
import type { Intake } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  if (req.method === "GET") return json(INTAKE);

  if (req.method === "PUT") {
    let body: Partial<Intake> = {};
    try {
      body = await req.json();
    } catch { /* tolerate empty */ }
    return json({ ...INTAKE, ...body }); // echo merged; not persisted in v1
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
