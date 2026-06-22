-- 0003_seed_structured_context.sql
-- Seed-parse the GamersLab context into the EXISTING structured v2 schema.
--
-- The lead-gen Supabase already carries the white-label v2 structured tables (created
-- out-of-band, not in this repo's schema.sql): `source` (registry + storage_path),
-- `document` (RAG chunks with a pgvector `embedding` column), `intake` (guided answers),
-- `business_summary` (structured understanding), plus `venue`, `evidence`, `run`, `tenant`.
-- We populate them rather than inventing parallel tables.
--
-- This seed mirrors the former hardcoded gamerslab-config.ts (SOURCES / INTAKE / GATE_FIELDS)
-- as real rows so the Sources page and the structured layer run on live data. Idempotent.

-- Private bucket for uploaded document bytes (extraction wired by the n8n Context Builder).
INSERT INTO storage.buckets (id, name, public) VALUES ('sources','sources', false)
ON CONFLICT (id) DO NOTHING;

-- 1) Source registry — the three real context sources.
WITH t AS (SELECT id FROM public.tenant WHERE name='Gamers Lab' LIMIT 1)
INSERT INTO public.source (tenant_id, type, label, parsing, done)
SELECT t.id, v.type, v.label, false, true
FROM t, (VALUES
  ('file','GamersLab product brief (CAG)'),
  ('url','gamerslab.gg'),
  ('file','Case studies — revenue / DLC / CCU')
) AS v(type,label)
WHERE NOT EXISTS (SELECT 1 FROM public.source s WHERE s.tenant_id=t.id);

-- 2) Guided intake answers.
INSERT INTO public.intake (tenant_id, offer, icp, outcome, leads_today, good_lead)
SELECT id,
  'A permissioned data layer plus UGC app suite (Grudge Goblin, Tournament Garden) that lifts revenue, DLC attach, and concurrent players for existing Steam titles.',
  'Indie and mid-size Steam publishers with multiplayer-leaning titles (roguelite, survival, battle royale, fighting, strategy, sports) in launch or growth phase.',
  'Booked intro calls with publishers who integrate a GamersLab UGC app.',
  'Manual Steam browsing and generic cold email — slow, low reply rate.',
  'A publisher with a live or just-launched multiplayer title, a reachable decision-maker, and a real pain signal we can reference.'
FROM public.tenant WHERE name='Gamers Lab'
  AND NOT EXISTS (SELECT 1 FROM public.intake i WHERE i.tenant_id = public.tenant.id);

-- 3) Business summary (structured understanding — Gate A).
INSERT INTO public.business_summary (tenant_id, summary, icp, pains, where_find, channel, channel_why, confidence, confirmed, version)
SELECT id,
  'GamersLab is a permissioned data layer and UGC app suite for game publishers. Integrations have driven +31% revenue and +115% concurrent players by year five on existing titles.',
  'Steam publishers of multiplayer-leaning games (roguelite, survival, battle royale, fighting, strategy, sports) in launch or growth phase, small enough to act but established enough to integrate.',
  'Publishers struggle to sustain concurrent players, retention, and DLC attach after launch; mature titles decline without new engagement loops.',
  'Steam — discovered via SteamSpy genre tags, enriched with Steam store + web intel.',
  'Personalised cold email referencing a founder quote or player signal, 100–130 words, one stat, one CTA.',
  'Publishers respond to specific, researched outreach over generic pitches.',
  '{"summary":"high","icp":"high","pains":"medium","where":"high","channel":"high"}'::jsonb,
  true, 1
FROM public.tenant WHERE name='Gamers Lab'
  AND NOT EXISTS (SELECT 1 FROM public.business_summary b WHERE b.tenant_id = public.tenant.id);
