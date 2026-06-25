// =============================================================================
// Filler 6 - Two-sided qualification scorer   (DRAFT, PRE-GATE - NOT applied to live v10)
// =============================================================================
// Spec:    how/prospect_dossier_build_spec_DRAFT.md  4.6 (this node, authoritative),
//          1 (provenance quad), 4 preamble (placement + venue-adapter/config seam),
//          7 modularity ledger row "6 qual" (rubric weights = tenant config; scorer = generic).
// Why:     how/prospect_dossier_research_DRAFT.md  2.1 (Fit x Intent x Timing - the deal is
//          timing, not just fit), 2.6 (two-sided qualification = right-prospect targeting +
//          the disqualifier that saves spend), 2.2 (a trigger decays; freshness is weighted).
//
// PLACEMENT (spec 4 preamble): a Code node added to the live engine MouIeDmDAAHKIpDn between
//   `Merge All Data` and `Build Final Record`. It runs AFTER the earlier fillers in the band
//   (4.1 demand -> 4.2 why-now -> 4.3 contact -> 4.4 human -> 4.5 peer -> THIS, 4.6 qual), so
//   it can read their slot outputs (evidence_*, why_now*, peer_*, contact_is_named) off the
//   merged record. Per spec 6 build sequence, qualification is the LAST filler (value/cost order).
//   Node name (suggested): "Filler 6 - Qualification".
//   Node type: n8n-nodes-base.code (Run Once for Each Item). No network call (spec 7: venue
//   adapter = "(none)" for this filler), so it is pure + free-tier by construction (mandate #8).
//
// WHAT IT COMPUTES (spec 4.6):
//   fit = w1 * value_to_client + w2 * prospect_match     (defaults w1 = w2 = 0.5; weights CONFIG)
//   - value_to_client  ("value_score")  = how much THIS prospect is worth to GamersLab, from the
//                                          Steam FIT facts (audience size, genre/feature fit, the
//                                          UGC surface area we can light up). "Should we sell to
//                                          them at all" (research 2.1 Fit axis).
//   - prospect_match   ("match_score")  = how READY/relevant they are right now, from the slot-2
//                                          why-now trigger and slot-3 demand signal (Intent x
//                                          Timing, research 2.1). Decay-weighted so a stale
//                                          trigger counts for less (research 2.2 "dead data").
//   fit_score = round( w1*value_score + w2*match_score ).  All three persisted 0..100 integers.
//
// WRITES (spec 4.6 -> live public.publishers columns):
//   fit_score            integer  (EXISTING col)  - the blended two-sided score, 0..100
//   value_score          integer  (EXISTING col)  - value_to_client sub-score, 0..100
//   match_score          integer  (EXISTING col)  - prospect_match sub-score, 0..100
//   score_rationale      text     (EXISTING col)  - one-line human-readable "why this score"
//   dimension_breakdown  jsonb    (NEW col, spec 2 Wave 0) - per-dimension contributions + weights
//   risk_flags           jsonb    (EXISTING col)  - PRESERVED + appended (flag-never-suppress, N5)
//   outreach_tier        text     (EXISTING col)  - RE-DERIVED from fit (spec 4.6 "tier order now
//                                                    reflects fit, not just pre-LLM Steam flags")
//   recommended_action   text     (EXISTING col)  - set ONLY for a hard disqualifier (saves spend);
//                                                    otherwise PRESERVED for the drafter/gate to set.
//
// SCHEMA NOTE (verified live ccmwksmgoisijvyovgko 2026-06-24): fit_score / value_score /
//   match_score are all `integer`; score_rationale `text`; risk_flags `jsonb`; outreach_tier
//   `text`; recommended_action `text`. dimension_breakdown is NOT yet present (correct: it ships
//   in the spec 2 Wave-0 migration which this DRAFT does NOT apply). Build Final Record already
//   JSON.stringify()s jsonb columns (risk_flags) before the Postgres upsert; this node hands it
//   real JS objects/arrays on the jsonb keys and lets the existing serialiser carry them. To stay
//   robust whether this node sits before OR after Build Final Record, the serialisation of
//   dimension_breakdown / risk_flags is conditional (see SERIALISE at the bottom).
//
// PROVENANCE INTERACTION (spec 1): this filler does NOT mint new sourced facts; it SCORES facts the
//   other fillers already grounded. So it consumes provenance rather than producing it: a trigger
//   or demand slot only contributes to match_score when it is non-empty AND grounded
//   (evidence_strength != 'none', has a date). An ungrounded slot scores 0 on its dimension - the
//   same rule the coverage gate (spec 3) enforces, applied here as "no points for an empty quad".
//
// RISK FLAGS (spec 4.6 "risk_flags (flag-never-suppress, unchanged)"; research 2.6 disqualifier):
//   We NEVER drop or overwrite an existing risk flag. We may APPEND newly-detected anti-fit flags
//   (e.g. sunset / inactive / no-online-surface). A flag lowers the score and, for a HARD
//   disqualifier only, sets recommended_action; it never silently suppresses the lead.
//
// MODULARITY (mandate #7, spec 7): the rubric WEIGHTS + thresholds below = TENANT CONFIG (derived
//   from the CAG: what GamersLab values + what counts as fit). The scorer (normalise -> weight ->
//   blend -> tier) = ENGINE-GENERIC. No GamersLab noun and no Steam assumption lives below the
//   CONFIG block: every Steam-specific field is read through the FACTS adapter at the top, so a new
//   venue swaps FACTS + CONFIG, not the scorer. A localisation client (research 7) keeps this exact
//   scorer and supplies different weights + a different value/match feature read.
// =============================================================================


// ---------------------------------------------------------------------------
// CONFIG  (spec 4.6 "rubric weights = tenant config (from CAG)"). Tenant-overridable.
// Every tunable lives here so onboarding a client edits config, never engine code.
// ---------------------------------------------------------------------------
const CONFIG = {
  // ---- the two-sided blend (spec 4.6: fit = w1*value_to_client + w2*prospect_match) ----
  // Defaults w1 = w2 = 0.5 per spec. Kept as a normalised pair; if a tenant supplies weights
  // that do not sum to 1 we renormalise (engine-generic), so config stays declarative.
  WEIGHTS: {
    value_to_client: 0.5,   // w1
    prospect_match:  0.5,   // w2
  },

  // ---- value_to_client sub-dimensions (the FIT axis, research 2.1) ----
  // "Is this an org GamersLab should ever sell to, and how much is it worth?" Built from Steam
  // facts (audience reach + the UGC surface area our community tooling can light up). Each
  // dimension yields a 0..1 contribution; `weight` is its share of value_score. Weights within
  // this block are relative and renormalised by the scorer.
  VALUE_DIMENSIONS: {
    // Audience reach: more players => a live, addressable community => more value. Banded on
    // total_reviews (a cheap public proxy for owners; same signal Pre-Score uses). Tenant config.
    audience: {
      weight: 0.40,
      // [threshold, contribution] bands, evaluated high-to-low; first match wins.
      bands: [
        [50000, 1.00],   // very large player base
        [5000,  0.85],
        [500,   0.60],
        [50,    0.35],
        [0,     0.10],   // tiny but non-zero
      ],
    },
    // UGC / community surface: GamersLab sells trackers/leaderboards/companion/tournament tooling.
    // A game that already exposes the matching Steam features is worth more (clean integration
    // surface, proven appetite). Each present flag adds its share; capped at 1.0. TENANT CONFIG:
    // the flag -> weight map is GamersLab's offering map, read generically by the scorer.
    ugc_surface: {
      weight: 0.40,
      flags: {
        has_online_pvp:         0.35,   // rivalry/ladder/tournament surface
        has_steam_leaderboards: 0.30,   // direct leaderboard/stat surface
        has_online_coop:        0.15,   // co-op community surface
        has_steam_workshop:     0.10,   // mod/community surface
        has_multi_player:       0.10,   // generic multiplayer baseline
      },
    },
    // Genre fit: competitive/multiplayer-leaning genres are the strongest fit for community
    // tooling. A keyword match on primary_genre + steam_tags. TENANT CONFIG (GamersLab ICP).
    genre_fit: {
      weight: 0.20,
      strong_terms: ['action', 'shooter', 'fps', 'fighting', 'racing', 'sports', 'moba',
                     'battle royale', 'survival', 'roguelike', 'card', 'strategy', 'rpg',
                     'co-op', 'pvp', 'competitive', 'multiplayer', 'arena'],
      strong_contribution: 1.00,
      weak_contribution:   0.35,   // a genre with no strong term still has some baseline value
    },
  },

  // ---- prospect_match sub-dimensions (the INTENT x TIMING axis, research 2.1-2.2) ----
  // "Are they ready NOW, and do their players ask for what we offer?" Built from the slot-2
  // why-now trigger and the slot-3 demand signal that the EARLIER fillers grounded. A slot only
  // scores when it is grounded (has a date, evidence_strength != 'none') - an empty quad = 0.
  MATCH_DIMENSIONS: {
    // Why-now trigger (slot 2). Base contribution by evidence_strength, then multiplied by the
    // freshness decay weight already computed in Filler 2 (evidence_decay_weight). A stale trigger
    // therefore contributes less, matching research 2.2 "signals aged past their window are dead".
    why_now: {
      weight: 0.55,
      strength_base: { explicit: 1.00, inferred: 0.60, none: 0.0 },
      // if a trigger is grounded but carries no decay weight, assume mild freshness (not stale).
      default_decay: 0.6,
    },
    // Demand signal (slot 3): players asking, in their own dated words, for what we offer.
    // The highest-converting personalization (research 2.3). Same grounded-only + decay rule.
    demand: {
      weight: 0.45,
      strength_base: { explicit: 1.00, inferred: 0.55, none: 0.0 },
      default_decay: 0.6,
    },
  },

  // ---- contact bump (spec 4.3/4.6: a named contact RAISES the priority score, NEVER gates) ----
  // Per D-b, contact is non-blocking. A named decision-maker lifts the blended fit_score by a
  // small fixed bump (additive, capped at 100). Engine-generic; the bump size is tenant config.
  NAMED_CONTACT_BUMP: 6,

  // ---- fit-aware tier thresholds (spec 4.6: "tier order now reflects fit, not just pre-LLM
  // Steam flags"). The Pre-Score node assigns A/B/C/skip from review counts ALONE; here we
  // RE-DERIVE outreach_tier from the blended fit_score so a high-fit, high-intent lead can rise
  // and a large-but-irrelevant one can fall. Thresholds on the 0..100 fit_score. Tenant config.
  TIER_THRESHOLDS: { A: 60, B: 40, C: 20 },   // below C => 'skip'

  // ---- hard-disqualifier flags (research 2.6 "the disqualifier that saves spend"). Detected
  // anti-fit conditions. A HARD flag sets recommended_action='disqualified' (spend saved) but
  // NEVER deletes the row or suppresses an existing flag - it is appended and surfaced. A SOFT
  // flag only lowers the score. Tenant config: which conditions count as anti-fit.
  HARD_DISQUALIFY_ACTIONS: true,   // emit recommended_action on a hard flag (else just flag+lower)
};


// ---------------------------------------------------------------------------
// FACTS ADAPTER (the ONLY venue-aware read). Maps the merged record's Steam-shaped fields onto
// venue-neutral names the scorer uses. Swap this block (and CONFIG) for a different venue; the
// scorer below never names a Steam field. Field names match build-final-record.APPLIED.js (src.*)
// and the earlier fillers' outputs, verified against live publishers cols 2026-06-24.
// ---------------------------------------------------------------------------
const rec = $input.item.json;

const toNum  = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const toBool = (v) => v === true || v === 'true';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp100 = (x) => Math.max(0, Math.min(100, x));

const FACTS = {
  // value (fit) facts
  total_reviews:          toNum(rec.total_reviews),
  primary_genre:          String(rec.primary_genre || ''),
  steam_tags:             String(rec.steam_tags || ''),
  flags: {
    has_online_pvp:         toBool(rec.has_online_pvp),
    has_steam_leaderboards: toBool(rec.has_steam_leaderboards),
    has_online_coop:        toBool(rec.has_online_coop),
    has_steam_workshop:     toBool(rec.has_steam_workshop),
    has_multi_player:       toBool(rec.has_multi_player),
  },
  game_phase:             String(rec.game_phase || ''),
  avg_playtime_2weeks:    toNum(rec.avg_playtime_2weeks),

  // match (intent x timing) facts, grounded by the earlier fillers
  why_now:                String(rec.why_now || ''),
  why_now_as_of:          rec.why_now_as_of || null,
  trigger_class:          rec.trigger_class || null,
  // Filler 2 does not emit a per-trigger evidence_strength; a grounded why_now (value+date) is
  // treated as 'explicit' when it carries a real news/url source and 'inferred' when it rests on
  // a synthetic steam: token (release_date / velocity). Engine-generic read below.
  why_now_source:         String(rec.why_now_source || ''),
  // slot-2 decay is its OWN column (filler-2 writes why_now_decay_weight); demand uses
  // evidence_decay_weight below. The two never share a decay column (review conflict 1).
  why_now_decay_weight:   (rec.why_now_decay_weight === null || rec.why_now_decay_weight === undefined)
                            ? null : Number(rec.why_now_decay_weight),

  evidence_strength:      ['explicit', 'inferred', 'none'].includes(rec.evidence_strength)
                            ? rec.evidence_strength : 'none',
  evidence_quote:         String(rec.evidence_quote || ''),
  evidence_as_of:         rec.evidence_as_of || null,
  evidence_decay_weight:  (rec.evidence_decay_weight === null || rec.evidence_decay_weight === undefined)
                            ? null : Number(rec.evidence_decay_weight),

  // contact (non-blocking score input from Filler 1)
  contact_is_named:       toBool(rec.contact_is_named),

  // existing risk flags to PRESERVE. Build Final Record stores risk_flags as jsonb; upstream it
  // may already be a JS array (pre-serialise) or a JSON string (post-serialise). Read either.
  existing_risk_flags:    parseFlags(rec.risk_flags),
};

function parseFlags(v) {
  if (Array.isArray(v)) return v.filter(f => f && f.flag);
  if (typeof v === 'string' && v.trim()) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter(f => f && f.flag) : []; }
    catch (_e) { return []; }
  }
  return [];
}


// ---------------------------------------------------------------------------
// ENGINE-GENERIC SCORER. No venue/tenant nouns below this line - everything reads CONFIG + FACTS.
// ---------------------------------------------------------------------------

// renormalise a {key: weight} map so its weights sum to 1 (declarative config -> safe math).
function normWeights(obj) {
  const sum = Object.values(obj).reduce((a, w) => a + (Number(w) || 0), 0);
  if (!sum) return obj;
  const out = {};
  for (const k of Object.keys(obj)) out[k] = (Number(obj[k]) || 0) / sum;
  return out;
}

// band lookup: highest threshold whose value <= x wins (bands are [threshold, contribution]).
function bandValue(x, bands) {
  for (const [thresh, contrib] of bands) if (x >= thresh) return contrib;
  return 0;
}

// ---- value_to_client (FIT) ----
const valDims = CONFIG.VALUE_DIMENSIONS;
const valW = normWeights({
  audience:    valDims.audience.weight,
  ugc_surface: valDims.ugc_surface.weight,
  genre_fit:   valDims.genre_fit.weight,
});

// audience (0..1)
const audienceContrib = clamp01(bandValue(FACTS.total_reviews, valDims.audience.bands));

// ugc surface (0..1): sum of present-flag weights, capped at 1.
let ugcContrib = 0;
const ugcPresent = [];
for (const [flag, w] of Object.entries(valDims.ugc_surface.flags)) {
  if (FACTS.flags[flag]) { ugcContrib += w; ugcPresent.push(flag); }
}
ugcContrib = clamp01(ugcContrib);

// genre fit (0..1): strong if any strong term appears in genre+tags, else weak baseline.
const genreHay = (FACTS.primary_genre + ' ' + FACTS.steam_tags).toLowerCase();
const genreStrong = valDims.genre_fit.strong_terms.some(t => genreHay.includes(t));
const genreContrib = clamp01(genreStrong
  ? valDims.genre_fit.strong_contribution
  : valDims.genre_fit.weak_contribution);

const value_unit =
  valW.audience    * audienceContrib +
  valW.ugc_surface * ugcContrib +
  valW.genre_fit   * genreContrib;
const value_score = Math.round(clamp100(value_unit * 100));

// ---- prospect_match (INTENT x TIMING) ----
const matchDims = CONFIG.MATCH_DIMENSIONS;
const matchW = normWeights({
  why_now: matchDims.why_now.weight,
  demand:  matchDims.demand.weight,
});

// why-now (slot 2): grounded only (value + date). Strength inferred from source type, then decayed.
let whyNowContrib = 0;
let whyNowGrounded = false;
if (FACTS.why_now && FACTS.why_now_as_of) {
  whyNowGrounded = true;
  // strength_rule (canonical: config/trigger-classes.DRAFT.json): http(s) source => 'explicit';
  // synthetic steam: token => 'inferred'. This is the single definition of the slot-2 split.
  const isExternal = /^https?:\/\//i.test(FACTS.why_now_source);
  const strength = isExternal ? 'explicit' : 'inferred';
  const base = matchDims.why_now.strength_base[strength] || 0;
  // why-now decay is its OWN column; demand uses evidence_decay_weight (review conflict 1).
  const decay = (FACTS.why_now_decay_weight !== null && Number.isFinite(FACTS.why_now_decay_weight))
    ? clamp01(FACTS.why_now_decay_weight)
    : matchDims.why_now.default_decay;
  whyNowContrib = clamp01(base * decay);
}

// demand (slot 3): grounded only (evidence_strength != 'none' AND dated). Decay-weighted.
let demandContrib = 0;
let demandGrounded = false;
if (FACTS.evidence_strength !== 'none' && FACTS.evidence_quote && FACTS.evidence_as_of) {
  demandGrounded = true;
  const base = matchDims.demand.strength_base[FACTS.evidence_strength] || 0;
  const decay = (FACTS.evidence_decay_weight !== null && Number.isFinite(FACTS.evidence_decay_weight))
    ? clamp01(FACTS.evidence_decay_weight)
    : matchDims.demand.default_decay;
  demandContrib = clamp01(base * decay);
}

const match_unit =
  matchW.why_now * whyNowContrib +
  matchW.demand  * demandContrib;
const match_score = Math.round(clamp100(match_unit * 100));

// ---- the two-sided blend (spec 4.6: fit = w1*value + w2*match) ----
const W = normWeights({
  value_to_client: CONFIG.WEIGHTS.value_to_client,
  prospect_match:  CONFIG.WEIGHTS.prospect_match,
});
let fit_unit = W.value_to_client * (value_score / 100) + W.prospect_match * (match_score / 100);

// named-contact bump (additive, non-blocking; spec 4.3/4.6).
let contactBumpApplied = 0;
if (FACTS.contact_is_named) {
  contactBumpApplied = CONFIG.NAMED_CONTACT_BUMP;
}
let fit_score = Math.round(clamp100(fit_unit * 100 + contactBumpApplied));


// ---------------------------------------------------------------------------
// RISK FLAGS (flag-never-suppress, spec 4.6 / N5). PRESERVE existing, APPEND newly-detected.
// A soft flag lowers the score; a hard flag also drives recommended_action='disqualified'.
// ---------------------------------------------------------------------------
const risk_flags = FACTS.existing_risk_flags.slice();   // never drop an existing flag
const haveFlag = (name) => risk_flags.some(f => f.flag === name);

let hardDisqualify = false;

// inactive / sunset: zero recent playtime on a game with reviews, or an explicit sunset phase.
if (!haveFlag('inactive') &&
    (FACTS.game_phase === 'sunset' || (FACTS.avg_playtime_2weeks === 0 && FACTS.total_reviews > 0))) {
  risk_flags.push({ flag: 'inactive', evidence: 'sunset / zero recent playtime', source: '' });
}
// no online/community surface: none of the UGC flags present => little for our tooling to attach to.
if (!haveFlag('no_online_surface') && ugcPresent.length === 0) {
  risk_flags.push({ flag: 'no_online_surface', evidence: 'no multiplayer/leaderboard/workshop flags', source: '' });
}

// HARD disqualifier (research 2.6 "saves spend"): inactive AND no online surface = nothing to sell.
// Flag is already present/appended above; here we only decide the spend-saving action. We do NOT
// suppress: the row, its score, and every flag remain visible.
if (haveFlag('inactive') && haveFlag('no_online_surface')) hardDisqualify = true;

// a flagged lead is down-weighted (each flag shaves the blended score; soft pressure, not a veto).
if (risk_flags.length) {
  const penalty = Math.min(20, risk_flags.length * 8);   // capped; never below 0
  fit_score = Math.round(clamp100(fit_score - penalty));
}


// ---------------------------------------------------------------------------
// FIT-AWARE TIER (spec 4.6: "tier order now reflects fit, not just pre-LLM Steam flags").
// Re-derive outreach_tier from the blended fit_score, overriding the review-count-only tier the
// Pre-Score node set. We record BOTH so the change is auditable in dimension_breakdown.
// ---------------------------------------------------------------------------
const pre_tier = rec.outreach_tier || 'skip';   // the review-count tier from Pre-Score
let outreach_tier;
if      (hardDisqualify)                       outreach_tier = 'skip';
else if (fit_score >= CONFIG.TIER_THRESHOLDS.A) outreach_tier = 'A';
else if (fit_score >= CONFIG.TIER_THRESHOLDS.B) outreach_tier = 'B';
else if (fit_score >= CONFIG.TIER_THRESHOLDS.C) outreach_tier = 'C';
else                                            outreach_tier = 'skip';


// ---------------------------------------------------------------------------
// RATIONALE + DIMENSION BREAKDOWN (spec 4.6 writes). score_rationale = one human line;
// dimension_breakdown = the per-dimension contributions + weights, for audit + the UI board.
// ---------------------------------------------------------------------------
const pct = (x) => Math.round(x * 100);

const rationaleBits = [];
rationaleBits.push(`value ${value_score} (audience ${pct(audienceContrib)}%, `
  + `ugc ${pct(ugcContrib)}%${ugcPresent.length ? ' [' + ugcPresent.join(',') + ']' : ''}, `
  + `genre ${genreStrong ? 'strong' : 'weak'})`);
rationaleBits.push(`match ${match_score} (`
  + `why-now ${whyNowGrounded ? pct(whyNowContrib) + '%' : 'none'}, `
  + `demand ${demandGrounded ? pct(demandContrib) + '%' : 'none'})`);
if (FACTS.contact_is_named) rationaleBits.push(`named contact +${contactBumpApplied}`);
if (risk_flags.length)      rationaleBits.push(`flags: ${risk_flags.map(f => f.flag).join(',')}`);
if (outreach_tier !== pre_tier) rationaleBits.push(`tier ${pre_tier}->${outreach_tier} (fit-aware)`);
const score_rationale = `fit ${fit_score} = ${Math.round(W.value_to_client * 100)}%*value `
  + `+ ${Math.round(W.prospect_match * 100)}%*match. ` + rationaleBits.join('; ') + '.';

const dimension_breakdown = {
  schema: 'fillerb6.qualification.v1',
  weights: { w1_value_to_client: W.value_to_client, w2_prospect_match: W.prospect_match },
  fit_score,
  value_to_client: {
    score: value_score,
    dimensions: {
      audience:    { weight: valW.audience,    contribution: audienceContrib, input: { total_reviews: FACTS.total_reviews } },
      ugc_surface: { weight: valW.ugc_surface, contribution: ugcContrib,      present_flags: ugcPresent },
      genre_fit:   { weight: valW.genre_fit,   contribution: genreContrib,    strong: genreStrong, genre: FACTS.primary_genre },
    },
  },
  prospect_match: {
    score: match_score,
    dimensions: {
      why_now: { weight: matchW.why_now, contribution: whyNowContrib, grounded: whyNowGrounded,
                 trigger_class: FACTS.trigger_class, as_of: FACTS.why_now_as_of,
                 decay: FACTS.why_now_decay_weight },
      demand:  { weight: matchW.demand,  contribution: demandContrib, grounded: demandGrounded,
                 evidence_strength: FACTS.evidence_strength, as_of: FACTS.evidence_as_of,
                 decay: FACTS.evidence_decay_weight },
    },
  },
  contact: { named: FACTS.contact_is_named, bump: contactBumpApplied },
  risk_flags,                       // mirrored here too (audit); the column is written separately
  tier: { pre_score_tier: pre_tier, fit_tier: outreach_tier, hard_disqualify: hardDisqualify },
};


// ---------------------------------------------------------------------------
// recommended_action (spec 4.6): set ONLY for a hard disqualifier (saves spend). Otherwise we
// PRESERVE whatever upstream set, so the drafter / coverage gate (spec 3) remains the owner of
// the draft/hold/enrich decision. We never overwrite a non-empty action with a weaker one.
// ---------------------------------------------------------------------------
let recommended_action = rec.recommended_action || '';
if (hardDisqualify && CONFIG.HARD_DISQUALIFY_ACTIONS) recommended_action = 'disqualified';

// reject_reason_code companion (existing text col) when we disqualify - keeps the WHY queryable.
let reject_reason_code = rec.reject_reason_code || '';
if (hardDisqualify && !reject_reason_code) reject_reason_code = 'inactive_no_surface';


// ---------------------------------------------------------------------------
// SERIALISE jsonb conditionally (see SCHEMA NOTE). If this node runs BEFORE Build Final Record,
// hand it JS objects and let that node's existing JSON.stringify carry them. If it runs AFTER
// (its output goes straight to the Postgres upsert), the upstream record's risk_flags is already
// a string - so we mirror that shape. Detect by whether the incoming risk_flags was a string.
// ---------------------------------------------------------------------------
const upstreamSerialised = (typeof rec.risk_flags === 'string');
const out_risk_flags         = upstreamSerialised ? JSON.stringify(risk_flags)         : risk_flags;
const out_dimension_breakdown = upstreamSerialised ? JSON.stringify(dimension_breakdown) : dimension_breakdown;


// ---------------------------------------------------------------------------
// RETURN: spread the incoming record, overwrite ONLY the slot-6 keys. Downstream Build Final
// Record / Upsert to Supabase carry these to the matching publishers columns by name.
// ---------------------------------------------------------------------------
return [{ json: {
  ...rec,
  fit_score,                 // integer 0..100, the blended two-sided score
  value_score,               // integer 0..100, value_to_client sub-score
  match_score,               // integer 0..100, prospect_match sub-score
  score_rationale,           // text, one-line human rationale
  dimension_breakdown: out_dimension_breakdown,   // jsonb (or string if post-serialise band)
  risk_flags:          out_risk_flags,            // jsonb, PRESERVED + appended (flag-never-suppress)
  outreach_tier,             // text, RE-DERIVED from fit (spec 4.6)
  recommended_action,        // text, set only on hard disqualifier; else preserved
  reject_reason_code,        // text companion for a disqualifier
  // non-persisted breadcrumbs (safe to drop before upsert if the Postgres node is strict):
  _qual: {
    value_score, match_score, fit_score,
    weights: { w1: W.value_to_client, w2: W.prospect_match },
    pre_tier, fit_tier: outreach_tier, hard_disqualify: hardDisqualify,
    why_now_grounded: whyNowGrounded, demand_grounded: demandGrounded,
  },
}}];

// =============================================================================
// ACCEPTANCE (spec 4.6): new rows carry a NON-FLAT fit_score that differentiates tiers and a
//   stored breakdown; tier order changes vs pre-score-only on a sample. READ-ONLY checks after a
//   (later, gated) run:
//
//   -- fit_score is not flat and breakdown is stored:
//   SELECT count(*)                                   AS rows,
//          count(DISTINCT fit_score)                  AS distinct_fit,
//          count(*) FILTER (WHERE dimension_breakdown IS NOT NULL) AS with_breakdown,
//          round(avg(fit_score)::numeric, 1)          AS avg_fit
//   FROM public.publishers WHERE created_at > '<run_ts>';
//
//   -- fit-aware tier actually reorders vs the review-count Pre-Score tier:
//   SELECT outreach_tier,
//          dimension_breakdown->'tier'->>'pre_score_tier' AS pre_tier,
//          count(*)
//   FROM public.publishers
//   WHERE created_at > '<run_ts>'
//   GROUP BY 1, 2 ORDER BY 1, 2;
//   -- expect off-diagonal rows (pre_tier != outreach_tier): tier reflects fit, not just reviews.
//
//   -- flag-never-suppress held (disqualifiers are flagged + visible, not deleted):
//   SELECT recommended_action, count(*),
//          count(*) FILTER (WHERE jsonb_array_length(risk_flags) > 0) AS with_flags
//   FROM public.publishers WHERE created_at > '<run_ts>' GROUP BY 1;
// =============================================================================
