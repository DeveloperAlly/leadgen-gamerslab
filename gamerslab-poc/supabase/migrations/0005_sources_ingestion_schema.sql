-- 0005_sources_ingestion_schema.sql
-- Source lifecycle + provenance + the INFORM (suggestion) layer for the ingestion pipeline.

ALTER TABLE public.source
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'queued',  -- queued|processing|indexed|error|unsupported
  ADD COLUMN IF NOT EXISTS error       TEXT,
  ADD COLUMN IF NOT EXISTS mime        TEXT,
  ADD COLUMN IF NOT EXISTS bytes       BIGINT,
  ADD COLUMN IF NOT EXISTS indexed_at  TIMESTAMPTZ;

UPDATE public.source SET status = CASE WHEN done THEN 'indexed' WHEN parsing THEN 'processing' ELSE 'queued' END
WHERE status = 'queued';

-- Raw extraction text + the structured facts an LLM pulled from a source (provenance/audit).
CREATE TABLE IF NOT EXISTS public.source_extract (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  source_id      UUID NOT NULL REFERENCES public.source(id) ON DELETE CASCADE,
  raw_text       TEXT,
  char_count     INT,
  model          TEXT,
  extracted_json JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.source_extract ENABLE ROW LEVEL SECURITY;

-- The INFORM layer: a source's proposed answer for an already-answered intake question.
CREATE TABLE IF NOT EXISTS public.intake_suggestion (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  question_key     TEXT NOT NULL,
  suggested_answer TEXT NOT NULL,
  source_id        UUID REFERENCES public.source(id) ON DELETE CASCADE,
  source_label     TEXT,
  confidence       TEXT,
  quote            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',   -- pending|accepted|dismissed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.intake_suggestion ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_intake_suggestion_tenant_status
  ON public.intake_suggestion (tenant_id, status);
