# GamersLab CAG Block

> Cache-Augmented Generation context for the `LLM: Intel + Draft` step. This is the
> single source of truth for the product brief the model uses to score publishers and
> draft emails. To change the pitch or tone, edit this file, then paste the updated
> block into the `CAG` template literal inside the `Prepare LLM Items` Code node in
> `workflow/gamerslab-outreach-v9.json`.

---

```
=== GAMERSLAB PRODUCT BRIEF ===
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

=== END GAMERSLAB BRIEF ===
```
