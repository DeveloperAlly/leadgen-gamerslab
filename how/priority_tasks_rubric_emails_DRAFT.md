# Priority Tasks — Rubric + Emails Correct & Surfaced (DRAFT, pre-gate)

Created 2026-06-23. Goal: get the lead RUBRIC and the EMAILS correct, grounded in the client's
real sources, and SURFACED for the client to edit. Ordered by dependency: data correctness first
(nothing downstream is right while the CAG is wrong), then rubric wiring, then email, then UI.

Reconciliation note: the source -> intake -> CAG deriver already exists and runs (Source
Ingestion `ertFL6pi4wlJ3lMJ`, Context Builder `G5Mkf1KUmr6LHJdV`). These tasks fix DATA, WIRING,
and SURFACING, not a rebuild.

Live state found (2026-06-23):
- Website `gamerslab.gg`: ingested. Produced 14 source-grounded suggestions, all `pending`,
  never accepted. (e.g. `a3_numbers` suggestion = the correct +8%/+31%/+75%/+115% set.)
- Deck PDF: original upload had "no bytes" and never ingested. RE-UPLOADED today
  (source `cbfb6d6e-...`); download + PDF extract work; LLM-map blocked by free-model rate limit.
- Live `intake_answer` bank still holds the OLD hand-seeded content (app-first; `a3_numbers` =
  unsourced +105% DLC / +20% console; `offer`/`a1_apps` name Grudge Goblin as "THE pitch tool").
- Scoring gate (`pre_score`) ignores the bank entirely; `good_lead`/`b1_*` exist as data, unused.

---

## P0 — Data correctness (the CAG must be true before anything else)

- [ ] **P0.1 Finish deck ingestion.** Free-model rate limit blocks the `Extract Chain` (LLM-map)
  step in Source Ingestion. Pin a non-rate-limited model for the extract step (or add
  backoff/retry + daily-cap handling). Deck is the authoritative value-prop source. Re-run until
  source `cbfb6d6e-...` reaches `indexed` with suggestions. (Known issue, see empty-drafts root
  cause memory.)
- [ ] **P0.2 Accept the source-grounded suggestions** to replace stale bank answers. Highest
  priority keys: `a3_numbers` (-> +8%/+31%/+75%/+115%, drop +105% DLC / +20% console),
  `a1_apps` (generic "apps your community could build", NOT Grudge Goblin as the product),
  `offer`, `a1_oneliner`, `b1_icp`, `b1_fit_strong`, `b2_poorfit`. Use the intake-bank
  accept flow (human-judged), then recompose the CAG.
- [ ] **P0.3 Purge unsourced / app-first claims** from any answer not backed by deck or site.
  Apps are "coming soon" per the deck; never named as the product or the CTA.
- [ ] **P0.4 Verify recomposed `cag_context`** reflects the corrected, sourced brief (the
  worked target is `how/cag_grounded_prompts_DRAFT.md`, which IS the corrected bank content).

## P1 — Rubric correctness + wiring (define "good lead" from the value prop, and USE it)

- [ ] **P1.1 Wire the gate to the bank rubric.** `pre_score` (Select & Split gate) must derive
  from `good_lead` / `b1_fit_strong` / `b1_icp` / `b2_poorfit` / `b3_pain_signals`, not a
  hardcoded points table disconnected from the value prop.
- [ ] **P1.2 Fix the backwards signal.** Today `mature`/established games score 0 phase points
  and `sunset` -20, while pre-launch/just-launched are rewarded. The deck's #1 segment is
  established-declining (revitalization). Re-weight so the primary ICP is not penalised.
- [ ] **P1.3 Make `fit_score` (LLM, reads CAG) actually gate** advancement, or explicitly
  reconcile it with `pre_score`. Today it is computed and ignored.
- [ ] **P1.4 Remove hardcoded `bestUgcApp` / `pitchAngle` if/else** in Prepare LLM Items; let
  app/angle derive from the corrected CAG.
- [ ] **P1.5 Fix discovery rank** `_s` in Pick 100 (currently 50% Steam-appid "newness") to
  reflect value-prop signals. (Lower priority than the gate.)

## P2 — Email correctness

- [ ] **P2.1 Delete the fabricated fallback brief** baked in `Prepare LLM Items` so a missing/
  empty CAG cannot silently fall back to invented content.
- [ ] **P2.2 Verify a corrected draft** end to end after P0: it pitches GamersLab (integration,
  free analytics, ecosystem), uses one sourced stat, one CTA about GamersLab (not an app).
- [ ] **P2.3 Decide A/B.** Variant B is subject-only today (body shared via the sync trigger).
  Either generate a real `draft_body_b` or label the board as a subject-only test.

## P3 — Surfacing (client can see and edit the rubric + prompts)

- [ ] **P3.1 Surface the rubric on the Context page.** Today only the CAG prose is editable;
  the scoring weights live in code. Expose `fit_signals` / the good-lead definition as editable
  config (weights as editable assumptions, per the locked D2 decision).
- [ ] **P3.2 Surface the prompts on the Context page** (qualify + draft templates), editable,
  with a preview of what gets injected. (Ally directive.)
- [ ] **P3.3 Wire the suggestions Accept/Dismiss UI** (Intake page) so future source ingests are
  reviewable, not stranded as `pending` like the current 14 website suggestions.

---

Acceptance: the live CAG contains only deck/site-sourced claims; the gate selects leads by the
value-prop rubric (established-declining included); a sample draft sells GamersLab; and a client
can edit the rubric and the prompts from the Context page.
