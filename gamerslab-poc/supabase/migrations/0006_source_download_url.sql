-- 0006_source_download_url.sql
-- Long-lived signed download URL for uploaded documents, so the n8n Source Ingestion
-- workflow can GET the bytes without needing Storage credentials inside n8n.
ALTER TABLE public.source ADD COLUMN IF NOT EXISTS download_url TEXT;
