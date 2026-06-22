-- GamersLab Publisher Outreach Pipeline
-- Full Supabase schema
-- Run this in Supabase SQL editor to initialise

-- ─────────────────────────────────────────────
-- PUBLISHERS TABLE
-- One row per Steam publisher/game combination
-- Upserted on steam_app_id
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS publishers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),

  -- Steam identity
  steam_app_id            TEXT UNIQUE NOT NULL,
  game_name               TEXT,
  publisher_name          TEXT,
  publisher_key           TEXT,   -- normalised publisher name; outreach dedup key (one outreach per publisher)
  publisher_other_games   TEXT,   -- other games by this publisher (for the portfolio mention in the email)
  developer_name          TEXT,
  primary_genre           TEXT,
  steam_tags              TEXT,
  steam_description       TEXT,
  release_date            TEXT,
  coming_soon             BOOLEAN DEFAULT FALSE,
  game_phase              TEXT,   -- pre-launch | just-launched | growth | mature | sunset | unknown
  is_free                 BOOLEAN DEFAULT FALSE,
  price_usd               INT,
  review_score            NUMERIC,
  total_reviews           INT,
  owners_estimate         TEXT,
  avg_playtime_2weeks     INT,

  -- Steam category signals
  has_multi_player        BOOLEAN DEFAULT FALSE,
  has_online_pvp          BOOLEAN DEFAULT FALSE,
  has_steam_leaderboards  BOOLEAN DEFAULT FALSE,
  has_steam_workshop      BOOLEAN DEFAULT FALSE,
  has_online_coop         BOOLEAN DEFAULT FALSE,

  -- Contact
  publisher_website       TEXT,
  support_email           TEXT,   -- from Steam API support_info.email
  contact_email           TEXT,   -- best email found
  contact_email_all       TEXT,   -- all emails found comma-separated
  contact_source          TEXT,   -- steam_api | contact_page_scrape | website_scrape | serper_search | whois
  email_valid             BOOLEAN DEFAULT FALSE, -- domain has MX records (free validation; NOT mailbox-level)
  email_status            TEXT,   -- valid | valid_role | guessed_role | no_mx | nxdomain | invalid_syntax | no_email
  contact_name            TEXT,
  contact_role            TEXT,
  whois_registrant_email  TEXT,
  whois_registrant_name   TEXT,

  -- Social
  twitter_handle          TEXT,
  linkedin_company_url    TEXT,
  discord_url             TEXT,

  -- Intel
  founder_name            TEXT,
  founder_quote           TEXT,
  founder_quote_source    TEXT,
  pain_signal             TEXT,
  intel_summary           TEXT,
  intel_quality           TEXT,   -- gold | silver | bronze | no_signal

  -- Scoring
  pre_score               INT,
  outreach_tier           TEXT,   -- A (60+) | B (30-59) | C (10-29) | skip (<10)
  fit_score               INT,
  score_rationale         TEXT,

  -- GamersLab match
  pitch_angle             TEXT,   -- revitalization | launch-amplification
  best_ugc_app            TEXT,
  gamerslab_hook          TEXT,
  ugc_app_pitch           TEXT,
  peer_publisher_ref      TEXT,

  -- Draft email
  draft_subject           TEXT,
  draft_body              TEXT,
  recommended_action      TEXT,   -- advance | warm_queue | archive
  model_used              TEXT,

  -- Pipeline state
  pipeline_status         TEXT DEFAULT 'draft',   -- draft | approved | rejected | sent | replied
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  reject_reason           TEXT,
  approved_subject        TEXT,
  approved_body           TEXT,
  sent_at                 TIMESTAMPTZ,
  replied_at              TIMESTAMPTZ,
  sequence_status         TEXT DEFAULT 'not_started'
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_publishers_outreach_tier    ON publishers(outreach_tier);
CREATE INDEX IF NOT EXISTS idx_publishers_pipeline_status  ON publishers(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_publishers_fit_score        ON publishers(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_publishers_game_phase       ON publishers(game_phase);
CREATE INDEX IF NOT EXISTS idx_publishers_created_at       ON publishers(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS publishers_updated_at ON publishers;
CREATE TRIGGER publishers_updated_at
  BEFORE UPDATE ON publishers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- MIGRATION: if the table already exists, add the
-- email-validation columns (safe to run repeatedly).
-- ─────────────────────────────────────────────
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS email_valid  BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS email_status TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS publisher_key         TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS publisher_other_games TEXT;
CREATE INDEX IF NOT EXISTS idx_publishers_email_valid   ON publishers(email_valid);
CREATE INDEX IF NOT EXISTS idx_publishers_publisher_key ON publishers(publisher_key);

-- ─────────────────────────────────────────────
-- Pipeline Critique v2 — Tier 1 (migration `tier1_evidence_riskflags_decay_rejectcode`,
-- applied live 2026-06-22). D1 evidence rubric, N5 anti-fit flags, N9 recency decay,
-- N1 structured reject reason. See how/pipeline_critique_v2.md §9.
-- ─────────────────────────────────────────────
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS evidence_strength     TEXT;                       -- D1: explicit | inferred | none
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS evidence_quote        TEXT;                       -- D1: painpoint evidence quote
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS evidence_sources      JSONB DEFAULT '[]'::jsonb;  -- D1: cited source urls
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS evidence_as_of        DATE;                       -- D1/N9: date the evidence is from
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS evidence_decay_weight NUMERIC;                    -- N9: exp(-age_days/halflife)
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS risk_flags            JSONB DEFAULT '[]'::jsonb;  -- N5: [{flag, evidence, source}] flag-not-suppress
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS reject_reason_code    TEXT;                       -- N1: bad_fit|wrong_contact|weak_evidence|bad_timing|already_customer|other
CREATE INDEX IF NOT EXISTS idx_publishers_evidence_strength  ON publishers(evidence_strength);
CREATE INDEX IF NOT EXISTS idx_publishers_reject_reason_code ON publishers(reject_reason_code);

-- Reply tracking (migration 0006) — the Gmail thread/message id of a sent outreach, so the
-- n8n Reply-poll workflow can detect when the publisher replies. See how/email_send_pipeline_DRAFT.md §6b.
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS outreach_thread_id  TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS outreach_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_publishers_awaiting_reply
  ON publishers (pipeline_status) WHERE pipeline_status = 'sent' AND replied_at IS NULL;

-- ─────────────────────────────────────────────
-- EMAIL_ACCOUNTS (migration 0005, applied live 2026-06-22)
-- The inbox a tenant connects (Gmail/Outlook OAuth) to send approved outreach from.
-- WHO sends (this table) is split from HOW it sends (n8n reads the token per-send).
-- Design: how/email_send_pipeline_DRAFT.md. Refresh token stored AES-256-GCM by the
-- Edge Function; RLS on + no policy = service-role-only access (matches `runs`).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id          UUID,                              -- v2-ready; v1 publishers flow is single-tenant
  provider           TEXT NOT NULL,                     -- google | microsoft
  from_email         TEXT NOT NULL,
  display_name       TEXT,
  refresh_token_enc  TEXT,                              -- AES-256-GCM ciphertext; server-side only, never returned to browser
  scopes             TEXT[] NOT NULL DEFAULT '{}',
  daily_cap          INT NOT NULL DEFAULT 500,          -- ~500 free Gmail, ~2000 Workspace, ~10000 M365
  sent_today         INT NOT NULL DEFAULT 0,
  sent_today_date    DATE,
  status             TEXT NOT NULL DEFAULT 'connected', -- connected | expired | revoked
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at       TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_one_active
  ON public.email_accounts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status <> 'revoked';
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON public.email_accounts(status);
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();