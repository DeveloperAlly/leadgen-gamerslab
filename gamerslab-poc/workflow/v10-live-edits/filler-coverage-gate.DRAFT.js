// Coverage gate (Lane A8)  -  DRAFT, PRE-GATE. NOT APPLIED to live v10.
// =============================================================================================
// Spec:  how/prospect_dossier_build_spec_DRAFT.md  S3 (the coverage gate, authoritative)  +  S1
//        (provenance quad: a value WITHOUT source_url OR date is EMPTY), S4.2 (decay windows /
//        trigger classes), S6 (Wave 2 placement: "gate + safety"), decision D-b
//        (TRIGGER-ONLY, CONTACT-OPTIONAL).
// Why:   how/prospect_dossier_research_DRAFT.md  S2.3 (an UNGROUNDED/stale cited detail makes the
//        email WORSE than generic: 0.84% vs 2.1% baseline -> the gate exists so no draft cites a
//        slot at evidence_strength='none'), S5 (the template only earns its keep if it gates
//        drafting; an empty trigger must be VISIBLE, not silently drafted).
//
// PLACEMENT (spec S3):  an n8n Code node placed IMMEDIATELY BEFORE the v10 draft step. In the live
//   engine MouIeDmDAAHKIpDn the draft band is:
//       ... Filler nodes -> Build Final Record -> Apply CAG from DB -> Prepare LLM Items -> <LLM draft>
//   This gate sits between "Apply CAG from DB" and "Prepare LLM Items" (spec S3: "before the v10
//   draft step (Apply CAG from DB -> Prepare LLM Items)"). It is read-only over the filled slots:
//   it CLASSIFIES each item as draft_ready | enrich_more | hold and routes; it does NOT mutate any
//   slot value (no fabrication, no backfill). The only field it WRITES is recommended_action on a
//   hold, plus a namespaced _gate trace for the UI / acceptance check.
//
// Node name (suggested):  "Coverage Gate"
// Node type:  n8n-nodes-base.code  (Run Once for All Items) so it can return THREE labelled output
//   buckets in one pass. The function returns one array; each item carries _gate.route. Wire the
//   downstream branch with an IF/Switch on  {{$json._gate.route}}  ==  'draft_ready' (-> Prepare LLM
//   Items), 'enrich_more' (-> re-run the next adapter/waterfall step, then back into the gate), or
//   'hold' (-> persist recommended_action='hold_no_trigger', no draft). If your canvas prefers hard
//   branching, replace the single return with n8n's multi-output Code mode and emit to indices
//   [0]=draft_ready [1]=enrich_more [2]=hold using the same ROUTE decision below.
//
// GATE PREDICATE (spec S3, per D-b TRIGGER-ONLY / CONTACT-OPTIONAL).  draft_ready == true requires
//   ALL of:
//     1. FRESH SOURCED TRIGGER OR DEMAND.  slot2 why_now OR slot3 demand is GROUNDED:
//          has source_url, has a date INSIDE its class window (spec S4.2 decay table), and
//          evidence_strength != 'none'.
//     2. PEER RESOLVED.  slot5 peer_publisher_ref present with peer_match_method='deterministic'.
//     3. NO CITED UNGROUNDED SLOT.  any slot whose value will be cited in the draft must NOT be
//          evidence_strength='none' (the S2.3 "0.84% worse-than-generic" guard).
//   CONTACT (slot1) is NOT in the gate (D-b). A named contact lifts priority and sets the send
//   target elsewhere; a role inbox is an acceptable, non-blocking send target. This node does not
//   read contact_* for the pass/fail decision.
//
// ROUTING (spec S3):
//     all hold                              -> 'draft_ready'  -> Prepare LLM Items / draft.
//     a REQUIRED slot empty-but-FILLABLE    -> 'enrich_more'  -> next adapter/waterfall step, re-gate.
//     a REQUIRED slot UNFILLABLE or only STALE -> 'hold'      -> recommended_action='hold_no_trigger',
//                                                                empty slot surfaced, NO blind draft.
//
// COLUMN / FIELD NAMES are the REAL fields the sibling fillers write onto the item (verified live
//   2026-06-24, project ccmwksmgoisijvyovgko, public.publishers):
//     slot2 (filler-2-why-now): why_now(text), why_now_source(text), why_now_as_of(date),
//            trigger_class(text), why_now_decay_weight(numeric).  NOTE: filler-2 stores slot-2
//            evidence_strength IMPLICITLY (a grounded why_now with source+date == strength!='none';
//            empty why_now == 'none'). This gate only needs strength != 'none', so it derives slot-2
//            strength from (why_now non-empty AND why_now_source AND why_now_as_of). The finer
//            explicit-vs-inferred split (canonical: config/trigger-classes.DRAFT.json) is a SCORING
//            concern applied by filler-6-qualification, not the gate (review conflict 4).
//     slot3 (filler-3-demand): evidence_quote(text), evidence_sources(jsonb [{url,date}]),
//            evidence_as_of(date), evidence_strength(text in {explicit,inferred,none}),
//            evidence_decay_weight(numeric), pain_signal(text).
//     slot5 (filler-5-peer):   peer_publisher_ref(text), peer_match_method(text='deterministic').
//     written by gate:         recommended_action(text='hold_no_trigger') on a hold.
//   No invented columns. The new columns (why_now*, trigger_class, peer_match_method) ship in the
//   spec S2 migration that is NOT applied by this draft.
//
// MODULARITY (mandate #7, spec S7):  there is NO venue adapter here. CLASS_WINDOWS below is the ONLY
//   tenant/venue-tunable block. CANONICAL SOURCE: config/trigger-classes.DRAFT.json (window_days),
//   which filler-2-why-now.DRAFT.js also mirrors. The grounded-check / freshness / route logic is
//   ENGINE-GENERIC: no GamersLab noun, no Steam assumption. A new tenant or venue overrides the
//   canonical config (and the filler), never the predicate below. KEEP CLASS_WINDOWS EQUAL TO THE
//   CANONICAL FILE AND filler-2 (review conflict 3).
// =============================================================================================


// ===== TENANT/VENUE CONFIG - the ONLY tunable block. CANONICAL: config/trigger-classes.DRAFT.json ==
// window_days = the freshness cutoff the gate treats as "in window" per spec S4.2 decay table.
// A trigger is FRESH while age_days <= window_days[class]; older = STALE (does not count toward
// draft_ready; routes to hold per spec S3 "unfillable or only stale -> hold"). Engine-generic code
// below treats this purely as data. These values MUST equal config/trigger-classes.DRAFT.json and the
// filler-2 inline copy (review conflict 3); at integration, source all three from the canonical file.
const CLASS_WINDOWS = {
  funding:       90,  // research S2.2 ~90d useful
  exec:          90,  // 30-90d champion/exec move
  launch:        21,  // days-weeks around the date
  patch:         21,  // major patch = same window
  update:        14,  // minor update, shorter
  coming_soon:   60,  // pre-launch interest window
  pain_velocity: 10,  // review spike 5-10d (research S2.2)
};
// Demand (slot 3) freshness window. Filler-3 keeps reviews from ~last 90 days (spec S4.1); a demand
// quote older than this is STALE for gate purposes. Single class, so a flat window.
const DEMAND_WINDOW_DAYS = 90;
// Default window for an UNKNOWN/blank trigger_class that nonetheless has a date+source. Conservative
// so a mislabelled-but-real trigger is still gateable rather than silently dropped.
const DEFAULT_TRIGGER_WINDOW_DAYS = 30;
// =================================================================================================


// ===== ENGINE-GENERIC gate (no GamersLab noun, no Steam assumption below this line) ==============
const NOW_MS    = Date.now();
const TODAY_ISO = new Date(NOW_MS).toISOString().slice(0, 10);

// --- small helpers (pure) ---------------------------------------------------------------------
const isNonEmptyStr = v => typeof v === 'string' && v.trim().length > 0;

// Parse a YYYY-MM-DD (or ISO) date to ms, or null. Defensive: the engine surfaces dates as text.
const dateMs = v => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};
const ageDays = v => {
  const t = dateMs(v);
  return t === null ? null : Math.max(0, (NOW_MS - t) / 86400000);
};

// A slot is GROUNDED (spec S1) only with BOTH a source_url AND a date. A value string alone is EMPTY.
// "Fresh" additionally requires age <= windowDays. Returns one of:
//   'grounded_fresh' | 'stale' (sourced+dated but aged out) | 'empty' (no source or no date).
function freshness(sourceUrl, dateVal, windowDays) {
  if (!isNonEmptyStr(sourceUrl) || !dateVal) return 'empty';
  const age = ageDays(dateVal);
  if (age === null) return 'empty';                  // undateable => empty by the quad rule
  return age <= windowDays ? 'grounded_fresh' : 'stale';
}

// --- per-slot evaluation ----------------------------------------------------------------------
// Slot 2 (why-now). filler-2 stores strength implicitly: a why_now with source_url + as_of is a real
// trigger (strength != 'none'); empty why_now == 'none' to the gate (filler-2 lines 410-412). We
// pick the class window from trigger_class, falling back to DEFAULT_TRIGGER_WINDOW_DAYS.
function evalTrigger(rec) {
  const value     = rec.why_now;
  const sourceUrl = rec.why_now_source;
  const dateVal   = rec.why_now_as_of;
  const klass     = isNonEmptyStr(rec.trigger_class) ? rec.trigger_class.trim() : null;
  const windowDays = (klass && CLASS_WINDOWS[klass] !== undefined)
    ? CLASS_WINDOWS[klass]
    : DEFAULT_TRIGGER_WINDOW_DAYS;

  // Strength is implicit for slot 2: grounded (value+source+date) => not 'none'; else 'none'.
  const hasValue = isNonEmptyStr(value);
  const fresh = hasValue ? freshness(sourceUrl, dateVal, windowDays) : 'empty';
  const strength = (fresh === 'grounded_fresh' || fresh === 'stale') && hasValue ? 'explicit' : 'none';

  return {
    slot: 'why_now',
    present: hasValue,
    has_source: isNonEmptyStr(sourceUrl),
    has_date: !!dateVal,
    age_days: ageDays(dateVal),
    window_days: windowDays,
    trigger_class: klass,
    evidence_strength: strength,                 // derived (implicit-strength contract)
    state: hasValue ? fresh : 'empty',           // grounded_fresh | stale | empty
    // "cited" only if the quad is complete (value + source + date). A why_now value with no source
    // or no date is EMPTY by the quad rule (spec S1) and therefore not a citation -> it routes as an
    // empty-fillable slot, not a 'none'-citation block.
    quad_complete: hasValue && isNonEmptyStr(sourceUrl) && !!dateVal,
    grounded: fresh === 'grounded_fresh' && strength !== 'none',
  };
}

// Slot 3 (demand). filler-3 writes an EXPLICIT evidence_strength column plus evidence_sources
// [{url,date}] + evidence_as_of. source_url = first evidence_sources[].url (fallback: any url).
function evalDemand(rec) {
  const value    = rec.evidence_quote;
  const strength = isNonEmptyStr(rec.evidence_strength) ? rec.evidence_strength.trim() : 'none';
  let sourceUrl = '';
  const srcs = rec.evidence_sources;
  if (Array.isArray(srcs)) {
    const withUrl = srcs.find(s => s && isNonEmptyStr(s.url));
    if (withUrl) sourceUrl = withUrl.url;
  } else if (isNonEmptyStr(srcs)) {
    // tolerate a stringified jsonb (Build Final Record stringifies evidence_sources)
    try {
      const parsed = JSON.parse(srcs);
      if (Array.isArray(parsed)) {
        const withUrl = parsed.find(s => s && isNonEmptyStr(s.url));
        if (withUrl) sourceUrl = withUrl.url;
      }
    } catch (_) { /* leave empty */ }
  }
  const dateVal  = rec.evidence_as_of;
  const hasValue = isNonEmptyStr(value);
  const fresh    = hasValue ? freshness(sourceUrl, dateVal, DEMAND_WINDOW_DAYS) : 'empty';

  return {
    slot: 'demand',
    present: hasValue,
    has_source: isNonEmptyStr(sourceUrl),
    has_date: !!dateVal,
    age_days: ageDays(dateVal),
    window_days: DEMAND_WINDOW_DAYS,
    evidence_strength: strength,                 // explicit column from filler-3
    state: hasValue ? fresh : 'empty',
    // "cited" only if the quad is complete (value + source + date). A value without a source/date is
    // EMPTY by the quad rule (spec S1), not a citation -> it does not trip the no-'none'-citation guard.
    quad_complete: hasValue && isNonEmptyStr(sourceUrl) && !!dateVal,
    // grounded == fresh AND strength != 'none' (spec S3 item 1)
    grounded: fresh === 'grounded_fresh' && strength !== 'none',
  };
}

// Slot 5 (peer). Required, near-always passes (spec S4.4). Resolved == ref present AND
// method == 'deterministic'. An LLM-guessed or missing peer does NOT satisfy the gate (spec S3 item 2).
function evalPeer(rec) {
  const ref    = rec.peer_publisher_ref;
  const method = isNonEmptyStr(rec.peer_match_method) ? rec.peer_match_method.trim() : null;
  const resolved = isNonEmptyStr(ref) && method === 'deterministic';
  return {
    slot: 'peer',
    present: isNonEmptyStr(ref),
    peer_match_method: method,
    // peer is computable from the catalogue, so an empty/non-deterministic peer is treated as
    // FILLABLE (re-run filler 5) rather than unfillable -> enrich_more, not hold (spec S4.4
    // "failing it is a config smell").
    resolved,
  };
}

// =============================================================================================
// ROUTE one record. Pure function of the three slot evaluations + the no-ungrounded-citation guard.
// Returns { route, reasons[], required_empty_fillable[], required_stale_or_unfillable[] }.
// =============================================================================================
function routeRecord(rec) {
  const t = evalTrigger(rec);
  const d = evalDemand(rec);
  const p = evalPeer(rec);

  const reasons = [];

  // ---- Predicate item 1: FRESH SOURCED TRIGGER OR DEMAND (spec S3.1) -------------------------
  const triggerOrDemandGrounded = t.grounded || d.grounded;

  // ---- Predicate item 2: PEER RESOLVED deterministically (spec S3.2) -------------------------
  const peerResolved = p.resolved;

  // ---- Predicate item 3: NO CITED-BUT-UNGROUNDED SLOT (spec S3.3 / research S2.3 guard) ------
  // A slot is "cited in the draft" only when its quad is COMPLETE (value + source_url + date). A
  // complete-but-weak quad at strength 'none' (e.g. a sourced+dated quote the rubric rated 'none')
  // would make the email worse than generic, so it BLOCKS draft. A value WITHOUT a source/date is
  // EMPTY by the quad rule (spec S1), NOT a citation -> it is handled as an empty-fillable slot, not
  // a 'none'-citation block (otherwise an empty trigger would force hold instead of enrich_more).
  const citedNoneSlots = [];
  if (t.quad_complete && t.evidence_strength === 'none') citedNoneSlots.push('why_now');
  if (d.quad_complete && d.evidence_strength === 'none') citedNoneSlots.push('demand');
  const noCitedUngrounded = citedNoneSlots.length === 0;

  // ---- draft_ready ----------------------------------------------------------------------------
  if (triggerOrDemandGrounded && peerResolved && noCitedUngrounded) {
    reasons.push('trigger_or_demand_grounded', 'peer_resolved', 'no_cited_ungrounded');
    return {
      route: 'draft_ready',
      reasons,
      required_empty_fillable: [],
      required_stale_or_unfillable: [],
      slots: { trigger: t, demand: d, peer: p },
    };
  }

  // ---- not draft_ready: classify WHY, then choose enrich_more vs hold ------------------------
  // A required slot is EMPTY-but-FILLABLE  -> enrich_more (re-run the adapter, then re-gate).
  // A required slot is STALE or UNFILLABLE -> hold (spec S3 "unfillable or only stale -> hold").
  const requiredEmptyFillable = [];
  const requiredStaleOrUnfillable = [];

  // Predicate 1 unmet: neither trigger nor demand grounded. Decide fillable vs stale per slot.
  if (!triggerOrDemandGrounded) {
    // why_now: empty (no value, or no source/date) is FILLABLE (re-run filler 2 / Exa fallback).
    //          present+sourced+dated but STALE = aged out, not re-fillable by another fetch.
    if (t.state === 'empty')  requiredEmptyFillable.push('why_now');
    else if (t.state === 'stale') requiredStaleOrUnfillable.push('why_now (stale)');

    // demand: empty is FILLABLE (re-run filler 3 / community fallback); stale = aged out.
    if (d.state === 'empty')  requiredEmptyFillable.push('demand');
    else if (d.state === 'stale') requiredStaleOrUnfillable.push('demand (stale)');

    reasons.push('no_fresh_trigger_or_demand');
  }

  // Predicate 2 unmet: peer not deterministically resolved. Computable => FILLABLE (re-run filler 5).
  if (!peerResolved) {
    requiredEmptyFillable.push('peer');
    reasons.push('peer_unresolved');
  }

  // Predicate 3 unmet: a cited slot is ungrounded ('none'). This is a STALE/UNFILLABLE-class block:
  // we will NOT draft citing a 'none' slot. If the SAME slot is also the only trigger/demand and is
  // merely empty, the empty path above already queued it for enrich_more; but a PRESENT-yet-'none'
  // value (e.g. an inferred-but-undated quote) is not improved by a re-run of the same fetch, so it
  // is unfillable-for-citation. Surface it; it must not be drafted (research S2.3 0.84% guard).
  if (!noCitedUngrounded) {
    for (const s of citedNoneSlots) requiredStaleOrUnfillable.push(s + ' (cited but ungrounded)');
    reasons.push('cited_ungrounded_slot');
  }

  // Decision: if EVERYTHING blocking is empty-but-fillable (and nothing is stale/unfillable),
  // route enrich_more so the next adapter/waterfall step runs and we re-gate. Otherwise hold:
  // an empty slot is surfaced and NO blind draft is produced (spec S3, research S5).
  const route = (requiredEmptyFillable.length > 0 && requiredStaleOrUnfillable.length === 0)
    ? 'enrich_more'
    : 'hold';

  return {
    route,
    reasons,
    required_empty_fillable: requiredEmptyFillable,
    required_stale_or_unfillable: requiredStaleOrUnfillable,
    slots: { trigger: t, demand: d, peer: p },
  };
}

// --- n8n entrypoint: classify + route every item ----------------------------------------------
// Run Once for All Items. Each returned item carries _gate.route for the downstream Switch/IF, and
// a hold ALSO sets recommended_action='hold_no_trigger' (spec S3) so persistence/UI surface it.
const out = [];
for (const it of $input.all()) {
  const rec = it.json;
  const decision = routeRecord(rec);

  const patched = {
    ...rec,
    _gate: {
      route: decision.route,                                    // draft_ready | enrich_more | hold
      reasons: decision.reasons,
      required_empty_fillable: decision.required_empty_fillable,
      required_stale_or_unfillable: decision.required_stale_or_unfillable,
      slots: decision.slots,
      gated_at: TODAY_ISO,
    },
  };

  // On a hold, write the recommended_action column (spec S3). Do NOT touch any slot value.
  if (decision.route === 'hold') {
    patched.recommended_action = 'hold_no_trigger';
  }

  out.push({ json: patched });
}
return out;

// =============================================================================================
// UNIT HARNESS (spec S3 acceptance: grounded -> draft_ready; empty -> enrich_more; stale -> hold).
// This block is NOT executed inside the n8n Code node (the node returns above). To run it:
//   1) copy this file's pure functions (CLASS_WINDOWS .. routeRecord) into a plain *.mjs, OR
//   2) wrap them in `module.exports = { routeRecord, evalTrigger, evalDemand, evalPeer }` and
//      `node filler-coverage-gate.harness.mjs`.
// It asserts the routing predicate over grounded / empty / stale fixtures with fixed dates so the
// freshness math is deterministic regardless of run date. Free, offline, no engine call (mandate #8).
//
// Fixtures use dates RELATIVE to a frozen "today" so they never bit-rot. We compute ISO strings off
// NOW_MS at load so a fresh fixture is in-window and a stale one is aged past the window. Because the
// gate reads the live Date(), the harness builds dates the same way for a stable expectation.
//
//   const iso = daysAgo => new Date(NOW_MS - daysAgo*86400000).toISOString().slice(0,10);
//
//   // -- FIXTURE A: GROUNDED trigger + deterministic peer  => draft_ready
//   //   why_now fresh (launch, 5d old, window 21), peer deterministic. demand empty (fine: OR).
//   const A = {
//     why_now: 'Left Early Access / 1.0 launch', why_now_source: 'https://store.steampowered.com/news/app/1/view/1',
//     why_now_as_of: iso(5), trigger_class: 'launch',
//     evidence_quote: '', evidence_sources: [], evidence_as_of: null, evidence_strength: 'none',
//     peer_publisher_ref: 'Maelstrom (Naval Battle Royale)', peer_match_method: 'deterministic',
//   };
//   assert(routeRecord(A).route === 'draft_ready');
//
//   // -- FIXTURE B: GROUNDED demand (no trigger) + deterministic peer  => draft_ready
//   const B = {
//     why_now: '', why_now_source: '', why_now_as_of: null, trigger_class: null,
//     evidence_quote: 'Wish there was a leaderboard for this', evidence_strength: 'explicit',
//     evidence_sources: [{ url: 'https://steamcommunity.com/profiles/1/recommended/1/', date: iso(10) }],
//     evidence_as_of: iso(10),
//     peer_publisher_ref: 'Dark Table CCG', peer_match_method: 'deterministic',
//   };
//   assert(routeRecord(B).route === 'draft_ready');
//
//   // -- FIXTURE C: EMPTY trigger + EMPTY demand, peer deterministic  => enrich_more
//   //   both required signals are empty-but-fillable, nothing stale/unfillable.
//   const C = {
//     why_now: '', why_now_source: '', why_now_as_of: null, trigger_class: null,
//     evidence_quote: '', evidence_sources: [], evidence_as_of: null, evidence_strength: 'none',
//     peer_publisher_ref: 'Bug & Seek', peer_match_method: 'deterministic',
//   };
//   assert(routeRecord(C).route === 'enrich_more');
//
//   // -- FIXTURE D: STALE trigger (sourced+dated but aged out), no demand, peer ok  => hold
//   //   launch window 21d; 120d-old event = stale -> not re-fillable -> hold_no_trigger.
//   const D = {
//     why_now: 'Patch 1.2 released', why_now_source: 'https://store.steampowered.com/news/app/1/view/2',
//     why_now_as_of: iso(120), trigger_class: 'launch',
//     evidence_quote: '', evidence_sources: [], evidence_as_of: null, evidence_strength: 'none',
//     peer_publisher_ref: 'NightSpawn', peer_match_method: 'deterministic',
//   };
//   const rd = routeRecord(D);
//   assert(rd.route === 'hold');
//   assert(rd.required_stale_or_unfillable.some(s => s.indexOf('why_now') === 0));  // surfaced
//
//   // -- FIXTURE E: CITED-BUT-UNGROUNDED demand quote (COMPLETE quad, strength 'none')  => hold
//   //   a demand value WITH a source+date but rubric strength 'none' is the 0.84% guard
//   //   (research S2.3): the quad is complete (so it WOULD be cited) yet ungrounded -> block draft.
//   //   (A value with NO source/date is empty-by-quad-rule -> enrich_more, see FIXTURE H.)
//   const E = {
//     why_now: '', why_now_source: '', why_now_as_of: null, trigger_class: null,
//     evidence_quote: 'players seem to want stats', evidence_strength: 'none',
//     evidence_sources: [{ url: 'https://steamcommunity.com/profiles/1/recommended/1/', date: iso(10) }],
//     evidence_as_of: iso(10),
//     peer_publisher_ref: 'Mullet Cop', peer_match_method: 'deterministic',
//   };
//   assert(routeRecord(E).route === 'hold');           // complete-quad but 'none' => unfillable-for-citation
//
//   // -- FIXTURE F: GROUNDED trigger but PEER not deterministic (LLM-guessed/missing) => enrich_more
//   //   peer is computable -> re-run filler 5 -> enrich_more (spec S4.4 "config smell", not hold).
//   const F = {
//     why_now: 'Now available', why_now_source: 'https://store.steampowered.com/news/app/1/view/3',
//     why_now_as_of: iso(3), trigger_class: 'launch',
//     evidence_quote: '', evidence_sources: [], evidence_as_of: null, evidence_strength: 'none',
//     peer_publisher_ref: 'SomeGame', peer_match_method: 'llm',
//   };
//   assert(routeRecord(F).route === 'enrich_more');
//
//   // -- FIXTURE G: CONTACT-OPTIONAL proof (D-b). Grounded trigger + peer, NO contact at all
//   //   (no contact_* fields) => still draft_ready. Contact is not in the gate.
//   const G = {
//     why_now: 'Out now', why_now_source: 'https://store.steampowered.com/news/app/1/view/4',
//     why_now_as_of: iso(2), trigger_class: 'launch',
//     evidence_quote: '', evidence_sources: [], evidence_as_of: null, evidence_strength: 'none',
//     peer_publisher_ref: 'Maelstrom', peer_match_method: 'deterministic',
//     contact_name: '', contact_email: '',   // only a role inbox / nothing -> non-blocking
//   };
//   assert(routeRecord(G).route === 'draft_ready');
//
//   // -- FIXTURE H: why_now has a VALUE but NO source_url (quad rule: EMPTY)  => enrich_more
//   //   demonstrates S1 - a value without a source is empty, hence fillable, not a 'none' citation
//   //   block (it is empty, not present-with-strength-none). Peer ok, demand empty.
//   const H = {
//     why_now: 'they just launched something', why_now_source: '', why_now_as_of: null, trigger_class: 'launch',
//     evidence_quote: '', evidence_sources: [], evidence_as_of: null, evidence_strength: 'none',
//     peer_publisher_ref: 'Bug & Seek', peer_match_method: 'deterministic',
//   };
//   // why_now has a value but no source -> state 'empty' -> implicit strength 'none', but NOT
//   // "cited" because the quad rule makes it empty; treated as empty-fillable -> enrich_more.
//   assert(routeRecord(H).route === 'enrich_more');
//
// Expected: A,B,G draft_ready | C,F,H enrich_more | D,E hold. All deterministic given iso().
// =============================================================================================
