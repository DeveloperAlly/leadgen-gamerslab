# GamersLab Publisher Outreach Pipeline

Automated n8n pipeline to find, research, score, and draft outreach emails to Steam game
publishers on behalf of GamersLab. The goal is precision, not volume — every draft reads like
someone spent an hour on the publisher first. All output lands in Supabase for human review;
**the pipeline never sends.**

## Where this sits

This is the **GamersLab POC (v1)** — the built, Steam-specific outreach pipeline, one of three
project areas in the repo. **Read the root [`README.md`](../README.md) and
[`CLAUDE.md`](../CLAUDE.md) first** for the repo-wide map and which project is which.

```
gamerslab-poc/                              ← you are here (the built v1 pipeline)
├── workflow/
│   ├── gamerslab-outreach-v9.json          ← n8n workflow — import this (live instance is v10)
│   └── gamerslab-outreach-v9.backup.json   ← prior snapshot
├── supabase/
│   ├── schema.sql                          ← run in Supabase SQL editor first
│   ├── test-queries.sql                    ← review / approval / inspection queries
│   └── functions/                          ← v1 integration API (Edge Functions) — see its README
├── docs/
│   ├── spec.md                             ← full technical specification
│   ├── requirements.md                     ← node-by-node build requirements
│   └── cag-block.md                        ← GamersLab product brief (CAG) used in LLM calls
└── README.md

../poc/ui/                                  ← the shared UI source (build with `--mode poc` for this POC)
```

> The shared white-label **UI lives at `../poc/ui/`** (one source, two build modes). The
> **white-label v2** design/productisation lives at `../whitelabel/`, and the cross-cutting
> campaign context (research, business process, architecture) at the repo root (`who/ what/ how/`).

## Setup

### 1. Secrets

Copy `.env.example` to `.env` and set `SERPER_API_KEY` (from [serper.dev](https://serper.dev)).
`.env` is gitignored — never commit it. The Serper HTTP nodes read the key via
`={{ $env.SERPER_API_KEY }}`, so the **same** `SERPER_API_KEY` must also be set in your n8n
instance environment.

### 2. Supabase

Run `supabase/schema.sql` in your Supabase SQL editor. This creates the `publishers` table with
all required columns and indexes (upsert key: `steam_app_id`).

Get your connection string from Supabase → Settings → Database → Connection pooling:
```
postgresql://postgres.YOURREF:[PASSWORD]@aws-X-region.pooler.supabase.com:6543/postgres
```

### 3. n8n credentials

Create these credentials in n8n (Settings → Credentials):

**OpenRouter**
- Type: `OpenRouter`
- API Key: your OpenRouter key from openrouter.ai

**Supabase Postgres**
- Type: `Postgres`
- Host: `aws-X-region.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- User: `postgres.YOURPROJECTREF`
- Password: your Supabase DB password
- SSL: `Require` · Ignore SSL Issues: ON

**Serper** — no n8n credential. Set `SERPER_API_KEY` as an environment variable on the n8n
instance (see step 1).

### 4. Import workflow

n8n → Workflows → Import from file → select `workflow/gamerslab-outreach-v9.json`

After import, repoint the credential-bound nodes to your own credentials:
1. `Fetch OpenRouter Free Models` → your OpenRouter credential
2. `LLM: Intel + Draft (All Models)` → your OpenRouter credential
3. `Get Drafted IDs`, `Upsert to Supabase`, `Upsert Backlog` → your Supabase Postgres credential

### 5. Run

The workflow has a **Schedule Trigger** set to run daily at 09:00. You can also hit
**Execute Workflow** to run on demand. A full run takes several minutes (100 Steam detail calls,
rate-limited, plus per-publisher Serper + scraping + LLM calls).

## Pipeline overview (v9)

```
Schedule Trigger (daily 09:00)
  → Get Drafted IDs                 read already-drafted steam_app_ids from Supabase (dedup)
  → Fetch OpenRouter Free Models    live list of zero-cost models
  → Filter Free Models              keep only :free / $0 prompt+completion models
  → Fetch SteamSpy Games            pull one tag, rotated hourly across 8 genres
                                    (Roguelite, Card Game, Survival, Battle Royale,
                                     Racing, Fighting, Strategy, Sports)
  → Pick 100 Publishers             drop blocked majors, score, return top 100
  → Wait: Steam Rate Limit          throttle before the Steam API
  → Get Steam App Details           Steam API per game
  → Extract Steam Data              parse categories, signals, support_email, game_phase
  → Filter Valid Games              IF — skip delisted / no-data games
  → Pre-Score                       free Steam signals → pre_score + outreach_tier + publisher_key
  → Select & Split                  per-publisher dedup; spend the daily draft budget (35) on
                                    top candidates; route the rest to backlog
  → Route Enrich                    IF  ─ enrich path ─┐         └─ backlog path ─┐
                                                       │                          │
       enrich path (batched, one publisher at a time): │      Build Backlog Record│
  → Batch for Serper                batchSize 1, loops │   →  Upsert Backlog        (parked, no draft)
  → Serper: Combined Search         publisher contact + founder/intel in one search
  → WHOIS Lookup                    domain registrant email (continue on fail)
  → Fetch Publisher Website         raw HTML (continue on fail)
  → Scrape Website                  emails, social links, contact-page URL
  → Fetch Contact Page              /contact or /about (continue on fail)
  → Scrape Contact Page             extract emails
  → Merge All Data                  email waterfall: steam → contact page → website → serper → whois
  → Verify Email                    MX + known-provider check; pick a deliverable address (free)
  → Classify Email                  label the chosen email (role/personal/generic)
  → Prepare LLM Items               load CAG brief; build one item per free model
  → LLM: Intel + Draft (All Models) HTTP, one call per model
  → Pick Best LLM Response          first valid JSON response wins
  → Build Final Record              assemble clean DB row
  → Upsert to Supabase              upsert on steam_app_id → loops back to next batch
```

## Outreach tiers

Set in `Pre-Score` from free Steam signals (PvP, leaderboards, Workshop, multiplayer, co-op,
game phase, etc.).

| Tier | Pre-score | What happens |
|---|---|---|
| A | 60+ | Full email drafted, full CAG context, advance to human review |
| B | 30–59 | Full email drafted, warm queue |
| C | 10–29 | Short email drafted |
| skip | <10 | No draft; routed to backlog for optional human promotion |

`Select & Split` enforces a daily **draft budget of 35** (OpenRouter free cap is ~50/day) and a
**score floor of 10**, deduped per publisher — so a publisher is only drafted once, even with
multiple games on Steam. Candidates that don't win budget are parked via `Upsert Backlog`.

## Human review

Records ready for review:
```sql
SELECT game_name, publisher_name, outreach_tier, fit_score, contact_email,
       draft_subject, draft_body, intel_quality
FROM publishers
WHERE pipeline_status = 'draft'
  AND outreach_tier IN ('A', 'B')
ORDER BY fit_score DESC;
```

Approve a record:
```sql
UPDATE publishers
SET pipeline_status = 'approved',
    approved_subject = draft_subject,
    approved_body    = draft_body,
    reviewed_by      = 'your name',
    reviewed_at      = NOW()
WHERE steam_app_id = 'XXXXXX';
```

See `supabase/test-queries.sql` for more inspection queries.

## Extending the pipeline

**Change the genre tags:** Edit the rotating tag list in the `Fetch SteamSpy Games` URL
expression (currently 8 genres rotated hourly).

**Adjust scoring:** Edit the point values in `Pre-Score`, or the budget / floor in `Select & Split`.

**Change the pitch or email tone:** Edit `docs/cag-block.md`, then paste the updated block into
the `CAG` template literal inside the `Prepare LLM Items` Code node.

**Add sending:** After human approval, add Instantly.ai / Lemlist nodes that read
`approved_subject` and `approved_body` from the `publishers` table. (Out of scope here — the
pipeline deliberately does not send.)
