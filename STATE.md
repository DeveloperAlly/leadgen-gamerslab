# STATE.md — Current State & Tracks

> Read after `CLAUDE.md`. Mandated read at the start of every session on this campaign.

**Campaign:** `gamers_lab_lead_gen`
**As of:** 2026-06-21
**Phase:** `RESEARCH + DESIGN` — **PRE-GATE** (no build authorised)

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
| Requirements specs (M1) | Pending Ally go | — | ⏸ awaiting next session |
| Verified architecture (M2) | Pending M1 | — | ⏸ |
| UI design (M3) | Pending M2 | — | ⏸ |

## Immediate next decision for Ally

Pick the next gated mission to run: **M1 (requirements specs)**, **M2 (verified architecture)**,
or **M3 (UI design)** — recommended order is M1 → M2 → M3 → gate. See plan doc §"Sequenced missions".

## Open questions logged (see `how/pipeline_critique.md` §Decisions)

1. Hosting model for n8n (self-host free vs n8n Cloud vs build native backend) — n8n has **no native multi-tenancy**.
2. Model-key strategy: BYO-key-via-edge-proxy vs OpenRouter fallback — both, with a router.
3. Auth: defer multi-tenant auth to Phase 2; GamersLab POC = single-tenant Supabase Auth.
4. RAG vs CAG split for business context.
