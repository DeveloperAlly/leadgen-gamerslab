# GamersLab POC — Fix Backlog (impact × effort, agent-ready)

**Status:** 🟢 **EXECUTION BACKLOG** for the live POC (area 1; STATE.md = "iterating live").
**Created:** 2026-06-23 · **Source of findings:** `how/poc_status_review.md` (architecture-verified).
Each task fixes a defect `Dxx` from that review. **Read the review's §4 before starting.**

---

## 0. The "do it CORRECTLY" contract — every agent, every task

These are non-negotiable (root `CLAUDE.md` doctrine). A task is **not done** unless all apply:

1. **Verify the live state first.** Re-read the actual node/file before editing — do not trust this
   doc or any other doc as ground truth for code. Confirm the defect still reproduces.
2. **Confirm root cause before fixing.** Where a task says "likely X", prove X first (read the node,
   check a real execution). Never patch a symptom you haven't traced.
3. **Minimal, modular change.** Config/data over hardcoding. Never fork the UI (one source,
   `poc/ui`). Nothing GamersLab-specific baked into engine code that should be tenant config.
4. **Free-tier only** (doctrine #8). No new paid dependency without an explicit Ally decision.
5. **Prove it.** Every task has an **Acceptance test** — run it and paste the result (read-back diff,
   SQL count, or a real execution id). "Should work" is not acceptance.
6. **Update canonical docs in the same change** (ARCHITECTURE.md §10 maintenance rule): the relevant
   §4 spine, §6/§7 if writes/webhooks changed, bump §9 date, and mirror to aDNA (`gamers-lab`,
   `lead-gen`).
7. **One task at a time, permission-first for anything destructive or schema-changing.** State the
   one-line task, get a yes, then act. No bundling unrequested extras.
8. **Outreach copy rule:** no em dashes in any generated email subject/body (existing pipeline rule).

> ⚠️ **Two tasks touch the same brief (T2, T3) and two touch the engine draft path (T1, T9).**
> Respect the dependency order in §2 or you will overwrite each other's work.

---

## 1. Impact × effort matrix

```
        EFFORT →     S (≤½ day)            M (1–2 days)              L (3+ days / decision-gated)
  I  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  M  │ HIGH   │ T1 draft-repair (D1)   │ T2 ingest non-destruct(D3)│ T10 decision-maker enrich (D8)│
  P  │        │                        │ T3 brief parity (D2)      │                               │
  A  ├────────┼────────────────────────┼───────────────────────────┼───────────────────────────────┤
  C  │ MED    │ T4 free model (D4)     │ T7 send hardening (D7)    │ T11 fit-driven tiering (D6)   │
  T  │        │ T5 security revoke (D9)│ T9 evidence-at-volume     │                               │
  ↓  │        │ T6 reply detect (D5)   │     (verify D1 fix)       │                               │
     │        │ T8 reject-reason (D11) │                           │                               │
     ├────────┼────────────────────────┼───────────────────────────┼───────────────────────────────┤
     │ LOW    │ T13 naming drift (D12) │ T12 entity dedup (D10)    │                               │
     └────────┴────────────────────────┴───────────────────────────┴───────────────────────────────┘
```

## 2. Sequenced waves (dependency-correct)

- **Wave 1 — restore trustworthy output:** T1 → (T2 → T3) → T4 → T5. Do T2 before T3 (T3 depends on
  ingestion being safe first). These make the engine draft reliably from the right brief.
- **Wave 2 — make the loop real & safe:** T6, T7, T8, then T9 (T9 needs T1 shipped to measure).
- **Wave 3 — decision-gated / structural (needs Ally go):** T10, T11, T12, T13.

---

## 3. Task briefs

### T1 — Repair the draft step so A/B tiers actually produce a body `[Impact H · Effort S–M]`
**Fixes:** D1 · **Area:** n8n ① `MouIeDmDAAHKIpDn` · **Depends:** none
**Verified current state (read live 2026-06-23):** 115 rows in tiers A+B (which run the full draft
prompt) have only 29 `draft_body` values — 75% stamp `model_used`, return no body, and are saved
`pipeline_status='draft'` with an empty body. Tier C is *intentionally* extract-only (do not change).
**Root cause — already confirmed (do not re-attribute to parsing):** `Pick Best LLM Response`
**already does** tolerant extraction (`JSON.parse(raw.substring(firstBrace, lastBrace+1))`) and accepts
a response if **any one** of `intel_summary`/`pain_signal`/`draft_body` is present; on total failure it
emits a fallback `_parsed = { intel_quality:'no_signal', fit_score:0, recommended_action:'archive' }`.
`Build Final Record` then sets `pipeline_status = (outreach_tier==='skip') ? 'skip' : 'draft'`
**regardless of whether `draft_body` is empty.** So the two real causes are:
(1) the free model returns intel but an **empty `draft_body`** → passes the one-field guard → stamped
`draft` with no body; (2) a **full parse failure** hits the fallback → still stamped `draft` (tier isn't
`skip`) with no body. It is **not** a missing-tolerant-parser problem.
**Target / DoD:**
- In `Build Final Record` (or a dedicated gate before `Upsert`): when `outreach_tier ∈ {A,B}` and
  `fullBody` is empty, **do not write `pipeline_status='draft'`** — route to backlog /
  `recommended_action='warm_queue'` so empty rows aren't counted as ready drafts.
- Add **one retry** with the next free model when an A/B draft comes back empty before giving up (the
  roster is already fetched in `Filter Free Models`).
- Optional, confirm with Ally: tighten `Pick Best`'s acceptance so an **intel-only** response on an
  A/B tier (no `draft_body`) is treated as "needs draft retry", not a success.
- Net: never store a `draft`-status row with an empty `draft_body`.
**Acceptance test:** trigger one discovery run; then
`SELECT outreach_tier, count(*) FILTER (WHERE draft_body<>'') AS bodies, count(*) FROM publishers
WHERE pipeline_status='draft' GROUP BY 1;` — A+B body-rate must be **≥80%** of A+B draft rows, and
**zero** `draft`-status rows with empty body.
**Guardrails:** don't touch the C extract-only branch; don't raise `DRAFT_BUDGET` (free-cap). Keep one
model call per lead + at most one retry (stay under OpenRouter 50/day).
**Docs:** ARCHITECTURE.md §4① spine note + §9 date; aDNA.

---

### T2 — Make Source Ingestion non-destructive (stop it clobbering the intake bank) `[Impact H · Effort M]`
**Fixes:** D3 · **Area:** n8n ⑤ `ertFL6pi4wlJ3lMJ` (`Apply Writes`) · **Depends:** none · **blocks T3**
**Verified current state:** `Apply Writes` does `INSERT … ON CONFLICT DO UPDATE SET answer=EXCLUDED`
for every derived key **then `DELETE FROM intake_answer WHERE question_key NOT IN (derived)`** — a full
overwrite from a free model reading GamersLab's own site. It writes **no `intake_suggestion`**. This
contradicts `ARCHITECTURE.md §4⑤` ("ADD where empty / SUGGEST where differs").
**Target / DoD (match the documented safe contract):**
- **ADD** a derived answer to `intake_answer` **only where the key is empty/absent**.
- **SUGGEST** into `intake_suggestion` when a derived answer **differs** from an existing human answer
  (never overwrite a human value; surface it for review).
- **Remove the blanket `DELETE`.** A re-ingest must never delete existing intake answers.
**Acceptance test:** seed a known human answer for one key; queue a source whose text implies a
different answer; run ⑤; assert the human `intake_answer` is **unchanged** and a row appeared in
`intake_suggestion`. `SELECT count(*) FROM intake_suggestion;` increases; human key intact.
**Guardrails:** permission-first — this changes write semantics; confirm with Ally before deploy. Keep
the base64-CTE pattern; just change the merge logic. Don't alter `Store Text + Index`.
**Docs:** ARCHITECTURE.md §4⑤ (correct it to match reality), §6 writer matrix; aDNA.

---

### T3 — Restore brief parity so the engine drafts from the tuned brief `[Impact H · Effort M]`
**Fixes:** D2 · **Area:** ④ `G5Mkf1KUmr6LHJdV` + `cag_context` + intake bank · **Depends:** T2
**Verified current state:** live `cag_context.cag_block` is a **2,249-char generic
"=== BUSINESS BRIEF ==="** composed by ④ from 13 intake answers; the engine's `Apply CAG from DB`
swaps the rich ~5,800-char "=== GAMERSLAB PRODUCT BRIEF ===" *out* for this thinner one. Tuned
guardrails (banned phrases, one-stat rule, named-CBO CTA, pitch-angle-by-phase) are compressed.
**Decision required (Ally) — pick one, then build:**
- **(a) Brief-as-source-of-truth:** restore the rich brief content into the **intake bank** so ④
  recomposes a `cag_block` at parity (every section of the rich brief maps to a keyed answer:
  `a3_numbers`, `a4_banned`, `a5_cta`, `b3_pitch_angles`, …). Preferred — keeps it data-driven/modular.
- **(b) Static brief:** point `Apply CAG from DB` at a pinned rich `cag_context` and treat the UI
  Business-Context editor as the only mutation path (disable ⑤'s auto-recompose of those keys).
**Target / DoD:** the `cag_block` the engine injects contains, verbatim or equivalent: the banned-phrase
list, "use only these numbers / one stat max / ≤130 words", the named-CBO CTA, and the two
phase-based pitch angles. Length back near the rich brief's coverage.
**Acceptance test:** `SELECT length(cag_block) FROM cag_context;` reflects parity; grep the block for
the banned-phrase rule + CTA + both pitch angles (all present); run one discovery run and confirm a
fresh A-tier draft still leads with the correct app + one stat + one CTA and no banned phrases.
**Guardrails:** do **not** re-bake GamersLab nouns into engine code (keep them in the intake bank /
`cag_context`). Coordinate with T2 — if ingestion is still destructive this will silently revert.
**Docs:** ARCHITECTURE.md §4④/§5 context loop; aDNA. Record the chosen option (a/b).

---

### T4 — Put Source Ingestion back on free models `[Impact M · Effort S]`
**Fixes:** D4 · **Area:** n8n ⑤ (`OR Model`, `OR Fallback`, `Prep`) · **Depends:** none
**Verified current state:** `Extract Chain` is wired to **paid `openai/gpt-4o-mini`** (primary) +
non-`:free` `meta-llama/llama-3.3-70b-instruct` (fallback), despite `Prep`'s "FREE models only" comment;
`Prep`'s computed `model`/`model2` free picks are **unused**.
**Target / DoD:** `Extract Chain`'s primary + fallback resolve to the `:free` models `Prep` already
selects (or pin two known-good `:free` instruct models). Remove or wire-in the dead `Prep` pick so
code and behaviour agree.
**Acceptance test:** read back ⑤; both model nodes reference `:free` ids (or are driven by `Prep`).
Queue one source, run ⑤, confirm a successful extract on free models (check execution; no paid model id).
**Guardrails:** free-tier mandate (#8). If free extraction quality is materially worse, **flag to Ally**
with evidence — do not unilaterally keep a paid model.
**Docs:** ARCHITECTURE.md §4⑤ credentials note; aDNA.

---

### T5 — Close the anon SECURITY DEFINER hole + decide the RLS model `[Impact M · Effort S]`
**Fixes:** D9 · **Area:** Supabase `ccmwksmgoisijvyovgko` · **Depends:** none
**Verified current state:** advisor flags `public.rls_auto_enable()` as a `SECURITY DEFINER` function
**executable by `anon`** via `/rest/v1/rpc/`. All tables have RLS enabled with **zero policies**; Edge
fns are `--no-verify-jwt` behind one static bearer (works because service-role bypasses RLS).
**Target / DoD:** `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;` (or
switch it to `SECURITY INVOKER` / drop if unused — confirm it isn't called first). Set
`search_path` on the three flagged functions. **Document** that the v1 access model is intentional
(service-role behind a bearer-gated Edge API; RLS-on/no-policy = locked to the public REST path) so it
isn't mistaken for a gap.
**Acceptance test:** re-run `get_advisors(security)`; the `anon_security_definer_function_executable`
lint for `rls_auto_enable` is gone; function-search-path warns cleared.
**Guardrails:** permission-first — this is a DDL/grant change on the live project; confirm with Ally.
Do **not** add broad anon RLS policies that would expose `publishers` over the public REST API.
**Docs:** SPEC.md §3 security aside; aDNA.

---

### T6 — Make reply detection reject bounces/auto-replies `[Impact M · Effort S]`
**Fixes:** D5 · **Area:** n8n ③ `LAPjN0jbvV9GAetX` (`Detect Reply`) · **Depends:** none
**Verified current state:** `Detect Reply` marks a reply when **any** message `From` ≠ the connected
inbox. Bounces (`mailer-daemon`/`postmaster`), out-of-office, and `no-reply@` auto-responders all
count as genuine positive replies → false `replied` stamps and poisoned outcome data.
**Target / DoD:** a message counts as a real reply only when From is **not** the inbox **and not** an
automated sender (exclude `mailer-daemon`, `postmaster`, `no-reply`/`noreply`, `do-not-reply`), and —
if cheaply available from `format=metadata` headers — ignore `Auto-Submitted: auto-replied` / OOO.
Optionally stamp a separate `bounced` state instead of `replied` for hard bounces.
**Acceptance test:** unit the matcher over sample headers (a real reply, a mailer-daemon bounce, an OOO)
→ only the real reply returns `replied=true`. Confirm on the live node read-back.
**Guardrails:** keep it metadata-only (no extra Gmail scopes / full-body fetch). Don't break the
existing positive-reply path already proven once.
**Docs:** ARCHITECTURE.md §4③; aDNA.

---

### T7 — Send hardening: auth + verified addresses + failure path `[Impact M · Effort S–M]`
**Fixes:** D7 · **Area:** n8n ② `YEgPZ0eATTSAb9pa` · **Depends:** none
**Verified current state:** ② is plain-text, linear, **no failure/dead-letter branch**; single
**unwarmed** inbox `ally@gamerslab.gg`; no confirmed SPF/DKIM/DMARC. **Do NOT add an unsubscribe footer
or physical postal address** — product law forbids it (`what/product_value_proposition.md §8`,
gold-standard §9: footers signal automation and lose). The send-side levers for this motion are the
*invisible* ones.
**Target / DoD:**
- **Auth (do first, it's S, invisible to the recipient):** confirm SPF/DKIM/DMARC are set on the sending
  domain — the only universally-applicable deliverability lever for this motion (gold-standard §9). Flag
  any missing record for Ally to set.
- **Address verification:** verify each address before send. Bounces are the one thing that can damage the
  real brand domain even at low volume, so this matters *more* on the brand domain, not less.
- **Failure path:** on `Gmail Send` error, route to a dead-letter (write the failure + reason to a
  `runs`/log row; do **not** stamp `sent`). Add an n8n Error Trigger or node-level On-Error branch.
- **Note for Ally (no build):** single-inbox, no warm-up → flag deliverability risk before volume.
**Acceptance test:** confirm SPF/DKIM/DMARC resolve for the sending domain; force a send error (bad token)
and confirm the row is **not** stamped `sent` and a dead-letter row is written.
**Guardrails:** **no unsubscribe footer / opt-out line / physical address** (product law). Don't add a
paid email-warmup tool without Ally go.
**Docs:** ARCHITECTURE.md §4②/§6; aDNA.

---

### T8 — Capture Gate-B rejection reasons & exercise the loop `[Impact M · Effort S]`
**Fixes:** D11 (+ critique N1) · **Area:** Edge `leads` + UI Gate B · **Depends:** none
**Verified current state:** 0 approved / 0 rejected / 1 sent / 1 replied — the Learn loop has no data.
The `leads` PATCH already accepts `{status, reasonCode, reason}` and writes `reject_reason_code`
(per the live-edit README) — **verify it end-to-end**, then actually use it.
**Target / DoD:** confirm the reject reason picker writes `reject_reason_code`+`reject_reason`+
`reviewed_at` live; then run a real Gate-B/Gate-C pass over the current drafts (after T1/T3) so the
system has genuine approve/reject/sent outcomes to learn from.
**Acceptance test:** reject 3 leads with reasons via the UI → `SELECT reject_reason_code, count(*)
FROM publishers WHERE reject_reason_code IS NOT NULL GROUP BY 1;` shows them; approve + send ≥1 real
lead → `sent` stamped with thread id.
**Guardrails:** don't auto-send; human stays in the loop at Gate C. Don't fabricate outcomes.
**Docs:** none structural; note in STATE.md that the loop now has live outcome data; aDNA.

---

### T9 — Prove the evidence rubric at volume `[Impact M · Effort S]` (verification task)
**Fixes:** verifies D1 fix + the §2.1 correction · **Area:** ① + DB · **Depends:** T1 (and ideally T3)
**Verified current state:** the rubric is wired (prompt → `Build Final Record` → `mapper` → UI badges)
but 93% of rows are null/none because they predate the upgrade and haven't re-enriched.
**Target / DoD:** after T1 ships, run discovery over a fresh genre and measure that the upgraded prompt
actually emits `evidence_strength` with dated sources at a usable rate on **new** rows.
**Acceptance test:** `SELECT evidence_strength, count(*) FROM publishers WHERE created_at > '<run-ts>'
GROUP BY 1;` — a meaningful share of new A/B rows are `explicit`/`inferred` with non-empty
`evidence_quote`+`evidence_as_of`. If still mostly `none`, the prompt/source coverage needs work (log
it, don't claim success).
**Guardrails:** measure new rows only; don't retro-judge pre-upgrade rows.
**Docs:** update `how/poc_status_review.md` §2.1 with the at-volume number; aDNA.

---

### T10 — Decision-maker contact enrichment `[Impact H · Effort L · decision-gated]`
**Fixes:** D8 · **Area:** ① enrichment + open pre-gate decision · **Depends:** Ally decision
**Verified current state:** 87% of emails are generic Steam `support@`; 7% of rows have a human name;
paid people-data (founder/LinkedIn) is the **open pre-gate decision** in
`how/lead_contact_enrichment_options_DRAFT.md`.
**Target / DoD:** this is **research + decision before build** (doctrine #1/#9). Produce a short options
memo: free/cheap named-role discovery paths (Exa criteria for "BD/publishing/founder" + role pages)
vs a paid people-data adapter, each with verified 2026 cost + coverage + ToS. Ally picks; **then** wire
the chosen path into `Merge All Data`/`Classify Email` behind the existing waterfall.
**Acceptance test (post-decision):** on a fresh run, `contact_name` real-rate on A/B rows rises from
~7% to an agreed target; named contacts carry a role.
**Guardrails:** no LinkedIn scraping (ToS). No paid dependency without explicit Ally go. Keep it a
fallback behind free Steam/Exa, not a replacement.
**Docs:** decision logged in the enrichment DRAFT + STATE.md; aDNA.

---

### T11 — Make scoring actually drive prioritisation `[Impact M · Effort M–L · decision-gated]`
**Fixes:** D6 (+ critique D2) · **Area:** ① `Pre-Score`/`Select & Split` + `mapper` · **Depends:** Ally
**Verified current state:** tier is set in `Pre-Score` from free Steam signals **before** the LLM;
`fit_score` is emitted after and used only as a UI proxy (`mapper.ts` maps `value=fit_score,
match=pre_score`). Leads are ranked by multiplayer flags, not fit.
**Target / DoD (per critique D2):** a logged two-sided score
`fit = w1·value_to_client + w2·prospect_match` with persisted `dimension_breakdown` + rationale, and a
`gate_b_threshold`. Decide whether fit re-ranks within the free-Steam pre-filter or replaces the tier
cut. Defaults `w1=w2=0.5`; surface the breakdown in the provenance panel.
**Acceptance test:** new rows carry a non-flat `fit_score` that differentiates A/B/C, a stored
breakdown, and tier order changes vs pre-score-only on a sample.
**Guardrails:** keep the cheap pre-score as the spend gate (don't LLM-score everything — free cap).
Weights as config, not hardcode (modular).
**Docs:** ARCHITECTURE.md §4①; aDNA.

---

### T12 — Publisher-entity dedup `[Impact L · Effort M]`
**Fixes:** D10 · **Area:** ① `Pick N`/`Select & Split` + exclusion · **Depends:** none
**Verified current state:** 11 publishers appear under multiple `steam_app_id`s; exclusion is keyed on
app-id, so the same publisher reached via a different game can be re-processed/pitched twice.
**Target / DoD:** add a stable publisher key (normalised name or domain); dedup on it in `Select &
Split` and add it to the exclusion filter so a publisher already drafted/contacted via another game is
skipped.
**Acceptance test:** `SELECT publisher_name, count(*) FROM publishers GROUP BY 1 HAVING count(*)>1;`
does not grow on the next run; no publisher gets a second draft.
**Guardrails:** don't merge existing rows destructively without Ally go; start by preventing new dupes.
**Docs:** ARCHITECTURE.md §4①/§6; aDNA.

---

### T13 — Resolve `cag_context` vs `cag_composed` naming drift `[Impact L · Effort S]`
**Fixes:** D12 · **Area:** ④ + tables · **Depends:** none
**Verified current state (read live 2026-06-23):** ④'s description says it writes `cag_composed`; the
node actually writes `cag_context`. The engine **confirmed** reads `cag_context` (`Get Drafted IDs`:
`SELECT cag_block FROM cag_context ORDER BY updated_at DESC LIMIT 1`; `Apply CAG from DB` swaps from
`cag_context`). `cag_composed` is a **separate legacy table with a different schema** (1 row, **no
`cag_block` column**) — not the brief the engine reads.
**Target / DoD:** keep `cag_context` (the live read path), fix ④'s description to say `cag_context`,
and retire `cag_composed` once confirmed unused.
**Acceptance test:** one CAG table referenced everywhere; ④ description matches; engine still reads the
live brief (regression-check a run).
**Guardrails:** confirm `cag_composed` truly unused before dropping (check all workflows + Edge fns).
**Docs:** SPEC.md §4 + ARCHITECTURE.md §6; aDNA.

---

## 4. Verification status — every task checked against the live system (2026-06-23)

Each task's **premise** and **fix target** were re-checked against the running n8n/Supabase/Edge
before publishing. One correction was made in the process (T1).

| Task | Premise verified by | Result |
|------|---------------------|--------|
| **T1** | ① `Pick Best LLM Response` + `Build Final Record` node bodies (live) + A/B body-rate SQL | ✅ **Corrected** — Pick Best *already* parses tolerantly; real cause is empty-`draft_body` passing the guard + fallback still stamping `draft`. Task rewritten. |
| **T2** | ⑤ `Apply Writes` SQL (live): `ON CONFLICT DO UPDATE` + blanket `DELETE`, no `intake_suggestion` write | ✅ Premise exact |
| **T3** | ④ `Compose CAG` (live) + `cag_context` SQL (len 2249, generic header) + engine reads `cag_context` (confirmed in `Get Drafted IDs`/`Apply CAG from DB`) | ✅ Premise exact |
| **T4** | ⑤ `OR Model`=`openai/gpt-4o-mini`, `OR Fallback`=non-`:free` Llama; `Prep` free pick unused | ✅ Premise exact |
| **T5** | `get_advisors(security)` live: anon-executable `rls_auto_enable`, RLS-no-policy, mutable search_path | ✅ Premise exact |
| **T6** | ③ `Detect Reply` jsCode (live): any `From`≠inbox ⇒ replied | ✅ Premise exact |
| **T7** | ② nodes (live): plain-text, linear/no error branch, no footer; cols `outreach_thread_id`/`outreach_message_id` exist | ✅ Premise exact |
| **T8** | `leads/index.ts` PATCH (code): 6 reason codes → `reject_reason_code`+`reject_reason`+`reviewed_at`; col exists; 0 rows used | ✅ Premise exact |
| **T9** | `Prepare LLM Items` rubric prompt + `Build Final Record` persistence (live) | ✅ Premise exact (verification task) |
| **T10** | DB: 87% `steam_api` emails, 7% named; `how/lead_contact_enrichment_options_DRAFT.md` open decision exists | ✅ Premise exact |
| **T11** | Tier set pre-LLM (`_outreach_tier` from `Pre-Score`); `mapper.ts` proxy comment | ✅ Premise exact |
| **T12** | DB: 11 dup publisher groups; `Get Drafted IDs` exclusion keyed on drafted `steam_app_id`s | ✅ Premise exact |
| **T13** | `cag_context` vs `cag_composed` (live): engine reads `cag_context`; `cag_composed` legacy, no `cag_block` col | ✅ Premise exact (refined) |

## 5. Coverage check (every defect has an owner)

D1→T1 · D2→T3 · D3→T2 · D4→T4 · D5→T6 · D6→T11 · D7→T7 · D8→T10 · D9→T5 · D10→T12 · D11→T8 ·
D12→T13. Plus T9 verifies the D1 fix + the evidence-rubric correction at volume.

**Sources:** `how/poc_status_review.md` (architecture-verified 2026-06-23) and its §7 source list.
