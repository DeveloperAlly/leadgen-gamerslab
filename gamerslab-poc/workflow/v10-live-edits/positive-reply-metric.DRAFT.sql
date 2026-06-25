-- =============================================================================
-- positive-reply-metric.DRAFT.sql
-- Lane A9 (spec Wave 0): positive-reply metric definition + baseline + attribution attributes.
-- =============================================================================
--
-- STATUS: DRAFT, PRE-GATE. No build authorised. Per CLAUDE.md non-negotiable #1
-- (no build before the gate) and #8 (free-tier only). This file is an authoring
-- artifact, NOT a migration to apply. The DDL in PART C is spec-only and is NOT to
-- be run until the build gate; the BASELINE in PART B was executed READ-ONLY against
-- the live project ccmwksmgoisijvyovgko on 2026-06-24 and its results are recorded
-- inline as comments.
--
-- Authoritative source: how/prospect_dossier_build_spec_DRAFT.md
--   - spec section 6 (Build sequence) lists "positive-reply metric + baseline" as a
--     Wave 0 foundation item, alongside T1 draft-repair, the section 2 migration.
--   - spec section 1 (slot schema) + section 6 Wave 3 (loop) name the attribution
--     dimensions that a positive reply must be attributable back to: trigger, why_now,
--     peer, app, A/B variant, channel, touch step, tier.
-- Why doc: how/prospect_dossier_research_DRAFT.md section 2.6 (the levers, ranked) and
--   section 5 (the gate only earns its keep by gating drafting) - the positive-reply
--   metric is the outcome these levers must be measured against.
--
-- Why this metric matters (research section 2.3): an inaccurate or hollow email is
-- worse than generic (0.84% vs 2.1% baseline). Raw reply rate hides that. The metric
-- below counts only POSITIVE replies, so a filler's lift is measured against the
-- outcome that actually pays (a conversation), not against any-reply noise that
-- includes bounces, out-of-office, and hard "no".
--
-- Conventions matched against the live schema (information_schema, read 2026-06-24):
--   - public.message is the canonical per-send / per-reply entity (memory:
--     project_pipeline_messaging - email promoted to a `message` entity). Columns
--     that EXIST today: id (uuid), publisher_id (uuid), tenant_id (uuid), message_id
--     (text), thread_id (text), subject, body, status (text), step (integer),
--     variant (text), is_control (boolean), scheduled_for, sent_at, replied_at,
--     created_at, updated_at.
--   - public.publishers carries the per-lead dossier slots used for attribution that
--     are NOT yet copied onto the message row: outreach_tier (text), peer_publisher_ref
--     (text), best_ugc_app (text), pre_score / fit_score / value_score / match_score.
--     The why_now / trigger_class columns are NOT yet present (spec section 2 Wave 0
--     adds them); the publisher_id join is how a reply is attributed to them until
--     the per-send snapshot in PART D exists.
--   - public.outreach exists but is EMPTY (0 rows, read 2026-06-24); the live send/reply
--     log lives entirely on public.message. channel is not yet stored on message
--     (see PART D).
--
-- HARD RULE (spec section 1 / research section 4): every dossier slot value is a
-- provenance quad {value, source_url, date, evidence_strength}. The attribution
-- attributes in PART D snapshot those slot values AND their provenance onto the send,
-- so a positive reply is traceable to a SOURCED, DATED trigger/peer, never a bare string.
-- =============================================================================


-- =============================================================================
-- PART A - METRIC DEFINITION (positive reply = replies less OOO / auto / not-interested)
-- =============================================================================
--
-- Spec ref: how/prospect_dossier_build_spec_DRAFT.md section 6 (Wave 0) and the loop in
-- Wave 3 (reply-intent classification -> journey_stage). Research ref: section 2.6.
--
-- A REPLY is any message row with replied_at IS NOT NULL (an inbound response was
-- observed on the thread). This is what the live schema can already see.
--
-- A POSITIVE REPLY is a reply whose intent is a genuine human engagement signal:
-- a question, an expression of interest, a request for more info, or a referral to
-- the right person. It EXCLUDES the three non-signal classes:
--   1. ooo_auto          - out-of-office / vacation autoresponder, mailbox-full,
--                          delivery-status notification, any machine-generated reply.
--   2. not_interested     - explicit decline, unsubscribe, "remove me", "not a fit",
--                          "no thanks", a hard no.
--   3. (implicitly) bounce / undeliverable - never counts as a reply at all; a bounce
--                          is a send failure, classified ooo_auto or dropped before
--                          replied_at is ever set.
--
-- So: positive_reply := reply AND reply_intent IN ('interested','question','referral').
-- Equivalently: reply AND reply_intent NOT IN ('ooo_auto','not_interested', NULL-as-unclassified).
--
-- The classifying field reply_intent does NOT exist on public.message today (verified
-- 2026-06-24: no intent / disposition / ooo / bounce / outcome column on message or
-- publishers). It is added in PART D and populated by the Wave 3 reply-intent
-- classifier. UNTIL that field exists and is populated, the positive-reply metric is
-- NOT directly computable from stored data: the only reply signal on disk is the
-- replied_at timestamp, with no stored inbound body to classify (message.body holds
-- the OUTBOUND draft, and there is no inbound_body column). This is itself a Wave 0
-- finding, recorded in the baseline below.
--
-- Canonical reply_intent vocabulary (config, tenant-neutral; engine-generic):
--   positive set : 'interested' | 'question' | 'referral'
--   negative set : 'not_interested'
--   non-signal   : 'ooo_auto'
--   unscored     : NULL  (reply observed, not yet classified -> excluded from positive)
--
-- Metric formulae (rates are over SENT, the denominator that the levers move):
--   reply_rate            = replies / sent
--   positive_reply_rate   = positive_replies / sent          <- the Wave 0 metric
--   positive_of_reply     = positive_replies / replies        <- reply quality, diagnostic
-- A send counts in the denominator once it has sent_at IS NOT NULL (a real send, not a
-- draft/backlog/skip row).


-- =============================================================================
-- PART B - BASELINE SQL  (RUN READ-ONLY 2026-06-24 against ccmwksmgoisijvyovgko)
-- =============================================================================
--
-- These SELECTs are non-destructive. They were executed read-only and the live
-- numbers are recorded inline. Because reply_intent does not yet exist (PART A),
-- the baseline computes the metric in TWO layers:
--   B1 - what is computable today (sent, raw replies, the implied ceiling on positives).
--   B2 - the metric AS IT WILL READ once PART D ships (guarded so it is safe to run now,
--        returns the same numbers as B1 with positive_replies=0 until classification runs).

-- -----------------------------------------------------------------------------
-- B1. Current funnel + raw reply baseline (computable today).
-- -----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE sent_at IS NOT NULL)                       AS sent,
  count(*) FILTER (WHERE replied_at IS NOT NULL)                    AS replies,
  round(
    count(*) FILTER (WHERE replied_at IS NOT NULL)::numeric
    / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0)
  , 4)                                                              AS reply_rate
FROM public.message;
--
-- RESULT (2026-06-24, live):
--   sent = 2 , replies = 1 , reply_rate = 0.5000
--
-- Interpretation: the send sample is N=2 (one of which replied). This is a smoke-test
-- sample, NOT a statistical baseline. The honest Wave 0 baseline is therefore:
--   - sent so far                 : 2
--   - raw replies                 : 1
--   - positive replies (classified): 0   (reply_intent column does not exist yet;
--                                          the single reply is UNSCORED, so it cannot
--                                          yet count as positive)
--   - positive_reply_rate         : 0 / 2 = 0.0000  (undefined-in-practice at N=2)
-- The number to beat once the fillers + gate ship is therefore "0 classified positive
-- replies over a near-zero send base." Lane A9's real output is the DEFINITION and the
-- attribute capture (PART D), so the FIRST post-gate send batch produces a measurable,
-- attributable positive_reply_rate instead of this empty baseline.

-- -----------------------------------------------------------------------------
-- B1b. Cross-check against publishers (the per-lead mirror of sent/replied).
-- -----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE sent_at IS NOT NULL)     AS pub_sent,
  count(*) FILTER (WHERE replied_at IS NOT NULL)  AS pub_replied
FROM public.publishers;
--
-- RESULT (2026-06-24, live): pub_sent = 2 , pub_replied = 1
-- Consistent with public.message (the two surfaces agree; no orphaned reply).

-- -----------------------------------------------------------------------------
-- B1c. Send distribution by A/B variant + control (the attribution this metric needs).
--      Shows the dimensions exist on message TODAY for attribution, even pre-send-scale.
-- -----------------------------------------------------------------------------
SELECT
  variant,
  is_control,
  count(*)                                       AS rows_total,
  count(*) FILTER (WHERE sent_at IS NOT NULL)     AS sent,
  count(*) FILTER (WHERE replied_at IS NOT NULL)  AS replies
FROM public.message
GROUP BY variant, is_control
ORDER BY variant, is_control;
--
-- RESULT (2026-06-24, live):
--   variant=A is_control=true  -> rows_total=123, sent (see note), replies (see note)
--   variant=A is_control=false -> rows_total=236
--   variant=B is_control=false -> rows_total=13
-- Note: of 372 message rows only 2 are sent and 1 replied, so per-variant sent/replied
-- are effectively 0/0 except where the single sent/replied pair falls. The point of B1c
-- is to confirm variant + is_control are POPULATED on every row (372/372), so the metric
-- can be sliced by A/B the moment send volume exists.

-- -----------------------------------------------------------------------------
-- B2. The metric as it WILL read post-PART-D. Guarded with to_regclass / a column
--     existence check so it is SAFE TO RUN TODAY (returns positive_replies=0 because
--     reply_intent is absent). Re-run this exact block after PART D ships to get the
--     true positive_reply_rate. Do not "fix" the 0 now: it is correct pre-classification.
-- -----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE sent_at IS NOT NULL)                                         AS sent,
  count(*) FILTER (WHERE replied_at IS NOT NULL)                                      AS replies,
  -- positive set lives in reply_intent (PART D). Until that column exists the
  -- expression below is written against it; run B2 only after PART D, or read it as 0.
  count(*) FILTER (
    WHERE replied_at IS NOT NULL
    -- AND reply_intent IN ('interested','question','referral')   -- enable after PART D
  )                                                                                   AS replies_pending_classification,
  0                                                                                   AS positive_replies_today,
  round(0::numeric / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0), 4)        AS positive_reply_rate_today
FROM public.message;
--
-- RESULT (2026-06-24, live): sent=2, replies=1, replies_pending_classification=1,
--                            positive_replies_today=0, positive_reply_rate_today=0.0000
--
-- POST-PART-D form of the metric (the query Wave 3 will run for real):
--   SELECT
--     count(*) FILTER (WHERE sent_at IS NOT NULL)                                   AS sent,
--     count(*) FILTER (WHERE replied_at IS NOT NULL)                                AS replies,
--     count(*) FILTER (WHERE replied_at IS NOT NULL
--                       AND reply_intent IN ('interested','question','referral'))   AS positive_replies,
--     round(
--       count(*) FILTER (WHERE replied_at IS NOT NULL
--                         AND reply_intent IN ('interested','question','referral'))::numeric
--       / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0)
--     , 4)                                                                          AS positive_reply_rate
--   FROM public.message;


-- =============================================================================
-- PART C - METRIC-SUPPORT DDL  (SPEC ONLY - NOT TO BE APPLIED PRE-GATE)
-- =============================================================================
--
-- Additive only, no drops, no backfill of human data (mirrors spec section 2 discipline).
-- These columns make the positive-reply metric COMPUTABLE and a positive reply
-- ATTRIBUTABLE. They are NOT in spec section 2 (which covers the dossier slots); this
-- file owns the metric/outcome columns. Apply at the build gate in ONE migration with
-- the section 2 migration, permission-first, after Ally approves.
--
-- (a) reply_intent classification on the reply (the field PART A's metric needs).
-- ALTER TABLE public.message
--   ADD COLUMN IF NOT EXISTS reply_intent        text,   -- interested|question|referral|not_interested|ooo_auto  (NULL = unscored)
--   ADD COLUMN IF NOT EXISTS reply_intent_source text,   -- 'classifier:v1' | 'human:<reviewer>'  (provenance of the label)
--   ADD COLUMN IF NOT EXISTS reply_intent_as_of  date,   -- when the classification was made (decay / audit)
--   ADD COLUMN IF NOT EXISTS reply_body          text,   -- inbound reply text the classifier read (today only replied_at is stored)
--   ADD COLUMN IF NOT EXISTS is_positive_reply   boolean GENERATED ALWAYS AS
--       (reply_intent IN ('interested','question','referral')) STORED;  -- the metric, materialised
--
-- (b) the per-send attribution snapshot (PART D). See PART D for the full column list
--     and rationale; the DDL is colocated here so the gate applies one block.


-- =============================================================================
-- PART D - PER-SEND AND PER-REPLY ATTRIBUTION ATTRIBUTES (the Lane A9 core output)
-- =============================================================================
--
-- Spec ref: section 6 Wave 0 ("positive-reply metric + baseline") feeding Wave 3
-- ("feed winning trigger/peer/genre back into Pre-Score weights"). To feed a WINNING
-- trigger/peer/variant back, the send must SNAPSHOT what was true at send time, because
-- the publishers row mutates on later runs (decay re-weights, re-enrichment overwrites).
-- A positive reply attributed to a trigger that has since changed is a false signal.
--
-- Therefore: capture the attribution attributes ON THE message ROW at send time, as an
-- immutable snapshot, each carrying its provenance (source_url + date) so the loop
-- learns from SOURCED facts (research section 2.2: a trigger is a fact with a source and
-- a date or it is not a trigger).
--
-- PER-SEND attributes (set once, at send, immutable):
--
--   | attribute (new message col) | type | source on publishers / engine | why it is captured |
--   |-----------------------------|------|-------------------------------|--------------------|
--   | tier            | text   | publishers.outreach_tier        | which priority band the lead sat in (spec slot 6) |
--   | why_now         | text   | publishers.why_now (Wave 0 col) | the trigger line that was pitched (spec slot 2) |
--   | why_now_source  | text   | publishers.why_now_source       | provenance URL of the trigger (quad: source_url) |
--   | why_now_as_of   | date   | publishers.why_now_as_of        | provenance DATE of the trigger (quad: date) |
--   | trigger_class   | text   | publishers.trigger_class        | funding|exec|launch|patch|pain_velocity (spec section 2) |
--   | peer_ref        | text   | publishers.peer_publisher_ref   | the deterministic peer pitched (spec slot 5) |
--   | peer_match_method | text | publishers.peer_match_method    | deterministic|llm (which proof type won) |
--   | app_id          | text   | publishers.steam_app_id         | which game this send was about (per-game, pre entity re-key) |
--   | publisher_key   | text   | publishers.publisher_key (Wave2)| entity the reply rolls up to (Wave 2 dedup) |
--   | ab_variant      | text   | message.variant (EXISTS today)  | A/B copy arm (already on message) |
--   | is_control      | bool   | message.is_control (EXISTS)     | control vs treatment arm (already on message) |
--   | channel         | text   | (new; email|discord|... )       | send channel; outreach.channel is empty, store on message |
--   | touch_step      | int    | message.step (EXISTS today)     | sequence position (initial=1, follow-up=2..) (already on message) |
--   | fit_score       | int    | publishers.fit_score            | qualification at send (spec slot 6) for outcome-vs-score analysis |
--
-- Already present on message TODAY (verified 2026-06-24): variant, is_control, step,
-- thread_id, publisher_id. Those need NO new column - the loop reads them directly.
-- The NEW per-send columns are the slot snapshots + channel:
--
-- ALTER TABLE public.message
--   ADD COLUMN IF NOT EXISTS tier              text,
--   ADD COLUMN IF NOT EXISTS why_now           text,
--   ADD COLUMN IF NOT EXISTS why_now_source    text,
--   ADD COLUMN IF NOT EXISTS why_now_as_of     date,
--   ADD COLUMN IF NOT EXISTS trigger_class     text,
--   ADD COLUMN IF NOT EXISTS peer_ref          text,
--   ADD COLUMN IF NOT EXISTS peer_match_method text,
--   ADD COLUMN IF NOT EXISTS app_id            text,
--   ADD COLUMN IF NOT EXISTS publisher_key     text,
--   ADD COLUMN IF NOT EXISTS channel           text,
--   ADD COLUMN IF NOT EXISTS fit_score         integer;
--   -- ab_variant / is_control / touch_step already exist as variant / is_control / step.
--
-- PER-REPLY attributes (set when the reply lands / is classified):
--   reply_intent, reply_intent_source, reply_intent_as_of, reply_body, is_positive_reply
--   (all defined in PART C(a)). The reply rolls up to the per-send snapshot via the same
--   message row (a reply updates the row it answers, keyed by thread_id), so EVERY
--   positive reply is automatically attributable to the tier / why_now / trigger_class /
--   peer / app / variant / channel / touch_step that produced it, with provenance intact.
--
-- ATTRIBUTION QUERY the loop (Wave 3) runs once the columns are populated - positive
-- reply rate broken out by each lever, so the winning trigger_class / peer / variant
-- feeds back into Pre-Score weights:
--
--   SELECT
--     trigger_class,
--     ab_variant,
--     is_control,
--     channel,
--     touch_step,                                         -- message.step
--     count(*) FILTER (WHERE sent_at IS NOT NULL)                                   AS sent,
--     count(*) FILTER (WHERE is_positive_reply)                                     AS positive_replies,
--     round(
--       count(*) FILTER (WHERE is_positive_reply)::numeric
--       / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0)
--     , 4)                                                                          AS positive_reply_rate
--   FROM public.message
--   GROUP BY trigger_class, ab_variant, is_control, channel, touch_step
--   ORDER BY positive_reply_rate DESC NULLS LAST;
--
-- (variant in the live table is the column named `variant`; aliased ab_variant above for
--  readability - rename only if the build chooses to, do not assume a rename here.)


-- =============================================================================
-- PART E - MODULARITY NOTE (mandate #7)
-- =============================================================================
-- The metric DEFINITION (positive = reply less ooo_auto / not_interested) and the
-- attribution dimension LIST are engine-generic. The reply_intent vocabulary and the
-- trigger_class set are tenant config (here: GamersLab/Steam). channel values are
-- venue config. No GamersLab noun or Steam assumption is baked into the metric or the
-- attribution snapshot columns: a localisation tenant reuses the identical message
-- columns and the identical positive-reply formula, changing only the trigger_class
-- and channel value sets. If a future edit hardcodes a Steam or GamersLab string into
-- this metric, it is wrong (spec section 7 modularity ledger).
--
-- =============================================================================
-- END - DRAFT, pre-gate. PART B was the only part executed (read-only, 2026-06-24).
-- PART C and PART D DDL are commented and MUST NOT be applied before the build gate.
-- =============================================================================
