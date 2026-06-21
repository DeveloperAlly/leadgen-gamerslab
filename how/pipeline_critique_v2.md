# Pipeline Critique v2 — Findings, Fixes & Roadmap

**Status:** 🟡 **DRAFT — PRE-GATE.** Analysis + recommended fixes. Nothing here authorises a
build (see `STATE.md`). **Created:** 2026-06-22 · **Owner:** Ally · **Campaign:**
`gamers_lab_lead_gen` · **Supersedes/extends:** `how/pipeline_critique.md` (v1, 8 gaps).

**What this is:** a critical analysis of the pipeline (the 5-stage business process, the infra
stack, **and the live n8n workflow `MouIeDmDAAHKIpDn`**), with — for every item — the **original
finding**, **how to fix it**, a **POC (GamersLab) path vs a later white-label path**, and an
**effort/impact** tag. Ally's inline decisions from the 2026-06-22 review are folded in.

**Verification done for this doc (doctrine #4):**
- Read the live workflow node graph (names, types, **connections**) for `MouIeDmDAAHKIpDn`.
  I read structure + wiring, **not** every node's full inner code — wiring claims below are from
  the connection map and are reliable; a 2-min editor glance can reconfirm before any change.
- n8n concurrency, retry, and webhook capabilities verified against **live n8n docs (2026)** —
  sources at the foot.

---

## 0. How to read this

Each item: **Original** (what I flagged) → **Verified** (what the live system actually does, where
checked) → **Ally** (your call) → **Fix** → **POC** (GamersLab, single-tenant, free-tier, Steam) →
**White-label** (multi-tenant productisation) → **`[Effort S/M/L · Impact H/M/L]`**.

"n/a for POC" items are parked in §8 (white-label backlog) so the POC stays lean.

---

## 1. Corrections to v1 (what looking at the live workflow changed)

Three v1 claims need correcting now that I've read the actual wiring:

1. **Exclusion is NOT late.** Live order is `Schedule Trigger → Get Drafted IDs → Fetch
   OpenRouter Free Models → SteamSpy → Pick 100 Publishers → …`. The drafted/contacted IDs are
   pulled **first** and filtered in `Pick 100 Publishers` **before** the expensive
   scrape/LLM/score steps. So the costly-rework risk I raised is largely already handled. The
   *narrower* real issue remains (see Inefficiency 3).
2. **SerpAPI is dead code, not a redundant cost.** `SerpAPI: Fallback Search` has an **output**
   (→ `Normalise Search`) but **no input** — nothing routes into it, so it never executes. Exa
   (`Batch for Web Search → Exa: Combined Search → Normalise Search`) is the sole live search.
3. **The real duplication is enrichment, not search.** Exa replaced *Serper (search)* only. The
   legacy **WHOIS + Fetch/Scrape Website + Fetch/Scrape Contact Page** cluster still runs *after*
   Exa (`Normalise Search → WHOIS Lookup → …`). That's the live drift vs the v10 design, which
   says Exa enrichments/Contents should cover identity + contact extraction too.

---

## 2. Inefficiencies

### I1 — Is SerpAPI a proper fallback? `[Effort S · Impact M]`
**Original:** Serper/SerpAPI should be a *fallback only* for rate-limited free tools.
**Verified:** **No — it's orphaned** (output wired, no input). It is not acting as a fallback;
it's inert. Exa is the only live search path.
**Ally:** "should be ONLY a fallback for rate-limited free tier tools — fix if not."
**Fix:** make it a *real* conditional fallback. After `Exa: Combined Search`, add an **IF** node:
`Exa returned 0 results` **OR** `Exa HTTP status ∈ {429, 5xx}` → route to `SerpAPI: Fallback
Search` → `Normalise Search`; else continue. Wire `Batch for Web Search`'s loop output into Exa,
Exa's error/empty branch into SerpAPI. Use n8n node setting **On Error = Continue (using error
output)** on the Exa node so a hard failure exposes an error branch to drive the IF.
**POC:** add the IF + re-wire; keep one SerpAPI key in n8n credentials. ~30 min.
**White-label:** generalise to a **search-adapter chain** (primary `→` fallback list) read from
`tenant_config.search_providers[]`, so each tenant can declare its own primary/fallback order.

### I2 — Multi-model fan-out runs for every lead `[Effort S · Impact H]`
**Original:** `LLM: Intel + Draft (All Models)` drafts across *all* free models for *every* lead,
then `Pick Best`. Most leads don't need N drafts.
**Ally:** "WHAT??? yes this should happen" (i.e. gate it).
**Fix:** you already compute `Pre-Score`. Gate the fan-out on it: only leads above a
`fanout_threshold` get the multi-model draft; everyone else gets **one** default model. Move
`Pre-Score` (or a lightweight copy) **above** `LLM: Intel + Draft` and branch with an IF.
**POC:** single hardcoded threshold (e.g. top 20% by pre-score, or score ≥ X). Saves the bulk of
token spend immediately.
**White-label:** `tenant_config.fanout_threshold` + `fanout_models[]`; log per-tenant spend so the
threshold can be tuned from the Learn loop (§5).

### I3 — Exclusion is keyed on Steam app IDs, post-mine `[Effort M · Impact M]`
**Original:** exclusion may be wasteful/late.
**Verified:** it's **early** but **coarse** — it filters `steam_app_id`s already
drafted/contacted inside `Pick 100 Publishers`. It excludes at the *game/proxy* level, not the
*publisher entity* level, and it's a post-SteamSpy-pull filter, not a source exclusion in the
discovery query.
**Ally:** "FIX THIS."
**Fix:** exclude at the **entity** you actually sell to (the **publisher**), and as far upstream
as possible. (a) Keep a `known_prospects` registry keyed on a stable **publisher** id (domain or
normalised name), not the Steam app id. (b) When discovery moves to Exa Websets, pass that
registry into Exa's **`exclude`** import so known publishers are **never returned**. (c) Until
then, filter on publisher id in `Pick 100 Publishers` *and* again right before enrich, so a
publisher reached via a *different* game isn't re-processed.
**POC:** add publisher-level dedup key to the backlog + filter on it. 
**White-label:** registry is `tenant_id`-scoped; Exa `exclude` import per run (see §7/L3).

### I4 — Full re-run every schedule, no deltas `[Effort M · Impact M]`
**Original:** the schedule re-pulls SteamSpy and reprocesses the world each run.
**Ally:** "fix."
**Fix:** make it incremental. Two layers: (a) **cursor/state** — persist the last-processed
SteamSpy page/rank and only advance, instead of re-pulling the top list; (b) **event-driven** —
when on Exa Websets, use **Monitors** (cron ≥1/day) + **webhooks** (`webset.item.created` /
`.enriched`) so *new* matches stream into an n8n **Webhook trigger**, rather than a blind full
sweep. (See Technical T4 — verified n8n can receive these.)
**POC:** add the cursor first (cheap, big win). Monitors when Exa is wired.
**White-label:** Monitor-per-tenant; webhook payload carries `tenant_id`.

### I5 — Blocking `Wait` instead of concurrency control `[Effort M · Impact M]`
**Original:** `Wait: Steam Rate Limit` stalls the whole run.
**Ally:** "use queue/concurrency control — VERIFY THAT IS POSSIBLE IN n8n."
**Verified — yes, two supported routes:**
- **Regular mode:** set `N8N_CONCURRENCY_PRODUCTION_LIMIT` (integer; `-1` = unlimited default,
  `1+` enables a FIFO queue for trigger/webhook executions). Read at startup; restart to apply.
- **Queue mode:** Redis-backed workers for true horizontal concurrency at scale.
  Rule of thumb: 5–10 concurrent per core for I/O-bound (HTTP-wait) workflows like this one.
**Fix:** keep a *small* `Wait` only where an API's per-second limit demands it, but move
run-level throttling to concurrency control + per-node **batching** (`splitInBatches`, already
present) rather than a global blocking wait.
**POC:** set `N8N_CONCURRENCY_PRODUCTION_LIMIT` on the Sliplane instance; reduce the Wait. (Note:
self-hosted default is disabled/`-1`, so it's currently off.)
**White-label:** queue mode + Redis when concurrent tenant runs appear.

### I6 — `Pick 100 Publishers` is hardcoded `[Effort S · Impact M]`
**Original:** magic number + single venue, re-mined every run.
**Ally:** "yikes — make this variable."
**Fix:** lift the count and the venue into parameters. `Pick {{ $json.target_count }} Publishers`
sourced from workflow input / a config row; default 100. Pair with the cursor from I4 so "100"
means "next 100 unseen," not "same top 100."
**POC:** read `target_count` from a Supabase `run_config` row (or the Schedule Trigger's static
data). 
**White-label:** `tenant_config.discovery.target_count` + `venue` + `entity_hop` so the same
template serves Steam→publisher, Reddit→author, etc. (the venue-adapter interface from the
business-process doc §4).

---

## 3. Lacking detail — how to implement each

### D1 — Painpoint evidence bar `[Effort S · Impact H]`
Define a 3-level rubric the verification step must emit per lead:
`evidence_strength ∈ {explicit, inferred, none}` where **explicit** = a dated public statement /
job post / review / talk where the prospect names the problem; **inferred** = circumstantial
(stack, size, hiring pattern) with cited reasoning; **none** = no support → auto-reject. Store
`{strength, sources[], quote, as_of_date}`. Gate B shows it; only `explicit`/`inferred` pass.
**POC:** hardcode the bar at "inferred or better." **White-label:** `tenant_config.evidence_bar`.

### D2 — Two-sided score formula `[Effort M · Impact H]`
Make it explicit and logged, not vibes:
`fit_score = w1·value_to_client + w2·prospect_match`, each sub-score 0–1, weights summing to 1.
`value_to_client = a·icp_fit + b·timing(trigger recency)`; `prospect_match = c·product_need +
d·reachability(email/warm-intro present)`. Persist `dimension_breakdown{}` + `rationale`. Set a
`gate_b_threshold` to pre-sort approve/reject.
**POC:** ship sensible defaults (`w1=w2=0.5`), surface the breakdown. **White-label:** weights in
`tenant_config`; Learn loop (§5) nudges them from outcomes.

### D3 — `known_prospects` state machine `[Effort M · Impact M]` (see also T8)
States: `discovered → enriched → drafted → contacted → replied → {won, partial, lost,
no_response}`. Columns: `tenant_id, entity_id, state, state_changed_at, reattempt_after`.
A `no_response` lead becomes re-eligible only after `reattempt_after` (e.g. +90d). This table **is**
the exclusion list I3 reads.
**POC:** add the columns + transitions in the backlog upsert. **White-label:** same, `tenant_id`-scoped + indexed `(tenant_id, state)`.

### D4 — Learn-loop eval method `[Effort M · Impact M]`
Don't refit on a handful of wins. Define: minimum sample (e.g. ≥30 contacted with known outcome)
before any weight change; hold a **golden set** of human-graded leads; measure precision@K of the
score against actual replies; only apply weight deltas that improve it. Log each change with a
reason + before/after metric.
**POC:** log outcomes + run the eval manually monthly. **White-label:** scheduled eval job per
tenant; see Technical T13 (eval harness).

### D5 — Volume / latency / SLA targets `[Effort S · Impact M]`
Write down the numbers the free-tier viability depends on: leads/run, runs/week, max acceptable
run duration, and the hard ceilings (OpenRouter free **50 req/day** until the one-time $10 → 1,000/day;
Exa Websets free **1,000 credits / 25 results**, auto-stop at 50× requested). Size the POC inside these.
**POC:** one table in `STATE.md`. **White-label:** per-plan quotas in `tenant_config`.

### D6 — Email verification provider + cost `[Effort S · Impact M]`
Exa can *return* an email; deliverability verification is a separate call. Pick a provider at M2
(e.g. a single verify API) and model cost/lead. Keep the existing `Verify Email` + `Classify
Email` nodes; just point `Verify Email` at the chosen provider and record `email_status`.
**POC:** one provider, free/cheap tier. **White-label:** provider is a config-driven adapter.

### D7 — Tracking ownership `[Effort S · Impact M]`
Decide where lead-state truth lives (open Q4). Recommended: **the UI is the source of truth** for
the POC (manual state updates at Gate B + a tracking board), with an optional webhook from the
sender later. This is what makes the Learn loop have data at all.
**POC:** manual state in UI. **White-label:** CRM/sender sync adapters write back to D3.

---

## 4. Gaps in the site's requirements

### G1 — No error / empty / loading states `[Effort M · Impact H]` — *Fix via agent prompt*
**Ally:** "Fix or provide agent prompt to fix." Drop this into the M3 UI build:
> *"For every screen (Login, Context drop, Guided intake, Gate A summary review, Gate B lead
> review, Tracking board, Learn panel), generate the full set of non-happy states: initial empty
> state (no data yet, with a primary CTA), loading/skeleton state, in-progress async state for
> long jobs (discovery running — show progress + 'we'll notify you'), partial-result state, error
> state (with retry + human-readable cause), and zero-result state ('no leads matched — widen
> criteria'). For each, specify copy, the primary action, and what the user can still do. Treat
> the 'discovery running' async state and the 'no leads found' state as first-class — they are the
> most common real-world paths."*
**POC:** apply to GamersLab's screens. **White-label:** same prompt, theming-token driven.

### G2 — Cost/usage meter → **n/a for POC** (§8 white-label backlog).

### G3 — "Tenant onboarding flow" — *what it means* `[Effort S · Impact L for POC]`
This means: *how does a brand-new client get set up* — who creates their account/workspace,
uploads their model key, and seeds their first business context + venue map. For a multi-tenant
SaaS this is a self-serve wizard. **For the POC it's basically n/a** — there is exactly one tenant
(GamersLab), set up by you by hand. So: no build needed now; just note that the white-label phase
needs a "create workspace → add key → run intake" wizard. **POC:** manual setup. **White-label:**
self-serve onboarding wizard.

### G4 — Provenance UI `[Effort M · Impact H]` — *agreed, fix*
Per-lead "why am I seeing this" panel: the matched **criteria + cited references** (Exa returns
these), the **painpoint evidence** (D1: strength + quote + source + date), **which model** drafted
the outreach, and **when** the data was fetched. This is the trust surface that sells the moat.
**POC:** render it on the Gate B lead detail. **White-label:** same component, per-tenant theme.

### G5 — Async-completion notification `[Effort S · Impact M]` — *suggested fix*
Discovery is long and runs off-screen. Fix: when a run finishes, write a `notifications` row +
(POC) send yourself an email via an n8n node, and show an in-app toast/badge on next load. Tie to
G1's "we'll notify you" async state.
**POC:** email-on-complete from n8n + in-app badge. **White-label:** per-user notification prefs.

### G6 — In-UI roles → **n/a for POC** (§8).

### G7 — Export spec — *what it means & suggest* `[Effort S · Impact M]`
"Export spec" = nailing down exactly what leaves the system and in what shape: the **CSV column
set** (e.g. `name, role, company, domain, email, email_status, fit_score, evidence_strength,
evidence_quote, source_url, draft_subject, draft_body`) and, for CRM push, the **field mapping**
(our field → HubSpot/Pipedrive property). Without it, "hand-off" is undefined and every client
asks for a different shape.
**POC:** one fixed CSV schema (above) from an n8n/Edge export. **White-label:** mapping config per
tenant + CRM adapters.

### G8 — Accessibility / responsive / i18n → **n/a for POC** (§8).

### G9 — Venue-map editing UX → **n/a for POC** (GamersLab venue is fixed = Steam) (§8).

### G10 — Product telemetry — *what it means & suggest* `[Effort S · Impact M]`
This is analytics about **the product itself** (not lead quality): which screens users visit, where
they drop off, time-to-approve at Gate A/B, how often they edit the AI summary. It tells you where
the UI is failing. Distinct from the Learn loop, which is about *lead outcomes*.
**Suggest:** a lightweight privacy-respecting event log (page views + key actions → a Supabase
`product_events` table, or a free analytics tool). **POC:** optional, a few key events. **White-label:**
full funnel analytics per tenant.

---

## 5. Generating more intelligence

### N1 — Capture rejection reasons at Gate B `[Effort S · Impact H]`
**Ally:** "connect to email? second n8n flow?" — *Neither.* It's a **UI capture + a table**, not
email. When the user rejects a lead at Gate B, show a quick structured reason (`bad_fit`,
`wrong_contact`, `weak_evidence`, `bad_timing`, `already_customer`, `other+note`). Write it to
`lead_feedback`. The Learn loop reads it. (No new flow; it's a column + a dropdown.) This is the
single richest signal you're currently throwing away.
**POC:** dropdown at Gate B → `lead_feedback`. **White-label:** same, feeds per-tenant tuning.

### N2 — Attribute outcomes to evidence/angle/model `[Effort M · Impact H]`
Tag every outreach asset with `{evidence_type, angle, model}` when drafted. When an outcome lands
(reply/win), join back so you can ask "which evidence type / angle / model converts for *this*
client." Then bias drafting toward winners.
**POC:** store the tags on the draft row; analyse manually. **White-label:** auto-rank angles per
tenant; feeds N10.

### N3 — Buying-signal / trigger detection — *explained* `[Effort M · Impact H]`
A "trigger" is a **time-sensitive event** that makes a prospect more likely to buy *now*: new
funding, hiring for a relevant role, a product launch, a leadership change, a tech-stack change, a
public complaint about the problem you solve. Detect them as a dedicated enrichment (Exa
search/criteria for recent events; Exa **Monitors** to catch them continuously) and feed
**recency** into the `timing` term of the score (D2). A lead with a fresh trigger outranks an
identical lead without one.
**POC:** one or two trigger queries (e.g. "publisher recently launched / raised") into the score.
**White-label:** configurable trigger set per tenant; Monitors stream them in.

### N4 — Warm-intro mapping (onboarding-seeded) `[Effort L · Impact H]`
**Ally:** great — put it in onboarding: collect founder/staff names usable to map warm connection
points (LinkedIn?). **How it works:**
1. **Onboarding capture (UI):** add a step "Who's on your team, and who do they know?" — collect
   your own people (name, LinkedIn URL) and any known existing relationships. Store in
   `tenant_relationships`.
2. **Matching:** when a prospect is enriched, check for a path between your team and the prospect's
   people (shared company history, shared connections, same alumni/community).
3. **Score + flag:** if a warm path exists, boost `reachability` in D2 and **flag the lead "warm
   intro available via {person}"** in the UI.
**Tech reality on LinkedIn:** LinkedIn has **no open API for connection graphs** and scraping it
violates ToS and breaks often. Practical approach: (a) rely on **user-provided** relationship data
captured at onboarding (cleanest, compliant); (b) optionally let the user connect a tool they
already authorise (e.g. their CRM contacts export) to seed known relationships; (c) treat any
public "X worked at Y / spoke at Z" overlap (Exa-found) as a *soft* warm signal. Do **not** build
LinkedIn scraping into the product.
**UI/tech updates needed:** new onboarding step + `tenant_relationships` table + a "warm path"
checker in enrichment + a "warm intro" badge on the lead card + a `reachability` input to the score.
**POC:** capture GamersLab's team (Eric, Ryan, Joon — Ryan = primary publisher credibility) and
flag prospects with a public overlap. **White-label:** generalise the relationship schema + matcher.

### N5 — Anti-fit signals: **flag, don't suppress** `[Effort S · Impact M]`
**Ally:** "maybe don't suppress → but flag." Agreed. Detect negative signals (just bought a
competitor, recent layoffs, churned, explicitly not-our-market) and **surface them as a warning
badge on the lead** with the evidence, leaving the human to decide at Gate B. Never auto-drop.
**POC:** a `risk_flags[]` field shown on the card. **White-label:** configurable flag set.

### N6 — "Find more like this" from wins `[Effort M · Impact M]`
**How:** from a **won** lead, take its defining attributes and run an Exa **`scope` hop / similar**
search seeded by the *actual converter* (not the original ICP), with the `known_prospects`
exclusion applied. A "more like this" button on a won lead triggers a scoped discovery run.
**POC:** manual re-query seeded by a win. **White-label:** one-click from the tracking board.

### N7 — Learn the venue map from outcomes `[Effort M · Impact M]`
**How:** tag each lead with the **venue it came from**. When outcomes land, compute conversion by
venue and **re-rank the venue map** so next runs weight the venues that actually convert for this
client. (For GamersLab there's one venue today, so this matters more at white-label, but the
*tagging* should start now so data accrues.)
**POC:** store `source_venue` on every lead. **White-label:** venue re-ranking in the Learn loop.

### N8 — Cross-client meta-learning + "what good looks like" from onboarding `[Effort L · Impact H]`
**Ally:** great — and onboarding should capture **which customers are already good / already being
pursued** so we can analyse what a good fit looks like. **How:**
1. **Onboarding capture (UI):** "Give us 5–20 of your best existing customers (or target accounts)
   and, if you have them, a few that *weren't* a fit." Store as labelled examples.
2. **Fit model:** derive the ICP/scoring signals from these **real labelled examples** instead of
   only from the self-described business summary — positives and negatives both. This sharpens D2
   from day one (supervised seed, not guesswork).
3. **Cross-client meta-learning (later):** with strict tenant isolation, learn *anonymised*
   patterns — which criteria/venues convert across many clients — to seed brand-new clients faster
   (a network-effect moat). Opt-in, aggregated, never raw-data-sharing.
**UI/tech:** new onboarding step "seed accounts (good/bad)"; `tenant_seed_accounts` table;
fit-model uses them. **POC:** capture GamersLab's known-good publishers as positive seeds.
**White-label:** the meta-learning layer is a Phase-2 feature pipe.

### N9 — Evidence recency decay `[Effort S · Impact M]`
**How:** store `as_of_date` on every piece of evidence (D1) and apply a decay factor in the score
so 2-year-old evidence counts less than last-month's. One function: `weight = e^(-age/halflife)`.
**POC:** add `as_of_date` + a simple decay in scoring. **White-label:** per-tenant half-life.

### N10 — A/B test outreach angles (in the UI) `[Effort M · Impact M]`
**Ally:** good — clear A/B testing of email types in the UI. **How:** when drafting, generate 2
labelled variants (e.g. "painpoint-led" vs "trigger-led"), tag each, and let the user pick / or
ship both to different leads. Track reply rate by variant (joins to N2). UI: a variant toggle on
the outreach screen + a small "angle performance" readout.
**POC:** two variants + manual win tracking. **White-label:** automated variant allocation +
significance readout.

---

## 6. Business outcomes

**Ally's framing — "is this value-prop marketing / branding?"** — *Mostly yes, and that's the
point.* These are **positioning + packaging + a few small instrumentation hooks**, not big builds.
They decide how the same pipeline is sold and retained. I've split the genuine *build* bits out.

- **B1 — Headline metric = time-to-first-qualified-lead.** *ok.* Positioning only; no build.
- **B2 — Cost-per-lead / cost-per-reply meter — how `[Effort S · Impact M]`:** you already log
  `model_call_log` + Exa usage. Aggregate `spend / qualified_leads` and `spend / replies` into one
  view. POC: a SQL view + a number on the dashboard. White-label: per-tenant, per-plan.
- **B3 — Reply/conversion loop — how `[Effort M · Impact H]`:** the value *is* outcomes. Capture
  them (D7/N1) and, later, a sender webhook writes replies back to D3. POC: manual marking;
  White-label: sender/CRM sync. (Build bit, overlaps D7.)
- **B4 — Make the compounding asset visible.** *"hmm maybe."* Low priority; revisit once the Learn
  loop produces something worth showing. Park.
- **B5 — Package on verified-lead volume / seats, not credits.** *ok.* Pricing decision; no build.
- **B6 — Warm-intro mode.** *"secondary phase, entirely new feature pipe."* Agreed — the *flag*
  (N4) ships in the POC; full "warm-intro mode" is a Phase-2 pipe.
- **B7 — Fundraising / investor mode.** *ok.* Same engine, second entity type (Exa supports it);
  positioning now, light build later.
- **B8 — Evidence guarantee — how to create `[Effort S · Impact M]`:** make "every lead ships with
  cited evidence or it doesn't count" a real rule: leads with `evidence_strength = none` are
  excluded from the deliverable and from any count/quota. Enforce in the export (G7) + show the
  promise in the UI. POC: enforce the filter. White-label: surface as an SLA.
- **B9 — Industry venue-map templates.** *ok.* White-label onboarding accelerator; n/a POC.
- **B10 — Transparency dashboard — how `[Effort S · Impact M]`:** combine B2 + provenance (G4) +
  run history into one client-facing "here's what we did and what it cost" view. Biggest churn
  reducer. POC: simple version reusing existing logs. White-label: full per-tenant dashboard.
- **B11 — Auto-harvest case studies — how `[Effort S · Impact L]`:** when a lead hits `won`,
  auto-assemble a mini case study (who, the evidence, the angle, the outcome) into a `case_studies`
  table for marketing. POC: a template + a query on won rows. White-label: per-tenant gallery.
- **B12 — "Done-with-you" Gate A/B cadence.** Services motion; no build. Park.

---

## 7. Technical improvements

### T1 — Kill the discovery duplication — **Ally: NO** `[n/a]`
You said no, and that's consistent with I1 (keep a fallback). So: **do not delete** the WHOIS/scrape
cluster outright. Instead make it **conditional/fallback** behind the Exa enrichment path (only
scrape when Exa enrichment returns no contact). Tracked under I1/L3, not as a deletion.

### T2 — Exclusion truly at source `[Effort M · Impact M]` — *good idea*
Covered by I3 + D3: publisher-level key + Exa `exclude` import. No repeat.

### T3 — Gate the fan-out with pre-score — *how & why* `[Effort S · Impact H]`
**Why:** `LLM: Intel + Draft (All Models)` is the single biggest token cost; most leads don't
warrant N drafts. **How:** IF `pre_score ≥ fanout_threshold` → fan-out + Pick Best; else → one
default model. Same fix as I2 (this is its technical statement). Immediate spend cut.

### T4 — Event-driven via Exa Monitors + webhooks — *if doable in n8n* `[Effort M · Impact M]`
**Verified doable:** n8n's **Webhook trigger** is the supported entry point (the public REST API
can't directly "execute" a workflow; webhooks are the way). So Exa **Monitors** (cron ≥1/day) →
**webhook** (`webset.item.created/.enriched`) → n8n **Webhook trigger** works. Note the known 2026
quirk: an API-activated webhook may not register until the workflow is saved once in the UI.
**POC:** add a webhook-triggered "ingest new Exa items" path alongside the schedule. **White-label:**
one Monitor + webhook per tenant; payload carries `tenant_id`.

### T5 — Pull the deterministic core out of n8n — *architecture diagram + spec* `[Effort L · Impact H]`
**Why:** n8n has **no native multi-tenancy** and auto-generated per-client workflows are brittle to
version. Keep n8n for what it's *great* at (connectors, scheduling, retries, visual ops) and move
the deterministic, testable, multi-tenant-sensitive logic into **Supabase Edge Functions / a small
worker** that you fully own and can unit-test.

```
                         ┌──────────────────────────────────────────────┐
                         │  F1 FRONT-END (React, themeable per tenant)   │
                         │  intake · Gate A · Gate B · tracking · learn  │
                         └───────────────┬──────────────────────────────┘
                                         │ HTTPS (JWT carries tenant_id)
                                         ▼
        ┌────────────────────────────────────────────────────────────────────┐
        │  CORE API  — Supabase Edge Functions / worker  (OWNED, TESTABLE)     │
        │  • model router (BYOK Vault → OpenRouter free)   ← single key path   │
        │  • scoring (two-sided, D2)      • exclusion/dedup (I3/D3)            │
        │  • evidence/painpoint rubric (D1)  • export builder (G7)             │
        │  • run ledger + idempotency (T6)   • RLS-enforced tenant reads/writes│
        └───────┬───────────────────────────────────────────────┬────────────┘
                │ reads/writes (RLS, tenant_id)                   │ invokes (tenant_id in payload)
                ▼                                                 ▼
   ┌───────────────────────────┐                  ┌──────────────────────────────────────┐
   │  F3 DATA PLANE (Supabase) │                  │  n8n  (CONNECTOR + SCHEDULE ENGINE)   │
   │  Postgres + pgvector +    │                  │  • Steam/SteamSpy mine + entity hop   │
   │  Storage + Vault          │◄─────writes──────│  • Exa Websets calls / Monitors hook  │
   │  known_prospects, leads,  │                  │  • email verify/classify              │
   │  scores, outcomes, logs   │                  │  • CRM push / CSV / sender webhook     │
   └───────────────────────────┘                  │  • Wait/concurrency (I5), retries (T7)│
                                                   └──────────────────────────────────────┘
                                                          │ all model calls route back
                                                          ▼ through the CORE model router (F4)
                                                   ┌──────────────────────────────────────┐
                                                   │  OpenRouter (:free) / client BYO key  │
                                                   └──────────────────────────────────────┘
```

**Spec — what goes where (and why):**

| Concern | Home | Why |
|---|---|---|
| Scoring, exclusion, evidence rubric, export | **Core API (Edge/worker)** | Deterministic + must be unit-tested + tenant-sensitive |
| Model routing / BYOK key injection | **Core API (F4)** | One server-side key path; never in n8n creds or browser |
| Run ledger, idempotency, RLS | **Core API + Supabase** | Ownership + resumability + isolation |
| Steam/Exa/email/CRM connectors, schedule | **n8n** | Connector library + retries + visual ops are n8n's strength |
| Storage, vectors, secrets | **Supabase** | Already the data plane |

**Verifiable claims in this spec (2026):** n8n no native multi-tenancy ✅; webhook-trigger entry
✅; Edge Function limits 150s/400s wall-clock ✅; Vault read via `vault.decrypted_secrets` ✅;
RLS + custom-claims hook ✅ (all per `infra_stack_and_layers_DRAFT.md` §F2/F4 verification).
**POC:** you don't need the full split now — but put the **model router + scoring + export** in
Edge Functions from the start so they're owned/testable; leave the rest in n8n. **White-label:**
complete the split before onboarding tenant #2.
*(I can render this as a house-style SVG to embed, like the other docs — say the word.)*

### T6 — Run ledger + idempotency / full error pathways `[Effort M · Impact H]`
**Ally:** "seems like we need full error pathways." Yes. Add a `runs` table
(`run_id, tenant_id, started_at, status, stage, counts{}, error`) and stamp every lead with its
`run_id`. Make each external step **idempotent** (upsert on a stable key — already the pattern) so
a re-run resumes instead of duplicating. Add an n8n **Error Trigger workflow** that catches any
node failure, writes the failure to `runs`, and notifies you. Define, per external call, what
"failure" does: retry (T7) → fallback (I1) → dead-letter row → alert.
**POC:** `runs` table + Error Trigger + dead-letter. **White-label:** per-tenant run history in UI.

### T7 — Retry / backoff / dead-letter — *how* `[Effort M · Impact M]`
**Verified n8n facts:** each node has **Retry On Fail** (Max Tries **capped at 5**, Wait **capped
at 5000ms**). **Gotcha:** if Retry On Fail is on **and** On Error = *Continue*, the retry settings
are **ignored** — retries only apply with On Error = *Stop*. (Your `Get Drafted IDs` is set to
`continueRegularOutput`, so a retry there would be silently ignored.) For real **exponential
backoff** beyond 5×/5s, use a custom **Set + If + Wait** loop. **How:** enable Retry On Fail on the
HTTP nodes (Steam, Exa, OpenRouter, verify) for transient errors; for rate-limit (429) use the
custom backoff loop; on final failure route to a **dead-letter** row (T6) instead of killing the run.
**POC:** node retries + a backoff loop on the rate-limited calls. **White-label:** same, templated.

### T8 — `known_prospects` state machine `[Effort M · Impact M]`
Same as D3 — single source. Build once, referenced by both.

### T9 — Single key-injection path — *how* `[Effort M · Impact H]`
**How:** all model calls go through the Core API **model router** (T5), which reads the client key
from **Supabase Vault** (`vault.decrypted_secrets`) server-side and forwards to OpenRouter/the
provider. **n8n must not hold a second copy** of model keys in its own credentials — point n8n's
LLM steps at the Core router endpoint, not directly at OpenRouter with a stored key. One path, one
place to rotate, nothing in the browser.
**POC:** route the existing `LLM: Intel + Draft` HTTP node through the Edge model router. **White-label:**
per-tenant Vault secret.

### T10 — Observability `[Effort M · Impact M]` — *good idea*
`run_id`-correlated structured logs across Core + n8n; per-stage cost counters; alerts as you near
free-tier ceilings (OpenRouter 50/day, Exa count caps). Surfaces B2/B10.
**POC:** log + a simple usage view. **White-label:** per-tenant dashboards + alerting.

### T11 — CI cross-tenant isolation tests — *how* `[Effort M · Impact H — at white-label]`
**How:** an automated test that signs in as Tenant A and asserts **0 rows** of Tenant B are
readable across every table; plus RLS policy tests on each table (the CVE-2025-48757 lesson — one
missing policy hit 170+ apps). Run in CI before any deploy.
**POC:** n/a (single tenant) — but write the test harness now so it's ready. **White-label:** blocking CI gate before tenant #2.

### T12 — Async/queued model calls — *what it means & fix* `[Effort M · Impact M]`
**Means:** Edge Functions have a wall-clock limit (150s/400s). If you fan out several LLM drafts
**inline in one request**, a slow run can hit the limit and fail mid-way. **Fix:** don't do the
fan-out synchronously inside one Edge call — enqueue the draft jobs (a `jobs` table or n8n
sub-execution) and process them with the concurrency control from I5, writing results back as they
land. The UI shows the async "drafting…" state (G1/G5).
**POC:** move fan-out into the n8n side (already async) gated by pre-score; keep Edge calls short.
**White-label:** a proper job queue.

### T13 — Eval harness (golden set) — *how* `[Effort M · Impact M]`
**How:** a fixed set of human-graded leads + expected scores/outcomes. On any change to the scoring
or outreach skill, run the harness and compare precision@K / win-rate before vs after; only ship
changes that improve it (the guardrail for D4/N2). 
**POC:** a small golden set + a manual eval script. **White-label:** automated per-tenant eval job.

---

## 8. White-label backlog (parked — Ally marked "n/a for POC")

These are real and needed for productisation, but **not** for the GamersLab POC:
G2 cost meter (client-facing) · G6 in-UI roles/permissions · G8 accessibility/responsive/i18n ·
G9 venue-map editing UX · G3 self-serve onboarding wizard · N8 cross-client meta-learning ·
B6 full warm-intro mode · B9 industry templates · T11 CI isolation as a *blocking* gate.

---

## 9. Priority — effort × impact

**Do first — high impact, low/medium effort (the quick wins):**
- I1 fix/remove orphaned SerpAPI fallback `[S·M]`
- I2 / T3 gate multi-model fan-out by pre-score `[S·H]` ← **biggest cost cut for least effort**
- I6 make `Pick N` + venue variable `[S·M]`
- D1 painpoint evidence rubric `[S·H]`
- N1 capture Gate-B rejection reasons `[S·H]`
- N5 anti-fit flag (not suppress) `[S·M]`
- N9 evidence recency decay `[S·M]`
- D5 write down volume/SLA numbers `[S·M]`

**Do next — high impact, medium/large effort (the structural moves):**
- G4 provenance UI `[M·H]` · G1 error/empty/async states `[M·H]`
- D2 two-sided score formula `[M·H]` · N2 outcome→evidence/angle/model attribution `[M·H]`
- T6 run ledger + full error pathways `[M·H]` · T9 single key path `[M·H]`
- N3 trigger detection `[M·H]` · N8 seed-accounts in onboarding `[L·H]`
- T5 pull core out of n8n `[L·H]` · N4 warm-intro mapping `[L·H]`

**Steady-state — medium impact:**
- I3/D3/T8 publisher-level exclusion + state machine · I4 incremental/event-driven · I5
  concurrency control · T4 Exa monitors+webhooks · T7 retry/backoff/dead-letter · T10
  observability · D3–D7 detail items · N6/N7/N10 learn-loop intelligence · B2/B8/B10/B11 outcome
  surfaces · T12 async model calls · T13 eval harness.

**Park until white-label:** everything in §8, plus T11 as a blocking gate.

---

## 10. Sources

**Live workflow:** n8n `MouIeDmDAAHKIpDn` (n8n-j39n.sliplane.app) — node graph + connections read
2026-06-22 (structure/wiring; not every node's inner code).
**n8n concurrency:** docs.n8n.io/hosting/scaling/concurrency-control · docs.n8n.io/manage-cloud/concurrency
(`N8N_CONCURRENCY_PRODUCTION_LIMIT`, `-1` default, FIFO queue; queue mode + Redis at scale).
**n8n retry/error:** docs.n8n.io HTTP Request common-issues + community (Retry On Fail caps 5×/5000ms;
ignored when On Error = Continue; custom Set+If+Wait loop for backoff; Error Trigger workflows).
**Prior project docs:** `how/pipeline_critique.md` (v1), `what/business_process_model_DRAFT.md` (v10),
`how/infra_stack_and_layers_DRAFT.md` (v10), `STATE.md`; aDNA recall tags `gamers-lab`, `lead-gen`.
