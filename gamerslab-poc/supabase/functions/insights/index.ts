/**
 * insights — Learn & iterate panel. v1 serves GamersLab's fixed insight copy, with a live
 * "approved" count overlaid where available. Refinement apply is a no-op in v1.
 * Contract: ENDPOINTS.md §8.
 *
 *   GET  /insights                    -> DashboardInsights
 *   POST /insights/refinement/apply   -> 204
 */

import { errBody, json, noContent, preflight, requireBearer } from "../_shared/http.ts";
import { INSIGHTS } from "../_shared/gamerslab-config.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname.endsWith("/apply")) {
    return noContent(); // v1: scoring refinement is not yet applied to the workflow
  }

  if (req.method === "GET") return json(INSIGHTS);

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
