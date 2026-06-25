// Filler 3 - Demand signal (Lane A1)  -  DRAFT, PRE-GATE. NOT APPLIED to live v10.
// ---------------------------------------------------------------------------------------------
// Spec:  how/prospect_dossier_build_spec_DRAFT.md  §4.1 (authoritative)  +  §1 provenance quad,
//        §3 coverage gate (this filler satisfies one half of the "trigger OR demand" requirement),
//        §7 modularity ledger row "3 demand".
// Why:   how/prospect_dossier_research_DRAFT.md  §2.3 (one specific, sourced, recent detail is the
//        highest-converting personalization; an UNGROUNDED quote is worse than generic, 0.84%).
//
// Placement (spec §4.1, §4 preamble):  an n8n Code node added to the live v10 engine
//   MouIeDmDAAHKIpDn between "Merge All Data" and "Build Final Record". It reads the merged item
//   (which already carries steam_app_id + the merged steam facts), fetches Steam appreviews for
//   that one app, extracts the single strongest dated demand quote, and writes the demand-signal
//   provenance quad back onto the item so "Build Final Record" persists it to public.publishers.
//
// Node name (suggested):  "Filler 3 - Demand Signal"
// Node type:  n8n-nodes-base.code  (Run Once for Each Item).  Self-contained: the fetch is done
//   in-node via this.helpers.httpRequest so the filler is one swappable venue adapter, not a
//   separate HTTP node wired into the canvas (matches "a node or small node cluster", §4 preamble).
//
// PROVENANCE CONTRACT (spec §1):  every slot value is {value, source_url, date, evidence_strength}.
//   A value with no source_url OR no date is EMPTY by definition -> we emit evidence_strength='none'
//   and DO NOT populate evidence_quote in that case. The coverage gate (§3) then routes it.
//
// COLUMN NAMES are REAL public.publishers columns, verified live 2026-06-24 (project
//   ccmwksmgoisijvyovgko): evidence_quote(text), evidence_sources(jsonb), evidence_as_of(date),
//   evidence_strength(text), evidence_decay_weight(numeric), pain_signal(text). No invented columns.
//   Build Final Record already JSON.stringify()s evidence_sources before the Postgres node, so here
//   we hand it a real array on _demand.evidence_sources and let the existing serialiser carry it.
//
// API verified live 2026-06-24 against 2 real app IDs (892970 Valheim, 413150 Stardew Valley):
//   GET https://store.steampowered.com/appreviews/<appid>?json=1&filter=recent&language=english
//       &num_per_page=100&review_type=all&purchase_type=all&cursor=*
//   -> { success:1, query_summary:{total_positive,total_negative,total_reviews,...},
//        reviews:[ { recommendationid, review, timestamp_created (unix int), voted_up,
//                    author:{ steamid, playtime_forever } }, ... ] }
//   Confirmed present: timestamp_created (unix seconds int) and author.playtime_forever.
//   Source: https://partner.steamgames.com/doc/store/getreviews  (Steamworks, fetched 2026-06-24).
//
// MODULARITY (mandate #7, spec §7):  the Steam appreviews call = venue adapter (swappable);
//   DEMAND_KEYWORDS below = TENANT CONFIG (the CAG offering set, NOT engine logic) and is the
//   only block a different client edits; the windowing + pick-strongest + quad assembly =
//   engine-generic. To onboard a localisation client you swap DEMAND_KEYWORDS (and, later, the
//   venue), not this code. Do NOT bake a GamersLab noun into the logic below the config block.
// ---------------------------------------------------------------------------------------------

// ===== TENANT CONFIG (CAG offering set) - the ONLY client-specific block =======================
// Demand language we are entitled to claim relevance for, derived from what GamersLab can prove
// and offer (research §1 "the dossier template is the CAG pointed outward"). Engine-generic code
// below treats this purely as data. Spec §4.1 explicitly lists these nine terms.
const DEMAND_KEYWORDS = [
  'tracker', 'leaderboard', 'stats', 'companion',
  'rival', 'tournament', 'ladder', 'ranking', 'second screen'
];
// Phrases that signal an explicit, verbatim feature REQUEST (engine-generic; raises confidence
// that a matched keyword is genuine demand, not an incidental mention). Tenant-agnostic.
const REQUEST_CUES = [
  'wish', 'wish there was', 'would love', 'would be great', 'needs a', 'need a', 'should add',
  'please add', 'add a', 'no way to', "there's no", 'there is no', 'lacks a', 'missing a',
  'want a', 'want to see', 'hoping for', 'we need', 'could use a', 'where is the', 'why is there no'
];
// =============================================================================================

const WINDOW_DAYS    = 90;           // spec §4.1 "last ~90 days" via timestamp_created
const HALFLIFE_DAYS   = 180;         // matches Build Final Record's evidence_decay_weight half-life
const NUM_PER_PAGE    = 100;         // spec §4.1; single request per app (free-tier, no key)
const NOW_MS          = Date.now();
const TODAY_ISO       = new Date(NOW_MS).toISOString().slice(0, 10);

const item = $input.item.json;                 // merged record from "Merge All Data"
const appId = String(item.steam_app_id || item.steam_app_id === 0 ? item.steam_app_id : '').trim();

// Helper: keyword-aware lowercase scan that respects "second screen" being two words.
const lc = s => (s || '').toLowerCase();
const matchedKeywords = text => {
  const t = lc(text);
  return DEMAND_KEYWORDS.filter(k => t.includes(k));
};
const isRequest = text => {
  const t = lc(text);
  return REQUEST_CUES.some(c => t.includes(c));
};
// Resolvable permalink per spec §4.1 (url = the steam review permalink OR the appreviews query).
// Prefer the per-review community permalink (needs author.steamid); fall back to the appreviews
// query URL which is itself resolvable + verifiable.
const queryUrl = id =>
  `https://store.steampowered.com/appreviews/${id}?json=1&filter=recent&language=english` +
  `&num_per_page=${NUM_PER_PAGE}&review_type=all&purchase_type=all&cursor=*`;
const reviewPermalink = (id, rev) =>
  (rev && rev.author && rev.author.steamid)
    ? `https://steamcommunity.com/profiles/${rev.author.steamid}/recommended/${id}/`
    : queryUrl(id);

// Default = EMPTY slot (provenance contract): no source_url/date => evidence_strength 'none',
// no evidence_quote. The coverage gate (§3) treats this as "demand not found here".
let demand = {
  evidence_quote:        '',
  evidence_sources:      [],          // [{url, date}] ; Build Final Record JSON.stringify()s it
  evidence_as_of:        null,        // review date (YYYY-MM-DD) ; null => slot empty
  evidence_strength:     'none',      // 'explicit' only when a verbatim dated request is found
  evidence_decay_weight: null,
  pain_signal:           item.pain_signal || ''   // refreshed below only if we find demand
};

if (appId) {
  let body = null;
  try {
    // Single unauthenticated request per app (spec §4.1 free-tier). Steam returns the review list.
    body = await this.helpers.httpRequest({
      method: 'GET',
      url: `https://store.steampowered.com/appreviews/${appId}`,
      qs: {
        json: 1,
        filter: 'recent',
        language: 'english',
        num_per_page: NUM_PER_PAGE,
        review_type: 'all',
        purchase_type: 'all',
        cursor: '*'
      },
      headers: { 'Accept': 'application/json' },
      json: true,
      timeout: 15000
    });
  } catch (e) {
    // Network/endpoint failure => leave slot EMPTY (no fabrication). Surface for debugging.
    body = null;
    demand._demand_fetch_error = String(e && e.message ? e.message : e);
  }

  const reviews = (body && body.success === 1 && Array.isArray(body.reviews)) ? body.reviews : [];
  const cutoffUnix = Math.floor(NOW_MS / 1000) - WINDOW_DAYS * 86400;

  // Keep reviews from the last ~90 days (timestamp_created) that mention >=1 demand keyword.
  const candidates = [];
  for (const rev of reviews) {
    const ts = Number(rev && rev.timestamp_created);
    if (!Number.isFinite(ts) || ts < cutoffUnix) continue;       // out of window or undated => skip
    const text = (rev && typeof rev.review === 'string') ? rev.review.trim() : '';
    if (!text) continue;
    const kws = matchedKeywords(text);
    if (!kws.length) continue;                                    // no demand language => skip
    const playtime = Number(rev && rev.author && rev.author.playtime_forever) || 0;
    const reqYes   = isRequest(text);
    candidates.push({ rev, ts, text, kws, playtime, reqYes });
  }

  if (candidates.length) {
    // Pick the SINGLE strongest dated quote (spec §4.1): prefer an explicit feature request, then
    // higher author.playtime_forever (engaged player), then more recent. Engine-generic ranking.
    candidates.sort((a, b) => {
      if (a.reqYes !== b.reqYes)         return a.reqYes ? -1 : 1;       // explicit request first
      if (b.playtime !== a.playtime)     return b.playtime - a.playtime; // higher playtime first
      return b.ts - a.ts;                                                // most recent first
    });
    const best = candidates[0];
    const dateIso = new Date(best.ts * 1000).toISOString().slice(0, 10);
    const url = reviewPermalink(appId, best.rev);

    // evidence_strength = 'explicit' ONLY when a verbatim dated REQUEST is found, else 'none'
    // (spec §4.1). A keyword-only mention without a request cue is real but not an explicit ask,
    // so it does not clear the 'explicit' bar; we still record it so the gate can see the date.
    const strength = best.reqYes ? 'explicit' : 'inferred';

    // Trim the quote to a single mirrorable line (keeps the draft to 1-2 specifics, research §2.3).
    let quote = best.text.replace(/\s+/g, ' ').trim();
    if (quote.length > 280) quote = quote.slice(0, 277).trimEnd() + '...';

    const ageDays = Math.max(0, (NOW_MS - best.ts * 1000) / 86400000);
    const decay   = Math.round(Math.exp(-ageDays / HALFLIFE_DAYS) * 1000) / 1000;

    demand = {
      evidence_quote:        quote,
      evidence_sources:      [{ url, date: dateIso }],   // provenance: resolvable url + date
      evidence_as_of:        dateIso,                    // review date drives recency decay
      evidence_strength:     strength,                   // 'explicit' iff verbatim dated request
      evidence_decay_weight: decay,
      // Refresh pain_signal from the same evidence (spec §4.1 "refresh pain_signal"). One line,
      // naming the matched offering(s) so the drafter has a concrete, sourced hook.
      pain_signal:           `Players asking for ${[...new Set(best.kws)].join('/')} ` +
                             `(Steam review ${dateIso})`
    };
  }
  // else: no qualifying review in window => slot stays EMPTY (spec §4.1 "Fallback: none in v1").
}

// Write the demand-signal quad back onto the item. We do NOT overwrite evidence_* that the LLM
// drafter may emit later (Build Final Record already prefers LLM-emitted evidence and falls back
// to existing intel). Carrying these under _demand keeps the filler's contribution explicit and
// lets Build Final Record / the coverage gate read a sourced, dated demand slot.
return [{
  json: {
    ...item,
    // Direct slot fields (real publishers columns) - what the gate (§3) and persistence read:
    evidence_quote:        demand.evidence_quote,
    evidence_sources:      demand.evidence_sources,   // array; Build Final Record stringifies it
    evidence_as_of:        demand.evidence_as_of,
    evidence_strength:     demand.evidence_strength,
    evidence_decay_weight: demand.evidence_decay_weight,
    pain_signal:           demand.pain_signal,
    // Namespaced copy for traceability / the coverage-gate node, and any fetch error surfaced:
    _demand: demand
  }
}];
