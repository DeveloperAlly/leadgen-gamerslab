-- DRAFT, PRE-GATE. DO NOT APPLY.
-- Prospect-dossier slot columns for public.publishers.
-- Spec: how/prospect_dossier_build_spec_DRAFT.md §2 (Schema migration, DDL spec - NOT applied).
-- Why:  how/prospect_dossier_research_DRAFT.md (the levers + provenance-quad model).
--
-- Scope (locked by spec §0 and §2):
--   - Additive only. No DROP, no rename, no backfill of human-entered data.
--   - Idempotent: every statement is ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS,
--     so a partial earlier apply re-runs cleanly.
--   - Two waves in one file, mirroring spec §2:
--       Wave 0 (foundations): per-slot provenance the v10 engine does not yet carry.
--       Wave 2 (entity + suppression): publisher-entity re-key + suppression booleans.
--   - Each dossier slot value is a provenance quad {value, source_url, date, evidence_strength}.
--     A value without a source_url or a date is EMPTY by definition (spec §1). The *_source and
--     *_as_of columns added here are the source_url and date halves of that quad for the slots
--     whose value/strength columns already exist live (verified against public.publishers 2026-06-24).
--
-- Verified 2026-06-24 against project ccmwksmgoisijvyovgko: none of the 13 columns below exist yet,
-- and the reused value/strength columns they pair with (evidence_*, founder_quote*, contact_*,
-- peer_publisher_ref, fit/value/match_score) all do. So these adds are genuinely additive.
--
-- Apply at build time only, permission-first (CLAUDE.md non-negotiable #1, #10). Not authorised here.

-- =====================================================================
-- Wave 0 (foundations): per-slot provenance the engine does not yet carry. Spec §2, §4.
-- =====================================================================
ALTER TABLE public.publishers
  -- Slot 2 (Why-now trigger). Spec §1 row 2, §4.2. value + source_url + date + class.
  ADD COLUMN IF NOT EXISTS why_now             text,   -- the one-line trigger statement (the quad value)
  ADD COLUMN IF NOT EXISTS why_now_source      text,   -- source_url: news url | steam:appreviews-velocity | steam:release_date
  ADD COLUMN IF NOT EXISTS why_now_as_of       date,   -- event date; drives decay (spec §4.2 windows). No date => slot EMPTY
  ADD COLUMN IF NOT EXISTS trigger_class       text,   -- funding|exec|launch|patch|update|coming_soon|pain_velocity (spec §4.2, config/trigger-classes.DRAFT.json)
  ADD COLUMN IF NOT EXISTS why_now_decay_weight numeric, -- slot-2 decay exp(-age/halflife[class]); demand keeps evidence_decay_weight (review conflict 1)
  -- Slot 4 (Human detail). Spec §1 row 4, §4.5. Pairs with existing founder_quote + founder_quote_source.
  ADD COLUMN IF NOT EXISTS founder_quote_as_of date,   -- date of the mirrored line; no date => slot EMPTY
  -- Slot 1 (Decision-maker). Spec §1 row 1, §4.3. Pairs with existing contact_* + contact_source.
  ADD COLUMN IF NOT EXISTS contact_as_of       date,   -- date the contact was sourced/verified
  -- Slot 5 (Peer match). Spec §1 row 5, §4.4. Records how peer_publisher_ref was chosen.
  ADD COLUMN IF NOT EXISTS peer_match_method   text,   -- deterministic | llm (gate §3 requires 'deterministic')
  -- Slot 6 (Qualification). Spec §1 row 6, §4.6. Per-dimension contributions behind fit_score.
  ADD COLUMN IF NOT EXISTS dimension_breakdown jsonb;  -- { value: .., match: .., weights: .. } scoring breakdown

-- =====================================================================
-- Wave 2 (entity + suppression): publisher-entity re-key + suppression. Spec §2, §5.
-- Entity-level, not per-game: a studio reached via a second game must not be re-pitched.
-- Booleans default false and are NOT NULL so suppression checks (spec §5) never see NULL.
-- =====================================================================
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS publisher_key    text,                          -- normalised publisher name or domain; dedup key (spec §5)
  ADD COLUMN IF NOT EXISTS journey_stage    text,                          -- new | contacted | replied | won | lost (spec §5)
  ADD COLUMN IF NOT EXISTS do_not_contact   boolean NOT NULL DEFAULT false, -- hard suppression; checked before every touch (spec §5)
  ADD COLUMN IF NOT EXISTS already_customer boolean NOT NULL DEFAULT false, -- already a GamersLab customer; suppress outreach
  ADD COLUMN IF NOT EXISTS opted_out        boolean NOT NULL DEFAULT false; -- unsubscribe / removal reply; suppress all of this publisher's games

-- Dedup + suppression scans select on publisher_key (spec §5). Spec §2 names exactly this index.
CREATE INDEX IF NOT EXISTS publishers_publisher_key_idx
  ON public.publishers (publisher_key);

-- =====================================================================
-- Rollback (commented; run manually only if a build apply must be reverted).
-- Drops exactly what this migration adds, nothing else. Destroys any data written into
-- these columns post-apply, so confirm before running. Index drop first, then columns.
-- =====================================================================
-- DROP INDEX IF EXISTS public.publishers_publisher_key_idx;
-- ALTER TABLE public.publishers
--   DROP COLUMN IF EXISTS why_now,
--   DROP COLUMN IF EXISTS why_now_source,
--   DROP COLUMN IF EXISTS why_now_as_of,
--   DROP COLUMN IF EXISTS trigger_class,
--   DROP COLUMN IF EXISTS why_now_decay_weight,
--   DROP COLUMN IF EXISTS founder_quote_as_of,
--   DROP COLUMN IF EXISTS contact_as_of,
--   DROP COLUMN IF EXISTS peer_match_method,
--   DROP COLUMN IF EXISTS dimension_breakdown,
--   DROP COLUMN IF EXISTS publisher_key,
--   DROP COLUMN IF EXISTS journey_stage,
--   DROP COLUMN IF EXISTS do_not_contact,
--   DROP COLUMN IF EXISTS already_customer,
--   DROP COLUMN IF EXISTS opted_out;
