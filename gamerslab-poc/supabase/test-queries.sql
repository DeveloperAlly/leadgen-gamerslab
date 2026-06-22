-- GamersLab Publisher Outreach — Test / Inspection Queries
-- Run these in the Supabase SQL editor (or any psql connected to the DB)
-- against the `publishers` table created by schema.sql.
--
-- "Outreach contenders" = rows the pipeline drafted an email for
-- (pipeline_status = 'draft'), ranked best-fit first.
-- Ranking: LLM fit_score first (richest signal), then deterministic pre_score.

-- ───────────────────────────────────────────────────────────────
-- 1. TOP 10 CONTENDERS — email-ready view (the one you'll use most)
--    Everything a human needs to approve/edit + the actual draft.
-- ───────────────────────────────────────────────────────────────
SELECT
  game_name,
  publisher_name,
  outreach_tier,
  pre_score,
  fit_score,
  game_phase,
  contact_email,
  email_valid,
  email_status,
  contact_source,
  contact_name,
  best_ugc_app,
  pitch_angle,
  gamerslab_hook,
  pain_signal,
  draft_subject,
  draft_body,
  recommended_action,
  model_used,
  pipeline_status
FROM publishers
WHERE pipeline_status = 'draft'
ORDER BY fit_score DESC NULLS LAST, pre_score DESC
LIMIT 10;

-- ───────────────────────────────────────────────────────────────
-- 2. TOP 10 CONTENDERS — full row (every column, for deep inspection)
-- ───────────────────────────────────────────────────────────────
SELECT *
FROM publishers
WHERE pipeline_status = 'draft'
ORDER BY fit_score DESC NULLS LAST, pre_score DESC
LIMIT 10;

-- ───────────────────────────────────────────────────────────────
-- 3. READ THE SINGLE BEST DRAFT — subject + body + who to send to
-- ───────────────────────────────────────────────────────────────
SELECT
  game_name,
  publisher_name,
  contact_email,
  draft_subject,
  draft_body
FROM publishers
WHERE pipeline_status = 'draft'
ORDER BY fit_score DESC NULLS LAST, pre_score DESC
LIMIT 1;

-- ───────────────────────────────────────────────────────────────
-- 4. FULL INTEL for the top 10 (research dossier, no email text)
-- ───────────────────────────────────────────────────────────────
SELECT
  game_name, publisher_name, developer_name, publisher_website,
  primary_genre, steam_tags, game_phase, review_score, total_reviews, owners_estimate,
  has_online_pvp, has_steam_leaderboards, has_steam_workshop, has_multi_player, has_online_coop,
  contact_email, contact_email_all, contact_source, contact_name, contact_role,
  twitter_handle, linkedin_company_url, discord_url,
  founder_name, founder_quote, founder_quote_source,
  pain_signal, intel_summary, intel_quality,
  pre_score, fit_score, outreach_tier, score_rationale,
  pitch_angle, best_ugc_app, ugc_app_pitch, peer_publisher_ref, gamerslab_hook
FROM publishers
WHERE pipeline_status = 'draft'
ORDER BY fit_score DESC NULLS LAST, pre_score DESC
LIMIT 10;

-- ───────────────────────────────────────────────────────────────
-- 5. PIPELINE HEALTH — how many rows in each state
-- ───────────────────────────────────────────────────────────────
SELECT pipeline_status, COUNT(*) AS n
FROM publishers
GROUP BY pipeline_status
ORDER BY n DESC;

-- ───────────────────────────────────────────────────────────────
-- 6. TIER BREAKDOWN of drafts (are we drafting high-fit games?)
-- ───────────────────────────────────────────────────────────────
SELECT outreach_tier, COUNT(*) AS n, ROUND(AVG(pre_score),1) AS avg_pre, ROUND(AVG(fit_score),1) AS avg_fit
FROM publishers
WHERE pipeline_status = 'draft'
GROUP BY outreach_tier
ORDER BY avg_pre DESC;

-- ───────────────────────────────────────────────────────────────
-- 7. CONTACT COVERAGE — how many drafts are actually SENDABLE
--    (email_valid = domain has MX records; free validation)
-- ───────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                      AS total_drafts,
  COUNT(*) FILTER (WHERE email_valid)           AS sendable,
  COUNT(*) FILTER (WHERE NOT email_valid)       AS not_sendable
FROM publishers
WHERE pipeline_status = 'draft';

-- 7b. Sendability breakdown by reason
SELECT email_status, COUNT(*) AS n
FROM publishers
WHERE pipeline_status = 'draft'
GROUP BY email_status
ORDER BY n DESC;

-- ───────────────────────────────────────────────────────────────
-- 8. TOP 10 *SENDABLE* CONTENDERS — valid email, ready to send/edit
--    This is the list Pipeline 2/3 should action.
-- ───────────────────────────────────────────────────────────────
SELECT
  game_name, publisher_name, contact_email, email_status,
  outreach_tier, pre_score, fit_score,
  draft_subject, draft_body
FROM publishers
WHERE pipeline_status = 'draft' AND email_valid = TRUE
ORDER BY fit_score DESC NULLS LAST, pre_score DESC
LIMIT 10;

-- 8b. DRAFTS WITH NO VALID EMAIL — need manual contact research
--     (try the socials we did capture)
SELECT game_name, publisher_name, email_status, publisher_website, twitter_handle, linkedin_company_url, discord_url, fit_score
FROM publishers
WHERE pipeline_status = 'draft' AND email_valid = FALSE
ORDER BY fit_score DESC NULLS LAST
LIMIT 25;

-- ───────────────────────────────────────────────────────────────
-- 9. INTEL QUALITY distribution among drafts
-- ───────────────────────────────────────────────────────────────
SELECT intel_quality, COUNT(*) AS n
FROM publishers
WHERE pipeline_status = 'draft'
GROUP BY intel_quality
ORDER BY n DESC;

-- ───────────────────────────────────────────────────────────────
-- 10. MOST RECENT runs — what landed last (verify a run worked)
-- ───────────────────────────────────────────────────────────────
SELECT game_name, publisher_name, pipeline_status, pre_score, fit_score, model_used, updated_at
FROM publishers
ORDER BY updated_at DESC
LIMIT 25;

-- ───────────────────────────────────────────────────────────────
-- 11. UNIQUENESS / DEDUP MIRROR
--     This is exactly what the pipeline's "Get Drafted IDs" node
--     excludes from future runs. Run it to see how many games are
--     "locked" so they won't be re-drafted.
--     NOTE: 'rejected' is intentionally NOT excluded by the current
--     pipeline — see the chat for whether to add it.
-- ───────────────────────────────────────────────────────────────
SELECT pipeline_status, COUNT(*) AS locked
FROM publishers
WHERE pipeline_status IN ('draft','approved','sent','replied')
GROUP BY pipeline_status;

-- ───────────────────────────────────────────────────────────────
-- 12. DUPLICATE GUARD — should always return ZERO rows.
--     If it returns anything, the steam_app_id UNIQUE constraint
--     was bypassed and the upsert match key is misconfigured.
-- ───────────────────────────────────────────────────────────────
SELECT steam_app_id, COUNT(*) AS copies
FROM publishers
GROUP BY steam_app_id
HAVING COUNT(*) > 1;

-- ───────────────────────────────────────────────────────────────
-- 13. BACKLOG — researched but not yet drafted (the promotion pool
--     a future run will pick the next top-35 from)
-- ───────────────────────────────────────────────────────────────
SELECT game_name, publisher_name, outreach_tier, pre_score, game_phase
FROM publishers
WHERE pipeline_status = 'backlog'
ORDER BY pre_score DESC
LIMIT 25;
