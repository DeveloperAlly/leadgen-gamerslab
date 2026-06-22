# GamersLab POC — System Spec (current, as-built)

**Status:** ✅ **AS-BUILT** (describes what is live, not a proposal). **Updated:** 2026-06-22.
**Owner:** Ally · **Area:** GamersLab POC (v1) — area 1 of the repo (see root `CLAUDE.md`).

**Verified live on 2026-06-22 against the running systems** (not the repo README, which is the
stale v9 export):
- n8n workflow **`MouIeDmDAAHKIpDn`** — *GamersLab Publisher Outreach v10* (self-host, Sliplane:
  `n8n-j39n.sliplane.app`). Node graph + connections read live.
- Supabase project **`ccmwksmgoisijvyovgko`** — *Gamers Lab Lead Gen* (`ap-southeast-1`). Tables,
  columns, and the 11 deployed Edge Functions read live.

> **What changed since the repo README / earlier write-ups (the "outdated" bits):**
> 1. The live DB is **not** "one `publishers` table + `runs`." The full generic multi-tenant
>    schema is already **provisioned** (`tenant, source, document, intake, venue,
>    business_summary, lead, evidence, run, outreach, outcome, model_call_log`) — mostly **empty**;
>    the live pipeline still runs on **`publishers`** (235 rows) + `cag_context` + `tenant` + `runs`.
> 2. `publishers` already carries **`tenant_id`**, **`value_score`/`match_score`**, and the
>    Tier-1 critique columns (`evidence_*`, `risk_flags`, `reject_reason_code`).
> 3. **CAG is DB-driven now**: a `cag_context` table + a **`context`** Edge Function + an
>    **`Apply CAG from DB`** n8n node + a "Business Context" UI page. Editing the brief in the UI
>    changes the next run's scoring + drafts. (It is no longer only a hardcoded literal.)
> 4. The workflow is **v10**: the LLM node is renamed `LLM: Intel + Draft` (no fan-out), and the
>    webhook/status/`Exa Has Results?`/`Apply CAG from DB` nodes are live.
> 5. There are **two** Supabase projects (see §3); only *Gamers Lab Lead Gen* is this POC.

---

## 1. Summary

**One line:** a React UI lets a human start a discovery run and review results; Supabase Edge
Functions are the API; an n8n v10 workflow is the prospecting engine that mines Steam, finds +
researches + scores game **publishers**, drafts **one** outreach email each, and writes everything
to the `publishers` table for human approval. **It never sends.**

**Business pipeline (WHAT):** onboard → understand the business (Gate A) → **discover + research +
score publishers** → human approves/rejects leads (Gate B) → human approves drafts (Gate C, no
send) → learn. The "lead" is a Steam **publisher**, found by mining games and hopping to the
publisher behind them.

**Technical pipeline (HOW):** three tiers —
1. **UI** (`poc/ui`, React, built `--mode poc`, themed "gamerslab") → one seam `leadService.ts`.
2. **Edge Functions** (project `ccmwksmgoisijvyovgko`) — the v1 Integration API (static bearer).
3. **n8n v10** (`MouIeDmDAAHKIpDn`) — the engine; two entry points (daily schedule + UI webhook),
   writes straight to Supabase.

**The key mental model:** the UI's **discovery / Gate B / Gate C / dashboard** paths are live over
real `publishers` data. The **onboarding/config screens** (sources, intake, venues, Gate-A
understanding, insights) are **baked GamersLab config that echoes** — except **Business Context
(CAG)**, which is genuinely live-editable and feeds the engine.

---

## 2. Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BROWSER · Lead Pipeline UI (React, themed "gamerslab")  — seam: leadService.ts │
│   Sign in(stub) · Onboarding(echo) · Business Context(LIVE) · Discovery ·      │
│   Gate B Leads · Gate C Outreach · Dashboard                                   │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                 │ HTTPS + static Bearer
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTIONS — v1 Integration API (project ccmwksmgoisijvyovgko)    │
│   LIVE data:   discovery · n8n-status · leads · outreach · context             │
│   Config/echo: tenant(+live usage) · sources · intake · venues · understanding │
│                · insights        |  _shared: http · mapper · types · config    │
└──────┬───────────────────────────────────────────────┬────────────────────────┘
       │ service-role R/W                               │ discovery POST → n8n webhook
       ▼                                                ▼   {run_id, mode}
┌─────────────────────────────────────┐   ┌────────────────────────────────────────┐
│ SUPABASE POSTGRES                    │   │ n8n v10  (Sliplane) MouIeDmDAAHKIpDn    │
│  LIVE: publishers(235) ·             │◄──┤  Schedule 09:00  +  Discovery Webhook   │
│        cag_context(1) · tenant(1) ·  │   │  → mine Steam → enrich → score → draft  │
│        runs(jobs)                    │   │  → upsert publishers ; never sends       │
│  PROVISIONED, empty (v2): source,    │   │  posts progress → n8n-status → runs      │
│   document, intake, venue,           │   └──────────────────┬─────────────────────┘
│   business_summary, lead, evidence,  │                      │ HTTP
│   run, outreach, outcome,            │                      ▼
│   model_call_log                     │   OpenRouter(free) · SteamSpy · Steam ·
└─────────────────────────────────────┘   Exa(primary) · SerpAPI(fallback) · WHOIS/scrape
```

---

## 3. The two Supabase projects (scope)

| Project | Ref | What it is | In scope? |
|---|---|---|---|
| **Gamers Lab Lead Gen** | `ccmwksmgoisijvyovgko` | This POC's data plane + Edge Functions. `publishers` lives here. | ✅ yes |
| **Gamers Lab Bot** | `bacumktnpozarnfvsrbw` | A separate GamersLab product (`monitor_results` ~6.8k rows, `targets`, `referrers`, `scheduled_surges`, `monitor_config`) — a monitoring/surge bot, unrelated to lead-gen. | ❌ no |

> ⚠️ Aside (not this POC): the *Gamers Lab Bot* project has **RLS disabled** on 5 tables
> (`monitor_results, targets, trigger_log, referrers, monitor_config`) — anyone with its anon key
> can read/write them. Worth fixing on that project, but out of scope here.

---

## 4. Data plane (live: `ccmwksmgoisijvyovgko`)

### 4.1 `publishers` — the one operational table (235 rows, RLS on, upsert key `steam_app_id`)

One row per Steam game/publisher; every pipeline stage writes its columns here. Grouped:

- **Identity / Steam facts:** `steam_app_id`, `game_name`, `publisher_name`, `developer_name`,
  `primary_genre`, `steam_tags`, `steam_description`, `review_score`, `total_reviews`,
  `owners_estimate`, `avg_playtime_2weeks`, `release_date`, `coming_soon`, `game_phase`,
  `is_free`, `price_usd`.
- **Steam signals (drive Pre-Score):** `has_multi_player`, `has_online_pvp`,
  `has_steam_leaderboards`, `has_steam_workshop`, `has_online_coop`.
- **Contact (email waterfall + socials):** `publisher_website`, `support_email`, `contact_email`,
  `contact_email_all`, `contact_source`, `contact_name`, `contact_role`,
  `whois_registrant_email`, `whois_registrant_name`, `twitter_handle`, `linkedin_company_url`,
  `discord_url`, `email_valid`, `email_status`.
- **Intel / evidence:** `founder_name`, `founder_quote`, `founder_quote_source`, `pain_signal`,
  `intel_summary`, `intel_quality` (gold|silver|bronze|no_signal), `evidence_strength`
  (explicit|inferred|none), `evidence_quote`, `evidence_sources` (jsonb), `evidence_as_of` (date),
  `evidence_decay_weight` (numeric), `risk_flags` (jsonb).
- **Scoring:** `pre_score`, `fit_score`, `value_score`, `match_score`, `outreach_tier`
  (A|B|C|skip), `score_rationale`.
- **GamersLab pitch:** `pitch_angle`, `best_ugc_app`, `gamerslab_hook`, `ugc_app_pitch`,
  `peer_publisher_ref`, `recommended_action`.
- **Outreach / draft:** `draft_subject`, `draft_body`, `model_used`, `approved_subject`,
  `approved_body`.
- **Workflow state:** `pipeline_status` (draft|skip|approved|rejected|sent|replied), `reviewed_by`,
  `reviewed_at`, `reject_reason`, `reject_reason_code`, `sent_at`, `replied_at`, `sequence_status`.
- **Multi-tenant / housekeeping:** `tenant_id` (uuid), `id`, `created_at`, `updated_at`.

> Note: `value_score`/`match_score` (two-sided) and `tenant_id` columns **exist**, but the UI
> adapter still derives the two-sided scores from `fit_score`/`pre_score` proxies (see §8 V1-GAP).

### 4.2 `cag_context` — the editable CAG brief (1 row)

`{ id, cag_block (text), updated_at }`. Single-row business brief that the engine injects when
scoring/drafting. Edited via the UI **Business Context** page → `context` function → this row; the
workflow reads it each run (`Apply CAG from DB`). **An edit here changes the next run's outputs.**

### 4.3 `runs` — discovery job state (used by the `discovery` function)

`{ id, created_at, kind, status, progress, counts (jsonb), error, started_at, finished_at }`.
One active run at a time; `n8n-status` updates `progress`/`status`.

### 4.4 `tenant` (1 row)

`{ id, name, theme (jsonb), mode }`. Exists, but the v1 `tenant` function currently returns a
fixed identity from config (it only reads `publishers` for the live usage count).

### 4.5 Provisioned-but-unused (the v2 generic schema, all 0 rows)

`source, document, intake, venue, business_summary, lead, evidence, run, outreach, outcome,
model_call_log`. These are the white-label/multi-tenant tables, created ahead of time so v2
doesn't retrofit. The v1 pipeline does **not** write them yet (it runs on `publishers`). Note
there are **two** run tables: `runs` (live, used) and `run` (generic v2, unused).

---

## 5. Edge Functions (11 live, all `verify_jwt: false`, static `API_BEARER`)

`_shared/`: `http.ts` (CORS, bearer, service-role client), `mapper.ts` (publishers↔Lead/Outreach),
`types.ts` (UI contract), `gamerslab-config.ts` (baked TENANT / GATE_FIELDS / sources / venues /
insights).

| Function | Methods | Live vs config | What it does |
|---|---|---|---|
| `discovery` | `POST /run`, `GET /:jobId` | 🟢 live | Inserts a `runs` row, fires the n8n webhook (`{run_id, mode}`), returns `202 {jobId}`; GET polls `runs` and returns mapped leads when done. One active run at a time. Stage label derived from `progress`. |
| `n8n-status` | `POST` | 🟢 live | Callback **from** n8n; updates `runs.status/progress/counts`. Secured by `x-status-secret`. |
| `leads` | `GET`, `PATCH /:id`, `POST /export` | 🟢 live | Reads `publishers`→`Lead[]` (mapper); approve/reject writes `pipeline_status`; export approved. |
| `outreach` | `GET`, `POST /:id/approve`, `POST /:id/skip` | 🟢 live | Gate C board over `publishers`; approve sets approved subject/body + "contacted" (no send); skip → "lost". |
| `context` | `GET`, `PUT` | 🟢 live | Reads/writes `cag_context.cag_block` — the editable CAG brief that drives the next run. Backs the Business Context UI page. |
| `tenant` | `GET` | 🟡 hybrid | Fixed identity/theme from config + **live** usage count (drafted publishers vs cap). |
| `understanding` | `GET/PUT` | ⚪ echo | Returns fixed Gate-A `GATE_FIELDS`; PUT echoes, not persisted. |
| `sources` | `GET/POST/DELETE` | ⚪ echo | Baked source list; add/remove no-op. |
| `intake` | `GET/PUT` | ⚪ echo | Baked offer/ICP; PUT echoes. |
| `venues` | `GET/PATCH` | ⚪ echo | Baked venue map (Steam strong); PATCH echoes. |
| `insights` | `GET`, `POST apply` | ⚪ echo | Baked dashboard insights; apply no-op. |

The UI speaks a generic Lead/Outreach language; `mapper.ts` adapts GamersLab's `publishers` onto
it. In v2 the **function surface stays identical** and only the backend swaps.

---

## 6. n8n v10 workflow (`MouIeDmDAAHKIpDn`) — the engine

**Entry (two, converge):** `Schedule Trigger` (daily 09:00, autonomous) **or** `Discovery Webhook`
(`POST /webhook/gamerslab-discovery`, returns 202; `Status: Running` posts progress to
`n8n-status`). Both converge at `Get Drafted IDs`. n8n has no REST execute endpoint, so the
webhook is the UI entry point.

**Linear spine (every run):**
1. `Get Drafted IDs` — read already-drafted/contacted `steam_app_id`s from `publishers` (the
   exclusion set); also reads the CAG row context.
2. `Fetch OpenRouter Free Models` → `Filter Free Models` — live `$0`/`:free` model roster.
3. `Fetch SteamSpy Games` — one genre tag, rotated hourly across 8 genres (Roguelite, Card,
   Survival, Battle Royale, Racing, Fighting, Strategy, Sports).
4. `Pick 100 Publishers` — drop blocked majors, score, return top `TARGET_COUNT` (default 100,
   from webhook body); the game→publisher hop.
5. `Wait: Steam Rate Limit` → `Get Steam App Details` → `Extract Steam Data` → `Filter Valid Games`
   (IF — skip delisted/no-data).
6. `Pre-Score` — free Steam signals → `pre_score` + `outreach_tier` + `publisher_key`.
7. `Select & Split` — per-publisher dedup; spend `DRAFT_BUDGET` (default 35) on best candidates
   above `SCORE_FLOOR` (default 10); route the rest to backlog.
8. `Route Enrich` (IF) → **backlog path** or **enrich path**.

**Backlog path:** `Build Backlog Record` → `Upsert Backlog` (parked, no draft).

**Enrich path (batched, one publisher at a time):**
9. `Batch for Web Search` (batchSize 1, loops).
10. `Exa: Combined Search` → `Exa Has Results?` (IF): true → `Normalise Search`; false (empty/429)
    → `SerpAPI: Fallback Search` → `Normalise Search`. *(SerpAPI is now a real fallback; in v9 it
    was orphaned.)*
11. `WHOIS Lookup` → `Fetch Publisher Website` → `Scrape Website` → `Fetch Contact Page` →
    `Scrape Contact Page` (legacy contact harvest; "continue on fail"). *(Still runs alongside Exa
    — the enrichment duplication noted in `how/pipeline_critique_v2.md` I1/T1.)*
12. `Merge All Data` — email waterfall: steam → contact page → website → exa/serper → whois.
13. `Verify Email` (free MX/provider check) → `Classify Email` (role/personal/generic).
14. `Apply CAG from DB` + `Prepare LLM Items` — inject the `cag_context` brief; build **one** model
    item per lead.
15. `LLM: Intel + Draft` (one model call) → `Pick Best LLM Response` (first valid JSON). *(No
    multi-model fan-out — the old "All Models" name is gone.)*
16. `Build Final Record` — assemble the row incl. `evidence_strength/quote/sources/as_of`,
    `evidence_decay_weight`, `risk_flags` (LLM-emitted, heuristic fallback).
17. `Upsert to Supabase` (upsert on `steam_app_id`) → loop to next batch.
18. On the enrich "done" branch: `Resolve Run Context` → `Status: Completed` posts progress 100 to
    `n8n-status` (only on webhook runs; scheduled runs skip the post).

**Outreach tiers** (set in `Pre-Score`): A `60+` full email · B `30–59` full · C `10–29` short ·
skip `<10` backlog. Budget 35/run respects OpenRouter's ~50/day free cap.

**Credentials:** OpenRouter (model list + draft), Supabase Postgres (`Get Drafted IDs`, `Upsert to
Supabase`, `Upsert Backlog`), `SERPER_API_KEY` + Exa key as env/HTTP; `N8N_STATUS_SECRET` for the
status callback.

---

## 7. UI step-by-step (what each action does)

🟢 live · ⚪ echo · 🟡 hybrid

1. **Sign in** ⚪ — stub; UI↔functions use one static bearer.
2. **Onboarding — Sources / Intake / Venues** ⚪ — `GET/POST/PUT/PATCH` return baked config; edits
   echo, nothing is parsed/indexed.
3. **Business Context (CAG)** 🟢 — `GET/PUT /context` reads/writes `cag_context.cag_block`. **This
   edit changes the next run's scoring + drafts.**
4. **Gate A — Understanding** ⚪ (screen) / 🟢 (button) — `GET/PUT /understanding` echoes baked
   fields; the **"Find leads"** button calls `POST /discovery/run`.
5. **Discovery (loading)** 🟢 — `POST /discovery/run {mode}` → `runs` row + n8n webhook → `202
   {jobId}`; UI polls `GET /discovery/:jobId` → `{running, pct, stage}` (stage from pct:
   Searching Steam→Mining contacts→Harvesting intel→Scoring fit→Drafting outreach) → `{done,
   result:{leads, foundCount}}`. n8n posts progress via `n8n-status`.
6. **Gate B — Leads** 🟢 — `GET /leads` (mapped publishers); `PATCH /leads/:id
   {approved|rejected|pending}` writes `pipeline_status`; `POST /leads/export`.
7. **Gate C — Outreach** 🟢 — `GET /outreach`; `POST /:id/approve` (sets approved subject/body,
   moves to "contacted" — **no send**); `POST /:id/skip` → "lost".
8. **Dashboard — Learn** ⚪ — `GET /insights` baked; "apply refinement" no-op; "re-run" →
   `POST /discovery/run`.

---

## 8. `publishers` → UI mapping (`_shared/mapper.ts`) and V1-GAPs

The mapper translates a `publishers` row to the UI's generic `Lead` / `OutreachItem`. Deliberate
gaps where GamersLab's schema has no clean equivalent:

- **Two-sided score:** UI `score`/`valueScore` ← `fit_score`; `matchScore` ← `pre_score` (proxies).
  Dedicated `value_score`/`match_score` columns exist but aren't the source yet. *(v2 produces real
  value×match.)*
- **`verified`** ← `email_valid` (a deliverable, MX-valid contact) — closest signal to the UI badge.
- **No send:** approving at Gate C is terminal and shows as "contacted"; `replied`/`success`/
  `partial` need inbound email/CRM webhooks (not wired).
- **Evidence/flags pass-through:** `evidence_strength`, `evidence_quote`/`sources`/`as_of`, and
  `risk_flags` map to the UI dossier (flagged, never used to drop a lead).

---

## 9. Config, secrets, deployment

- **UI** (`poc/ui/.env.local`): `VITE_API_BASE=https://ccmwksmgoisijvyovgko.supabase.co/functions/v1`,
  `VITE_API_BEARER=<API_BEARER>`, `VITE_USE_FIXTURES=false`.
- **Edge Function secrets:** `API_BEARER` (UI must match), `N8N_WEBHOOK_URL`
  (`https://n8n-j39n.sliplane.app/webhook/gamerslab-discovery`), `N8N_WEBHOOK_SECRET`,
  `N8N_STATUS_SECRET`; service-role auto-injected. Deployed `--no-verify-jwt`.
- **n8n env:** `SERPER_API_KEY`, Exa key, `N8N_STATUS_SECRET`; OpenRouter + Supabase Postgres
  credentials. Webhook auth is path-based; if it 404s on first call, toggle the workflow active
  off→on once.

---

## 10. Known gaps / not-yet-wired (and what's pre-built for v2)

- **Enrichment duplication:** Exa search runs *and* the WHOIS/scrape cluster runs (critique
  `how/pipeline_critique_v2.md` I1/T1). Decision: keep scrape as fallback behind Exa.
- **Exclusion is keyed on `steam_app_id`**, not the publisher entity (critique I3).
- **No send / no inbound tracking** → the Learn loop has no outcome data yet (critique D7/N1).
- **Auth is a stub**; one shared bearer; no per-user/tenant auth.
- **Config surfaces echo** (sources/intake/venues/understanding/insights); only Business
  Context (CAG) is live-editable.
- **Pre-built for v2 (provisioned, empty):** the full generic schema (§4.5), `tenant_id` and
  `value_score`/`match_score` on `publishers`, and the stable Edge-Function surface — so v2 swaps
  the backend without changing the UI.

---

## 11. Verification log & sources

**Verified live 2026-06-22:**
- n8n `MouIeDmDAAHKIpDn` node graph + connections (incl. `Discovery Webhook`, `Status: Running`,
  `Resolve Run Context`, `Status: Completed`, `Exa Has Results?`, `Apply CAG from DB`,
  `LLM: Intel + Draft`). *(Read node names/types/connections + key node logic; not every node's
  full inner code.)*
- Supabase `ccmwksmgoisijvyovgko`: `list_tables` (16 tables, row counts), `publishers`/`runs`/`run`/
  `cag_context`/`tenant` columns via `information_schema`, and the 11 deployed Edge Functions.
- Edge-Function source read: `discovery`, `context`, `tenant`, `understanding`, `_shared/mapper.ts`.

**Repo sources:** `gamerslab-poc/supabase/functions/*`, `gamerslab-poc/workflow/v10-live-edits/`,
`poc/ui/docs/ENDPOINTS.md`, `how/pipeline_critique_v2.md`.

**Stale (do not trust for current state):** `gamerslab-poc/workflow/gamerslab-outreach-v9.json`
and the v9 pipeline overview in `gamerslab-poc/README.md`.
