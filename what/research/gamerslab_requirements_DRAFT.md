# M1b — GamersLab Requirements Spec (POC) — DRAFT

**Status:** 🟡 **DRAFT — PRE-GATE.** Gated Mission **M1b**. The **POC slice only** — single-tenant,
free, concrete acceptance tests. Subset of `product_requirements_DRAFT.md` (M1a). Nothing here
authorises a build (`STATE.md`).

**Created:** 2026-06-21 · **Owner:** Ally.

---

## 1. What GamersLab actually is (so the POC targets the right entity)

GamersLab (gamerslab.space / .gg) is a **permissioned data layer linking games + UGC apps** —
free for studios, ad-supported for builders. Live UGC apps: Grudge Goblin, Tournament Garden,
GamersLab Plus. Team: Eric Vander Wal (CEO), **Ryan Waller (CBO — the warm-intro credibility
signal with publishers)**, Dr Joon Yoon (CDO).

**Therefore the "lead" = game PUBLISHERS / STUDIOS (B2B2C), not generic SMB contacts.** Warm
intros matter (Ryan Waller), so the pipeline must surface **warm-intro availability** as a signal.

## 2. Critical constraint: wrap, don't rebuild

There is **already a working ~35-node n8n pipeline — `GamersLab Publisher Outreach v9`** (Steam →
publishers → drafted outreach, Supabase store, OpenRouter free models, **drafts but does not
send**). The POC **wraps / productises v9**; it does not rebuild it. The one swap: **Exa Websets
replaces v9's Serper + WHOIS + raw scraping** for discovery/enrichment.

## 3. POC scope

**In:** Stages 1→4 of the business process + hand-off as CSV. Single-tenant. Free.
**Out:** sending (leverage GamersLab's existing path if needed), multi-tenancy enforcement,
billing, fundraising mode (later).

## 4. Functional requirements (POC)

- **PR-1 (MUST)** Ally logs in (Supabase Auth: email + Google). *(single-tenant; `tenant_id` present, defaulted)*
- **PR-2 (MUST)** Drop GamersLab context (site, docs, socials) → AI business summary + ICP (= **publishers/studios who'd want GamersLab's data layer / UGC apps**) + venue map (**Steam/SteamSpy primary**; Reddit/Discord/forums candidate). Ally **edits to correct** (Gate A).
- **PR-3 (MUST)** Discovery via **Exa Websets**: mine publishers (incl. Steam games → publisher hop), verified + criteria-checked + enriched (site, socials, contacts).
- **PR-4 (MUST)** Painpoint verification (does this publisher plausibly want a permissioned games/UGC data layer?) with cited evidence.
- **PR-5 (MUST)** Two-stage score (pre-score gate → two-sided `fit_score`); **warm-intro-available flag** (Ryan Waller path).
- **PR-6 (MUST)** Email verify + classify; backlog "already-drafted" dedup.
- **PR-7 (MUST)** Per-lead discovery pack; Ally approves/rejects (Gate B).
- **PR-8 (MUST)** Generate grounded outreach drafts (multi-model → pick best). **No sending.**
- **PR-9 (MUST)** Hand-off = **CSV export** of approved leads + packs + drafts.
- **PR-10 (SHOULD)** Track lead state in a simple board.

## 5. Acceptance tests (concrete, testable)

| # | Test | Pass condition |
|---|------|----------------|
| AT-1 | Login + context drop + intake | Ally reaches an editable summary + venue map |
| AT-2 | Summary correctness | Ally can edit ICP/venue and the change persists (Gate A) |
| AT-3 | Discovery returns real publishers | ≥ N verified publisher leads with cited criteria evidence |
| AT-4 | Painpoint evidence | each surfaced lead has ≥1 cited source for the painpoint claim |
| AT-5 | Scoring | leads ranked by two-sided `fit_score`; warm-intro flag present |
| AT-6 | Email quality | each lead's email is verify-checked + classified |
| AT-7 | Dedup | a second run does not re-draft an already-drafted publisher |
| AT-8 | Hand-off | CSV exports with packs + drafts; **no email is sent** |
| AT-9 | **Zero cost to Ally** | full run on free tiers / GamersLab keys; $0 to Ally |
| AT-10 | **Portability** | **no `"Gamers Lab"` / `"Steam"` string hard-coded** — swapping `tenant_config` + venue map = a different client |

## 6. Free-for-Ally cost map (POC)

| Need | Free path |
|------|-----------|
| Front-end host | Vercel / Netlify free |
| DB / Auth / Storage / Vectors | Supabase free (gte-small embeddings free) |
| Orchestration | n8n self-hosted (existing Sliplane) |
| Discovery | Exa free credits ($10 onboarding / 1,000 Websets credits) |
| Models | OpenRouter `:free` (one-time $10 → 1,000 req/day) or GamersLab keys |

**Net: $0 to Ally** (model cost is BYOK or free-tier).

## 7. Done when

AT-1…AT-10 pass against GamersLab's real context, confirming the loop end-to-end at zero cost,
with nothing hard-coded to GamersLab — i.e. the POC **is** the portable template.
