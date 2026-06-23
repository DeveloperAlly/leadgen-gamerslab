# GamersLab Publisher Outreach Pipeline

Automated n8n pipeline to find, research, score, and draft outreach emails to Steam game
publishers on behalf of GamersLab. The goal is precision, not volume — every draft reads like
someone spent an hour on the publisher first. All output lands in Supabase for human review;
**the pipeline never sends.**

> **📍 Source of truth for the live system:** [`SPEC.md`](SPEC.md) (UI ↔ Edge ↔ n8n ↔ Supabase,
> full live schema) **and** [`ARCHITECTURE.md`](ARCHITECTURE.md) (the **complete n8n fleet** — all
> **six** live workflows and how they wire together, not just the engine). This README's "Pipeline
> overview" below covers only the **v10 discovery engine** (`MouIeDmDAAHKIpDn` on Sliplane); the
> Send, Reply Poll, Context Builder and Source Ingestion workflows are documented in
> `ARCHITECTURE.md`. The committed `workflow/gamerslab-outreach-v9.json` is a **stale v9 export**
> kept only as a baseline (the live v9 workflow is superseded — see `ARCHITECTURE.md §3`).

## Where this sits

This is the **GamersLab POC (v1)** — the built, Steam-specific outreach pipeline, one of three
project areas in the repo. **Read the root [`README.md`](../README.md) and
[`CLAUDE.md`](../CLAUDE.md) first** for the repo-wide map and which project is which.

```
gamerslab-poc/                              ← you are here (the built v1 pipeline)
├── SPEC.md                                 ← as-built UI↔Edge↔DB contract (canonical)
├── ARCHITECTURE.md                         ← ALL 6 live n8n workflows + wiring (canonical)
├── workflow/
│   ├── gamerslab-outreach-v9.json          ← stale v9 export (baseline only; live engine is v10)
│   ├── gamerslab-outreach-v9.backup.json   ← prior snapshot
│   ├── email-*.workflow.ts                 ← Send / Reply-poll source (see ARCHITECTURE.md ②③)
│   └── v10-live-edits/                      ← v10 engine deltas (the live graph is not fully exported)
├── supabase/
│   ├── schema.sql                          ← run in Supabase SQL editor first
│   ├── test-queries.sql                    ← review / approval / inspection queries
│   └── functions/                          ← v1 integration API (Edge Functions) — see its README
├── docs/
│   ├── cag-block.md                        ← GamersLab CAG brief (reference; live CAG is DB-driven)
│   └── _archive/                           ← superseded spec.md (v1) + requirements.md (v9)
└── README.md

../poc/ui/                                  ← the shared UI source (build with `--mode poc` for this POC)
```

> The shared white-label **UI lives at `../poc/ui/`** (one source, two build modes). The
> **white-label v2** design/productisation lives at `../whitelabel/`, and the cross-cutting
> campaign context (research, business process, architecture) at the repo root (`who/ what/ how/`).

## System flow (end-to-end)

Two flows make up the system. The first builds the client's **CAG brief**; the second is the
**lead lifecycle** that consumes it. Inputs are on the left of each step, outputs on the right.
Full node/wiring detail is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

> ⚠️ **Keep these current.** These SVGs are generated from the live system. When a workflow,
> Edge function, or DB write changes, **update the matching `docs/assets/*.svg` in the same change**
> — it is step 1 on the `ARCHITECTURE.md §10` maintenance checklist.

### 1 · Client — onboarding & intelligence loop (builds the CAG brief)

![Client onboarding and intelligence loop: sources → ingestion → intake bank → Context Builder → CAG brief](docs/assets/client-intelligence-flow.svg)

### 2 · Leads — end-to-end (Steam → inbox → reply)

![Leads end-to-end flow: trigger, mine, score, enrich, draft, Gate B, Gate C, send, reply, learn — with inputs and outputs per stage](docs/assets/leads-end-to-end-flow.svg)

The single handoff between them is the **CAG brief**: built in flow 1, consumed at the *draft* step
of flow 2 (`Apply CAG from DB`).

## Setup

### 1. Secrets

Copy `.env.example` to `.env` and set `SERPER_API_KEY` (from [serper.dev](https://serper.dev)).
`.env` is gitignored — never commit it. The Serper HTTP nodes read the key via
`={{ $env.SERPER_API_KEY }}`, so the **same** `SERPER_API_KEY` must also be set in your n8n
instance environment.

### 2. Supabase

Run `supabase/schema.sql` in your Supabase SQL editor. This creates the `publishers` table with
all required columns and indexes (upsert key: `steam_app_id`).

> Note: the **live** Lead Gen project (`ccmwksmgoisijvyovgko`) has more than `publishers` — it
> also has `cag_context` (the editable CAG brief), `runs` (discovery job state), `tenant`, and the
> full generic multi-tenant schema provisioned for v2 (mostly empty). `publishers` already carries
> `tenant_id`, `value_score`/`match_score`, and the evidence/risk columns. See [`SPEC.md`](SPEC.md) §4.

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
2. `LLM: Intel + Draft` → your OpenRouter credential
3. `Get Drafted IDs`, `Upsert to Supabase`, `Upsert Backlog` → your Supabase Postgres credential

> Note: this imports the **stale v9** graph. The live workflow is **v10** (`MouIeDmDAAHKIpDn`),
> which adds the Discovery Webhook + status nodes, the Exa→SerpAPI fallback, and `Apply CAG from
> DB`. There is no full v10 export committed; see `workflow/v10-live-edits/` for the deltas and
> [`SPEC.md`](SPEC.md) for the live graph.

### 5. Run

The workflow has a **Schedule Trigger** set to run daily at 09:00. You can also hit
**Execute Workflow** to run on demand. A full run takes several minutes (100 Steam detail calls,
rate-limited, plus per-publisher Serper + scraping + LLM calls).

## Pipeline overview (live v10)

Two entry points converge: the daily **Schedule Trigger** and a **Discovery Webhook** (the UI's
`discovery` Edge Function POSTs to it; `Status: Running`/`Status: Completed` report progress back
to the `n8n-status` function). See [`SPEC.md`](SPEC.md) §6 for full detail.

```
Schedule Trigger (daily 09:00)  ┐
Discovery Webhook (UI → 202)    ┘ → converge
  → Get Drafted IDs                 read already-drafted steam_app_ids from Supabase (dedup)
                                    + read the CAG brief row (cag_context)
  → Fetch OpenRouter Free Models    live list of zero-cost models
  → Filter Free Models              keep only :free / $0 prompt+completion models
  → Fetch SteamSpy Games            pull one tag, rotated hourly across 8 genres
                                    (Roguelite, Card Game, Survival, Battle Royale,
                                     Racing, Fighting, Strategy, Sports)
  → Pick 100 Publishers             drop blocked majors, score, return top TARGET_COUNT (default 100)
  → Wait: Steam Rate Limit          throttle before the Steam API
  → Get Steam App Details           Steam API per game
  → Extract Steam Data              parse categories, signals, support_email, game_phase
  → Filter Valid Games              IF — skip delisted / no-data games
  → Pre-Score                       free Steam signals → pre_score + outreach_tier + publisher_key
  → Select & Split                  per-publisher dedup; spend the daily draft budget (default 35,
                                    floor 10) on top candidates; route the rest to backlog
  → Route Enrich                    IF  ─ enrich path ─┐         └─ backlog path ─┐
                                                       │                          │
       enrich path (batched, one publisher at a time): │      Build Backlog Record│
  → Batch for Web Search            batchSize 1, loops │   →  Upsert Backlog        (parked, no draft)
  → Exa: Combined Search            publisher contact + founder/intel (primary search)
  → Exa Has Results?                IF — empty / 429 → SerpAPI: Fallback Search → Normalise
  → WHOIS Lookup                    domain registrant email (continue on fail)
  → Fetch Publisher Website         raw HTML (continue on fail)
  → Scrape Website                  emails, social links, contact-page URL
  → Fetch Contact Page              /contact or /about (continue on fail)
  → Scrape Contact Page             extract emails
  → Merge All Data                  email waterfall: steam → contact page → website → exa/serper → whois
  → Verify Email                    MX + known-provider check; pick a deliverable address (free)
  → Classify Email                  label the chosen email (role/personal/generic)
  → Apply CAG from DB + Prepare LLM Items   inject the cag_context brief; build one item, one model
  → LLM: Intel + Draft              HTTP, one model call per lead (no fan-out)
  → Pick Best LLM Response          first valid JSON response wins
  → Build Final Record              assemble DB row + evidence_strength/quote/sources/decay, risk_flags
  → Upsert to Supabase              upsert on steam_app_id → loops back to next batch
```

> **Search:** Exa is the primary engine; **SerpAPI is a real fallback** (gated by `Exa Has
> Results?`). The legacy WHOIS + website/contact scrape cluster still runs as a contact-harvest
> fallback — see the enrichment-duplication note in [`../how/pipeline_critique_v2.md`](../how/pipeline_critique_v2.md) (I1/T1).
> **CAG:** the brief is the editable `cag_context` DB row (UI "Business Context" page → `context`
> Edge Function); editing it changes the next run's scoring + drafts.

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
