> ⛔ **ARCHIVED / SUPERSEDED.** v1 critique (8 gaps). Superseded by [`../pipeline_critique_v2.md`](../pipeline_critique_v2.md). Kept for history; do not action from this file.

---

# Pipeline Critique & Gap Analysis

**Task 3.** Critical analysis of the proposed end-to-end process pipeline, with gaps, risks,
and research-grounded improvements. This is a **self-critique gate** output: it audits the
sketched design against the 2026 landscape (`../what/research/competitor_analysis.md`) and
verified platform docs. Nothing here authorises a build.

---

## 1. The pipeline as sketched (restated)

1. Front-end login.
2. User drops files in for **RAG / CAG** (business context).
3. Use **Exa** to search for competitors.
4. Client enters their lead-gen requirements.
5. Docs go into a **vector DB**, indexed/searchable.
6. AI summary of the business (pain points, needs, target customer, where to find them) →
   vector DB (+ maybe a CAG).
7. User reviews & edits this data to confirm correctness.
8. An **n8n pipeline** is created for them.
9. **Auth** deferred (GamersLab first); research it for later.
10. Tech stack: React front end · n8n automation · client model keys / OpenRouter fallback · Supabase.

**Overall verdict:** the *shape* is right and modern — it mirrors how the winning stacks work
(context → discovery → enrich/score → orchestrate). The gaps are in **sequencing, data
contracts, the model-key layer, n8n's multi-tenancy ceiling, and the missing scoring/output
half of the pipeline.** Eight substantive gaps below, each with a fix.

---

## 2. What's strong (keep these)

- **Context-first.** Grounding the pipeline in the business's own docs is exactly the white
  space incumbents miss (resellers sell generic bots). This is the moat — protect it.
- **Exa for discovery.** Correct call. **Exa Websets** (verified, criteria-checked,
  source-cited, enrichable, monitor-able) is purpose-built for "find competitors/leads/investors
  matching fuzzy criteria" and avoids us licensing a contact DB. It powers customer-finding *and*
  fundraising from one engine.
- **Human review/edit gate (step 7).** Keeping a human in the loop on the AI's business
  understanding is the single highest-leverage quality lever — and matches the "augmentation
  beats autonomous" finding. Don't drop it.
- **BYO model keys / OpenRouter fallback.** Structurally smart: sidesteps the credit-cost
  unpredictability that drives churn at Clay/White Label Suite/IRMA, and keeps the POC free for Ally.

---

## 3. Gaps & risks (with fixes)

### Gap 1 — RAG vs CAG is treated as interchangeable; it isn't
**Issue:** "RAG / CAG" is used loosely. They solve different things.
**Fix / decision:**
- **CAG (Cache-Augmented Generation)** = load the *whole* compact business context (the
  AI-generated business summary, ICP, value props — a few KB) directly into the model's context
  window every call. Best for the *always-needed, small, stable* core. This is the "boot" context.
- **RAG (Retrieval-Augmented)** = vector-search over the *large, variable* corpus (uploaded
  PDFs, scraped site/socials, prior campaigns) and inject only the relevant chunks.
- **Rule:** the editable business summary → **CAG** (always loaded). The raw document corpus →
  **RAG** (retrieved on demand). This directly serves Ally's "design for the boot" principle.

### Gap 2 — No source-ingestion layer specified before "drop files in"
**Issue:** "user drops in value props, website & socials" — websites and socials aren't files.
There's no defined ingestion for URLs/social handles, and no normalisation step.
**Fix:** add an **Ingestion module** with adapters: (a) file upload (PDF/docx/txt), (b) website
crawl (Exa `get_contents` / crawl), (c) social fetch (handles → public profile/post text). All
normalise to clean text → chunk → embed. *Do we need a skill?* — Yes: a small **"business-context
extraction" skill/prompt** that turns mixed raw inputs into the structured summary (value props,
ICP, pains, where-customers-are) is worth formalising, because it's reused for every client and
defines the quality of everything downstream.

### Gap 3 — The pipeline stops at "create an n8n pipeline" — the *output half* is missing
**Issue:** Steps 1–8 build understanding and discovery, but there's no **scoring, dedup,
review-of-leads, or hand-off/output** stage. Competitors win or lose on exactly this back half.
**Fix:** add stages: **(a) Score** leads/competitors against the ICP (fit + activity, or the
fundraising 4-dimension rubric: stage/sector/recency/warm-intro); **(b) Dedup + verify**
(Websets already verifies; add cross-run dedup); **(c) Lead review UI** (human approves/rejects,
mirrors step 7 but for outputs); **(d) Hand-off** — export CSV / push to CRM / webhook to a
sender. **Do not own sending in the POC** (deliverability is a specialist, domain-reputation risk).

### Gap 4 — n8n has **no native multi-tenancy** (the biggest architectural trap)
**Issue:** "an n8n pipeline is created for them" implies per-client pipelines. n8n has **no
built-in tenant/user separation**; true isolation means **a separate instance per client**
(infra/maintenance multiplies), and **white-labelling n8n is reported at ~$50K/yr**. Auto-
generating per-client workflows is brittle and hard to version.
**Fix / decision options (pick at gate):**
- **(A) n8n as a single shared engine, parameterised by `tenant_id`** — one set of template
  workflows; the business context/keys are passed in per execution. Cheapest; needs careful
  isolation discipline. **Recommended for POC + early productisation.**
- **(B) Native orchestration** (Supabase Edge Functions / a small worker) for the core path, with
  n8n only where its connector library earns its keep. More work, fully ours, no white-label fee.
- **(C) n8n instance-per-tenant** — only at enterprise/compliance scale. Avoid early.
- **POC stance:** GamersLab is single-tenant, so this doesn't bite yet — but **design the data
  contract now** (every record carries `tenant_id`) so we never retrofit it.

### Gap 5 — The model-key layer is under-specified and has a security hole
**Issue:** "use the client's model API keys… or OpenRouter fallback" — *where do keys live, who
calls the model, how do we not leak keys?* Browser-side BYOK exposes the key in the network tab.
**Fix (verified pattern):**
- Store client keys **encrypted at rest** (e.g. Fernet/AES) in Supabase, scoped by `tenant_id`;
  **never** in client code or `NEXT_PUBLIC_*`.
- Route every model call through a **Supabase Edge Function proxy** (or worker) that injects the
  client's key server-side, so the key never reaches the browser. (This is the exact "what I'd do
  differently" fix from the BYOK case study.)
- **Model router:** try client key → on missing/failure fall back to **OpenRouter free models**;
  log which path was used. One interface, swappable providers.

### Gap 6 — Auth deferral is fine, but multi-tenancy must be designed *now* (cheap) not later (expensive)
**Issue:** "leave auth to later" is reasonable for the POC, **but** tenancy is a schema decision,
not an auth feature. Bolting `tenant_id` on later = painful migration; AI-generated RLS policies
are a known breach vector (CVE-2025-48757 hit 170+ apps via one missing policy).
**Fix (verified Supabase 2026 pattern):**
- POC: **single-tenant**, Supabase Auth (email + Google OAuth), RLS `auth.uid() = user_id`.
- But **add `tenant_id` to every table from day one** (nullable/defaulted in POC).
- Productisation: shared-schema multi-tenancy with `tenant_id` on every isolated table;
  inject `tenant_id` + `role` via a **Custom Access Token Hook** into the JWT; RLS reads
  `auth.jwt() ->> 'tenant_id'`; **`WITH CHECK` on every write**; **`FORCE ROW LEVEL SECURITY`**;
  verify `tenant_id` against a **server-controlled memberships table**, never user-writable
  metadata; **explicit cross-tenant isolation test** in CI (sign in as Tenant A, expect 0 rows
  from Tenant B). This handles ~80% of B2B SaaS to 10K+ tenants on one instance.

### Gap 7 — No "is cold even the right channel?" check (outbound market fit)
**Issue:** The pipeline assumes discovery → outreach works. The most credible 2026 insight is
that ~10% of businesses simply shouldn't run cold; cold needs who/what/when iteration.
**Fix:** make the intake capture current channels + warm assets, and have the AI summary include
a **channel recommendation** (cold-fit vs warm/CRM-driven) and an **iteration loop** on
who/what/when. This is a differentiator no reseller offers.

### Gap 8 — No evaluation / feedback loop or cost guardrails
**Issue:** No way to know if leads were good, and no cost ceiling on Exa/model spend per run.
**Fix:** log outcomes (lead accepted/replied/converted) back against the ICP to improve scoring;
add **per-run credit/cost caps** and Exa Websets **count limits** (it auto-stops at 50× requested
/ 50K max) so a client can't accidentally burn credits. Cost transparency is a churn-avoider.

---

## 4. Revised end-to-end pipeline (recommended)

```
0. AUTH (POC: single-tenant Supabase Auth; schema carries tenant_id from day 1)
1. INGEST    files + website crawl + socials  → normalise → chunk → embed (RAG corpus)
2. UNDERSTAND  business-context-extraction skill → structured summary
               (value props, ICP, pains, where-customers-are, cold-vs-warm rec)  → CAG core
3. REVIEW (human gate A)  user edits/confirms the summary  ← highest-leverage quality lever
4. DISCOVER  Exa Websets: competitors + lookalike leads/ICP (or investors), verified + enriched
5. SCORE + DEDUP  fit/activity score (or 4-dim fundraising rubric); cross-run dedup
6. REVIEW (human gate B)  user approves/rejects leads in UI
7. ORCHESTRATE  n8n shared engine (tenant_id param) — enrich/route/schedule/monitor
8. HAND-OFF  export CSV / push to CRM / webhook to sender (POC does NOT send)
9. LEARN  log outcomes → improve scoring; cost caps + Exa count limits throughout
   ── all model calls go through an Edge-Function proxy: client key → OpenRouter free fallback ──
```

---

## 5. Decisions needed from Ally (logged in STATE.md)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | n8n shared-engine vs native orchestration vs instance-per-tenant | **Shared engine, tenant_id param** for POC + early; revisit at scale |
| D2 | RAG/CAG split | **CAG = editable summary; RAG = doc corpus** |
| D3 | Sending in scope? | **No** — hand off to a sender; never burn client domains in POC |
| D4 | Model keys | **BYOK encrypted + Edge proxy; OpenRouter free fallback; router logs path** |
| D5 | Multi-tenancy timing | **Schema-ready now (tenant_id everywhere), enforce at productisation** |
| D6 | Build vs buy guardrail | Our edge = context-grounding + portability + BYOK; if a build decision doesn't serve one of those, reconsider |
| D7 | Front-end framework for modularity | Decide at UI design (M3); likely React + theming tokens + config-driven screens |

---

## 6. Self-critique of this critique

- I have **not** yet verified every Exa Websets / Supabase / n8n API call against live 2026 docs
  at the line level — that is the explicit job of **Mission M2 (verified architecture)**, gated.
  This doc establishes *direction*; M2 establishes *proof*.
- Pricing/feature figures are vendor- and review-sourced (2026) and may move; treat as directional.
- The biggest unknown is **GamersLab's actual business** (its real ICP and whether cold is its
  channel). The intake + human review gates are designed to surface that, not assume it.
