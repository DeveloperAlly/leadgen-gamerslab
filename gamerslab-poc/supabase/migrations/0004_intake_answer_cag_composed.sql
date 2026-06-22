-- 0004_intake_answer_cag_composed.sql
-- Structured intake answer bank + composed-CAG store for the Context Builder loop.
--
-- intake_answer: keyed answers to the white-label question bank (the catalog lives in the
--   UI — poc/ui/src/screens/IntakeBankScreen.tsx). The n8n "GamersLab Context Builder"
--   workflow reads these and composes the CAG, writing the live public.cag_context.
-- cag_composed: audit/preview store for a composed CAG (kept separate from the live block).
--
-- Loop: Intake page (PUT /intake-bank) -> ping Context Builder webhook -> compose from
-- intake_answer -> write cag_context -> outreach workflow reads it next run.

CREATE TABLE IF NOT EXISTS public.intake_answer (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  question_key TEXT NOT NULL,
  answer       TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, question_key)
);
ALTER TABLE public.intake_answer ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cag_composed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  prompt      TEXT NOT NULL,
  composed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.cag_composed ENABLE ROW LEVEL SECURITY;

-- Seed (data, applied via execute_sql): 21 keyed answers for the GamersLab tenant,
-- decomposed section-by-section from docs/cag-block.md. The Context Builder recomposes
-- those exact sections back into the byte-identical CAG (verified: md5 unchanged).
-- Keys: offer, a1_oneliner, a1_apps, a1_sdk, a2_problem, a3_numbers, a3_peers, a3_team,
--       a4_objections, a4_banned, a5_cta, a5_contact, outcome, good_lead, b1_icp,
--       b1_fit_strong, b2_poorfit, b3_pitch_angles, b3_pain_signals, b5_venue, leads_today.
