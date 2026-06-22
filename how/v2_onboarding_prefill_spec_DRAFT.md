# v2 Onboarding — Doc-First Pre-Fill Spec — DRAFT

**Status:** 🟡 **DRAFT — PRE-GATE.** White-label v2 design spec. Nothing here authorises a build
(`STATE.md`). Productisation detail for **Stage 1 (Client Business Discovery)**.

**Created:** 2026-06-22 · **Owner:** Ally · **Reads from:**
[`../what/client_intake_design_DRAFT.md`](../what/client_intake_design_DRAFT.md) (the 41-question
answer bank + document pack), [`infra_stack_and_layers_DRAFT.md`](infra_stack_and_layers_DRAFT.md)
(L1 Ingest, L2 Understand, Gate A).

---

## 1. Scope (read this first)

This spec covers **one** decision only: **who answers the intake — and how we avoid asking the
human anything a document already states.** It resolves intake open-question **#2** ("founder-only,
or pre-fill from the docs and only ask the judgement gaps").

**Explicitly out of scope / still OPEN:** intake open-question **#1** — the *delivery form*
(conversational **AI interviewer** vs **static form**). This spec is written **delivery-agnostic**:
the pre-fill + gap model below works identically whether the gap questions are asked by an AI
interviewer or rendered as a short form. The interviewer-vs-form call is deferred to a later
decision and must not be assumed here.

---

## 2. Principle

**"Look at data before asking"** (operating doctrine). Onboarding must **extract every answer it
can from the client's supplied documents first**, then ask the human **only the judgement gaps** a
document can't state. The client should never be asked to type what they already gave us.

---

## 3. The two passes

```
client docs  ─►  PASS A: Pre-fill  ─►  answer_bank (each answer: value + source + confidence)
                                          │
                                          ▼
                         PASS B: Gap  ─►  ask ONLY: empty · low-confidence · judgement-only
                                          │
                                          ▼
                                    GATE A: human confirms / edits  ─►  locked summary → CAG
```

- **Pass A — Pre-fill.** Ingest the supplied **document pack** (intake §7: site, deck, case
  studies, docs, past outreach, etc.), then map extracted facts onto the **41-question answer
  bank**. Every pre-filled answer carries a **source citation + a confidence score**.
- **Pass B — Gap.** Ask the human only what's left: questions that came back **empty**,
  **low-confidence**, or are **judgement-only** (see §4). Target a small ask (~the ~15 the bank
  was designed to probe), not all 41.
- **Gate A.** The human confirms/edits the assembled summary (high-confidence answers shown for a
  quick confirm; low-confidence shown for correction). This is the existing Gate A — no new gate.

---

## 4. What pre-fills vs what always needs a human

| Pre-fillable from docs (Pass A) | Judgement-only — always ask (Pass B) |
|---|---|
| Identity, offer, product lines (A1) | The honest **disqualifiers** / "never contact" rules (B2) |
| Value prop / Jobs-Pains-Gains (A2) | The **evidence bar** for painpoint proof (B3.32) |
| Proof points, numbers, peers, team (A3) | Which past customers were the **easy yes**, and *why* (B1.21) |
| Voice samples, existing assets (A4 partial) | **Banned** phrases / claims we must never make (A4.16) |
| Public venues / channels (B5 partial) | **Warm-intro paths** + who decides/blocks (B4) |
| Firmographic/technographic ICP hints (B1) | The client's definition of a **"good lead"** + the CTA (A5) |

Rule of thumb: **facts** pre-fill; **judgements, secrets, and priorities** are asked.

---

## 5. Confidence model + data contract

Each answer is a row in an `answer_bank`, keyed by `question_id` and `tenant_id`:

```
answer_bank {
  tenant_id, question_id,
  value,                 // extracted or human-entered
  source_doc,            // citation (uri/doc + locator) — null if human-entered
  confidence,            // high | medium | low  (high only with a clear source)
  status                 // prefilled | confirmed | asked | empty
}
```

- **high** → shown at Gate A for a one-click confirm.
- **medium / low** → surfaced in Pass B for correction (don't trust silently).
- **empty / judgement-only** → asked in Pass B.
- No answer enters the CAG without a `confirmed` status (the human owns the final summary).

---

## 6. How it rides the existing architecture (no new infra)

| Step | Existing layer it reuses |
|---|---|
| Ingest the doc pack | **L1 Ingest** — Exa Contents → normalise → embed |
| Pre-fill the answer bank | **L2 Understand** — the `business-context-extraction` skill emits the `answer_bank` (not just a prose summary) |
| Ask the gap questions | **F1 front-end** — Pass-B questions (form or interviewer; #1 deferred) |
| Confirm | **Gate A** — confirmed `answer_bank` → synthesised into the **CAG** block |

Net change vs today: the extraction skill outputs a **citation-backed, confidence-scored answer
bank**, not just a summary. Everything else is the existing Stage-1 path.

---

## 7. Acceptance (when this is real, post-gate)

1. A client who supplies the recommended doc pack (intake §7) has a **majority of the bank
   pre-filled**, each pre-filled answer carrying a **source citation**.
2. The human is asked **only** the empty / low-confidence / judgement-only items (small ask).
3. **No** answer reaches the CAG without a `confirmed` status at Gate A.
4. Works unchanged whether Pass B is delivered as a form or an AI interviewer (#1 still open).

---

## 8. Open / deferred

- **#1 delivery form** (AI interviewer vs static form) — separate decision, not made here.
- Pre-fill **coverage threshold** (what "majority pre-filled" must hit) — set with real docs.
- **Confidence thresholds** (what counts as high vs medium) — tune from early onboardings.
