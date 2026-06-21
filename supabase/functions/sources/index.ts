/**
 * sources — context sources. v1 serves GamersLab's fixed source set; add/remove are
 * accepted as no-ops (the GamersLab context is baked into the v10 workflow's CAG block,
 * not user-uploaded). v2 wires real ingest. Contract: ENDPOINTS.md §2.
 *
 *   GET    /sources        -> Source[]
 *   POST   /sources        { type, label }  -> 201 Source (done)
 *   DELETE /sources/:id    -> 204
 */

import { errBody, json, lastSegment, noContent, preflight, requireBearer } from "../_shared/http.ts";
import { SOURCES } from "../_shared/gamerslab-config.ts";
import type { SourceType } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  if (req.method === "GET") return json(SOURCES);

  if (req.method === "POST") {
    let body: { type?: SourceType; label?: string } = {};
    try {
      body = await req.json();
    } catch { /* tolerate empty */ }
    // v1: accepted but not ingested — returns immediately "done" so the UI doesn't hang.
    return json(
      {
        id: `src-${Date.now()}`,
        type: body.type ?? "url",
        label: body.label ?? "Untitled source",
        parsing: false,
        done: true,
      },
      201,
    );
  }

  if (req.method === "DELETE") {
    const id = lastSegment(req.url);
    if (!id || id === "sources") return errBody("bad_request", "Missing source id", 400);
    return noContent();
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
