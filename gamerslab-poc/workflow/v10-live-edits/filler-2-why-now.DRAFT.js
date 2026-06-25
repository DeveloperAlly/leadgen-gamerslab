// =============================================================================
// Filler 2 - Why-now trigger  (DRAFT, PRE-GATE - NOT applied to live v10)
// =============================================================================
// Spec: how/prospect_dossier_build_spec_DRAFT.md  4.2 (the #1 relevance lever).
// Research: how/prospect_dossier_research_DRAFT.md  2.1-2.2 (Fit x Intent x Timing;
//   a trigger is a discrete, timestamped, verifiable change with a source url and a date).
//
// PLACEMENT (spec 4): a Code node added to the live engine MouIeDmDAAHKIpDn between
//   `Merge All Data`  ->  `Build Final Record`.
//   Sibling fillers (4.1 demand, 4.3 contact, ...) sit in the same band.
//
// CONTRACT (spec 1): every dossier slot value is a provenance quad
//   { value, source_url, date, evidence_strength }. A value WITHOUT a source_url OR a
//   date is EMPTY by definition. This node never writes a why_now string it cannot date
//   and source; when it cannot, it writes empty + evidence_strength='none' so the
//   coverage gate (spec 3) routes the lead to hold/enrich_more instead of a blind draft.
//
// WRITES (spec 4.2 -> live public.publishers columns, verified 2026-06-24):
//   why_now              text      (new col, spec 2 Wave 0)   - one-line trigger
//   why_now_source       text      (new col, spec 2 Wave 0)   - url OR "steam:..." token
//   why_now_as_of        date      (new col, spec 2 Wave 0)   - event date YYYY-MM-DD
//   trigger_class        text      (new col, spec 2 Wave 0)   - one of TRIGGER_CLASSES
//   why_now_decay_weight numeric   (new col, spec 2 Wave 0)   - exp(-age/halflife[class]); slot-2
//                                                                decay ONLY. Demand (filler-3) owns
//                                                                evidence_decay_weight; never touch it here.
//   game_phase           text      (EXISTING col)             - promoted to a primary
//                                                                Pre-Score weight (spec 4.2)
//   (passthrough: this node spreads the incoming record and only overwrites the slot keys.)
//
// SCHEMA NOTE (verified live ccmwksmgoisijvyovgko 2026-06-24): release_date is TEXT,
//   coming_soon BOOLEAN, game_phase TEXT, total_reviews INTEGER, steam_app_id TEXT.
//   The four why_now* columns and trigger_class are NOT yet present (correct: pre-gate;
//   they ship in the spec 2 migration that is NOT applied by this draft).
//
// MODULARITY (mandate #7, spec 7): Steam News + release_date + review-velocity = the
//   VENUE ADAPTER (swappable); TRIGGER_CLASSES + windows = TENANT CONFIG; the classify /
//   decay / pick-strongest logic = ENGINE-GENERIC. No GamersLab noun and no Steam
//   assumption is baked into the generic logic below.
//
// FREE-TIER (mandate #8): GetNewsForApp is a keyless public endpoint, one request per app.
//   The Exa news fallback rides the existing per-lead Exa budget, capped at ONE query, and
//   is a SOFT dependency (see EXA_FALLBACK) - this draft does NOT call any paid endpoint.
//
// VERIFICATION (read-only, 2026-06-24): GetNewsForApp v0002 shape confirmed on appid=730
//   (CS2) and appid=1245620 (Elden Ring). Response =
//     { appnews: { appid:int, count:int, newsitems: [ {
//         gid, title, url, is_external_url, author, contents,
//         feedlabel, date /*unix int*/, feedname, feed_type, appid } ] } }
//   `date` is a unix-seconds integer; `url` is the item permalink; external posts set
//   is_external_url=true and carry a third-party feedname (e.g. "Gamemag.ru").
// =============================================================================


// ---------------------------------------------------------------------------
// CONFIG  (spec 4.2 "trigger classes + windows = config"; tenant-overridable).
// Keep ALL tunables here so a new tenant/venue overrides config, never engine code.
// ---------------------------------------------------------------------------
const CONFIG = {
  // Steam News venue adapter (spec 4.2 "Calls"). count/maxlength per spec.
  NEWS_ENDPOINT: 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/',
  NEWS_COUNT: 10,
  NEWS_MAXLENGTH: 600,
  NEWS_TIMEOUT_MS: 8000,

  // Decay windows from spec 4.2 / research 2.2. halflife_days drives
  //   why_now_decay_weight = exp(-age_days / halflife). window_days is the
  //   freshness cutoff the coverage gate (spec 3) treats as "in window".
  // A class is FRESH while age_days <= window_days; older = stale (down-weighted,
  // and the gate will not count it toward draft_ready).
  // CANONICAL SOURCE: config/trigger-classes.DRAFT.json. This inline copy MUST equal it;
  // filler-coverage-gate.DRAFT.js carries the same windows. Keep all three in sync (review conflict 3).
  TRIGGER_CLASSES: {
    funding:        { window_days: 90, halflife_days: 30 }, // ~90d useful (research 2.2)
    exec:           { window_days: 90, halflife_days: 45 }, // 30-90d (champion/exec move)
    launch:         { window_days: 21, halflife_days: 10 }, // days-weeks around the date
    patch:          { window_days: 21, halflife_days: 10 }, // major patch = same window
    update:         { window_days: 14, halflife_days: 7  }, // minor update, shorter
    coming_soon:    { window_days: 60, halflife_days: 30 }, // pre-launch interest window
    pain_velocity:  { window_days: 10, halflife_days: 4  }, // review spike 5-10d (research 2.2)
  },

  // Class precedence when more than one signal fires for a lead (highest relevance wins).
  // launch/patch (dated, public, in-window) beats a velocity spike beats a release-derived
  // window. Engine-generic ordering over the config keys above.
  CLASS_PRIORITY: ['launch', 'patch', 'update', 'coming_soon', 'pain_velocity'],

  // Newsitem -> class keyword sets (VENUE/TENANT config). Matched against title+contents,
  // case-insensitive, word-ish. Generic gaming-news vocabulary, not GamersLab-specific.
  NEWS_KEYWORDS: {
    launch: ['now available', 'out now', 'launch', 'released', 'release date',
             'leaves early access', 'full release', '1.0', 'available now'],
    patch:  ['patch', 'hotfix', 'major update', 'season', 'content update',
             'big update', 'expansion', 'dlc'],
    update: ['update', 'changelog', 'patch notes', 'fixes', 'balance'],
  },
  // Only trust an item's class if the item is fresh enough for ANY of these classes.
  // (We still record the date; freshness gating is the coverage gate's job, but we will
  //  not mislabel an ancient post as a live "launch".)

  // Review-velocity (pain_velocity) trigger. delta over days_elapsed; a spike beyond
  // the rate threshold OR the absolute threshold (whichever the prior baseline supports)
  // is a pain_velocity trigger. Engine-generic; thresholds are tenant config.
  VELOCITY: {
    min_reviews_per_day: 25,   // sustained add-rate that counts as a spike
    min_abs_delta: 150,        // OR an absolute jump since last run
    max_baseline_age_days: 30, // ignore a stale baseline (avoids dividing by a huge gap)
  },

  // Exa news-search fallback (spec 4.2 "Fallback"). SOFT, capped at 1 query, FREE budget.
  // This draft authors the call shape but does NOT execute a paid endpoint. If the Exa
  // result is unavailable at deploy time the node degrades to empty (never fabricates).
  EXA_FALLBACK: {
    enabled: true,
    max_queries: 1,
    // query template is studio-name based (engine-generic); {studio} filled at runtime.
    query_template: '{studio} game launch OR update OR patch OR funding news',
    // Node name to read the already-fetched Exa results from, IF the engine is wired to
    // run a news-scoped Exa search upstream. Left as a named seam, not a live fetch here.
    upstream_node: 'Exa: News Fallback',
    lookback_days: 30, // only accept a fallback hit dated within this window
  },

  // game_phase promotion (spec 4.2 "Promote game_phase/launch-window to a primary
  // Pre-Score weight"). This node does not own Pre-Score; it emits the derived phase and
  // a flag the Pre-Score node can read. Kept here as config for the weight hint.
  PHASE_PRESCORE_HINT: { launch: 3, coming_soon: 2, live: 1, sunset: 0 },
};


// ---------------------------------------------------------------------------
// ENGINE-GENERIC HELPERS (no venue/tenant nouns).
// ---------------------------------------------------------------------------
const TODAY = new Date();

function ymd(d) {
  // -> "YYYY-MM-DD" or null. Accepts Date | unix-seconds | "YYYY-MM-DD" | parseable string.
  if (d === null || d === undefined || d === '') return null;
  let dt;
  if (d instanceof Date) dt = d;
  else if (typeof d === 'number') dt = new Date(d * 1000);            // unix seconds
  else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;                   // already a date
  else { const t = Date.parse(d); if (isNaN(t)) return null; dt = new Date(t); }
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function ageDays(dateStr) {
  // whole days between an event date and today; null if undatable.
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((TODAY.getTime() - t) / 86400000));
}

// spec 4.2: why_now_decay_weight = exp(-age_days / halflife[class]). Rounded to 3dp,
// matching the existing convention in build-final-record.APPLIED.js (N9). null when undated.
function decayWeight(dateStr, halflifeDays) {
  const age = ageDays(dateStr);
  if (age === null || !halflifeDays) return null;
  return Math.round(Math.exp(-age / halflifeDays) * 1000) / 1000;
}

function inWindow(dateStr, windowDays) {
  const age = ageDays(dateStr);
  return age !== null && age <= windowDays;
}

function kwHit(text, words) {
  const hay = (text || '').toLowerCase();
  return words.some(w => hay.includes(w.toLowerCase()));
}

// Classify a single newsitem -> class | null. Engine-generic over NEWS_KEYWORDS config.
function classifyNewsItem(item) {
  const text = (item.title || '') + ' ' + (item.contents || '');
  if (kwHit(text, CONFIG.NEWS_KEYWORDS.launch)) return 'launch';
  if (kwHit(text, CONFIG.NEWS_KEYWORDS.patch))  return 'patch';
  if (kwHit(text, CONFIG.NEWS_KEYWORDS.update)) return 'update';
  return null;
}

function pick(rec, keys, dflt) {
  for (const k of keys) {
    if (rec && rec[k] !== undefined && rec[k] !== null && rec[k] !== '') return rec[k];
  }
  return dflt;
}


// ---------------------------------------------------------------------------
// INPUT (spec 4.2 "Input"): steam_app_id, release_date/coming_soon already computed,
// prior-run total_reviews for the velocity delta.
//
// This node sits after `Merge All Data`, so the merged steam record is on $json.
// Field names match build-final-record.APPLIED.js (src.*) and the live publishers cols.
// prior_total_reviews is the value from the LAST run for this steam_app_id. At deploy
// time, wire ONE of:
//   (a) an upstream Supabase "Select prior publishers row" node keyed on steam_app_id,
//       exposing { total_reviews, why_now_as_of } as $('Prior Publishers Row'); OR
//   (b) a run-state table.
// Until wired, prior is read defensively and velocity simply does not fire (no fabrication).
// ---------------------------------------------------------------------------
const rec = $input.first().json;

const steam_app_id = String(pick(rec, ['steam_app_id'], '')).trim();
if (!steam_app_id) throw new Error('filler-2-why-now: steam_app_id missing on merged record');

const release_date_raw = pick(rec, ['release_date'], '');     // text per live schema
const coming_soon      = pick(rec, ['coming_soon'], false) === true || rec.coming_soon === 'true';
const total_reviews    = Number(pick(rec, ['total_reviews'], 0)) || 0;
const studio           = String(pick(rec, ['developer_name', 'publisher_name', 'game_name'], '')).trim();

// Prior-run baseline for velocity (soft; see INPUT note). Defensive lookup of the optional node.
let prior_total_reviews = null;
let prior_as_of = null;
try {
  const prior = $('Prior Publishers Row').first().json; // optional upstream Supabase read
  if (prior) {
    prior_total_reviews = (prior.total_reviews === null || prior.total_reviews === undefined)
      ? null : Number(prior.total_reviews);
    prior_as_of = prior.why_now_as_of || prior.updated_at || prior.created_at || null;
  }
} catch (_e) { /* node not wired yet -> velocity stays inactive, never fabricated */ }


// ---------------------------------------------------------------------------
// SIGNAL 1 - Steam News (venue adapter). Keyless, one request. (spec 4.2 Calls)
// ---------------------------------------------------------------------------
let newsTrigger = null; // { class, why_now, source_url, date }
try {
  const url = CONFIG.NEWS_ENDPOINT
    + '?appid=' + encodeURIComponent(steam_app_id)
    + '&count='     + CONFIG.NEWS_COUNT
    + '&maxlength=' + CONFIG.NEWS_MAXLENGTH
    + '&format=json';

  // n8n Code node helper. (At deploy this may instead be an HTTP Request node feeding $json;
  // the parse below is agnostic to which - it reads appnews.newsitems either way.)
  const resp = await this.helpers.httpRequest({
    method: 'GET',
    url,
    json: true,
    timeout: CONFIG.NEWS_TIMEOUT_MS,
  });

  const items = (resp && resp.appnews && Array.isArray(resp.appnews.newsitems))
    ? resp.appnews.newsitems : [];

  // Classify every item, keep those that classify AND are in-window for their class,
  // then choose by CLASS_PRIORITY, breaking ties by most-recent date.
  const candidates = [];
  for (const it of items) {
    const cls = classifyNewsItem(it);
    if (!cls) continue;
    const dateStr = ymd(it.date);                 // unix int -> YYYY-MM-DD
    if (!dateStr) continue;                        // no date => not a trigger (spec 1)
    const win = CONFIG.TRIGGER_CLASSES[cls].window_days;
    if (!inWindow(dateStr, win)) continue;         // stale for its class => skip
    candidates.push({
      class: cls,
      date: dateStr,
      source_url: it.url || '',                    // permalink; '' => slot stays empty (spec 1)
      title: (it.title || '').trim(),
      priority: CONFIG.CLASS_PRIORITY.indexOf(cls),
    });
  }
  candidates.sort((a, b) =>
    (a.priority - b.priority) || (b.date.localeCompare(a.date)));

  const top = candidates.find(c => c.source_url); // require a source_url to be non-empty
  if (top) {
    newsTrigger = {
      class: top.class,
      why_now: top.title || (top.class + ' on ' + top.date),
      source_url: top.source_url,
      date: top.date,
    };
  }
} catch (_e) {
  // network/endpoint failure -> fall through to other signals. Never throw on a soft signal.
  newsTrigger = null;
}


// ---------------------------------------------------------------------------
// SIGNAL 2 - Review-velocity delta -> pain_velocity (spec 4.2). Engine-generic.
//   delta = total_reviews(now) - total_reviews(prior); rate = delta / days_elapsed.
// Source is a synthetic provenance token (no external url exists for a velocity fact),
// but it still carries a DATE (today, the observation date) so it satisfies the quad.
// ---------------------------------------------------------------------------
let velocityTrigger = null;
if (prior_total_reviews !== null && total_reviews > prior_total_reviews) {
  const baseAge = ageDays(ymd(prior_as_of));
  const daysElapsed = (baseAge && baseAge > 0) ? baseAge : 1; // guard divide-by-zero
  if (!baseAge || baseAge <= CONFIG.VELOCITY.max_baseline_age_days) {
    const delta = total_reviews - prior_total_reviews;
    const perDay = delta / daysElapsed;
    if (perDay >= CONFIG.VELOCITY.min_reviews_per_day || delta >= CONFIG.VELOCITY.min_abs_delta) {
      const obs = ymd(TODAY);
      velocityTrigger = {
        class: 'pain_velocity',
        why_now: 'Review velocity spike: +' + delta + ' reviews ('
          + Math.round(perDay) + '/day over ' + daysElapsed + 'd)',
        // synthetic source token (spec 4.2 allows "steam:appreviews-velocity"); dated by obs.
        source_url: 'steam:appreviews-velocity:' + steam_app_id,
        date: obs,
      };
    }
  }
}


// ---------------------------------------------------------------------------
// SIGNAL 3 - Launch / coming_soon derived from release_date (spec 4.2). Engine-generic.
//   If release_date is in the near past and in the launch window -> launch trigger.
//   If coming_soon true (or release_date in the future) -> coming_soon trigger.
// ---------------------------------------------------------------------------
let releaseTrigger = null;
{
  const rd = ymd(release_date_raw);
  if (coming_soon) {
    releaseTrigger = {
      class: 'coming_soon',
      why_now: rd ? ('Launching soon (release_date ' + rd + ')') : 'Marked coming soon on Steam',
      source_url: 'steam:release_date:' + steam_app_id,
      date: rd || ymd(TODAY), // observation date when no concrete release date is set
    };
  } else if (rd) {
    const age = ageDays(rd);
    if (age !== null && age < 0) {
      // future-dated but not flagged coming_soon -> treat as coming_soon
      releaseTrigger = {
        class: 'coming_soon',
        why_now: 'Upcoming release (release_date ' + rd + ')',
        source_url: 'steam:release_date:' + steam_app_id,
        date: rd,
      };
    } else if (inWindow(rd, CONFIG.TRIGGER_CLASSES.launch.window_days)) {
      releaseTrigger = {
        class: 'launch',
        why_now: 'Recently launched (release_date ' + rd + ')',
        source_url: 'steam:release_date:' + steam_app_id,
        date: rd,
      };
    }
  }
}


// ---------------------------------------------------------------------------
// SIGNAL 4 - Exa news-search fallback (spec 4.2 "Fallback"). SOFT, capped, FREE.
// Only consulted when none of the Steam signals fired. This draft reads an OPTIONAL
// upstream Exa-news node if the engine is wired for it; it does NOT execute a paid call
// and never fabricates. The query template is studio-name based (engine-generic).
// ---------------------------------------------------------------------------
let exaTrigger = null;
const anySteam = newsTrigger || velocityTrigger || releaseTrigger;
if (!anySteam && CONFIG.EXA_FALLBACK.enabled && studio) {
  try {
    const exa = $(CONFIG.EXA_FALLBACK.upstream_node).first().json; // optional, soft
    const results = (exa && Array.isArray(exa.results)) ? exa.results : [];
    // pick first result that has a resolvable url AND a parseable published date in lookback.
    for (const r of results) {
      const dateStr = ymd(r.publishedDate || r.published_date || r.date);
      const link = r.url || r.link || '';
      if (!dateStr || !link) continue;            // no date or no url => not a trigger (spec 1)
      if (!inWindow(dateStr, CONFIG.EXA_FALLBACK.lookback_days)) continue;
      const title = (r.title || '').trim();
      // best-effort class from the headline; default to 'update' (least-strong news class).
      const cls = classifyNewsItem({ title, contents: r.text || r.snippet || '' }) || 'update';
      exaTrigger = { class: cls, why_now: title || 'Recent studio news', source_url: link, date: dateStr };
      break;
    }
  } catch (_e) {
    exaTrigger = null; // node not wired / no budget -> stay empty
  }
}


// ---------------------------------------------------------------------------
// SELECT the winning trigger by CLASS_PRIORITY, then recency. (spec 4.2)
// ---------------------------------------------------------------------------
const all = [newsTrigger, velocityTrigger, releaseTrigger, exaTrigger].filter(Boolean);
all.sort((a, b) => {
  const pa = CONFIG.CLASS_PRIORITY.indexOf(a.class);
  const pb = CONFIG.CLASS_PRIORITY.indexOf(b.class);
  if (pa !== pb) return pa - pb;
  return (b.date || '').localeCompare(a.date || '');
});
const winner = all[0] || null;


// ---------------------------------------------------------------------------
// EMIT the provenance quad onto the record (spec 1 + 4.2).
// A winner WITHOUT a source_url or a date is rejected to empty (the quad rule).
// ---------------------------------------------------------------------------
let why_now = '';
let why_now_source = '';
let why_now_as_of = null;            // DATE column -> null when empty (not '')
let trigger_class = null;
let why_now_decay_weight = null;  // slot-2 decay ONLY. Demand (filler-3) owns evidence_decay_weight; this node never reads or writes it (review conflict 1).

if (winner && winner.source_url && winner.date) {
  const klass = winner.class;
  const halflife = (CONFIG.TRIGGER_CLASSES[klass] || {}).halflife_days || null;
  why_now = String(winner.why_now || '').slice(0, 280).trim();
  why_now_source = winner.source_url;
  why_now_as_of = winner.date;
  trigger_class = klass;
  // spec 4.2: why_now_decay_weight = exp(-age_days / halflife[class]). Slot-2 decay column,
  // kept separate from demand's evidence_decay_weight (review conflict 1).
  const w = decayWeight(why_now_as_of, halflife);
  if (w !== null) why_now_decay_weight = w;
}
// else: no grounded trigger. why_now stays '' and why_now_as_of stays null => the slot is
// EMPTY by definition (spec 1). The coverage gate (spec 3) will route to hold/enrich_more.
// evidence_strength for slot 2 is implicit: empty here means "none" to the gate.

// game_phase promotion hint (spec 4.2). We do not overwrite an existing game_phase; we
// surface a Pre-Score weight hint the Pre-Score node can consume. Engine-generic.
const game_phase = pick(rec, ['game_phase'], (coming_soon ? 'coming_soon' : ''));
const why_now_prescore_hint =
  (CONFIG.PHASE_PRESCORE_HINT[trigger_class] !== undefined)
    ? CONFIG.PHASE_PRESCORE_HINT[trigger_class]
    : (CONFIG.PHASE_PRESCORE_HINT[game_phase] || 0);


// ---------------------------------------------------------------------------
// RETURN: spread the incoming record, overwrite only the slot-2 keys. Downstream
// `Build Final Record` and `Upsert to Supabase` (autoMapInputData) carry these to the
// matching publishers columns by name.
// ---------------------------------------------------------------------------
return [{ json: {
  ...rec,
  why_now,                  // text
  why_now_source,           // text
  why_now_as_of,            // date | null
  trigger_class,            // text | null
  why_now_decay_weight,     // numeric | null (slot-2 decay; demand owns evidence_decay_weight)
  game_phase,               // text (preserved/derived)
  // non-persisted hint for the Pre-Score node (spec 4.2 game_phase promotion):
  why_now_prescore_hint,
  // debug breadcrumb (not a column; safe to drop before upsert if the node is strict):
  _why_now_signals: {
    news: !!newsTrigger,
    velocity: !!velocityTrigger,
    release: !!releaseTrigger,
    exa_fallback: !!exaTrigger,
    prior_total_reviews,
  },
}}];

// =============================================================================
// ACCEPTANCE (spec 4.2): on a fresh discovery run, new rows carry a populated why_now +
//   why_now_as_of at a usable rate; trigger_class distribution is non-degenerate; a stale
//   event shows a low why_now_decay_weight. READ-ONLY check after a (later, gated) run:
//
//   SELECT trigger_class, count(*),
//          round(avg(why_now_decay_weight)::numeric, 3) AS avg_decay
//   FROM public.publishers
//   WHERE why_now <> '' AND why_now_as_of IS NOT NULL AND created_at > '<run_ts>'
//   GROUP BY trigger_class ORDER BY 2 DESC;
//
//   -- empties surfaced (gate fodder, not drafted):
//   SELECT count(*) FILTER (WHERE why_now = '' OR why_now_as_of IS NULL) AS empty_why_now
//   FROM public.publishers WHERE created_at > '<run_ts>';
// =============================================================================
