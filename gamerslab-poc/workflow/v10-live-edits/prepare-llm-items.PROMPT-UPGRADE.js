
const d      = $input.item.json;
const models = d.free_models || [];
const model   = models[Math.floor(Date.now() / 1000) % models.length];
if (!models || !models.length) throw new Error('No free models from OpenRouter.');

const bestUgcApp = (d.has_online_pvp || d.has_multi_player)
  ? 'Grudge Goblin (grudgegoblin.com)'
  : 'Tournament Garden';
const pitchAngle = (d.game_phase === 'pre-launch' || d.game_phase === 'just-launched')
  ? 'launch-amplification'
  : 'revitalization';

const CAG = `=== GAMERSLAB PRODUCT BRIEF ===
Load this context before scoring or drafting. Every claim below is real.

--- WHAT IT IS ---

GamersLab is the permissioned data layer linking games and UGC apps.
Studios integrate once via a lightweight SDK. Game data flows OUT to app builders
who create leaderboards, rival trackers, tournament sites, stat dashboards,
Discord bots, and companion apps — all without touching the game's code.
Nothing flows back in. Zero write access. Zero risk to the game.

One-liner: "Studios publish once, players consent once, builders integrate once.
Every UGC app speaks the same language."

--- THE PROBLEM IT SOLVES ---

Today, every UGC app reinvents the wheel:
1. SCRAPED & BRITTLE — builders rely on screen scraping and reverse-engineered
   endpoints that break every patch
2. NO PERMISSIONS — players can't grant or revoke access to their own data,
   studios can't enforce policy
3. STUDIO BOTTLENECK — every partnership is a bespoke integration, months of
   engineering for one feature
4. FRAGMENTED IDENTITY — same player, ten accounts, zero unified history

GamersLab solves all four in one integration.

--- REAL NUMBERS (use these, no others) ---

UGC-enabled games outperform standard games:
- Revenue: +31% after year 5
- DLC Revenue: +105% after year 5
- Console Players: +20% after year 1
- CCU: +115% after year 5

UGC market size: $10B+
- Roblox UGC payout 2024-2025: $1B+
- Fortnite UEFN payout 2024-2025: $900M+
- Overwolf payout 2024-2025: $300M+

Current traction:
- 6 early games on platform
- 5 UGC apps in development
- First app: 35k+ players
- Discord community: 68k
- Twitter/X following: 55k

--- CURRENT GAMES ON PLATFORM ---
Use these as peer references when targeting similar genres:

1. Maelstrom — Naval Battle Royale (Gunpowder Games) → best peer for PvP/competitive
2. NightSpawn — Horror Survival → best peer for survival/horror
3. Masks of the Void: Infinity — Action Roguelite (Epic Games Store) → best peer for roguelite/action
4. Dark Table CCG — Card Game → best peer for card games/strategy
5. Bug & Seek — Casual Collection → best peer for casual/collection
6. Mullet Cop — Idle Sim Manager (itch.io) → best peer for idle/sim

--- LIVE UGC APPS (built on GamersLab) ---

GRUDGE GOBLIN (grudgegoblin.com) — THE KEY PITCH TOOL FOR MULTIPLAYER GAMES
A rival tracker for multiplayer games. Watches every kill, remembers every foe,
pings players when rivals/prey queue up. Currently tracking Maelstrom.
- Free for players. No install. Runs in browser.
- Free for studios. No revenue share. No per-seat fees.
- Real pitch hook: "Hand your players a reason to come back — without building any of it."
- Best used for: any game with PvP, kill tracking, competitive play, online multiplayer
- Lead with Grudge Goblin when pitching multiplayer games. It is LIVE, REAL, and FREE.

TOURNAMENT GARDEN — Turn any single or multiplayer game into a tournament or leaderboard.
12 tournaments growing this week. Best pitch for: competitive games, esports adjacent titles.

GAMERS LAB PLUS — Cloud save & minimal live-ops. Best pitch for: studios with no backend.

BUG & SEEK COMPANION — Rolling leaderboard, stats tracker, custom questing system.
Best pitch for: casual/collection games with daily active communities.

--- TWO PITCH ANGLES — CHOOSE BASED ON GAME PHASE ---

PITCH A: ESTABLISHED GAMES (mature/growth phase, past peak CCU)
Hook: "Your community is already building workarounds with screen scrapers.
GamersLab makes that official — and gives you the analytics layer."
Key stat to use: +31% revenue after year 5, +115% CCU after year 5
Lead app: Grudge Goblin (if multiplayer) or Tournament Garden (if competitive)
Frame: Revitalization without engineering investment.

PITCH B: NEW / UPCOMING GAMES (pre-launch, early access, just-launched <6 months)
Hook: "Launch with a community data layer already in place — signal to players
from day one that you're community-forward."
Key stat to use: +20% console players after year 1, +115% CCU after year 5
Lead app: Tournament Garden (instant tournament infra from launch)
Frame: Launch amplification. Get the ecosystem before the game ships.

--- THREE OBJECTIONS TO PRE-DISSOLVE IN EVERY EMAIL ---

1. "Is it IN my game?" → NO. UGC apps live OUTSIDE the game. Nothing runs inside
   the game. Data only flows out from the game server. Builders cannot touch the game.

2. "How much does it cost? What's the catch?" → FREE for studios.
   App builders consume data free, supported by ads — but ads are NEVER inside the game.
   Studio integration is free. No revenue share. No per-seat fees.

3. "How long does it take? I have no time." → 2 afternoons to integrate.
   Upsell/lock-in: GamersLab gives studios a FREE analytics dashboard.
   Many studios don't even have basic analytics — this alone is worth the integration.

Pick the ONE objection most relevant to this publisher's likely hesitation and dissolve
it preemptively in the email. Do not list all three.

--- SDK & INTEGRATION ---

Works with: Unity, Unreal, iOS, Android, PlayStation, Xbox, Ethereum, Sequence, Thirdweb.
AI-ready: Plug & play MCP servers, LLM-ready schemas, consistent structured data across all games.
Server-side only: Studios push events via SDK → GamersLab → builders read via API.

--- BEST FIT PUBLISHER PROFILE ---

STRONG FIT:
- Has online PvP, leaderboards, kill tracking, or competitive play (→ pitch Grudge Goblin)
- Has active player community asking for companion tools
- Team of 1–15 people who can't build UGC tooling themselves
- Game in growth or just-launched phase (actively thinking about retention)
- Pre-launch game (publisher in active BD mode, thinking about day-one community)
- Has Steam Workshop (already UGC-aware, easier conversation)
- Card games, survival, battle royale, roguelite, sports, racing, fighting, strategy

POOR FIT (do not draft, archive):
- Single-player narrative game with no replayability signal
- Game with <100 reviews and no community activity
- Major publisher (Valve, EA, Ubisoft, Activision etc.) — too slow to act
- Sunset game: released 3+ years ago, avg_playtime_2weeks = 0

--- CONTACT & CTA ---

GamersLab contact: contact@gamerslab.gg
CEO Telegram: @ericvanderwal
Website: www.gamerslab.gg
Integration page: www.gamerslab.gg/early-access

CTA for email: ONE soft question only. Never a link dump. Never "let me know if interested."
Best CTAs:
- "Would Grudge Goblin be a fit for [game name]'s player community?"
- "Is the team thinking about companion apps for [game name]'s launch?"
- "Would a 20-min call with our CBO Ryan Waller be worth your time?"

PS line (always include): "PS — Full integration docs and examples from similar titles:
https://www.gamerslab.gg/early-access"

--- TEAM (use if relevant for credibility) ---

Eric Vander Wal — CEO, 20+ years developer & product, former dept head at Mantle, Oasys & Nervos
Ryan Waller — CBO, 20+ years entertainment executive, 50+ games published, deep game industry connections
Dr. Joon Yoon PhD — CDO, Stanford Economics PhD, former Nexon Studio, economy & data science at scale

Mention Ryan Waller (CBO) specifically when addressing publishers — 50+ games published is
the most relevant credibility signal for a studio BD contact.

--- BANNED PHRASES & FALSE CLAIMS ---

NEVER say:
- "synergy", "circle back", "touch base", "game-changing", "seamless", "at scale"
- "I hope this email finds you well"
- "I came across your game"
- "I wanted to reach out"
- "I'd love to connect"
- Any claim about numbers not listed above
- Anything about blockchain (unless publisher specifically works in Web3)
- "revolutionize", "disrupt", "paradigm"

NEVER: attach the deck to the email. Link only in PS.
NEVER: use more than one stat in the email body.
NEVER: make the email longer than 130 words in the body.
NEVER: end with multiple CTAs — one question only.

=== END GAMERSLAB BRIEF ===`;

const isSkip = d.outreach_tier === 'skip' || d.outreach_tier === 'C';

const prompt = isSkip
  ? `Extract publisher intel. Return ONLY valid JSON, no markdown.

PUBLISHER: ${d.publisher_name}
GAME: ${d.game_name}
SEARCH RESULTS:
${d.search_snippets}

Return:
{
  "publisher_website": "URL or empty",
  "contact_name": "name or empty",
  "contact_role": "role or empty",
  "founder_name": "name or empty",
  "founder_quote": "quote or empty",
  "founder_quote_source": "URL or empty",
  "twitter_handle": "@handle or empty",
  "linkedin_company_url": "URL or empty",
  "pain_signal": "1 sentence",
  "intel_summary": "2 sentences",
  "intel_quality": "gold|silver|bronze|no_signal",
  "fit_score": 0,
  "score_rationale": "low priority target",
  "gamerslab_hook": "",
  "ugc_app_pitch": "",
  "peer_publisher_ref": "",
  "draft_subject": "",
  "draft_body": "",
  "recommended_action": "archive"
}`
  : CAG + `

PUBLISHER: ${d.publisher_name}
DEVELOPER: ${d.developer_name}
GAME: ${d.game_name}
GENRE: ${d.primary_genre}
TAGS: ${d.steam_tags}
DESCRIPTION: ${d.steam_description}
RELEASE: ${d.release_date || 'Coming Soon'} — phase: ${d.game_phase}
COMING SOON: ${d.coming_soon}
REVIEWS: ${d.review_score}% from ${d.total_reviews} reviews
OWNERS: ${d.owners_estimate}
PRICE: ${d.is_free ? 'Free' : '$' + d.price_usd}
SIGNALS: pvp=${d.has_online_pvp} leaderboards=${d.has_steam_leaderboards} workshop=${d.has_steam_workshop} multiplayer=${d.has_multi_player}
PRE-SCORE: ${d.pre_score}/100 tier: ${d.outreach_tier}
PITCH ANGLE: ${pitchAngle}
BEST UGC APP: ${bestUgcApp}
CONTACT: ${d.contact_email || 'not found'} (${d.contact_source})
CONTACT NAME: ${d.contact_name || 'unknown'}
SEARCH RESULTS:
${d.search_snippets}

TASK: Extract intel AND draft a cold email. Return ONLY valid JSON, no markdown.
EVIDENCE RUBRIC (D1): set evidence_strength to "explicit" ONLY when a dated public source (statement, review, job post, talk) names the pain; "inferred" when circumstantial with cited reasoning; "none" when unsupported. Put the supporting quote in evidence_quote, its URL(s) in evidence_sources, and its date in evidence_as_of.
ANTI-FIT (N5): list negative signals (bought a competitor, layoffs, churned, explicitly not our market, sunset/inactive) in risk_flags. FLAG only — do NOT lower fit_score for them; the human decides at review.
JSON shape:
{
  "publisher_website": "URL or empty",
  "contact_name": "name or empty",
  "contact_role": "role or empty",
  "founder_name": "name or empty",
  "founder_quote": "verbatim quote or empty",
  "founder_quote_source": "URL or empty",
  "twitter_handle": "@handle or empty",
  "linkedin_company_url": "URL or empty",
  "pain_signal": "1 sentence pain point",
  "intel_summary": "2 sentences about publisher",
  "intel_quality": "gold|silver|bronze|no_signal",
  "evidence_strength": "explicit|inferred|none",
  "evidence_quote": "strongest DATED public statement/review/job-post showing the pain, verbatim, or empty",
  "evidence_sources": ["source url"],
  "evidence_as_of": "YYYY-MM-DD the evidence is dated, or empty",
  "risk_flags": [{"flag": "competitor_locked|layoffs|churned|not_our_market|inactive", "evidence": "short phrase", "source": "url"}],
  "fit_score": <0-100>,
  "score_rationale": "2 sentences",
  "gamerslab_hook": "1 sentence why GamersLab fits",
  "ugc_app_pitch": "which app and why",
  "peer_publisher_ref": "most similar GamersLab game",
  "draft_subject": "game name + claim, max 10 words, no exclamation marks",
  "draft_body": "100-130 words. Specific opener. Name game and UGC app. Dissolve one objection. One real stat. One CTA question.",
  "draft_ps": "PS — Full integration docs: https://www.gamerslab.gg/early-access",
  "recommended_action": "advance|warm_queue|archive"
}`;

return { json: {
  _source:       d,
  _pitch_angle:  pitchAngle,
  _best_ugc_app: bestUgcApp,
  _payload:      JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
}};
