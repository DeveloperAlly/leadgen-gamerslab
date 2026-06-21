/**
 * tenant — GET /tenant -> { tenant, usage }. Drives the sidebar logo/name + usage bar.
 * Tenant is fixed (GamersLab); usage is a live count of drafted publishers vs the daily cap.
 * Contract: ENDPOINTS.md §1.
 */

import { admin, json, preflight, requireBearer } from "../_shared/http.ts";
import { TENANT, USAGE_LIMIT } from "../_shared/gamerslab-config.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const { count } = await admin()
    .from("publishers")
    .select("id", { count: "exact", head: true })
    .in("pipeline_status", ["draft", "approved", "sent", "replied"]);

  return json({ tenant: TENANT, usage: { used: count ?? 0, total: USAGE_LIMIT } });
});
