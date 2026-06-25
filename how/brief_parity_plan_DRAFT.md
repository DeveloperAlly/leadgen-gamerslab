# Brief Parity Plan (poc_fix_backlog T2 + T3, spec Wave 0) - DRAFT

**Status:** DRAFT, PRE-GATE. This is a deploy-ready plan, not a deploy. No engine change is authorised by
this doc (CLAUDE.md non-negotiable #1, STATE.md). The revised SQL/merge logic below is written to be
pasted into the live nodes verbatim at a future build gate, after Ally's explicit yes (doctrine #10).

**Created:** 2026-06-24 - **Owner:** Ally - **Author:** Claude (Cowork subagent, Lane A11)
**Scope:** the two brief-parity backlog tasks, in dependency order: **T2 first** (make ingestion
non-destructive), **then T3** (restore cag_context brief parity). T3 depends on T2: if ingestion is still
destructive, any restored brief is silently reverted on the next re-ingest (poc_fix_backlog T3 guardrail).

**Reads from / extends:**
- `how/poc_fix_backlog.md` T2 (D3) + T3 (D2), and its §0 "do it correctly" contract.
- `how/prospect_dossier_build_spec_DRAFT.md` §6 Wave 0 (this is the "T2 -> T3 brief parity" foundations item).
- `gamerslab-poc/docs/cag-block.md` (the canonical rich brief = the parity target).
- `gamerslab-poc/ARCHITECTURE.md` §4 (workflow spine), §6 (writer matrix), §10 (doc-update rule).

**Live state verified READ-ONLY for this plan (2026-06-24):**
- n8n `ertFL6pi4wlJ3lMJ` (Source Ingestion) node **Apply Writes** - confirmed `INSERT ... ON CONFLICT DO
  UPDATE` then a blanket `DELETE ... WHERE question_key NOT IN (derived)`; writes **no** `intake_suggestion`.
- n8n `G5Mkf1KUmr6LHJdV` (Context Builder) node **Compose CAG** - confirmed generic scaffold; reads 13ish
  keys; no banned-phrase list, no one-stat rule, no named-CBO CTA, no per-phase pitch angles baked in.
- Supabase `ccmwksmgoisijvyovgko`: `intake_answer` unique index is `(tenant_id, question_key)`;
  `intake_suggestion` real columns are
  `id, tenant_id, question_key, suggested_answer, source_id, source_label, confidence, quote, status
  (default 'pending'), created_at` (PK on `id`, FK `source_id -> source(id)`, no other unique constraint);
  live `cag_context.cag_block` length is **1722** chars (the thinned generic brief), vs the ~5,800-char rich
  `cag-block.md`.

> Deploy guardrails that apply to BOTH tasks (poc_fix_backlog §0): verify the live node again at build time
> before editing (it may have moved), make the minimal change, keep it free-tier, run the acceptance test
> and paste the real result, update `ARCHITECTURE.md` §4/§6 + §9 date in the same change, mirror to aDNA.
> Permission-first: both tasks change write semantics, so confirm with Ally before any deploy.

---

## Part 1 - T2: make Apply Writes non-destructive

### 1.1 The defect (verified)

The live **Apply Writes** node (`537d9fa2-...`, type `n8n-nodes-base.postgres`) runs this single query
against the base64 payload built by **Build Writes**:

```sql
-- LIVE (destructive) - DO NOT KEEP
WITH p AS (SELECT convert_from(decode($1,'base64'),'UTF8')::jsonb AS j),
     t AS (SELECT (j->>'tenant_id')::uuid AS tid, j->'answers' AS ans FROM p),
     up AS (
       INSERT INTO intake_answer (tenant_id, question_key, answer)
       SELECT t.tid, kv.key, kv.value FROM t, jsonb_each_text(t.ans) AS kv
       ON CONFLICT (tenant_id, question_key) DO UPDATE
         SET answer=EXCLUDED.answer, updated_at=now()
       RETURNING question_key
     )
DELETE FROM intake_answer
WHERE tenant_id=(SELECT tid FROM t)
  AND question_key NOT IN (SELECT question_key FROM up)
```

Three harms, all confirmed against the node:
1. **Overwrite of human answers.** `ON CONFLICT DO UPDATE SET answer=EXCLUDED.answer` clobbers a
   human-entered `intake_answer` with a free model's read of GamersLab's own website.
2. **Blanket delete.** The trailing `DELETE ... WHERE question_key NOT IN (derived)` wipes every key the
   model did not happen to emit this run. A sparse derive silently destroys the bank.
3. **No suggestion path.** Nothing is ever written to `intake_suggestion`, so a human never gets to
   review a divergent derived value. This contradicts the documented contract in `ARCHITECTURE.md §4(5)`
   ("ADD where empty / SUGGEST where differs") and the node's own description string.

### 1.2 The safe contract (spec + backlog T2 DoD)

- **ADD** a derived answer to `intake_answer` **only where the key is empty or absent** (never touch a key
  that already holds a non-empty human value).
- **SUGGEST** into `intake_suggestion` when a derived answer **differs** from an existing non-empty answer.
  Surface for human review; never overwrite.
- **REMOVE the blanket `DELETE`** entirely. A re-ingest must never delete an existing intake answer.

Note on "empty": the column default is `''::text` and is `NOT NULL`, so "empty" means
`answer IS NULL OR btrim(answer) = ''`. The ADD branch must treat a blank-string row as fillable.

### 1.3 Revised SQL (paste-ready - the only change to the node)

This is a drop-in replacement for the Apply Writes query. It keeps the existing base64 CTE pattern and the
`queryReplacement` parameter (`={{ $json.payload_b64 }}`) unchanged - only the merge logic changes
(poc_fix_backlog T2 guardrail: "keep the base64-CTE pattern; just change the merge logic").

```sql
-- REVISED (non-destructive). Drop-in for Apply Writes ($1 = base64 payload, unchanged).
-- Contract: ADD only where empty/absent; SUGGEST on divergence; NO delete.
WITH p AS (
  SELECT convert_from(decode($1,'base64'),'UTF8')::jsonb AS j
),
t AS (
  SELECT (j->>'tenant_id')::uuid AS tid, j->'answers' AS ans FROM p
),
-- one row per derived (key, value)
d AS (
  SELECT t.tid AS tenant_id, kv.key AS question_key, btrim(kv.value) AS derived
  FROM t, jsonb_each_text(t.ans) AS kv
  WHERE btrim(kv.value) <> ''
),
-- join each derived key to the current stored answer (if any)
j AS (
  SELECT d.tenant_id, d.question_key, d.derived,
         ia.answer AS current_answer,
         (ia.question_key IS NULL OR btrim(COALESCE(ia.answer,'')) = '') AS is_empty
  FROM d
  LEFT JOIN intake_answer ia
    ON ia.tenant_id = d.tenant_id AND ia.question_key = d.question_key
),
-- ADD: insert only where the key is absent or its stored answer is blank.
-- ON CONFLICT DO NOTHING protects a human value written between the read and this write (race-safe);
-- it does NOT overwrite, because we only INSERT rows we believe are empty.
added AS (
  INSERT INTO intake_answer (tenant_id, question_key, answer)
  SELECT tenant_id, question_key, derived FROM j WHERE is_empty
  ON CONFLICT (tenant_id, question_key) DO NOTHING
  RETURNING question_key
),
-- SUGGEST: where a non-empty answer already exists AND the derived value differs, queue a suggestion.
-- De-dupe against an already-pending suggestion for the same (tenant, key, value) so re-ingest is idempotent.
suggested AS (
  INSERT INTO intake_suggestion
    (tenant_id, question_key, suggested_answer, source_label, confidence, status)
  SELECT j.tenant_id, j.question_key, j.derived,
         'source-ingest (auto-derived)', 'derived', 'pending'
  FROM j
  WHERE NOT j.is_empty
    AND btrim(j.derived) <> btrim(j.current_answer)
    AND NOT EXISTS (
      SELECT 1 FROM intake_suggestion s
      WHERE s.tenant_id = j.tenant_id
        AND s.question_key = j.question_key
        AND s.status = 'pending'
        AND btrim(s.suggested_answer) = btrim(j.derived)
    )
  RETURNING question_key
)
SELECT
  (SELECT count(*) FROM added)     AS keys_added,
  (SELECT count(*) FROM suggested) AS suggestions_created;
```

Why these choices, against the real schema:
- `intake_suggestion` has **no** unique constraint usable for `ON CONFLICT`, so idempotency is done with the
  `NOT EXISTS` guard on `(tenant_id, question_key, status='pending', suggested_answer)` rather than an
  upsert. Verified: only `intake_suggestion_pkey (id)` + the `source_id` FK exist.
- `source_label` is the human-readable provenance field that exists on the table; `confidence` is free text
  (set to `'derived'`); `status` defaults to `'pending'` but is set explicitly for clarity. `source_id` is
  left null here because Build Writes collapses all sources into one combined derive (the `Collapse` node),
  so there is no single owning `source` row. If per-source attribution is wanted later, Build Writes would
  need to carry a `source_id` into the payload - out of scope for T2.
- The blanket `DELETE` is gone. Keys the model did not emit this run are simply left as they are.
- The final `SELECT` returns counts so the run is observable (and feeds the acceptance test below).

### 1.4 Optional companion change (Build Writes) - flag, do not bundle

`Build Writes` currently throws `derivation too sparse (...) - keeping existing bank` when fewer than 3 keys
parse. With the destructive DELETE removed, that guard is **less** critical (a sparse derive can no longer
wipe the bank), but it is harmless and should stay. **Do not** change Build Writes as part of T2; it is a
separate node and bundling it violates the one-task-permission-first rule. Note it here only so a future
agent does not "tidy" both at once.

### 1.5 Acceptance test (run at build time, paste the real result)

Per poc_fix_backlog T2:

```sql
-- 1. Seed a known HUMAN answer for one key (pick a key the website will imply differently).
INSERT INTO intake_answer (tenant_id, question_key, answer)
VALUES ((SELECT id FROM tenant LIMIT 1), 'a5_cta', 'HUMAN-OWNED CTA - do not overwrite')
ON CONFLICT (tenant_id, question_key) DO UPDATE SET answer=EXCLUDED.answer, updated_at=now();

-- 2. Queue a source whose text implies a DIFFERENT a5_cta, then run workflow (5) (Source Ingestion).

-- 3. Assert the human answer is UNCHANGED and a suggestion appeared.
SELECT answer FROM intake_answer
WHERE tenant_id=(SELECT id FROM tenant LIMIT 1) AND question_key='a5_cta';
-- expect: 'HUMAN-OWNED CTA - do not overwrite'  (unchanged)

SELECT question_key, suggested_answer, status FROM intake_suggestion
WHERE tenant_id=(SELECT id FROM tenant LIMIT 1) AND question_key='a5_cta'
ORDER BY created_at DESC LIMIT 3;
-- expect: at least one 'pending' row whose suggested_answer = the divergent derived CTA
```

Pass criteria: the human `intake_answer` row is byte-for-byte unchanged; `SELECT count(*) FROM
intake_suggestion` has increased; and an empty key the model derived a value for was ADDED (spot-check one).

### 1.6 Modularity check (mandate #7)

No GamersLab noun enters engine logic: the merge is pure schema logic over `intake_answer` /
`intake_suggestion`, identical for any tenant. The only tenant-specific thing is the data in the bank.
Passes.

---

## Part 2 - T3: restore cag_context brief parity

### 2.1 The defect (verified)

The live **Compose CAG** node (`c41c9b9a-...`) builds a generic `=== BUSINESS BRIEF ===` from ~13 intake
keys via a fixed `parts[]` scaffold and writes it to `cag_context`. The engine's `Apply CAG from DB` swaps
the rich `=== GAMERSLAB PRODUCT BRIEF ===` (~5,800 chars, in `cag-block.md`) out for this thinner block
(live length **1722**). Four tuned guardrails are lost in the swap:

1. **Banned-phrase list** ("synergy", "circle back", "I hope this email finds you well", "I came across
   your game", blockchain-unless-Web3, etc.).
2. **The one-stat rule** plus the companion format rules ("use only these numbers", "one stat max in the
   body", "<= 130 words", "one CTA only", "never attach the deck, link only in PS").
3. **The named-CBO CTA** ("Would a 20-min call with our CBO Ryan Waller be worth your time?" and "mention
   Ryan Waller, 50+ games published, when addressing publishers").
4. **The two phase-based pitch angles** (PITCH A established/mature vs PITCH B new/upcoming, each with its
   own hook, stat, and lead app).

The Compose CAG scaffold DOES already have section slots that map to all four (`a4_banned`,
`a3_numbers`, `a5_cta`, `b3_pitch_angles`) - the loss is in the **intake bank content**, which is thin and
generic (verified: `a3_numbers` len 188, `a5_cta` len 108, and `a4_banned` / `b3_pitch_angles` keys are
absent from the live bank). So Compose CAG is composing faithfully from a hollow bank.

### 2.2 The decision Ally must make (T3 requires picking one)

poc_fix_backlog T3 forces a choice. Recommendation stated with reasoning, not a menu:

**Recommended: Option (a) - brief-as-source-of-truth (restore the rich content INTO the intake bank).**

Rationale: it keeps the brief **data-driven and modular** (mandate #7). The engine and Compose CAG stay
generic; the GamersLab specifics live in `intake_answer` where the in-app Business-context editor can tune
them, and where T2's now-safe ingestion will never clobber them. Option (b) (pin a static rich
`cag_context` and disable recompose) re-couples the brief to a hand-maintained DB row and a disabled code
path; it is faster but it is the less modular, more brittle choice and it fights the intake architecture.

Pick (a) unless Ally explicitly wants the static pin. The rest of this part assumes (a).

### 2.3 Mapping the rich brief to intake keys (the actual restore work)

Every section of `cag-block.md` maps to a keyed `intake_answer`. The Compose CAG scaffold already reads
these keys; the work is to write the rich content into them. Keys that need enriching or creating:

| cag-block.md section | intake key (Compose CAG reads it) | live state | action |
|---|---|---|---|
| REAL NUMBERS (use these, no others) | `a3_numbers` | thin (len 188) | enrich to the full stat set + the explicit "use only these / one stat in body" rule |
| TWO PITCH ANGLES (by phase) | `b3_pitch_angles` | **absent** | create: PITCH A (established) + PITCH B (new/upcoming), each hook + stat + lead app |
| BANNED PHRASES & FALSE CLAIMS | `a4_banned` | **absent** | create: full banned list + format rules (<=130 words, one CTA, no deck attach, link in PS) |
| CONTACT & CTA (named CBO) | `a5_cta` | thin (len 108) | enrich: the soft-question CTAs incl. "20-min call with our CBO Ryan Waller", PS-line rule |
| CURRENT GAMES / peers | `a3_peers` | thin (len 83) | enrich: the 6 catalogue peers + genre mapping (feeds Slot 5 peer match later) |
| TEAM / CREDIBILITY | `a3_team` | thin (len 75) | enrich: Eric / Ryan / Joon + "mention Ryan Waller to publishers" |
| OBJECTIONS to pre-dissolve | `a4_objections` | **absent** | create: the 3 objections + "pick ONE, do not list all three" |
| WHAT IT IS / problem / SDK / ICP | `a1_oneliner`, `a2_problem`, `a1_sdk`, `b1_icp`, `b1_fit_strong`, `b2_poorfit` | present, mostly thin | enrich to brief depth where they drive the draft |

**How to write them (modular, T3 guardrail "do not re-bake GamersLab nouns into engine code"):** the
content goes into `intake_answer` rows (data), not into Compose CAG's `parts[]` (code). Two viable
mechanisms, both keep the nouns in data:
- **Preferred:** paste each section's text into the in-app **Business context** editor
  (`PUT /functions/v1/context` -> writes `intake_answer`, re-triggers Context Builder). Human-owned,
  auditable, and exactly the mutation path Option (a) wants to be canonical.
- **Acceptable for a one-shot seed:** a single SQL upsert of the rich content (below), then verify recompose.
  Use only at build time, permission-first.

```sql
-- One-shot SEED of the rich brief content into the bank (build-time only, Option (a)).
-- Illustrative rows; full text comes verbatim from gamerslab-poc/docs/cag-block.md sections.
-- This is an UPSERT (safe to re-run); it does NOT delete other keys.
INSERT INTO intake_answer (tenant_id, question_key, answer) VALUES
  ((SELECT id FROM tenant LIMIT 1), 'a4_banned',
   'NEVER say: synergy, circle back, touch base, game-changing, seamless, at scale, '
   || '"I hope this email finds you well", "I came across your game", "I wanted to reach out", '
   || '"I''d love to connect", revolutionize, disrupt, paradigm. No numbers not in KEY NUMBERS. '
   || 'No blockchain unless the publisher works in Web3. Body <= 130 words. One stat in the body, max. '
   || 'One CTA only - a single soft question. Never attach the deck; link only in the PS.'),
  ((SELECT id FROM tenant LIMIT 1), 'b3_pitch_angles',
   'PITCH A (ESTABLISHED, mature/growth, past peak CCU): hook = your community is already building '
   || 'workarounds with screen scrapers; GamersLab makes that official plus an analytics layer. '
   || 'Stat: +31% revenue after year 5, +115% CCU after year 5. Lead app: Grudge Goblin (multiplayer) '
   || 'or Tournament Garden (competitive). Frame: revitalization without engineering. '
   || 'PITCH B (NEW/UPCOMING, pre-launch / early access / launched < 6 months): hook = launch with a '
   || 'community data layer already in place. Stat: +20% console players after year 1, +115% CCU after '
   || 'year 5. Lead app: Tournament Garden. Frame: launch amplification.'),
  ((SELECT id FROM tenant LIMIT 1), 'a5_cta',
   'ONE soft question only. Never a link dump, never "let me know if interested". '
   || 'Best CTAs: "Would Grudge Goblin be a fit for [game]''s player community?"; '
   || '"Is the team thinking about companion apps for [game]''s launch?"; '
   || '"Would a 20-min call with our CBO Ryan Waller be worth your time?". '
   || 'Always PS: full integration docs and examples - https://www.gamerslab.gg/early-access')
ON CONFLICT (tenant_id, question_key) DO UPDATE
  SET answer = EXCLUDED.answer, updated_at = now();
-- (repeat for a3_numbers, a4_objections, a3_peers, a3_team, and any thin a1_/b1_/b2_ key)
```

> Note: this seed UPSERT overwrites those keys at the moment of restore. That is intentional and human-run
> (Ally seeding the canonical brief). It is NOT the same as the automated ingestion overwrite that T2
> removes - T2 stops the **free model** silently clobbering; this is a deliberate human restore. After this
> seed, T2's safe Apply Writes will protect these values on every subsequent re-ingest.

### 2.4 Trigger the recompose

After the bank is enriched, the Context Builder must recompose `cag_context`. It fires automatically when
the Business-context editor saves (the `PUT /functions/v1/context` path posts to `/webhook/context-build`).
For the SQL seed path, fire it manually (read-only to engine logic, just runs Compose CAG):

```
POST https://n8n-j39n.sliplane.app/webhook/context-build   body: {"trigger":"brief-parity-restore"}
```

Compose CAG then rebuilds `cag_block` from the now-rich bank and `Trim cag_context` keeps only the latest
row, which `Get Drafted IDs` / `Apply CAG from DB` read on the next discovery run.

### 2.5 Optional scaffold tightening (only if content alone misses a rule)

Compose CAG's scaffold maps numbers, pitch angles, banned, CTA - so restoring content should restore
parity without code change. If a verbatim guardrail still needs to be guaranteed present regardless of bank
content (e.g. the hard "<= 130 words / one stat / one CTA" instruction), add a fixed **format-rules footer**
to `parts[]` that is tenant-agnostic instruction text (no GamersLab noun), e.g.:

```
'--- DRAFTING RULES (always apply) ---', '',
'Body <= 130 words. Use at most ONE number from KEY NUMBERS in the body. One CTA only (a single soft '
+ 'question). Do not use any BANNED CLAIMS. Never attach files; put any link in a PS.', '',
```

This keeps the *instruction* generic (engine-safe) while the *facts* (which numbers, which CTA) stay in the
bank. Decide at build time whether content-only is enough or the footer is wanted; default content-only.

### 2.6 Acceptance test (run at build time, paste the real result)

Per poc_fix_backlog T3:

```sql
SELECT length(cag_block) AS len FROM cag_context ORDER BY updated_at DESC LIMIT 1;
-- expect: length back near the rich brief's coverage (was 1722; rich source ~5,800)

SELECT
  (cag_block ILIKE '%circle back%' OR cag_block ILIKE '%i hope this email finds you well%') AS has_banned_list,
  (cag_block ILIKE '%130 words%' OR cag_block ILIKE '%one stat%' OR cag_block ILIKE '%use only these%') AS has_one_stat_rule,
  (cag_block ILIKE '%ryan waller%') AS has_named_cbo_cta,
  (cag_block ILIKE '%pitch a%' AND cag_block ILIKE '%pitch b%') AS has_both_pitch_angles
FROM cag_context ORDER BY updated_at DESC LIMIT 1;
-- expect: all four columns = true
```

Then run one discovery run and confirm a fresh A-tier draft leads with the correct app + one stat + one
CTA and contains no banned phrase (manual read of the new `draft_body`).

### 2.7 Dependency + revert guard

T3 must land **after** T2. If T3 ships while ingestion is still destructive, the next `source-ingest` run
re-derives a thin generic bank and the blanket DELETE removes the rich keys, silently reverting parity
(poc_fix_backlog T3 guardrail). Sequence is non-negotiable: T2 deploy + acceptance pass -> T3 restore +
acceptance pass.

---

## Part 3 - Parity checklist (single gate for "brief parity restored")

Tick every box before declaring T2+T3 done. Each maps to a verifiable check above.

**T2 - ingestion is non-destructive**
- [ ] Apply Writes query replaced with the §1.3 non-destructive version (blanket DELETE removed).
- [ ] ADD branch writes a derived answer only where the key is empty/absent (blank-string treated as empty).
- [ ] SUGGEST branch writes a `pending` `intake_suggestion` on divergence, using real columns
      (`suggested_answer`, `source_label`, `confidence`, `status`); idempotent via the `NOT EXISTS` guard.
- [ ] Acceptance §1.5: seeded human `a5_cta` unchanged after a divergent re-ingest;
      `intake_suggestion` count increased; an empty key was ADDED.
- [ ] `ARCHITECTURE.md` §4(5) corrected to describe ADD/SUGGEST/no-delete; §6 writer matrix notes the new
      `intake_suggestion` writer; §9 date bumped. aDNA mirrored (`gamers-lab`, `lead-gen`).

**T3 - brief parity restored (Option (a) recommended)**
- [ ] Ally has chosen Option (a) brief-as-source-of-truth (or explicitly (b) static pin) and it is recorded.
- [ ] Rich content seeded into the intake bank for: `a3_numbers`, `b3_pitch_angles`, `a4_banned`,
      `a5_cta`, `a3_peers`, `a3_team`, `a4_objections`, and thin `a1_*` / `b1_*` / `b2_*` keys (§2.3 map).
- [ ] Context Builder recompose fired (editor save or manual `POST /webhook/context-build`).
- [ ] Acceptance §2.6: `length(cag_block)` near rich coverage; `has_banned_list`, `has_one_stat_rule`,
      `has_named_cbo_cta`, `has_both_pitch_angles` all true.
- [ ] One discovery run: a fresh A-tier draft leads with correct app + one stat + one CTA, zero banned
      phrases.
- [ ] `ARCHITECTURE.md` §4(4)/§5 context loop updated; chosen option (a/b) recorded in the doc + STATE.md;
      aDNA mirrored.

**Cross-cutting (both)**
- [ ] No GamersLab noun baked into engine/Compose CAG/Apply Writes **code** - all client specifics live in
      `intake_answer` data (mandate #7).
- [ ] Free-tier only; no paid model or paid dependency added (doctrine #8).
- [ ] Sequence honoured: T2 deployed + verified BEFORE T3 restore (else T3 silently reverts).
- [ ] Outreach copy rule intact: no em dash in any restored CTA / brief text (the seed text above uses none).

---

## Part 4 - Provenance note (spec discipline)

This plan does not itself fill prospect dossier slots, so the provenance-quad rule
(`{value, source_url, date, evidence_strength}`) does not directly apply to its output. Where it touches the
dossier model: a future `intake_suggestion` row carries `source_label` and `created_at`, which is the bank's
equivalent of `{source, date}` for a derived suggestion - a human reviewer sees where a suggestion came from
and when before promoting it. The T2 SUGGEST branch is written to preserve that, not discard it.

---

*DRAFT, pre-gate. No build authorised. Per CLAUDE.md: business process before technical, verify before
assert, modular mandate, free-for-Ally, permission-first. All live state cited above was read READ-ONLY on
2026-06-24; the SQL is paste-ready for a future build gate, not applied.*
