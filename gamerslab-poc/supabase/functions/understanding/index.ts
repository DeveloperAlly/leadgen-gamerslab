/**
 * understanding — Gate A. v1 serves GamersLab's fixed business understanding (from the
 * CAG block); PUT echoes edits (not persisted in v1). The "find leads" action calls the
 * discovery function, not this one. Contract: ENDPOINTS.md §5.
 *
 *   GET /understanding             -> GateFields
 *   PUT /understanding  GateFields -> GateFields
 */

import { errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { GATE_FIELDS } from "../_shared/gamerslab-config.ts";
import type { GateFields } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  if (req.method === "GET") return json(GATE_FIELDS);

  if (req.method === "PUT") {
    let body: Partial<GateFields> = {};
    try {
      body = await req.json();
    } catch { /* tolerate empty */ }
    return json({ ...GATE_FIELDS, ...body }); // echo merged; not persisted in v1
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
