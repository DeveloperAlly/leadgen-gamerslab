# M1a — Product Requirements Spec (White-Label) — DRAFT

**Status:** 🟡 **DRAFT — PRE-GATE.** Gated Mission **M1a**. Defines the *full* white-label
product (not the POC slice — that's `gamerslab_requirements_DRAFT.md`). Nothing here authorises
a build (`STATE.md`).

**Created:** 2026-06-21 · **Owner:** Ally · **Reads from:** `business_process_model_DRAFT.md`
(the WHAT), `infra_stack_and_layers_DRAFT.md` (the HOW), `research/competitor_analysis.md`
(feature superset), v9 reconciliation.

---

## 1. Product in one sentence

A **modular, portable, white-label** product where any business drops in its context, confirms
an AI understanding of itself, and gets a **context-grounded lead-generation pipeline** that
discovers, verifies, scores, and prepares outreach for the right customers **or** investors —
re-templatable to the next client with **config, not code**.

## 2. Who it's for (actors)

| Actor | Role |
|-------|------|
| **Operator / agency** | Owns the deployment, onboards client tenants, brands the product |
| **Client (tenant)** | The business whose pipeline runs; reviews summaries + leads; owns its keys |
| **Prospect** | The discovered entity (customer or investor) — *subject*, not a user |

## 3. Functional requirements — by business stage

IDs are stable (`FR-<stage>.<n>`). **MUST / SHOULD / MAY** = priority. Each maps to a stack layer.

### Stage 1 — Client Business Discovery
- **FR-1.1 (MUST)** Ingest context from files (PDF/docx/txt), website URL, and social handles → normalise → embed. *(L1)*
- **FR-1.2 (MUST)** Generate an editable business summary: value props, ICP/personas, pains, **cold-vs-warm channel rec**. *(L2)*
- **FR-1.3 (MUST)** Generate a **venue map** — ranked places the client's prospects congregate + the access method per venue. *(L2)*
- **FR-1.4 (MUST)** Human review/edit gate on summary **and** venue map before spend. *(Gate A)*

### Stage 2 — Data & Lead Discovery
- **FR-2.1 (MUST)** Mine prospects per venue; support a **venue → entity hop** (e.g. games → publishers). *(L3)*
- **FR-2.2 (MUST)** Enrich each prospect 360° (site, socials, founders, contacts) via Exa. *(L3)*
- **FR-2.3 (MUST)** **Verify the painpoint** with cited evidence (satisfied / not / unclear + refs). *(L4)*
- **FR-2.4 (MUST)** **Two-stage score**: cheap pre-score gate → two-sided `fit_score` (value-to-client × prospect-match). *(L4)*
- **FR-2.5 (SHOULD)** Verify + classify contact email (deliverable? role vs personal?). *(L4)*
- **FR-2.6 (MUST)** Build a per-lead **discovery pack** (identity + evidence + angle + sources). *(L4)*
- **FR-2.7 (MUST)** **Cross-run dedup** via a backlog ("already-drafted") + Exa `exclude`. *(L4/F3)*
- **FR-2.8 (MUST)** Human review/approve gate on leads, evidence visible. *(Gate B)*

### Stage 3 — Reach Out
- **FR-3.1 (MUST)** Generate outreach material grounded in the discovery pack; **multi-model draft → pick best**. *(L6)*
- **FR-3.2 (MUST)** Product **does not send** — output is campaign-ready assets only. *(L6 / D3)*

### Stage 4 — Prospect Tracking
- **FR-4.1 (MUST)** Track each lead's state (not-contacted → contacted → replied → success/partial/fail). *(L7/F3)*
- **FR-4.2 (SHOULD)** Optional CRM sync / sender-webhook to update state. *(L6)*

### Stage 5 — Learn & Iterate
- **FR-5.1 (MUST)** Log outcomes; feed back into scoring weights, venue map, and **the client's prompts/skills**. *(L7)*

### Fundraising mode (second vertical, same engine)
- **FR-6.1 (SHOULD)** Investor entity type + **4-dimension rubric** (stage/sector/recency/warm-intro) reusing Stages 1–5. *(L3/L4)*

## 4. Modular contracts (the portability mandate)

Each layer is swappable behind a clean contract; a new client = new config row, not a fork.

| Layer | Contract | Portable because |
|-------|----------|------------------|
| Front end | reads `tenant_config` (logo/colors/copy) | no business name in code |
| Context | ingestion adapters → normalise → embed | same for any business |
| Discovery | **venue-adapter interface** `find(venue, access_method)`; Exa = web adapter | new venue = new adapter/config |
| Orchestration | n8n template parameterised by `tenant_id` | one engine, many tenants |
| Data | every table carries `tenant_id` | shared-schema isolation |
| Model access | router: BYOK (Vault) → free fallback | provider-agnostic, client pays |

- **NFR-PORT-1 (MUST)** Onboarding a **second** business requires **zero code changes** — only a new `tenant_config` + context drop + (optional) keys. *(acceptance test)*

## 5. Feature-superset selection (from competitor master list)

Chosen against `competitor_analysis.md` §7. **Include / Defer / Exclude.**

| Capability | Decision | Why |
|------------|----------|-----|
| Context-grounded business summary (RAG/CAG) | **Include** | the moat; nobody in white-label does it |
| Semantic discovery (Exa Websets) | **Include** | fuzzy ICP, verified, no contact-DB license |
| Painpoint verification w/ cited evidence | **Include** | the differentiator |
| Two-sided + two-stage scoring | **Include** | value to client × match; cost control |
| Multi-tenant workspaces + branding | **Include** | table-stakes for white-label |
| BYOK / OpenRouter free fallback | **Include** | structural cost advantage vs credit-metered |
| Outreach material generation | **Include** (no send) | grounded assets, hand off to sender |
| Continuous monitors / alerts | **Defer** | Exa Monitors exist; post-POC |
| Investor/fundraising mode | **Defer** (Phase 3) | same engine, low marginal cost |
| Native sending / deliverability / warmup | **Exclude** | domain-burn risk (D3) |
| Proprietary contact database | **Exclude** | Exa avoids the need |
| Autonomous high-volume AI-SDR | **Exclude** | scales the non-bottleneck; reputational risk |

## 6. Non-functional requirements

- **NFR-SEC-1 (MUST)** Shared-schema multi-tenancy: `tenant_id` on every isolated table; RLS reading `auth.jwt() ->> 'tenant_id'`; `WITH CHECK` on writes; tenant verified against a server-controlled memberships table (never user-writable metadata). *(verified Supabase 2026)*
- **NFR-SEC-2 (MUST)** Client model keys encrypted at rest (Supabase Vault), injected server-side via Edge Function; never in client code/`NEXT_PUBLIC_*`.
- **NFR-SEC-3 (MUST)** CI **cross-tenant isolation test** (sign in as Tenant A → expect 0 rows of Tenant B) before any multi-tenant release. *(CVE-2025-48757 class)*
- **NFR-COST-1 (MUST)** Runs on free tiers / client keys at $0 to the operator to prove; per-run cost caps + Exa count limits (50×/50k auto-stop).
- **NFR-COST-2 (SHOULD)** Pre-score gate cuts enrichment spend; dynamic free-model discovery used by default.
- **NFR-PORT-1 (MUST)** Zero-code second-tenant onboarding (see §4).
- **NFR-OBS-1 (SHOULD)** Log every model call (path: client-key vs free, tokens, cost) + Exa usage per tenant.
- **NFR-PERF-1 (MAY)** Discovery batch may run async (Exa is async-first); UI shows progress, not a blocking wait.

## 7. Out of scope (explicit)

Sending/deliverability infrastructure; owning a contact database; autonomous high-volume
outreach; multi-tenant billing (Phase 3); per-tenant separate infra (shared-schema instead).

## 8. Acceptance criteria (productisation)

1. A second business is onboarded with **config only**, no code change (NFR-PORT-1).
2. Cross-tenant isolation test passes in CI (NFR-SEC-1/3).
3. A full run (Stages 1→3 + hand-off) completes on free tiers / client keys.
4. No client name or venue is hard-coded anywhere.

## 9. Open decisions feeding M2

Email-verification provider; venue-adapter set for launch; two-sided score weighting;
embedding dimension per tenant (gte-small 384 default). Carried into M2 + the gate.
