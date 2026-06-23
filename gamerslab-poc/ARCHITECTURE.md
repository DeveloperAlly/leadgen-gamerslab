# GamersLab POC — Complete System Architecture (all workflows, as-built)

**Status:** ✅ **AS-BUILT & CANONICAL.** This is the single source of truth for the *whole*
GamersLab lead-gen runtime — **all six n8n workflows**, Supabase, the UI, and Gmail, and how they
interconnect. **Verified live 2026-06-23** (every workflow read node-by-node via the n8n API).
**Owner:** Ally · **Area:** GamersLab POC (v1) — area 1 of the repo (see root `CLAUDE.md`).

> **Why this doc exists.** Earlier write-ups (`SPEC.md §6`, the README) documented only the
> **v10 discovery engine** and left the other five workflows scattered across STATE.md prose and
> `how/` drafts. The result: every agent that touched the system rebuilt a partial mental model and
> missed half the moving parts. **This doc holds the full picture.** Read it before changing any
> workflow. Keep it current (see §10, *Maintenance rule*).

> **Companion docs:** `SPEC.md` = UI ↔ Edge ↔ DB contract + the v10 engine in depth.
> This file = **the workflow fleet and its wiring.** Read `STATE.md` first for live status.

---

## 0. Scope — this is the GamersLab POC (v1) ONLY. White-label v2 is elsewhere.

This document describes **one of the two products in this repo**: the **built, live, Steam-specific,
single-tenant GamersLab POC (v1)**. It does **not** describe the white-label v2 product.

| | **GamersLab POC (v1)** — *this doc* | **White-label v2** — *not this doc* |
|---|---|---|
| State | **BUILT & ACTIVE** (iterating live) | **DESIGN / pre-gate — does NOT run** |
| What | Steam→publisher outreach, hardwired to GamersLab | Productised, multi-tenant, config-not-code generalisation |
| Lives in | `gamerslab-poc/` (this folder) + the 6 live n8n workflows | `whitelabel/` + design specs in root `how/` (`architecture_spec_M2_DRAFT.md`, `v2_phase_delivery_DRAFT.md`) |
| n8n | 6 live workflows on one shared Sliplane instance, GamersLab-specific | Not built. Design assumes a **shared** engine parameterised by `tenant_id` (n8n has no native multi-tenancy) |
| Read instead | — | `whitelabel/README.md`, then the root `how/` v2 design drafts |

### The POC IS the modular template — no hardcoding (modular mandate #7)

The differentiation above is about **scope and state** (POC is built; v2 is design), **not** about
quality. The POC is **not** a throwaway hardwired prototype — it is built to be **modular and
scalable**, so it **extends into white-label by adding config, never by forking or rewriting**.
GamersLab is the *first tenant of the template*, not a special-cased one-off.

The rule: **anything GamersLab-specific must live as data/config, not in code.** Each layer is
designed to that standard; where the as-built still bakes a value in code, that is a **modularisation
gap to close** (tech debt, not acceptable design):

| Layer | Modular design (the standard) | As-built today | Gap to close before it extends cleanly |
|---|---|---|---|
| Venue / mining | Venue is a **pluggable adapter**; tenant declares its venue + entity hop | Steam/SteamSpy logic is in the v10 engine nodes | Lift Steam specifics into a venue-adapter config; engine stays generic |
| CAG / brief | `cag_context` built from a tenant's `intake_answer` bank by the generic Context Builder | Generic ✅ — already data-driven per tenant | Keep question keys tenant-scoped (no GamersLab keys in code) |
| Data model | `tenant_id` on every row; generic entities (`lead`, `evidence`, `outreach`, …) | `tenant_id` present; live pipeline still writes `publishers` | Migrate the live path onto the generic schema |
| Edge API surface | **Identical generic function surface** for every tenant; backend swaps underneath | Generic Lead/Outreach contract via `_shared/mapper.ts` ✅ | Keep baked GamersLab config (`gamerslab-config.ts`) tenant-loaded, not hardcoded |
| n8n workflows | One **shared** engine + send + reply + context + ingest, parameterised by `tenant_id` | 6 GamersLab-wired graphs (the correct *pattern*, single-tenant) | Parameterise per-tenant inputs; one shared instance, not instance-per-tenant |
| UI | **One source** (`poc/ui/`), reskinned by tokens — never forked | Built `--mode poc`, themed "gamerslab" ✅ | None — already one source, two build modes |

> So: **clear differentiation (POC ≠ v2) AND a clean extension path (POC → v2 by config).** Everything
> below (§1–§10) is the **v1 as-built**; the "Gap to close" column is the modularisation backlog that
> makes it extend. When v2 work begins it gets its **own** doc under `whitelabel/` — but it builds on
> this template, it does not replace it.

---

## 1. The whole system at a glance

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ BROWSER · Lead Pipeline UI (React, themed "gamerslab")        seam: leadService.ts   │
│  Onboarding · Sources · Business Context(CAG) · Discovery · Gate B · Gate C · Inbox  │
└───────────────────────────────────┬──────────────────────────────────────────────────┘
                                     │ HTTPS + static Bearer
                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTIONS (project ccmwksmgoisijvyovgko) — the v1 Integration API      │
│  discovery · n8n-status · leads · outreach · context · sources · intake · …          │
│  email-account · email-oauth · email-access-token(broker) · email-thread · …         │
└───┬───────────────┬───────────────┬───────────────┬───────────────┬──────────────────┘
    │ POST webhook  │ POST webhook  │ POST webhook  │ POST webhook  │ service-role R/W
    │ /discovery    │ /source-ingest│ /context-build│ /gamerslab-   │
    ▼               ▼               ▼               │ send +/approve▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │        ┌──────────────────────────┐
│ ① Outreach  │ │ ⑤ Source     │ │ ④ Context    │  │        │ SUPABASE POSTGRES        │
│   v10       │ │   Ingestion  │ │   Builder    │  │        │  publishers(235) ·       │
│ (engine)    │ │              │ │              │  │        │  message · cag_context · │
│ mine→draft  │ │ url/file →   │ │ intake_answer│  │        │  intake_answer ·         │
│             │ │ intake facts │ │ → CAG block  │  │        │  intake_suggestion ·     │
└──────┬──────┘ └──────┬───────┘ └──────┬───────┘  │        │  source · source_extract │
       │ writes        │ writes         │ writes    │        │  · runs · tenant         │
       └───────────────┴────────────────┴───────────┼───────▶└──────────┬───────────────┘
                                                     │                   │
   ┌─────────────────────────┐  ┌──────────────────┐│                   │ reads/writes
   │ ② Outreach Send         │  │ ③ Reply Poll     ││                   ▼
   │ webhook → Gmail send →   │  │ every 15m → read │└──────────▶ Gmail API (broker token)
   │ stamp publishers+message │  │ thread → stamp   │            send · read threads
   └─────────────────────────┘  │ replied          │
                                 └──────────────────┘
External (engine ①): Steam · SteamSpy · OpenRouter(free) · Exa(primary) · SerpAPI(fallback)
n8n host: self-host on Sliplane — https://n8n-j39n.sliplane.app
```

There is **one more** n8n workflow named "Gamers Lab …" — **Gamers Lab Monitor Site**
(`pTkt5lTwDgTwUY1f`). It belongs to a **separate product** (the *Gamers Lab Bot* / monitoring-surge
project on Supabase `bacumktnpozarnfvsrbw`) and is **NOT part of lead-gen**. Do not wire it in.

---

## 2. Workflow registry (the fleet)

All on the same self-hosted n8n instance (`n8n-j39n.sliplane.app`).

| # | Workflow | n8n ID | Trigger | Active | Role |
|---|----------|--------|---------|--------|------|
| ① | **GamersLab Publisher Outreach v10** | `MouIeDmDAAHKIpDn` | Schedule 09:00 **+** `POST /webhook/gamerslab-discovery` | ✅ | The engine: mine Steam → enrich → score → draft. Writes `publishers`. Never sends. |
| ② | **GamersLab Outreach Send** | `YEgPZ0eATTSAb9pa` | `POST /webhook/gamerslab-send` | ✅ | Approve → Gmail send → stamp `sent` on `publishers` + `message`. |
| ③ | **GamersLab Reply Poll** | `LAPjN0jbvV9GAetX` | Schedule every 15 min | ✅ | Detect inbound reply on sent threads → stamp `replied`. |
| ④ | **GamersLab Context Builder** | `G5Mkf1KUmr6LHJdV` | `POST /webhook/context-build` | ✅ | Compose the CAG block from `intake_answer` → write `cag_context`. |
| ⑤ | **GamersLab Source Ingestion** | `ertFL6pi4wlJ3lMJ` | `POST /webhook/source-ingest` | ✅ | URL/file → LLM-extract facts → fill/suggest intake → trigger ④. |
| — | **GamersLab Publisher Outreach v9** | `bGxcwlp3VRL8jT9r-Mm_h` | Schedule **(node disabled)** | ⏸ inert | **Superseded by ①ㆍparked.** Trigger node disabled → does not run. See §3. |
| — | *Gamers Lab Monitor Site* | `pTkt5lTwDgTwUY1f` | Schedule | ✅ | **Different product** (monitoring bot). Not lead-gen. |

---

## 3. v9 is superseded and parked (no run, no risk)

The old engine **v9 (`bGxcwlp3VRL8jT9r-Mm_h`)** is superseded by ①. It shows `active: true` at the
workflow level, **but its `Schedule Trigger` node is disabled (`"disabled": true`)** — so it has no
live entry point and **does not run**. There is **no** double-run or conflicting-write risk.

Leave it as-is unless you intend to retire it entirely. The committed
`workflow/gamerslab-outreach-v9.json` is a stale v9 export kept only as a historical baseline.
*(Verified live 2026-06-23: the trigger node carries `disabled: true`.)*

---

## 4. Per-workflow detail (live node spines)

### ① GamersLab Publisher Outreach v10 — the engine (`MouIeDmDAAHKIpDn`)

**Triggers (converge):** `Schedule Trigger` (daily 09:00, autonomous) **and** `Discovery Webhook`
(`POST /webhook/gamerslab-discovery`, 202; `Status: Running` posts progress to the `n8n-status`
Edge fn). n8n has no REST execute endpoint, so the webhook is the UI's entry.

**Linear spine (38 nodes live):**
```
(Schedule | Discovery Webhook → Status: Running)
  → Get Drafted IDs            read drafted/contacted steam_app_ids (exclusion set) + CAG row
  → Fetch OpenRouter Free Models → Filter Free Models   live $0/:free model roster
  → Fetch SteamSpy Games       one genre tag, rotated hourly across 8 genres
  → Pick 100 Publishers        drop blocked majors, score, top TARGET_COUNT (default 100); game→publisher hop
  → Wait: Steam Rate Limit → Get Steam App Details → Extract Steam Data → Filter Valid Games (IF)
  → Pre-Score                  free Steam signals → pre_score + outreach_tier + publisher_key
  → Select & Split             per-publisher dedup; spend DRAFT_BUDGET (35) above SCORE_FLOOR (10)
  → Route Enrich (IF) ──────── backlog → Build Backlog Record → Upsert Backlog (parked, no draft)
        │ enrich (batched, batchSize 1):
        → Batch for Web Search
        → Exa: Combined Search → Exa Has Results? (IF)
              true  → Normalise Search
              false → SerpAPI: Fallback Search → Normalise Search
        → Fetch Publisher Website → Scrape Website → Fetch Contact Page → Scrape Contact Page
        → Merge All Data         email waterfall + socials mining (twitter/linkedin/discord)
        → Verify Email (MX/provider) → Classify Email (role/personal/generic)
        → Apply CAG from DB      inject editable cag_context brief into the prompt
        → Prepare LLM Items      build ONE model item per lead (no fan-out)
        → LLM: Intel + Draft → Pick Best LLM Response (first valid JSON)
        → Build Final Record     row incl. evidence_*, risk_flags, decay
        → Add B Variant          write a question/pairing B subject (A/B)
        → Upsert to Supabase     upsert on steam_app_id → loop next batch
  → (enrich done) Resolve Run Context → Status: Completed   posts progress 100 (webhook runs only)
```

**Recent live edits (2026-06-23, already applied):** `WHOIS Lookup` node **removed** (0% real
registrants by law) and rewired `Normalise Search → Fetch Publisher Website`; `Merge All Data` now
mines socials from Exa result links; `Add B Variant` inserted between `Build Final Record` and
`Upsert to Supabase`. See `workflow/v10-live-edits/` for the applied node bodies.

**Outreach tiers** (set in `Pre-Score`): A `60+` full · B `30–59` full · C `10–29` short · skip
`<10` backlog. **Writes:** `publishers` (upsert `steam_app_id`), backlog rows; reads `cag_context`.
**Credentials:** OpenRouter, Supabase Postgres, `SERPER_API_KEY` + Exa key (env/HTTP),
`N8N_STATUS_SECRET`.

### ② GamersLab Outreach Send (`YEgPZ0eATTSAb9pa`)

**Trigger:** `POST /webhook/gamerslab-send` — fired by the `outreach` Edge fn on
`POST /outreach/:id/approve`. Body: `{ publisher_id, message_id? }`.

```
Send Webhook → Get Draft → Get Access Token → Build Raw → Gmail Send → Mark Sent → Mark Message Sent
```
- **Get Draft** — `SELECT … FROM message m JOIN publishers p` ; if `message_id` given uses it, else
  the publisher's step-1 draft, preferring variant `A`.
- **Get Access Token** — POSTs the **`email-access-token` broker** Edge fn (Header-Auth credential)
  → `{ access_token, from_email }`.
- **Build Raw** — assembles an RFC 822 MIME message, RFC 2047-encodes a non-ASCII subject,
  base64url-encodes; carries `threadId` for in-thread follow-ups.
- **Gmail Send** — `POST gmail/v1/users/me/messages/send` (`Bearer` token); includes `threadId` when present.
- **Mark Sent** — `UPDATE publishers SET pipeline_status='sent', sent_at, outreach_thread_id, outreach_message_id`.
- **Mark Message Sent** — `UPDATE message SET status='sent', sent_at, thread_id, message_id`.

### ③ GamersLab Reply Poll (`LAPjN0jbvV9GAetX`)

**Trigger:** Schedule every **15 min**.
```
Every 15 min → Get Access Token → Awaiting Reply → Reply Loop (splitInBatches)
   → Get Thread → Detect Reply → Replied? (IF)
        true  → Mark Replied → Mark Publisher Replied → (loop)
        false → (loop) → Done
```
- **Awaiting Reply** — `SELECT … FROM message WHERE status='sent' AND thread_id IS NOT NULL AND replied_at IS NULL LIMIT 50`.
- **Get Thread** — Gmail `threads/{id}?format=metadata&metadataHeaders=From`.
- **Detect Reply** — replied = any message whose `From` is **not** the connected inbox (`from_email`).
- **Writes:** `message` (`status='replied', replied_at`) and `publishers` (`pipeline_status='replied', replied_at`).

### ④ GamersLab Context Builder (`G5Mkf1KUmr6LHJdV`)

**Trigger:** `POST /webhook/context-build` — fired by the `intake`/`sources` Edge fns on save, and
by ⑤ at the end of an ingest.
```
Build Webhook → Read Intake → Compose CAG → Publish to cag_context → Trim cag_context
```
- **Read Intake** — `SELECT question_key, answer FROM intake_answer` for the tenant.
- **Compose CAG** — deterministic template assembling the `=== GAMERSLAB PRODUCT BRIEF === … ===
  END GAMERSLAB BRIEF ===` block from keyed answers (oneliner, problem, numbers, peers, apps, pitch
  angles, objections, sdk, fit profile, contact/CTA, team, banned phrases). **These markers are the
  exact block the engine's `Apply CAG from DB` node regex-swaps** — do not rename them.
- **Publish to cag_context** — insert new row; **Trim** keeps only the latest by `updated_at`.

### ⑤ GamersLab Source Ingestion (`ertFL6pi4wlJ3lMJ`)

**Trigger:** `POST /webhook/source-ingest` — fired by the `sources` Edge fn when a source is queued.
```
Ingest Webhook → Fetch Free Models → Get Answers → Prep → Get Queued URLs → Route Type (IF)
   url  → Fetch URL ─┐
   file → Download File → Extract Doc (PDF) ─┘→ Prep LLM → Extract Chain (OR Model / OR Fallback)
   → Build Writes → Apply Writes → Trigger Context Builder (calls ④)
```
- **Prep** — picks two **free** OpenRouter models (primary + fallback), rotated across the live
  `:free` instruct pool to spread rate limits.
- **Get Queued URLs** — `SELECT … FROM source WHERE status='queued' AND type IN ('url','file') LIMIT 3`.
- **Extract Chain** — LangChain LLM chain over stripped page/PDF text → minified JSON mapping
  intake `question_key` → `{answer, confidence, quote}`, grounded only in the text.
- **Build Writes / Apply Writes** — single CTE: insert `source_extract`; **ADD** to `intake_answer`
  where empty (on-conflict update); **SUGGEST** into `intake_suggestion` where the answer differs;
  mark `source` `indexed`. Then **Trigger Context Builder** recomposes the CAG.

---

## 5. End-to-end data flow (how the fleet interconnects)

**Onboarding / context loop (informs scoring + drafts):**
client adds a source in the UI → `sources` Edge fn queues it + fires **⑤ Source Ingestion** →
facts land in `intake_answer` (+ `intake_suggestion`) → ⑤ triggers **④ Context Builder** →
`cag_context` row updated. Editing **Business Context** in the UI writes `cag_context` directly via
the `context` Edge fn. Either way, the **next ① run** reads the fresh brief through `Apply CAG from DB`.

**Discovery loop (the leads):**
UI "Find leads" → `discovery` Edge fn inserts a `runs` row + POSTs **① v10**'s discovery webhook →
① mines/enriches/scores/drafts → upserts `publishers` (+ `message` B-variants) → posts progress to
`n8n-status` → UI Gate B reads `leads`, Gate C reads `outreach`.

**Send + reply loop (the outreach):**
Gate C approve → `outreach` Edge fn POSTs **② Outreach Send** → Gmail send (via `email-access-token`
broker) → stamps `publishers` + `message` = `sent`. **③ Reply Poll** every 15 min reads sent threads
→ on inbound reply stamps `publishers` + `message` = `replied` → UI Inbox/prospect tracking reflects it.

---

## 6. Supabase tables — who writes what (project `ccmwksmgoisijvyovgko`)

| Table | Written by | Read by |
|-------|-----------|---------|
| `publishers` (235) | ① upsert · ② sent · ③ replied | `leads`/`outreach` Edge fns, UI |
| `message` (A/B variants, steps) | ① `Add B Variant` · ② sent · ③ replied | ② Get Draft, ③ Awaiting Reply, `outreach` |
| `cag_context` | ④ Publish/Trim · `context` Edge fn | ① `Get Drafted IDs` / `Apply CAG from DB` |
| `intake_answer` | ⑤ ADD · `intake` Edge fn | ④ Read Intake, ⑤ Get Answers |
| `intake_suggestion` | ⑤ SUGGEST | `intake`/`sources` Edge fns, UI |
| `source` | `sources` Edge fn (queue) · ⑤ (indexed) | ⑤ Get Queued URLs |
| `source_extract` | ⑤ Apply Writes | audit |
| `runs` | `discovery` Edge fn · `n8n-status` (from ①) | `discovery`, UI |
| `tenant` | seed | all (tenant scoping) |

Provisioned-but-unused v2 generic tables (`source`* aside, `document, venue, business_summary, lead,
evidence, run, outcome, model_call_log`) are 0-row — see `SPEC.md §4.5`. (`run` ≠ `runs`.)

## 7. Webhook / endpoint registry

| Path (on `n8n-j39n.sliplane.app`) | Workflow | Caller |
|-----------------------------------|----------|--------|
| `POST /webhook/gamerslab-discovery` | ① | `discovery` Edge fn |
| `POST /webhook/gamerslab-send` | ② | `outreach` Edge fn (approve) |
| `POST /webhook/context-build` | ④ | `intake`/`sources` Edge fns, ⑤ |
| `POST /webhook/source-ingest` | ⑤ | `sources` Edge fn |
| `POST …/functions/v1/n8n-status` | (Edge) | ① Status: Running/Completed |
| `POST …/functions/v1/email-access-token` | (Edge broker) | ②, ③ |

## 8. Credentials & secrets

- **n8n:** OpenRouter API, Supabase Postgres (pooler), `SERPER_API_KEY` + Exa key (env/HTTP),
  `N8N_STATUS_SECRET`, Header-Auth credential for the `email-access-token` broker.
- **Edge fns:** `API_BEARER`, `N8N_WEBHOOK_URL` + `N8N_WEBHOOK_SECRET`, `N8N_STATUS_SECRET`, Google
  OAuth client (for the email broker); service-role auto-injected. All deployed `--no-verify-jwt`.
- **Gmail:** Google OAuth app; connected inbox `ally@gamerslab.gg`; tokens vended by the broker.

---

## 9. Verification log

**Read live via the n8n API on 2026-06-23** — full node graphs of ②③④⑤ and the v10 ① node list
(38 nodes) + the two recently-rewired connections (`Build Final Record→Add B Variant→Upsert`;
`Normalise Search→Fetch Publisher Website`, WHOIS gone). v9 confirmed parked — its Schedule Trigger
node carries `disabled: true`, so it does not run.
Supabase table roles cross-checked against `SPEC.md` (verified live 2026-06-22).

---

## 10. Maintenance rule (keep this doc true)

**This file must be updated in the same change as any live workflow edit.** Specifically, when you:

- add/remove/rename a node, or rewire a connection → update the relevant §4 spine;
- add a workflow → add a row to §2, a §4 block, and the §1 map;
- change a webhook path or DB write → update §6/§7;
- activate/deactivate a workflow → update §2 `Active` and §3 if it changes the v9 situation.

**Update checklist (paste into the PR/commit body):**
- [ ] §2 registry row accurate (ID, trigger, active, role)
- [ ] §4 node spine matches the live graph (re-read via the n8n API, don't guess)
- [ ] §6 table-writer matrix still correct
- [ ] §7 webhook registry still correct
- [ ] §9 verification date bumped to today
- [ ] aDNA `project_state` saved (tags `gamers-lab`, `lead-gen`) so other surfaces recall the change
