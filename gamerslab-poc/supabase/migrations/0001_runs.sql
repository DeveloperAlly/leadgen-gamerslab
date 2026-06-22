-- Discovery run state — backs the loading screen's progress polling.
-- The `publishers` table holds results; this table holds job state. The n8n workflow
-- posts progress to the `n8n-status` Edge Function, which updates the row; the UI polls
-- GET /api/runs/:id. Single-tenant in v1 (no tenant_id); v2 adds tenant scoping + RLS.

CREATE TABLE IF NOT EXISTS runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind         TEXT NOT NULL DEFAULT 'discovery',
  status       TEXT NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed | canceled
  progress     INT  NOT NULL DEFAULT 0,         -- 0-100
  counts       JSONB NOT NULL DEFAULT '{}',     -- { found, verified, approved }
  error        TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
