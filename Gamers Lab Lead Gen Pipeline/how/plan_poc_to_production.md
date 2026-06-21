# Plan — GamersLab POC → Production White-Label Product

**Task 4.** Phased plan and tasklist. **Core premise (law): the POC IS the modular template.**
Every choice is made so Gamers Lab can be lifted out and re-used for any client with **config,
not code** — front end included. Nothing here authorises a build; the build gate is in `STATE.md`.

---

## 1. The modular mandate — how we keep it portable

Four swappable layers, each with a clean contract so a new client = new config row, not a fork:

| Layer | Module | What makes it portable |
|-------|--------|------------------------|
| **Front end** | `web/` | Config-driven screens + theming tokens (logo/colors/copy per tenant). No business name in code; reads a `tenant_config`. |
| **Context** | `context-service` | Ingestion adapters (file/web/social) → normalise → embed. Same for any business. |
| **Discovery** | `discovery-service` | Exa Websets queries built from the structured ICP, not hard-coded. |
| **Orchestration** | `orchestration` (n8n shared / worker) | Template workflows parameterised by `tenant_id` + injected context/keys. |
| **Data** | Supabase | Every table carries `tenant_id` from day 1; RLS-ready. |
| **Model access** | `model-router` (Edge Function) | BYOK (encrypted) → OpenRouter free fallback. Provider-agnostic. |

**Portability test (acceptance):** onboarding a *second* business requires **zero code changes** —
only a new `tenant_config` + their context drop + (optionally) their keys.

---

## 2. Architecture overview (modules + flow)

```
                ┌──────────────────────── web/ (React, config-driven, themeable) ─────────────────────┐
                │  Login · Context drop · Guided intake · Review/edit summary · Review leads · Dashboard │
                └───────────────┬───────────────────────────────────────────────────────────────────────┘
                                │  (Supabase Auth; tenant_config drives theme/copy)
        ┌───────────────────────┼─────────────────────────────────────────────────────────────────────┐
        ▼                       ▼                          ▼                         ▼                  ▼
  context-service        discovery-service          orchestration            model-router        Supabase
  ingest→embed (RAG)     Exa Websets (verify,       n8n shared engine        Edge Function:      Postgres + pgvector
  + summary (CAG)        enrich, monitor)           (tenant_id param)        BYOK→OpenRouter     Auth · Storage · RLS
        │                       │                          │                   fallback              │
        └───────────────────────┴──────────────┬───────────┴──────────────────────┬─────────────────┘
                                                ▼                                  ▼
                                     Score · Dedup · Human review            (all model calls routed here;
                                                ▼                             keys encrypted, never client-side)
                                     Hand-off: CSV / CRM / webhook (NO sending in POC)
```

Detailed, line-verified version of this is **Mission M2** (gated). This is the design-level map.

---

## 3. Phases

### Phase 0 — Design & gate (NOW, pre-build)
Produce what Ally must *see* before any build: requirements specs, verified architecture, UI.
Ends at the **one hard human gate**. (Missions M1–M3 below.)

### Phase 1 — GamersLab POC (single-tenant, free)
Prove the loop end-to-end for one real business at zero cost to Ally.
- Single-tenant; Supabase Auth (email + Google); `tenant_id` present but defaulted.
- Free tiers: Supabase free, n8n self-hosted (Docker) or cloud trial, Vercel free (front end),
  Exa free credits, **OpenRouter free models** (or GamersLab's own keys).
- Scope = the revised pipeline stages 1–6 + hand-off as CSV. **No sending.**
- **Done when** the POC success criteria in `campaign_master.md` pass.

### Phase 2 — Multi-tenant hardening
Turn the single-tenant POC into a safe multi-tenant base — the moment a *second* business appears.
- Shared-schema multi-tenancy: `tenant_id` enforced, Custom Access Token Hook injects
  `tenant_id`+`role`, RLS with `WITH CHECK` + `FORCE RLS`, server-controlled memberships table,
  **CI cross-tenant isolation test**.
- BYOK encrypted storage + model-router proxy productionised.
- Per-tenant theming/config; tenant onboarding flow.

### Phase 3 — White-label productisation
Make it sellable: branded portals, billing, templating, fundraising mode.
- Branded domains/subdomains per tenant; partner admin console; usage metering + Stripe billing.
- "Clone a client setup" templating (the Snapshot pattern that wins in white-label).
- **Fundraising mode** (same engine, investor entity + 4-dimension scoring rubric) as a second
  vertical — low marginal cost, doubles the TAM.
- Decide n8n shared-engine vs native orchestration based on Phase 1–2 learnings.

---

## 4. Sequenced gated missions (Phase 0 — do these before build)

Run in order; each ends in a small review. Recommended: **M1 → M2 → M3 → GATE**.

**M1 — Requirements specs** (`what/research/`)
- M1a: **Product requirements spec (white-label)** — the full product, feature-superset chosen
  from the master list, modular contracts, non-functional reqs (security, cost, portability).
- M1b: **GamersLab requirements spec (separate)** — the POC slice only, single-tenant, free,
  concrete acceptance tests. *Must be free for Ally first.*

**M2 — Verified architecture spec** (`how/`)
- Every external call verified against **2026** docs at line level: Exa Websets
  (create/search/criteria/enrichments/monitors/webhooks/limits), Supabase (Auth, RLS, Custom
  Access Token Hook, pgvector, Edge Functions, Vault), n8n (multi-tenancy reality, embedding,
  white-label licensing), OpenRouter (free models, fallback, key handling).
- Data model with `tenant_id` everywhere; sequence diagrams; cost-cap design; threat model.

**M3 — UI design** (Figma or coded prototype)
- Ally's hard rule: **"we do not build until I can visualise the UI & the pipeline architecture
  stack."** Deliver clickable screens: login, context drop, intake, **review/edit summary**,
  **review leads**, dashboard — all config-driven/themeable to prove portability.

**GATE — Ally reviews UI + architecture and approves.** Only then does Phase 1 build start.

---

## 5. POC tasklist (Phase 1 — unlocked only after the gate)

> Listed now so Ally sees the shape; **blocked** until the gate passes.

1. Repo + module skeleton (`web/`, `context-service`, `discovery-service`, `orchestration`,
   `model-router`); `tenant_config` + `tenant_id` schema from commit 1.
2. Supabase project (free): Auth (email + Google), Postgres + pgvector, Storage, base RLS.
3. **model-router** Edge Function: BYOK (encrypted) → OpenRouter free fallback; logs path; cost cap.
4. **context-service**: ingestion adapters (file upload, website crawl, social fetch) → normalise
   → chunk → embed → RAG store; business-context-extraction skill → structured summary (CAG core).
5. `web/` screens: login → context drop → intake → **review/edit summary** (human gate A).
6. **discovery-service**: Exa Websets — competitor + lookalike-lead/ICP search with criteria +
   enrichments + count limit; verified, source-cited results.
7. Score + dedup; `web/` **review leads** screen (human gate B).
8. **orchestration**: one n8n template workflow (tenant_id param) wiring 4→7; hand-off = CSV export.
9. Verify against GamersLab real context; confirm zero-cost run; confirm **no "Gamers Lab" string
   is hard-coded** (portability test).
10. Extract: write the runbook + a "new client onboarding" checklist (the template, proven).

---

## 6. Free-for-Ally cost map (POC)

| Need | Free path | Paid only when… |
|------|-----------|-----------------|
| Front-end host | Vercel free / Netlify free | custom domains at scale |
| DB/Auth/Storage/Vectors | Supabase free tier | rows/storage exceed free |
| Orchestration | n8n self-hosted (Docker, free) | n8n Cloud / white-label ($$$) at scale |
| Discovery | Exa free credits | higher Webset volumes |
| Models | OpenRouter **free** models, or GamersLab's own keys | client chooses paid models (their spend) |

**Net:** the POC can run at **$0 to Ally**. Model cost is BYOK (client's) or free-tier.

---

## 7. How this stays aligned with doctrine

- **Gated:** Phase 0 ends at one hard human gate; Phase 1 tasks are visibly *blocked* until then.
- **Visual-first:** M3 (UI) + the architecture diagram satisfy "I must be able to visualise it."
- **Modular by construction:** the portability acceptance test is a first-class success criterion.
- **Continuity:** this campaign + decisions are saved to the AI-Ally MCP so a fresh chat boots aligned.
- **Energy-aware:** missions are small and sequenced; Ally reviews one at a time, not a wall.
