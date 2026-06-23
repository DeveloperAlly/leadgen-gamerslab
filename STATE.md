# STATE.md — Current State & Tracks

> Read after `CLAUDE.md`. Mandated read at the start of every session on this campaign.

**Campaign:** `gamers_lab_lead_gen`
**As of:** 2026-06-23

**Phase — two parallel tracks, different rules (do not conflate):**

| Area | Phase | Build rule |
|------|-------|-----------|
| **GamersLab POC (v1)** | **BUILT & ACTIVE — iterating on the live system** | POC iteration is in motion (6 live n8n workflows, Supabase, UI). Free-tier only. |
| **White-label v2** | `RESEARCH + DESIGN` — **PRE-GATE** | **No build** until the hard human gate (UI + verified architecture) passes. |

> The "no build before gate" doctrine governs **white-label v2 only**. The GamersLab POC is the
> built proof-of-concept and is being iterated live. An older version of this file framed the whole
> campaign as "PRE-GATE, no build" — that was wrong about the POC and caused agents to misread state.

**Canonical current-state docs (read before acting on the POC):**
`gamerslab-poc/SPEC.md` (UI↔Edge↔DB) · **`gamerslab-poc/ARCHITECTURE.md` (all 6 n8n workflows)** ·
`gamerslab-poc/workflow/v10-live-edits/` (engine deltas).

**v9 status:** the old **v9** outreach workflow (`bGxcwlp3VRL8jT9r-Mm_h`) is superseded by v10 and
**parked** — its Schedule Trigger node is disabled, so it does not run (no double-run risk).
See `ARCHITECTURE.md §3`.

## Gate status

| Gate | Status | Owner | Notes |
|------|--------|-------|-------|
| Research complete | ✅ Draft delivered | Claude | Competitor scan + pipeline critique done 2026-06-21 |
| Plan / tasklist | ✅ Draft delivered | Claude | `how/plan_poc_to_production.md` |
| Product requirements spec (whitelabel) | ⬜ Not started | Claude→Ally | Gated mission M1 |
| GamersLab requirements spec | ⬜ Not started | Claude→Ally | Gated mission M1 |
| Verified architecture spec (every 2026 API call verified) | ⬜ Not started | Claude→Ally | Gated mission M2 |
| UI design (visualisable) | 🟡 Design brief ready | Claude→Ally | M3 prompt drafted: `how/ui_design_prompt.md` — feed to Claude Design |
| **HARD HUMAN GATE — Ally approves UI + architecture** | ⬜ **BLOCKING** | **Ally** | Nothing builds until this passes |
| Build GamersLab POC | ⬜ Blocked | — | Blocked by the gate above |

## Tracks running

| Track | Type | Where | State |
|-------|------|-------|-------|
| Competitor research | Agent (done) | `what/research/competitor_analysis.md` | ✅ |
| Pipeline critique | Agent (done) | `how/pipeline_critique.md` | ✅ |
| POC→prod plan | Agent (done) | `how/plan_poc_to_production.md` | ✅ |
| Business process model (the WHAT) | Agent (done) | `what/business_process_model_DRAFT.md` (+ embedded `business_process_diagram.svg`) | ✅ v10 |
| Infra stack & layers (the HOW) | Agent (done) | `how/infra_stack_and_layers_DRAFT.md` (+ embedded `infra_stack_diagram.svg`) | ✅ v10 |
| v9 pipeline reconciliation | Agent (done) | Both docs §v10; aDNA tag `v9` | ✅ |
| Pipeline critique v2 — Tier 1 (POC) | Live + verified | `gamerslab-poc/workflow/v10-live-edits/` | ✅ n8n (I1/I6/D1/N5/N9 + prompt) · DB migration · `leads` Edge v3 · UI badges/reason picker — all live & verified |
| Email send pipeline (identity + delivery) | Build (Claude) — gate passed 2026-06-22 | `how/email_send_pipeline_DRAFT.md`; `gamerslab-poc/supabase` (0005+0006 + 5 email fns); `gamerslab-poc/workflow/email-*.workflow.ts`; `poc/ui` EmailScreen | 🟢 Built (Gmail-only). Live: `email_accounts`+thread cols, 5 Edge fns (email-account verified end-to-end), EmailScreen (both states verified). n8n Send (`YEgPZ0eATTSAb9pa`) + Reply Poll (`LAPjN0jbvV9GAetX`) via broker design. ✅ **LIVE & full-loop verified 2026-06-22**: Google OAuth app created, secrets set, inbox connected (`ally@gamerslab.gg`), workflows active, `outreach` approve→send fires. Real approve sent a real email + stamped the row `sent` (exec 68446). Send/Reply-Poll **rebound to the `message` entity** (dual-write to publishers) + verified. RFC 2047 subject encoding fixed; no em dashes. ⏳ Only the positive reply-flip remains to demo (needs an external-sender reply). Endpoints verified vs 2026 docs |
| Pipeline messaging (subject split · A/B · sequencing · reply detect) | Phases 0-3 built & verified | `how/pipeline_messaging_ab_sequencing_DRAFT.md` (+ `pipeline_messaging_architecture.svg`); `gamerslab-poc/supabase/functions/outreach` + `_shared/mapper.ts`; `poc/ui` ProspectTrackingScreen | 🟢 Phase 0 (subject/body split + `PATCH /outreach/:id`) built, `outreach` Edge fn **redeployed v4 & verified live**. 🟢 Em dashes fixed: existing 235 drafts normalized in `publishers`+`message` (0 left), and `Build Final Record` Code node now strips dashes on every future run. 🟢 Migrations `0007` (`message` entity + backfill 235), `0008` (B-subject cols + publishers→message sync trigger), `0009` (trigger B-delete) applied. `outreach` Edge fn **rebound to `message` (v8)**: GET groups by publisher with A/B variants; `PATCH /outreach/message/:id` edits a variant (writes the publishers column, trigger mirrors) — full round-trip verified live. UI: A/B variant tabs + per-variant edit + honest "needs ~200/variant" accumulation line, verified in preview. Send/Reply-Poll already rebound to `message` (email send track). 🟢 **B generation LIVE 2026-06-23**: new n8n node `Add B Variant` (between `Build Final Record` and `Upsert`) writes a question/pairing B subject (`game + ugc?` / `Quick idea for game`, dashes stripped) → autoMap upsert → trigger makes the B row. `outreach` Edge fn **redeployed v13, now self-contained** (mapping inlined, no `_shared/mapper` import) after a stale parallel deploy had reverted it to the flat shape and crashed the board; UI hardened with `item.variants?.length` guard. Live API verified: returns `variants`+`toEmail`+`emailValid`; board shows A/B tabs, recipients, enabled approve. ⏳ Remaining: step-2 follow-up sequencing + inbox UI (no data until sends accumulate); A/B winner-call UI volume-gated |
| Requirements specs (M1) | Pending Ally go | — | ⏸ awaiting next session |
| Verified architecture (M2) | Pending M1 | — | ⏸ |
| UI design (M3) | Pending M2 | — | ⏸ |

## Immediate next decision for Ally

Pick the next gated mission to run: **M1 (requirements specs)**, **M2 (verified architecture)**,
or **M3 (UI design)** — recommended order is M1 → M2 → M3 → gate. See plan doc §"Sequenced missions".

## POC volume / latency / SLA (critique v2 · D5)

The numbers free-tier viability depends on. Defaults are the live workflow's; all are now
configurable per run via the discovery webhook body (`target_count` / `draft_budget` / `score_floor`).

| Metric | POC value | Source / constraint |
|--------|-----------|---------------------|
| Cadence | 1 run/day, 09:00 | Schedule Trigger (daily) |
| Candidates mined / run | 100 (`target_count`) | `Pick N Publishers`, SteamSpy top-list |
| Drafts (LLM calls) / run | ≤ 35 (`draft_budget`) | `Select & Split`; tier C+ only (`score_floor` ≥ 10) |
| Model calls / day | ≤ 35 | **Binding ceiling: OpenRouter free = 50 req/day** (failed attempts count). One-time $10 → 1,000/day. 35 leaves ~15 for retries. |
| Exa searches / run | ≤ 35 (1 per enriched lead) | Exa free **1,000 credits / 25 results**, auto-stop at 50× requested. SerpAPI is fallback only (I1). |
| Email verifies / run | ≤ 35 | free MX-level check (`Verify Email`) |
| Max run duration (target) | < 30 min | not yet measured; Steam rate-limit `Wait` + 35 enrich loops. Target, not SLA. |
| Backlog (un-drafted) / run | ~65 | recorded free as `pipeline_status` rows; no spend |

**Binding constraint:** OpenRouter free 50/day. At `draft_budget=35`/day the POC sits inside every
free ceiling with headroom. Raising cadence or `draft_budget` requires the $10 OpenRouter top-up first.
To-confirm: exact Exa credit cost per `/search` (the 1,000-credit ceiling is per the Websets product).

## Open questions logged (see `how/pipeline_critique.md` §Decisions)

1. Hosting model for n8n (self-host free vs n8n Cloud vs build native backend) — n8n has **no native multi-tenancy**.
2. Model-key strategy: BYO-key-via-edge-proxy vs OpenRouter fallback — both, with a router.
3. Auth: defer multi-tenant auth to Phase 2; GamersLab POC = single-tenant Supabase Auth.
4. RAG vs CAG split for business context.
