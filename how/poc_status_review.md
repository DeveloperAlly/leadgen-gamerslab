# GamersLab POC — Status Review (architecture-verified)

**Status:** 🔴 **REVIEW — verified live, not from docs.** Findings + severity + fixes. Nothing here
authorises a build. **Created:** 2026-06-23 · **Reviewer:** Claude (Cowork) · **Area:** GamersLab
POC (v1) · **Campaign:** `gamers_lab_lead_gen`.

> **Why this supersedes the first pass.** My first answer measured the **database** live but took
> the **n8n workflows, Edge Functions and UI** from `SPEC.md`/`ARCHITECTURE.md`. This pass reads the
> actual node source for all six workflows and the Edge/UI code. Verifying the architecture
> **corrected two of my earlier claims and exposed three defects the docs do not record.**

---

## 0. Verification log (what was actually read, 2026-06-23)

- **Supabase `ccmwksmgoisijvyovgko`** — live SQL over `publishers` (271 rows), `intake_answer`,
  `intake_suggestion`, `cag_context`, `source`; plus `get_advisors(security)`.
- **n8n live node graphs read in full:** ① Outreach v10 `MouIeDmDAAHKIpDn` (engine node bodies via
  the committed `workflow/v10-live-edits/*.APPLIED.js`, which the live-edit README records as
  applied + read-back-verified), ② Send `YEgPZ0eATTSAb9pa`, ③ Reply Poll `LAPjN0jbvV9GAetX`,
  ④ Context Builder `G5Mkf1KUmr6LHJdV`, ⑤ Source Ingestion `ertFL6pi4wlJ3lMJ` — all four read
  node-by-node via the n8n API.
- **Edge source read:** `_shared/mapper.ts`, `venues/index.ts` (echo confirmation).
- **Not re-run end-to-end:** the 2026-06-23 socials lift in ① is marked "not yet run-tested" in the
  live-edit README; I did not trigger a discovery run.

---

## 1. Headline verdict

The architecture is sound and genuinely modular. The **runtime is degraded**: the engine drafts
successfully only ~1 in 4 times, it is briefing the model with a thinned auto-summary instead of the
hand-tuned brief, the ingestion path silently overwrites the business context, and the whole
review/send/learn loop has carried exactly one real message. It is a well-built pipeline whose fuel
and output quality have quietly regressed — and the regressions are invisible unless you read the
live nodes against the live data, which is the point of this pass.

---

## 2. Corrections to my first-pass review (own the errors)

1. **WRONG earlier — "the engine isn't populating the evidence rubric."** It is. `Prepare LLM Items`
   explicitly demands `evidence_strength/quote/sources/as_of` with a dated-source rule; `Build Final
   Record` persists them (LLM-first, heuristic fallback); `mapper.ts` renders them as UI badges. The
   93% null/none in the DB is because almost every row **predates the 2026-06-22/23 prompt upgrade
   and has not been re-enriched** (one daily run since), plus the heuristic writes `none` when there
   is no quote. Capability present; **unproven at volume**, not missing.
2. **OVERSTATED earlier — "confident fabricated specifics / hallucination."** The stats in the
   drafts (`+31% revenue`, `+115% CCU`) are **real, brief-locked facts** — the brief hard-bans
   invented numbers and caps the email at one stat. The genuinely unsourced element is the
   **per-prospect pain assertion** ("your players already ask for companion tools"), which is
   LLM-inferred — exactly what the evidence rubric is meant to discipline.
3. **What verifying made worse, not better.** Two findings only the live nodes reveal: the engine no
   longer uses the rich brief (§4 D2), and the draft step fails ~75% of the time (§4 D1).

---

## 3. The six questions, answered (grounded)

**Where does it fail to gather real data / real intelligence?**
Contact intelligence is the weak point. 51% of rows have an email, but **87% of those are generic
Steam support inboxes** (`contact_source='steam_api'`), only 11 came from real search, and just
**7% of rows carry a human contact name** (the mapper treats the pipeline's `"unknown"` sentinel as
absent). Proprietary intel is thin and mostly unproven: 216/271 rows are `no_signal`, founder quotes
exist on 4%. The evidence rubric that would fix this is wired but hasn't run across the corpus.

**What business gaps are missing?**
The biggest is a **decision-maker contact strategy** — emailing `support@` will not reach buyers,
and paid people-data is still an open pre-gate decision. Beyond that: no Gate-B rejection-reason
capture (the richest signal, currently discarded), no buying-signal/trigger detection, no warm-intro
mapping, and no outcome→angle attribution. (An unsubscribe footer is **not** a gap here: product law
bans it, `what/product_value_proposition.md §8`. The real send-side gaps are SPF/DKIM/DMARC + address
verification, not a footer.)

**Where is the UI/UX lacking?**
Most onboarding surfaces are **echo** — `venues/index.ts` literally returns config and its PATCH is
commented `echo; not persisted in v1`; the same holds for sources/intake/understanding/insights.
Only Business Context (CAG) is live-editable. There are no error/empty/loading states, no provenance
"why this lead" panel, and no async-completion notification for the long discovery run.

**Where is it inefficient?**
Of the 115 rows in the two tiers that are *supposed* to draft (A+B), **only 29 have a body — 75%
burned a model call and produced nothing** (§4 D1). 11 publishers appear under multiple Steam
app-IDs (entity-level dedup gap). The ingestion path re-derives the entire intake bank from a free
model on every source (§4 D3). The enrichment scrape cluster still runs alongside Exa.

**Where does it fail completely on intel / outreach?**
The send-and-learn loop has effectively **never run: 0 approved, 0 rejected, 1 sent, 1 replied** —
all test traffic. So Gate B/C, A/B testing, and the entire Learn dashboard have no data. And the
engine is drafting from a **thinned generic brief**, not the tuned one (§4 D2), so even successful
drafts are weaker than the repo implies.

**What features would make it better?** See §5.

---

## 4. Verified defect register (severity-ranked)

| # | Severity | Defect | Evidence (verified) |
|---|----------|--------|---------------------|
| **D1** | 🔴 High | **A/B draft generation fails ~75%.** Tiers A+B run the full draft prompt, stamp `model_used`, but `draft_body` comes back empty and the row is silently written `pipeline_status='draft'` with no body and **no retry/JSON-repair**. (Tier C is *by design* extract-only — `isSkip = tier==='skip' \|\| tier==='C'`.) | ① `Prepare LLM Items`/`Build Final Record` + data: A 4/15, B 25/100 have bodies |
| **D2** | 🔴 High | **CAG drift — engine runs on a thinned brief.** The live `cag_context` is a **2,249-char generic "=== BUSINESS BRIEF ==="** composed by ④, not the ~5,800-char hand-tuned "=== GAMERSLAB PRODUCT BRIEF ===". `Apply CAG from DB` swaps the rich baked block out for this shorter one, so the tuned guardrails (banned phrases, one-stat rule, named-CBO CTA, pitch-angle-by-phase) are compressed into single intake fields. | ④ `Compose CAG` + SQL: `cag_block` len 2249, generic header |
| **D3** | 🔴 High | **Source Ingestion overwrites the business context (off-spec).** `Apply Writes` does `INSERT … ON CONFLICT DO UPDATE` for every derived key, then **`DELETE FROM intake_answer WHERE question_key NOT IN (derived)`** — a full bank overwrite from a free model reading GamersLab's own site. It writes **no `intake_suggestion`**, contrary to `ARCHITECTURE.md §4⑤` ("ADD where empty / SUGGEST where differs"). This is the mechanism behind D2 and can clobber human-entered intake. | ⑤ `Apply Writes` SQL (live) |
| **D4** | 🟠 Med | **Paid model in a free-tier mandate.** ⑤ `Extract Chain` is wired to `openai/gpt-4o-mini` (primary) + non-`:free` Llama fallback, despite the `Prep` node's "FREE models only (no spend)" comment — and `Prep`'s free-model pick is then unused (dead code). Violates doctrine #8. | ⑤ `OR Model`/`OR Fallback` nodes (live) |
| **D5** | 🟠 Med | **Reply detection false-positives.** ③ `Detect Reply` flags a reply when *any* message `From` ≠ the connected inbox. Bounces (mailer-daemon), out-of-office, and auto-responders therefore register as genuine positive replies. | ③ `Detect Reply` jsCode (live) |
| **D6** | 🟠 Med | **`fit_score` doesn't drive prioritisation.** Tier is set in `Pre-Score` from free Steam signals **before** the LLM; `fit_score` is emitted after and only used as a UI proxy (`mapper.ts` comment confirms `value=fit_score, match=pre_score`). So leads are ranked by multiplayer flags, not fit. | ① + `mapper.ts` |
| **D7** | 🟠 Med | **Send hardening gaps.** ② is plain-text only, linear with **no failure/dead-letter path**, single **unwarmed** inbox `ally@gamerslab.gg`, and no confirmed SPF/DKIM/DMARC on the sending domain. (No unsubscribe footer is **correct, not a gap** — product law forbids it: `what/product_value_proposition.md §8`, gold-standard §9. Footers signal automation and lose.) Deliverability risk at volume. | ② nodes (live) |
| **D8** | 🟠 Med | **Decision-maker gap.** 87% of emails are generic Steam support; 7% of rows have a human name; paid people-data remains the open pre-gate decision. Caps the funnel at the last step. | data + live-edit README |
| **D9** | 🟠 Med | **Security posture.** Every table has RLS **enabled with zero policies**; all Edge fns deploy `--no-verify-jwt` behind one static bearer; advisor flags an **anon-executable `SECURITY DEFINER` `rls_auto_enable()`** over the public REST API. Revoke that EXECUTE. | `get_advisors(security)` |
| **D10** | 🟡 Low | **Entity dedup gap.** 11 publishers appear under multiple `steam_app_id`s; exclusion is keyed on app-id, so a publisher reached via a different game can be re-processed/pitched twice. | data (`dup_publisher_groups=11`) |
| **D11** | 🟡 Low | **Loop unexercised.** 0 approved / 0 rejected / 1 sent / 1 replied → the Learn loop has no outcome data to learn from. | data |
| **D12** | 🟡 Low | **Naming drift.** ④'s description says it writes `cag_composed`; the node writes `cag_context`; both tables exist. Cosmetic but confusing. | ④ (live) |

---

## 5. What would most move the needle (priority)

1. **Fix the draft step (D1).** Add JSON-repair + one retry on empty `draft_body`, and stop stamping
   `draft`-status on rows with no body. This single fix ~4×'s usable output for the spend already paid.
2. **Resolve the brief drift (D2/D3).** Decide the source of truth: either restore the rich brief as
   the live `cag_context`, or make ⑤ **non-destructive** (suggest, don't overwrite) and re-derive the
   brief to parity. Right now an ingest can silently degrade every future draft.
3. **Decision-maker enrichment (D8).** Named-role lookup, not support inboxes — the funnel's hard cap.
4. **Enforce the evidence gate.** No lead ships / no draft sends with `evidence_strength='none'`;
   the columns and rubric already exist (correction §2.1) — just gate on them once it runs at volume.
5. **Capture Gate-B rejection reasons (D11).** The one signal that makes the Learn loop work; you have
   zero outcome data today.
6. **Send hardening (D7): SPF/DKIM/DMARC + verified addresses + a dead-letter path** (no footer — banned)
   and **reply-detection fix (D5)** before any real volume.

---

## 6. What is genuinely good (fair balance)

- **Modular spine is real:** generic Edge Lead/Outreach surface + `mapper.ts`, a tenant-agnostic CAG
  scaffold (④ uses keyed `a1_oneliner…` fields, no baked nouns), and the provisioned v2 schema.
- **Exclusion is early,** not late (`Get Drafted IDs` runs before the expensive steps).
- **Engine spend is disciplined:** one model call per lead, `SCORE_FLOOR`/`DRAFT_BUDGET` gating — the
  old "multi-model fan-out" critique was already a non-issue.
- **Evidence rubric + risk flags + recency decay are wired end-to-end** (prompt → DB → UI badges) —
  just not yet run across the corpus.
- **Full send→reply loop is built and proved once** end-to-end (Gmail broker, thread stamping, A/B
  variant rows).

---

## 7. Sources

Live Supabase `ccmwksmgoisijvyovgko` (`publishers`/`intake_answer`/`intake_suggestion`/`cag_context`
queries + security advisors, 2026-06-23). Live n8n node graphs `MouIeDmDAAHKIpDn` (via
`workflow/v10-live-edits/*.APPLIED.js`), `YEgPZ0eATTSAb9pa`, `LAPjN0jbvV9GAetX`, `G5Mkf1KUmr6LHJdV`,
`ertFL6pi4wlJ3lMJ` (read node-by-node). Edge `_shared/mapper.ts`, `venues/index.ts`. Cross-ref:
`gamerslab-poc/SPEC.md`, `gamerslab-poc/ARCHITECTURE.md`, `how/pipeline_critique_v2.md`.
