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