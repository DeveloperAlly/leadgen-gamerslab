// Filler 5 - Deterministic peer match (Lane A4)  -  DRAFT, PRE-GATE. NOT APPLIED to live v10.
// ---------------------------------------------------------------------------------------------
// Spec:  how/prospect_dossier_build_spec_DRAFT.md  S4.4 (authoritative)  +  S1 provenance/method,
//        S3 coverage gate item 2 ("Slot 5 has a peer_publisher_ref with method='deterministic'"),
//        S7 modularity ledger row "5 peer" (venue=none-internal, tenant config=the 6-peer catalogue
//        map, engine-generic=nearest-vector matcher).
// Why:   how/prospect_dossier_research_DRAFT.md  S2.6 lever #4 ("a deterministic peer match -
//        catalogue-relevant proof: 'a game like yours is already here'") and S8 ("Deterministic
//        nearest-catalogue lookup ... not LLM-guessed"). Replaces today's LLM free-choice /
//        hardcoded peer ternary (spec S4.4 "Replaces today's LLM free-choice / hardcoded ternary").
//
// Placement (spec S4 preamble):  an n8n Code node added to the live v10 engine MouIeDmDAAHKIpDn
//   between "Merge All Data" and "Build Final Record". It reads the merged item (which already
//   carries primary_genre, steam_tags, and the boolean feature flags), runs the nearest-vector
//   matcher over the embedded catalogue config, and writes the peer-match slot fields back onto the
//   item so "Build Final Record" persists them to public.publishers. Because the match is a pure
//   local computation (no external call), this node is deterministic, free, and key-free.
//
// Node name (suggested):  "Filler 5 - Peer Match"
// Node type:  n8n-nodes-base.code  (Run Once for Each Item).
//
// PROVENANCE / METHOD (spec S1, S4.4):  peer match is a deterministic computation, not a sourced
//   external fact, so it carries a method marker rather than a fetched source_url. We write
//   peer_match_method='deterministic' (the gate's required evidence marker, spec S3 item 2) and a
//   namespaced _peer_match block with a synthetic source ('catalogue:<game>') + run date so any
//   downstream consumer can still read a {value, source, date, method} shape. A value with method
//   is never EMPTY for gate purposes (peer is computable from the catalogue, so it near-always
//   passes; failing it is a config smell - research S5).
//
// COLUMN NAMES are REAL public.publishers columns, verified live 2026-06-24 (project
//   ccmwksmgoisijvyovgko):
//     peer_publisher_ref(text), pitch_angle(text), best_ugc_app(text), ugc_app_pitch(text),
//     gamerslab_hook(text)  -> all exist today (text).
//     peer_match_method(text)  -> NEW column named in spec S2 (additive migration, NOT applied here).
//   Input flags read are real boolean columns: has_online_pvp, has_steam_leaderboards,
//   has_online_coop, has_multi_player, has_steam_workshop. primary_genre + steam_tags are text.
//   No invented columns.
//
// BUILD FINAL RECORD INTEROP:  build-final-record.APPLIED.js already reads peer_publisher_ref,
//   pitch_angle, best_ugc_app, ugc_app_pitch, gamerslab_hook from the parsed LLM block (p.*) and
//   falls back to _source (src.*). Writing these onto the item here (top level) makes them available
//   to that fallback path and lets the LLM stop guessing the peer. peer_match_method is a new field
//   Build Final Record should pass through once the column exists (noted for the build wave).
//
// MODULARITY (mandate #7, spec S7):  there is NO venue adapter for this slot (the data is internal).
//   The CATALOGUE_MAP below is TENANT CONFIG (GamersLab catalogue data, NOT engine logic) and is the
//   ONLY block a different client edits; the nearest-vector scorer + tie-break + quad assembly are
//   engine-generic. CANONICAL COPY of this config is the repo file
//     gamerslab-poc/workflow/config/peer-catalogue-map.DRAFT.json
//   It is embedded inline here because an n8n Code node cannot read a repo file at runtime (same
//   pattern as the sibling fillers' inline tenant-config blocks). KEEP THE TWO IN SYNC: edit the
//   JSON file first, then mirror it into CATALOGUE_MAP below. Do NOT bake a GamersLab noun into the
//   scorer below the config block.
// ---------------------------------------------------------------------------------------------

// ===== TENANT CONFIG (GamersLab catalogue map) - the ONLY client-specific block ================
// Mirror of gamerslab-poc/workflow/config/peer-catalogue-map.DRAFT.json (version 2026-06-24).
// Engine-generic code below treats this purely as data.
const CATALOGUE_MAP = {
  version: '2026-06-24',
  tenant: 'gamerslab',

  // Genre/tag keyword sets per peer. Matcher lowercases (primary_genre + ',' + steam_tags) and
  // counts how many of a peer's keywords appear as substrings. Set semantics; order irrelevant.
  genre_keywords: {
    maelstrom:         ['pvp', 'battle royale', 'battle-royale', 'multiplayer', 'competitive', 'naval', 'shooter', 'arena', '1v1', 'free for all', 'deathmatch', 'fps', 'tps'],
    nightspawn:        ['survival', 'horror', 'survival horror', 'zombie', 'open world survival', 'crafting survival', 'permadeath', 'monster'],
    masks_of_the_void: ['roguelite', 'roguelike', 'action roguelike', 'action', 'hack and slash', 'bullet hell', 'dungeon crawler', 'run-based', 'procedural'],
    dark_table_ccg:    ['card game', 'ccg', 'tcg', 'deckbuilder', 'deck building', 'card battler', 'strategy', 'turn-based strategy', 'tabletop'],
    bug_and_seek:      ['casual', 'collection', 'collectathon', 'cozy', 'creature collector', 'monster collector', 'family friendly', 'exploration', 'puzzle'],
    mullet_cop:        ['idle', 'incremental', 'simulation', 'management', 'tycoon', 'clicker', 'sim', 'business sim', 'manager']
  },

  // Per-feature weight added when BOTH the prospect flag is true AND the peer lists that flag true.
  // Tuned so a hard competitive signal outranks a soft genre keyword (genre hit = 1 each).
  feature_weights: {
    has_online_pvp:         4,
    has_steam_leaderboards: 3,
    has_online_coop:        2,
    has_multi_player:       1,
    has_steam_workshop:     2
  },
  default_genre_keyword_weight: 1,

  // The six catalogue peers + the exact UGC offering each one proves (from cag-block.md).
  catalogue: [
    {
      key: 'maelstrom',
      catalogue_game: 'Maelstrom',
      peer_publisher_ref: 'Maelstrom (Naval Battle Royale, Gunpowder Games)',
      feature_vector: { has_online_pvp: true, has_steam_leaderboards: true, has_online_coop: false, has_multi_player: true, has_steam_workshop: false },
      best_ugc_app: 'Grudge Goblin',
      ugc_app_pitch: 'Grudge Goblin is a rival tracker for multiplayer games: it watches every kill, remembers every foe, and pings players when rivals or prey queue up. It is currently tracking Maelstrom. Free for players (no install, runs in browser), free for studios (no revenue share, no per-seat fees).',
      pitch_angle: 'Hand your players a reason to come back without building any of it: a live rival tracker for your PvP community, the way Maelstrom already runs it.',
      gamerslab_hook: 'Maelstrom (a naval battle royale) is already on GamersLab with Grudge Goblin tracking its rivalries. A game like yours, with online PvP, plugs into the same rival-tracking layer.'
    },
    {
      key: 'nightspawn',
      catalogue_game: 'NightSpawn',
      peer_publisher_ref: 'NightSpawn (Horror Survival)',
      feature_vector: { has_online_pvp: false, has_steam_leaderboards: false, has_online_coop: true, has_multi_player: true, has_steam_workshop: false },
      best_ugc_app: 'GamersLab Plus',
      ugc_app_pitch: 'GamersLab Plus gives a survival title cloud save and minimal live-ops without standing up a backend, plus a free analytics dashboard most small studios do not have.',
      pitch_angle: 'Survival communities live on persistence and stats. Add a community data layer (saves, run history, leaderboards) without engineering investment, the way NightSpawn does on GamersLab.',
      gamerslab_hook: 'NightSpawn (horror survival) is already on GamersLab. A survival game like yours can offer the same persistent community layer without touching your game code.'
    },
    {
      key: 'masks_of_the_void',
      catalogue_game: 'Masks of the Void: Infinity',
      peer_publisher_ref: 'Masks of the Void: Infinity (Action Roguelite, Epic Games Store)',
      feature_vector: { has_online_pvp: false, has_steam_leaderboards: true, has_online_coop: false, has_multi_player: false, has_steam_workshop: false },
      best_ugc_app: 'Tournament Garden',
      ugc_app_pitch: 'Tournament Garden turns any single or multiplayer game into a tournament or leaderboard. For a run-based roguelite this means seasonal leaderboards and community challenge runs with no backend work.',
      pitch_angle: 'Run-based games thrive on leaderboards and challenge events. Stand up seasonal tournaments and ranked runs instantly, the way Masks of the Void does on GamersLab.',
      gamerslab_hook: 'Masks of the Void: Infinity (an action roguelite) is already on GamersLab. A run-based game like yours can add leaderboards and challenge events the same way.'
    },
    {
      key: 'dark_table_ccg',
      catalogue_game: 'Dark Table CCG',
      peer_publisher_ref: 'Dark Table CCG (Card Game)',
      feature_vector: { has_online_pvp: true, has_steam_leaderboards: true, has_online_coop: false, has_multi_player: true, has_steam_workshop: false },
      best_ugc_app: 'Tournament Garden',
      ugc_app_pitch: 'Tournament Garden gives a competitive card game ladders, tournaments and leaderboards out of the box. 12 tournaments are growing this week across the platform.',
      pitch_angle: 'Card and strategy communities organise around ladders and tournaments. Hand them ranked play and event infrastructure with no engineering, the way Dark Table CCG does on GamersLab.',
      gamerslab_hook: 'Dark Table CCG (a competitive card game) is already on GamersLab running tournaments. A strategy or card game like yours plugs into the same ladder and tournament layer.'
    },
    {
      key: 'bug_and_seek',
      catalogue_game: 'Bug & Seek',
      peer_publisher_ref: 'Bug & Seek (Casual Collection)',
      feature_vector: { has_online_pvp: false, has_steam_leaderboards: true, has_online_coop: false, has_multi_player: false, has_steam_workshop: false },
      best_ugc_app: 'Bug & Seek Companion',
      ugc_app_pitch: 'Bug & Seek Companion gives a casual collection game a rolling leaderboard, a stats tracker and a custom questing system. Best for casual or collection games with daily active communities.',
      pitch_angle: 'Daily-active casual communities want streaks, quests and a stats companion. Add exactly that with no backend, the way Bug & Seek runs its companion on GamersLab.',
      gamerslab_hook: 'Bug & Seek (a casual collection game) is already on GamersLab with its own companion app. A daily-play game like yours can offer the same rolling leaderboard and questing layer.'
    },
    {
      key: 'mullet_cop',
      catalogue_game: 'Mullet Cop',
      peer_publisher_ref: 'Mullet Cop (Idle Sim Manager, itch.io)',
      feature_vector: { has_online_pvp: false, has_steam_leaderboards: true, has_online_coop: false, has_multi_player: false, has_steam_workshop: false },
      best_ugc_app: 'GamersLab Plus',
      ugc_app_pitch: 'GamersLab Plus gives an idle or sim title cloud save and minimal live-ops plus a free analytics dashboard, so a small team gets persistence and player insight without standing up a backend.',
      pitch_angle: 'Idle and management games run on long-tail progression. Add cloud saves, a stats layer and live-ops without engineering, the way Mullet Cop does on GamersLab.',
      gamerslab_hook: 'Mullet Cop (an idle sim manager) is already on GamersLab. An idle or sim game like yours can add persistence and a free analytics layer the same way.'
    }
  ],

  // Used only when a prospect scores 0 against every peer. Broadest catch-all = casual/collection.
  fallback: { peer_key: 'bug_and_seek' }
};
// =============================================================================================

// ===== ENGINE-GENERIC nearest-vector matcher (no GamersLab nouns below this line) ==============
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const item = $input.item.json;

// Build the prospect vector from real columns. Coerce loosely: the engine may surface flags as
// booleans or as truthy strings depending on the upstream node, so normalise to boolean.
const truthy = v => v === true || v === 'true' || v === 1 || v === '1';
const FEATURE_KEYS = Object.keys(CATALOGUE_MAP.feature_weights);
const prospectFlags = {};
for (const k of FEATURE_KEYS) prospectFlags[k] = truthy(item[k]);

// Genre/tag haystack: primary_genre + steam_tags (steam_tags is a comma string), lowercased.
const haystack = ((item.primary_genre || '') + ',' + (item.steam_tags || '')).toLowerCase();

// Score every peer. score = sum(matched genre keywords * default_genre_keyword_weight)
//                            + sum(feature_weight where prospect flag true AND peer flag true).
// Track shared_feature_count separately for the tie-break (spec S4.4 "ties break by shared
// feature count"). Config order is the final, deterministic tie-break.
function scorePeer(peer, idx) {
  const kws = CATALOGUE_MAP.genre_keywords[peer.key] || [];
  let genreHits = 0;
  for (const kw of kws) if (kw && haystack.includes(kw)) genreHits += 1;

  let featureScore = 0;
  let sharedFeatures = 0;
  for (const k of FEATURE_KEYS) {
    const peerHas = !!(peer.feature_vector && peer.feature_vector[k]);
    if (prospectFlags[k] && peerHas) {
      featureScore += (CATALOGUE_MAP.feature_weights[k] || 0);
      sharedFeatures += 1;
    }
  }

  const score = genreHits * CATALOGUE_MAP.default_genre_keyword_weight + featureScore;
  return { peer, idx, score, genreHits, featureScore, sharedFeatures };
}

const scored = CATALOGUE_MAP.catalogue.map((p, i) => scorePeer(p, i));

// Nearest wins; tie-break by shared_feature_count desc, then config order asc (stable, deterministic).
scored.sort((a, b) => {
  if (b.score !== a.score)                   return b.score - a.score;
  if (b.sharedFeatures !== a.sharedFeatures) return b.sharedFeatures - a.sharedFeatures;
  return a.idx - b.idx;
});

let winner = scored[0];
let usedFallback = false;

// If the top candidate scored nothing (no genre hit, no shared feature), use the configured
// fallback peer so the coverage gate (spec S3 item 2) still resolves. Flag it so qualification
// (filler 6) can down-weight a fallback peer rather than treat it as a true genre match.
if (!winner || winner.score <= 0) {
  const fbKey = CATALOGUE_MAP.fallback && CATALOGUE_MAP.fallback.peer_key;
  const fbScored = scored.find(s => s.peer.key === fbKey) || scored[0];
  winner = fbScored;
  usedFallback = true;
}

const peer = winner.peer;

// Provenance shape (spec S1): synthetic source + run date + method. Peer match is computed, not
// fetched, so method='deterministic' is the evidence marker the gate reads (spec S3 item 2).
const peerMatch = {
  value:              peer.peer_publisher_ref,
  source_url:         'catalogue:' + peer.key,     // internal, resolvable to the config row
  date:               TODAY_ISO,
  evidence_strength:  'explicit',                  // deterministic over known catalogue data
  peer_match_method:  'deterministic',
  matched_peer_key:   peer.key,
  score:              winner.score,
  genre_hits:         winner.genreHits,
  feature_score:      winner.featureScore,
  shared_features:    winner.sharedFeatures,
  used_fallback:      usedFallback,
  catalogue_version:  CATALOGUE_MAP.version
};

// Write the peer-match slot fields back onto the item (real publishers columns) so Build Final
// Record persists them and the LLM no longer free-chooses the peer. Namespaced _peer_match keeps
// the scoring trace + provenance for the coverage gate and for spot-check acceptance (spec S4.4).
return [{
  json: {
    ...item,
    peer_publisher_ref: peer.peer_publisher_ref,
    pitch_angle:        peer.pitch_angle,
    best_ugc_app:       peer.best_ugc_app,
    ugc_app_pitch:      peer.ugc_app_pitch,
    gamerslab_hook:     peer.gamerslab_hook,
    peer_match_method:  'deterministic',            // NEW column (spec S2); pass-through at build time
    _peer_match:        peerMatch
  }
}];
