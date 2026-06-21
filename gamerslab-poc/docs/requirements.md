# GamersLab Publisher Outreach Pipeline — Requirements (v9)

## Purpose

Automated pipeline to find Steam game publishers, research them, score their fit for GamersLab,
draft personalised cold emails, and save everything to Supabase for human review. The pipeline
never sends — output is staged for a human to approve.

> This document describes the **v9** workflow at `workflow/gamerslab-outreach-v9.json`. It is the
> source of truth for build/maintenance. (An earlier draft described a single-game-per-run
> design; v9 supersedes it with a batched fan-out.)

---

## Infrastructure

- **n8n**: Self-hosted on Sliplane — https://n8n-j39n.sliplane.app
- **Supabase**: `publishers` table, unique constraint on `steam_app_id`
- **OpenRouter**: API key stored as n8n credential type `openRouterApi`
- **Serper**: API key stored in gitignored `.env` as `SERPER_API_KEY` (header auth — no native n8n credential type). The Serper HTTP nodes read it via `={{ $env.SERPER_API_KEY }}`, so set `SERPER_API_KEY` in the n8n instance environment.

---

## Core architecture: batched fan-out with per-publisher dedup and a draft budget

The pipeline pulls **~100 candidate games per run**, enriches them, and drafts emails only for
the top candidates within a daily budget:

- **Fan-out:** `Pick 100 Publishers` returns up to 100 candidates; Steam enrichment runs per game.
- **Dedup:** `Get Drafted IDs` reads already-drafted `steam_app_id`s from Supabase at the start;
  `Select & Split` dedups **per publisher** (one outreach per publisher, not per game) via a
  normalised `publisher_key`.
- **Budget gate:** `Select & Split` spends a daily **draft budget of 35** (OpenRouter free cap is
  ~50/day, failed tries count) on the highest-scoring candidates above a **score floor of 10**.
- **Backlog split:** `Route Enrich` sends budget winners down the enrich+draft path and routes
  everyone else to `Build Backlog Record` → `Upsert Backlog` (parked, no draft).
- **Batch loop:** the enrich+draft path runs through `Batch for Serper` (batchSize 1) and loops
  back from `Upsert to Supabase` to process one publisher at a time (keeps `.first().json`
  cross-node references valid and stays within rate limits).

---

## Pipeline stages (v9 execution order)

1. **Schedule Trigger** — daily at 09:00 (also runnable on demand).
2. **Get Drafted IDs** (Postgres) — read existing drafted `steam_app_id`s for dedup.
3. **Fetch OpenRouter Free Models** (HTTP, `openRouterApi`) — `GET /api/v1/models`.
4. **Filter Free Models** (code) — keep models where `pricing.prompt === '0'` AND
   `pricing.completion === '0'` AND `id.includes(':free')`. Output `{ free_models: [...] }`.
5. **Fetch SteamSpy Games** (HTTP) — `GET steamspy.com/api.php?request=tag&tag=<TAG>` where TAG
   rotates hourly across 8 genres: Roguelite, Card Game, Survival, Battle Royale, Racing,
   Fighting, Strategy, Sports.
6. **Pick 100 Publishers** (code) — drop blocked major publishers, score by review quality +
   recency, return top 100. Stamps `free_models` so it travels downstream.
7. **Wait: Steam Rate Limit** (wait) — throttle before the Steam API.
8. **Get Steam App Details** (HTTP) — `GET store.steampowered.com/api/appdetails?appids=<id>&json=1`.
9. **Extract Steam Data** (code, runOnceForEachItem) — parse categories, genres, tags,
   support_email, website, domain, game_phase, price, boolean signals. Soft-skip
   (`{ _skip: true }`) on no data — never throws. Carries `free_models` forward.
10. **Filter Valid Games** (IF) — `$json._skip` not true → continue; true → dead end.
11. **Pre-Score** (code, runOnceForAllItems) — score on free Steam signals; set `pre_score`,
    `outreach_tier` (A ≥60, B ≥30, C ≥10, skip <10), and a normalised `publisher_key`.
12. **Select & Split** (code, runOnceForAllItems) — per-publisher dedup against `Get Drafted IDs`;
    spend the draft budget (35) on top candidates above the score floor (10); attach the
    publisher's other games (max 6) for a portfolio mention; stamp a `_route` of `enrich` or
    `backlog` on each item.
13. **Route Enrich** (IF) — `_route === 'enrich'` → enrich path; else → backlog path.
    - **Backlog path:** `Build Backlog Record` → `Upsert Backlog` (Postgres). Parked, no draft.

### Enrich path (batched, one publisher at a time)

14. **Batch for Serper** (splitInBatches, batchSize 1) — loop driver.
15. **Serper: Combined Search** (HTTP, `X-API-KEY` from `$env.SERPER_API_KEY`) — single combined
    query (`publisher + game + 'contact email founder interview website press'`), ~10 results.
16. **WHOIS Lookup** (HTTP) — `who-dat.as93.net/<domain>`. Continue on fail, neverError.
17. **Fetch Publisher Website** (HTTP, text) — continue on fail.
18. **Scrape Website** (code) — extract emails, Twitter, LinkedIn, Discord, contact-page URL.
    No regex with forward slashes — use `indexOf`/string methods.
19. **Fetch Contact Page** (HTTP, text) — continue on fail.
20. **Scrape Contact Page** (code) — extract emails only.
21. **Merge All Data** (code) — email waterfall: steam_api → contact_page → website → serper →
    whois. Builds `search_snippets`; spreads upstream to carry `free_models`.
22. **Verify Email** (HTTP/code) — find a *deliverable* address: MX + known-provider check across
    the harvested candidates (`contact_email_all`). Free — no paid verifier, no mailbox probe.
23. **Classify Email** (code) — label the chosen email (role / personal / generic).
24. **Prepare LLM Items** (code) — load the CAG product brief; build one item per free model;
    select pitch angle + best UGC app; output `_payload` (`{model, max_tokens: 2000, messages}`).
    Tier A/B: full email draft + intel; tier C/skip: intel only.
25. **LLM: Intel + Draft (All Models)** (HTTP, `openRouterApi`) — `POST /api/v1/chat/completions`,
    body `={{ $json._payload }}`. Continue on fail, retry up to 4× with 15s wait (time-based
    model rotation means each retry uses a different model).
26. **Pick Best LLM Response** (code) — first valid JSON wins. Extract via `indexOf('{')` /
    `lastIndexOf('}')` (handles thinking models where the answer is in `reasoning` not `content`).
    Reads `_source` etc. from `$('Prepare LLM Items').first().json` (HTTP strips custom fields).
27. **Build Final Record** (code) — assemble a clean flat Supabase row. `pipeline_status` =
    `skip` if tier skip, else `draft`. Throws if `steam_app_id` missing.
28. **Upsert to Supabase** (Postgres) — Insert-or-Update on `steam_app_id`. Loops back to
    **Batch for Serper** for the next publisher.

---

## Data that must travel through the pipeline

```
free_models        — stamped in Pick 100 Publishers, read in Prepare LLM Items
steam_app_id       — upsert key in Supabase
publisher_key      — set in Pre-Score, used for per-publisher dedup in Select & Split
pre_score          — set in Pre-Score, read in Build Final Record
outreach_tier      — set in Pre-Score, read in Build Final Record
_route             — set in Select & Split, read by Route Enrich
```

Every code node that spreads its input (`...d` / `...steam`) must do so completely so no fields
are lost across the chain.

---

## CAG block

The GamersLab product brief is embedded as a static string in the `Prepare LLM Items` code node,
and mirrored in `docs/cag-block.md` (edit there, then paste into the node). It includes:

- What GamersLab is (permissioned data layer)
- Real stats: +31% revenue yr5, +105% DLC yr5, +20% console yr1, +115% CCU yr5
- Live UGC apps: Grudge Goblin (grudgegoblin.com), Tournament Garden, GamersLab Plus, Bug & Seek Companion
- Two pitch angles: revitalization (mature/growth) vs launch-amplification (pre-launch/just-launched)
- Three objections to pre-dissolve: in-game risk, cost, integration time
- Best/poor fit signals
- Team: Eric Vander Wal CEO, Ryan Waller CBO (50+ games published), Dr. Joon Yoon PhD CDO
- Email rules: 100–130 words, one stat, one CTA question, PS with link
- Banned phrases

---

## Email requirements

- Subject: game name + specific claim, max 10 words, no exclamation marks
- Body: 100–130 words MAX
- Open with founder_quote if intel_quality=gold, else a specific game observation — never generic
- Name the game by name
- Name the specific UGC app (Grudge Goblin or Tournament Garden — not generic)
- Dissolve ONE objection naturally
- Use ONE real stat with the number
- End with ONE soft CTA question
- PS line: `PS — Full integration docs and examples from similar titles: https://www.gamerslab.gg/early-access`

---

## UGC app selection logic

The workflow (`Prepare LLM Items`) picks the lead app as:

```javascript
const bestUgcApp = (d.has_online_pvp || d.has_multi_player)
  ? 'Grudge Goblin (grudgegoblin.com)'
  : 'Tournament Garden';
```

Lead with Grudge Goblin for any PvP / multiplayer title; Tournament Garden otherwise.

---

## Supabase schema

Key columns on `publishers` (full DDL in `supabase/schema.sql`):

```sql
steam_app_id        TEXT UNIQUE NOT NULL
game_name           TEXT
publisher_name      TEXT
publisher_key       TEXT   -- normalised; per-publisher outreach dedup key
outreach_tier       TEXT   -- A | B | C | skip
pipeline_status     TEXT   -- draft | skip | approved | sent | replied
fit_score           INT
pre_score           INT
draft_subject       TEXT
draft_body          TEXT
contact_email       TEXT
contact_source      TEXT   -- steam_api | contact_page_scrape | website_scrape | serper_search | whois
intel_quality       TEXT   -- gold | silver | bronze | no_signal
model_used          TEXT
-- ... plus all Steam signal booleans and enrichment fields
```

---

## n8n rules that must not be violated

1. **No HTTP calls in code nodes** — `$helpers.httpRequest` does not exist
2. **No credential access in code nodes** — `$credentials` does not exist
3. **runOnceForEachItem mode must return `{ json: {} }` not `[{ json: {} }]`**
4. **`.item` only works in runOnceForEachItem mode for directly paired upstream nodes**
5. **`.first()` inside SplitInBatches returns the first item of the current batch — use batchSize=1 if relying on `.first()`**
6. **HTTP nodes strip all custom fields from input — never expect custom fields on HTTP node output**
7. **Cross-node references (`$('NodeName')`) only work for nodes that have already executed in the current run**
8. **The Wait node does not throttle parallel execution — it only delays the item passing through it**

---

## Maintenance checklist

When changing the workflow:

1. Edit `workflow/gamerslab-outreach-v9.json` (or in n8n, then re-export to this path).
2. Keep `docs/cag-block.md` in sync with the `CAG` literal in `Prepare LLM Items`.
3. Verify against the n8n rules above.
4. Confirm a run produces correct `publishers` rows (all key fields populated) and that backlog
   records land via `Upsert Backlog`.
5. Never commit real keys — Serper lives in `.env` / the n8n environment as `SERPER_API_KEY`.
