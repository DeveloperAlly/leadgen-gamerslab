// =============================================================================
// T1 - Draft Repair (poc_fix_backlog T1 / D1 ; prospect_dossier_build_spec wave 0)
// =============================================================================
// STATUS: DRAFT, PRE-GATE. NOT APPLIED. Do NOT deploy via update_workflow /
//   publish_workflow. No Supabase migration. This file is a build target only,
//   to be reviewed and applied by a human at a separate build gate
//   (root CLAUDE.md non-negotiable #1; poc_fix_backlog.md §0).
//
// TARGET WORKFLOW: live v10 `MouIeDmDAAHKIpDn` (GamersLab Publisher Outreach v10).
// TWO NODES are patched, both on the draft path:
//   PATCH A -> replaces node `Pick Best LLM Response`  (adds ONE empty-A/B retry)
//   PATCH B -> replaces node `Build Final Record`      (never stamp empty A/B as draft)
// Apply each PATCH block as the jsCode of its named node. They are independent of
// each other; PATCH B is safe on its own, PATCH A makes the retry that feeds it.
//
// DEFECT (verified live 2026-06-24 via get_workflow_details on MouIeDmDAAHKIpDn):
//   - `Pick Best LLM Response` accepts a parse if ANY ONE of
//     intel_summary / pain_signal / draft_body is present, so an intel-only reply
//     with an EMPTY draft_body passes the guard (poc_fix_backlog T1 root cause (1)).
//   - On total parse failure it emits the archive fallback _parsed
//     { intel_quality:'no_signal', fit_score:0, recommended_action:'archive' }
//     (root cause (2)).
//   - `Build Final Record` then sets
//       pipeline_status = (outreach_tier==='skip' || _weak) ? 'skip' : 'draft'
//     with NO check that draft_body is non-empty -> A/B rows get stamped 'draft'
//     with an empty body (the 75% empty-draft rate; spec §3, research §5).
//
// FIX (poc_fix_backlog T1 Target/DoD ; spec §3 routing, §0 D-f budget):
//   1. PATCH A: when outreach_tier is A or B and the accepted parse has an EMPTY
//      draft_body, fire exactly ONE retry with the NEXT free model from the roster
//      already fetched upstream, then re-evaluate. Stay at <= 1 retry/lead.
//   2. PATCH B: when outreach_tier is A or B and the final body is empty, route to
//      warm_queue / backlog (recommended_action='warm_queue', pipeline_status NOT
//      'draft') instead of stamping a hollow 'draft'.
//   NET: never persist a `draft`-status row with an empty draft_body on A/B.
//
// GUARDRAILS HONOURED (poc_fix_backlog T1 + this task):
//   - Tier C / `skip` extract-only branch is UNTOUCHED (only A/B tiers gated/retried).
//   - DRAFT_BUDGET is NOT raised (free-cap). At most ONE model call + ONE retry per
//     A/B lead -> <= 2 OpenRouter calls/lead, stays under the 50/day free ceiling.
//   - Free models only: the retry reuses the existing `:free` roster from
//     `Filter Free Models` / `Prepare LLM Items` (no paid id introduced).
//   - No em dashes / en dashes in generated copy (existing pipeline rule; the
//     dedash() helper in PATCH B is carried over verbatim from live).
//
// ACCEPTANCE TEST (run AFTER a human applies this at the build gate; read-only here):
//   Trigger one discovery run, then:
//     SELECT outreach_tier,
//            count(*) FILTER (WHERE draft_body <> '') AS bodies,
//            count(*) AS total
//     FROM publishers
//     WHERE pipeline_status='draft'
//     GROUP BY 1;
//   PASS = A+B body-rate >= 80% of A+B draft rows AND zero draft-status rows with
//   an empty body (poc_fix_backlog T1 Acceptance test).
//
// VERIFICATION DONE FOR THIS DRAFT (read-only, no deploy / no migration):
//   - Live node bodies of `Pick Best LLM Response` and `Build Final Record` read
//     from get_workflow_details(MouIeDmDAAHKIpDn) 2026-06-24 and matched against
//     poc_fix_backlog T1 + spec §3.
//   - Column types confirmed live in public.publishers (project ccmwksmgoisijvyovgko):
//     pipeline_status text, recommended_action text, outreach_tier text,
//     draft_body text, draft_subject text, model_used text, fit_score integer.
//   - Call path confirmed: `LLM: Intel + Draft` POSTs `_payload` (models[] max 3)
//     to `$('Get Model Key').first().json.base_url`/chat/completions with Bearer
//     `$('Get Model Key').first().json.api_key`, neverError:true; output feeds
//     `Pick Best LLM Response` -> `Build Final Record` -> `Add B Variant` ->
//     `Upsert to Supabase` (autoMapInputData). The retry below reuses exactly that
//     base_url + api_key + payload shape, so no new node/credential is required.
// =============================================================================


// =============================================================================
// PATCH A  ->  node `Pick Best LLM Response`   (n8n Code node, runOnceForAllItems)
// -----------------------------------------------------------------------------
// Adds the ONE empty-A/B retry. Everything outside the new RETRY block is the live
// behaviour preserved verbatim (tolerant JSON slice, one-field accept guard, the
// archive fallback). The retry is in-node `fetch` (n8n Code nodes expose fetch /
// $http; fetch is used here for an explicit, reviewable call) so NO graph node is
// added - keeps this a pure node-body swap a human can paste and publish.
// =============================================================================

const items = $input.all();
const meta  = $('Prepare LLM Items').first().json;

// --- helpers (engine-generic) ------------------------------------------------
// Tolerant JSON slice, identical to live: take the outermost {...} and parse.
function sliceParse(raw) {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(raw.substring(start, end + 1)); } catch (e) { return null; }
}
// Live accept guard: a parse counts if ANY of these three is present.
function hasAnySignal(p) {
  return !!(p && (p.intel_summary || p.pain_signal || p.draft_body));
}
// Pull the model text out of an OpenRouter choice the same way live does.
function rawFromChoice(choice) {
  if (!choice || !choice.message) return '';
  const msg = choice.message;
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content;
  if (typeof msg.reasoning === 'string') return msg.reasoning;
  return '';
}

// Tier of THIS lead. Only A/B run the full draft prompt and earn a retry; C/skip
// are extract-only and MUST NOT be retried (guardrail: do not touch C branch).
const __tier = (meta && meta._source && meta._source.outreach_tier) ? meta._source.outreach_tier : 'skip';
const __isAB = (__tier === 'A' || __tier === 'B');

// Free-model roster already chosen upstream (Prepare LLM Items emits MODELS into
// `_payload.models`, max 3, all `:free`). We read it back so the retry picks the
// NEXT free model after the one already tried - no new roster, no paid id.
let __roster = [];
try { __roster = JSON.parse(meta._payload).models || []; } catch (e) { __roster = []; }

// Build the SAME chat payload the live LLM node used, so a retry is apples-to-apples.
let __basePayload = null;
try { __basePayload = JSON.parse(meta._payload); } catch (e) { __basePayload = null; }

// Resolve OpenRouter endpoint + key exactly as `LLM: Intel + Draft` does.
let __baseUrl = '', __apiKey = '';
try {
  const mk = $('Get Model Key').first().json;
  __baseUrl = mk.base_url || '';
  __apiKey  = mk.api_key  || '';
} catch (e) { /* leave blank -> retry is skipped, falls through to live behaviour */ }

// ONE retry against the next free model. Returns a parsed object or null.
// async because n8n Code nodes allow top-level await; a single awaited fetch only.
async function retryNextModel(alreadyUsedModelId) {
  if (!__isAB) return null;                      // never retry C / skip
  if (!__basePayload || !__baseUrl || !__apiKey) return null;
  // Choose the next free model id after the one that produced the empty body.
  // Fall back to roster[1] (or roster[0]) if we cannot match the used id.
  let next = '';
  const idx = __roster.indexOf(alreadyUsedModelId);
  if (idx !== -1 && __roster[idx + 1]) next = __roster[idx + 1];
  else if (__roster[1] && __roster[1] !== alreadyUsedModelId) next = __roster[1];
  else if (__roster[0] && __roster[0] !== alreadyUsedModelId) next = __roster[0];
  if (!next || !/:free/.test(next)) return null; // free-only guard: bail if not a :free id
  // Single-model retry payload (pin `next`, drop the fallback array so this is
  // exactly ONE more call, not a fan-out).
  const retryBody = Object.assign({}, __basePayload, { model: next });
  delete retryBody.models;                       // pin to one model -> one call
  let resp;
  try {
    const r = await fetch(__baseUrl + '/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + __apiKey },
      body:    JSON.stringify(retryBody)
    });
    resp = await r.json();
  } catch (e) { return null; }                   // network/JSON fail -> no retry win
  const choice = resp && resp.choices && resp.choices[0];
  if (!choice || choice.finish_reason === 'length') return null;
  const parsed = sliceParse(rawFromChoice(choice));
  if (!hasAnySignal(parsed)) return null;
  // tag the model that actually produced this so Build Final Record records it
  if (parsed) parsed.__retry_model_used = resp.model || next;
  return parsed;
}

// Standard envelope used by both the success and fallback returns (matches live).
function envelope(parsed, modelUsed) {
  return [{ json: {
    _parsed:        parsed,
    _model_used:    modelUsed || 'unknown',
    _source:        meta._source         || {},
    _pitch_angle:   meta._pitch_angle    || '',
    _best_ugc_app:  meta._best_ugc_app   || '',
    _pre_score:     meta._source ? (meta._source.pre_score    || 0)      : 0,
    _outreach_tier: meta._source ? (meta._source.outreach_tier || 'skip') : 'skip'
  }}];
}

// --- main loop ---------------------------------------------------------------
for (const item of items) {
  const llm = item.json;
  if (!llm.choices || !llm.choices[0] || !llm.choices[0].message) continue;
  const choice = llm.choices[0];
  const raw = rawFromChoice(choice);
  if (!raw || choice.finish_reason === 'length') continue;
  const parsed = sliceParse(raw);
  if (!hasAnySignal(parsed)) continue;           // live one-field accept guard

  // ---- T1 RETRY: A/B accepted but draft_body empty -> ONE next-model retry ----
  // This is the precise empty-A/B-draft case (poc_fix_backlog T1 root cause (1)).
  // C / skip never enter here (__isAB === false), so the extract-only branch is
  // untouched. A successful retry's body replaces the empty one; a failed retry
  // falls through with the original parse and Build Final Record (PATCH B) routes
  // it to warm_queue instead of stamping an empty 'draft'.
  const __bodyEmpty = !(parsed.draft_body && String(parsed.draft_body).trim());
  if (__isAB && __bodyEmpty) {
    const retryParsed = await retryNextModel(llm.model);
    if (retryParsed && retryParsed.draft_body && String(retryParsed.draft_body).trim()) {
      return envelope(retryParsed, retryParsed.__retry_model_used || 'retry');
    }
    // retry did not yield a body -> keep the original parse, let PATCH B route it.
  }

  return envelope(parsed, llm.model || 'unknown');
}

// Total failure across all items: live archive fallback, unchanged.
return [{ json: {
  _parsed:        { intel_quality: 'no_signal', fit_score: 0, recommended_action: 'archive' },
  _model_used:    'none',
  _source:        meta._source         || {},
  _pitch_angle:   meta._pitch_angle    || '',
  _best_ugc_app:  meta._best_ugc_app   || '',
  _pre_score:     meta._source ? (meta._source.pre_score    || 0)      : 0,
  _outreach_tier: meta._source ? (meta._source.outreach_tier || 'skip') : 'skip'
}}];

// === END PATCH A =============================================================


/* ============================================================================
   PATCH B  ->  node `Build Final Record`   (n8n Code node, runOnceForEachItem)
   ----------------------------------------------------------------------------
   Identical to the live `Build Final Record` EXCEPT the final status decision.
   The ONLY behavioural change is the new empty-A/B-body routing (see the marked
   block near the bottom). Everything above it is the live node verbatim so the
   diff a human reviews at the gate is exactly the T1 fix and nothing else.

   PASTE THE BLOCK BELOW (between the BEGIN/END markers) as the node body.
   It is wrapped in a comment here only so this single .js file stays valid for a
   linter; un-comment it (or copy the inner lines) when applying to the node.
   ============================================================================ */

/* ----- BEGIN PATCH B node body -----------------------------------------------
const r   = $input.first().json;
const p   = r._parsed   || {};
const src = r._source   || {};

// No em dashes / en dashes in outreach copy (Ally rule). PS dash -> colon; other dashes -> comma.
const dedash = (x) => String(x == null ? '' : x).replace(/PS\s*[—–]\s*/g, 'PS: ').replace(/\s*[—–]\s*/g, ', ');

const steam_app_id = src.steam_app_id || '';
if (!steam_app_id) throw new Error('steam_app_id missing from _source');

const fullBody = dedash(((p.draft_body || '') + (p.draft_ps ? '\n\n' + p.draft_ps : '')).trim());

let intel_quality = p.intel_quality || 'no_signal';
if (!p.intel_quality) {
  if      (p.founder_quote && p.founder_quote.length > 20) intel_quality = 'gold';
  else if (p.pain_signal   && p.pain_signal.length   > 10) intel_quality = 'silver';
  else if (src.contact_email)                               intel_quality = 'bronze';
}

const pre_score     = r._pre_score     !== undefined ? r._pre_score     : (src.pre_score     || 0);
const outreach_tier = r._outreach_tier                                   || (src.outreach_tier || 'skip');
const pitch_angle   = r._pitch_angle                                     || (src.pitch_angle   || '');
const best_ugc_app  = r._best_ugc_app                                    || (src.best_ugc_app  || '');

// D1/N5/N9 - evidence rubric, anti-fit flags, recency decay.
const HALFLIFE_DAYS = 180;
let evidence_strength = ['explicit','inferred','none'].includes(p.evidence_strength) ? p.evidence_strength : null;
let evidence_quote    = p.evidence_quote || '';
let evidence_sources  = Array.isArray(p.evidence_sources) ? p.evidence_sources.filter(Boolean) : [];
let evidence_as_of    = (typeof p.evidence_as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.evidence_as_of)) ? p.evidence_as_of : null;
if (!evidence_strength) {
  if      (p.founder_quote && p.founder_quote.length > 20 && p.founder_quote_source) evidence_strength = 'explicit';
  else if (p.pain_signal   && p.pain_signal.length   > 10)                            evidence_strength = 'inferred';
  else                                                                                evidence_strength = 'none';
}
if (!evidence_quote)                          evidence_quote   = p.founder_quote || p.pain_signal || '';
if (!evidence_sources.length && p.founder_quote_source) evidence_sources = [p.founder_quote_source];
let evidence_decay_weight = null;
if (evidence_as_of) {
  const ageDays = Math.max(0, (Date.now() - new Date(evidence_as_of).getTime()) / 86400000);
  evidence_decay_weight = Math.round(Math.exp(-ageDays / HALFLIFE_DAYS) * 1000) / 1000;
}
let risk_flags = Array.isArray(p.risk_flags) ? p.risk_flags.filter(f => f && f.flag) : [];
if (!risk_flags.length && (src.game_phase === 'sunset' || (src.avg_playtime_2weeks === 0 && src.total_reviews > 0))) {
  risk_flags.push({ flag: 'inactive', evidence: 'sunset / zero recent playtime', source: '' });
}

// P1.3 (live): the LLM fit assessment gates the board. Weak leads (LLM recommends
// archive, or fit below the floor) are parked. Carried over unchanged.
const FIT_FLOOR = 35;
const _fit  = typeof p.fit_score === 'number' ? p.fit_score : 0;
const _weak = (p.recommended_action === 'archive') || (_fit > 0 && _fit < FIT_FLOOR);

// ===== T1 empty-A/B-body routing (THE ONLY NEW LOGIC) =======================
// poc_fix_backlog T1 / spec §3: an A/B tier row whose body is empty must NEVER be
// stamped pipeline_status='draft' (it would count as a ready draft while being a
// hollow email - the worse-than-generic failure, research §2.3). Route it to the
// warm queue / backlog instead, and surface why via recommended_action.
//   - C / `skip` tiers are unaffected (they fall into the existing 'skip' arm).
//   - Non-empty A/B bodies keep stamping 'draft' exactly as today.
// This is the persistence-side guard that complements PATCH A's one retry: if the
// retry still produced no body, the row is visibly parked, not silently drafted.
const _isAB      = (outreach_tier === 'A' || outreach_tier === 'B');
const _bodyEmpty = !(fullBody && fullBody.trim());

let _pipeline_status;
let _recommended_action = p.recommended_action || 'archive';
if (outreach_tier === 'skip' || _weak) {
  _pipeline_status = 'skip';                          // live behaviour, unchanged
} else if (_isAB && _bodyEmpty) {
  // empty A/B draft after retry: park, do NOT call it a draft.
  _pipeline_status    = 'backlog';                    // any non-'draft' sentinel; UI reads recommended_action
  _recommended_action = 'warm_queue';                 // spec §3 enrich/hold -> warm_queue lane
} else {
  _pipeline_status = 'draft';                         // genuine A/B draft with a body
}
// ===========================================================================

return [{ json: {
  steam_app_id,
  game_name:              src.game_name              || '',
  publisher_name:         src.publisher_name         || '',
  developer_name:         src.developer_name         || '',
  primary_genre:          src.primary_genre          || '',
  steam_tags:             src.steam_tags             || '',
  steam_description:      src.steam_description      || '',
  review_score:           src.review_score           || 0,
  total_reviews:          src.total_reviews          || 0,
  owners_estimate:        src.owners_estimate        || '',
  avg_playtime_2weeks:    src.avg_playtime_2weeks     || 0,
  release_date:           src.release_date           || '',
  coming_soon:            src.coming_soon            || false,
  game_phase:             src.game_phase             || '',
  is_free:                src.is_free                || false,
  price_usd:              src.price_usd              || 0,
  has_multi_player:       src.has_multi_player       || false,
  has_online_pvp:         src.has_online_pvp         || false,
  has_steam_leaderboards: src.has_steam_leaderboards || false,
  has_steam_workshop:     src.has_steam_workshop     || false,
  has_online_coop:        src.has_online_coop        || false,
  publisher_website:      p.publisher_website        || src.publisher_website    || '',
  support_email:          src.support_email          || '',
  contact_email:          src.contact_email          || '',
  contact_email_all:      src.contact_email_all      || '',
  contact_source:         src.contact_source         || '',
  contact_name:           p.contact_name             || src.contact_name         || '',
  contact_role:           p.contact_role             || src.contact_role         || '',
  whois_registrant_email: src.whois_registrant_email || '',
  whois_registrant_name:  src.whois_registrant_name  || '',
  twitter_handle:         p.twitter_handle           || src.twitter_handle       || '',
  linkedin_company_url:   p.linkedin_company_url     || src.linkedin_company_url || '',
  discord_url:            src.discord_url            || '',
  founder_name:           p.founder_name             || '',
  founder_quote:          p.founder_quote            || '',
  founder_quote_source:   p.founder_quote_source     || '',
  pain_signal:            p.pain_signal              || '',
  intel_summary:          p.intel_summary            || '',
  intel_quality,
  evidence_strength,
  evidence_quote,
  evidence_sources:      JSON.stringify(evidence_sources),
  evidence_as_of,
  evidence_decay_weight,
  risk_flags:            JSON.stringify(risk_flags),
  pre_score,
  outreach_tier,
  fit_score:              _fit,
  score_rationale:        p.score_rationale          || '',
  pitch_angle,
  best_ugc_app,
  gamerslab_hook:         p.gamerslab_hook           || '',
  ugc_app_pitch:          p.ugc_app_pitch            || '',
  peer_publisher_ref:     p.peer_publisher_ref       || '',
  draft_subject:          dedash(p.draft_subject || ''),
  draft_body:             fullBody,
  recommended_action:     _recommended_action,
  model_used:             r._model_used              || '',
  email_valid:            src.email_valid || false,
  email_status:           src.email_status || 'no_email',
  pipeline_status:        _pipeline_status
}}];
   ----- END PATCH B node body ----------------------------------------------- */

// =============================================================================
// APPLY-TIME NOTES FOR THE HUMAN (build gate):
//   - PATCH B uses pipeline_status='backlog' as the non-'draft' sentinel for an
//     empty A/B row, with recommended_action='warm_queue' carrying the reason
//     (spec §3). Confirm the UI / Gate-B board treats a 'backlog'/'warm_queue'
//     row as parked, not as a ready draft, before publishing. If the board keys
//     off a different sentinel (e.g. 'skip' or a dedicated 'warm_queue' status),
//     swap the one string in the marked block to match - the routing logic is
//     otherwise tenant-agnostic.
//   - PATCH A's dedash regex lives only in PATCH B; PATCH A adds no outreach copy.
//   - After applying: re-fetch the OpenRouter free roster is NOT needed; the retry
//     reuses the in-run roster from Prepare LLM Items / Filter Free Models.
//   - Update gamerslab-poc/ARCHITECTURE.md §4(1) draft-path spine + §9 date IN THE
//     SAME CHANGE as deploy (ARCHITECTURE.md §10 rule), and mirror to aDNA
//     (tags gamers-lab, lead-gen). Not done here: this is pre-gate authoring only.
// =============================================================================
