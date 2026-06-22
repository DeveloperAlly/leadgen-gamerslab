# Campaign Master — `gamers_lab_lead_gen`

**Created:** 2026-06-21 · **Owner:** Ally · **Status:** Research+Design, pre-gate

## North star

A business drops in its context (value props, website, socials, docs), answers a short
guided intake, and the system produces a **running lead-generation pipeline** that finds,
qualifies, and helps reach the right customers (or investors) — wrapped in a clean,
white-labelled UI. **Gamers Lab proves it. Every other business inherits it.**

## What we are building (and what we are not)

**Building:** a modular pipeline product with four swappable layers —
(1) **Context layer** (file drop → RAG/CAG of the business),
(2) **Discovery layer** (Exa-powered competitor + lead/ICP discovery),
(3) **Orchestration layer** (n8n or native workflows that enrich, score, route),
(4) **Front end** (login, intake, review/edit, dashboard) — itself modular and themeable.

**Not building (yet):** a fully autonomous AI-SDR that sends at volume, a proprietary
contact database, or multi-tenant billing. Those are later phases. The POC is the template.

## Why now (the wedge)

Multiple businesses in Ally's network have signalled the same need. The market is hot but
**fragmented** (see `research/competitor_analysis.md`): incumbents either own the *data*
(Clay, Apollo, ZoomInfo) or the *autonomous sending* (11x, Artisan), and white-label
players (GoHighLevel, Vendasta, White Label Suite, SalesMind) mostly resell generic CRM +
LinkedIn automation. The white space is a **context-grounded, business-specific pipeline**
that is genuinely re-templatable and lets clients use **their own model keys** — a
build-once-sell-many wedge that doesn't require us to own data or burn sending domains.

## Hard constraints

- **Modular / portable / scalable** — front end included. The POC must be liftable.
- **Free for Ally first** — runs on free tiers + the client's own keys.
- **Gated** — no build until UI + verified architecture are approved (see `CLAUDE.md`).
- **Verified** — every external API the architecture relies on is checked against 2026 docs.

## Success criteria

**POC (GamersLab):**
1. Ally can log in, drop GamersLab context, complete intake, and review an AI summary of the
   business + ICP + where-to-find-them, and *edit it to correct*.
2. The system runs an Exa discovery pass and returns a verified, enriched list of
   competitors and candidate leads relevant to GamersLab.
3. It runs end-to-end on free tiers / GamersLab's own keys, at zero cost to Ally.
4. **Nothing in the POC is hard-coded to "Gamers Lab"** — swapping context = a new client.

**Productisation (later):** a second business onboarded with no code changes, only config.

## Artifacts index

| Artifact | Path | Status |
|----------|------|--------|
| Campaign router & governance | `CLAUDE.md` | ✅ |
| State & tracks | `STATE.md` | ✅ |
| Competitor analysis (Task 2) | `what/research/competitor_analysis.md` | ✅ Draft |
| Pipeline critique + gaps (Task 3) | `how/pipeline_critique.md` | ✅ Draft |
| POC→prod plan & tasklist (Task 4) | `how/plan_poc_to_production.md` | ✅ Draft |
| **Business process model (the WHAT)** | `what/business_process_model_DRAFT.md` | ✅ Draft v10 |
| Business-process diagram | `what/business_process_diagram.svg` (embedded) | ✅ |
| **Infra stack & layers (the HOW)** | `how/infra_stack_and_layers_DRAFT.md` | ✅ Draft v10 |
| Infra-stack diagram | `how/infra_stack_diagram.svg` (embedded) | ✅ |
| UI design brief (M3) | `how/ui_design_prompt.md` | ✅ Draft |
| Product requirements spec | `what/research/` (M1) | ⬜ |
| GamersLab requirements spec | `what/research/` (M1) | ⬜ |
| Verified architecture spec | `how/` (M2) | ⬜ |
| UI design | `how/` or Figma (M3) | ⬜ |
