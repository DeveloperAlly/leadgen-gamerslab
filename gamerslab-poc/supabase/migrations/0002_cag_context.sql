-- 0002_cag_context.sql
-- The editable CAG business-context block.
--
-- Single source of truth for the GamersLab product brief that the n8n outreach workflow
-- (v10) injects when scoring publishers and drafting emails. Edited via the web app's
-- "Business context" page (GET/PUT /functions/v1/context). The workflow's "Get Drafted IDs"
-- node selects cag_block on every run; the "Apply CAG from DB" code node swaps it into the
-- already-built prompt (with the node's baked literal as a fallback if this table is empty).
--
-- Seed: the single row is loaded byte-for-byte from docs/cag-block.md (the content between
-- the code fences) so behaviour is unchanged until someone edits it in the UI. The seed is
-- applied out-of-band (base64 INSERT) rather than inlined here to keep this file readable;
-- to re-seed, copy docs/cag-block.md's block into the Business context editor and save.

CREATE TABLE IF NOT EXISTS public.cag_context (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cag_block   TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cag_context IS
  'Single-row editable CAG context block: the GamersLab business brief the n8n workflow injects when scoring/drafting. Edited via the UI Business Context page.';

ALTER TABLE public.cag_context ENABLE ROW LEVEL SECURITY;
-- No policies: access is server-side only via the service-role key in the `context` Edge
-- Function (RLS is bypassed by the service role). v2 (multi-tenant) adds tenant-scoped policies.
