# v10 live edits — Pipeline Critique v2, Tier 1 (POC)

Record of changes applied to the **live** n8n workflow `MouIeDmDAAHKIpDn`
(`GamersLab Publisher Outreach v10`, n8n-j39n.sliplane.app) and the live Supabase
project `ccmwksmgoisijvyovgko` (Gamers Lab Lead Gen) on **2026-06-22**, implementing the
Tier 1 "do first" items from `how/pipeline_critique_v2.md` §9.

> The repo's `gamerslab-outreach-v9.json` is the **v9 (Serper-era)** export and is stale
> vs the live v10 graph. These files capture the v10 edits; they are not a full v10 export.

## Applied live

### DB migration (Supabase `publishers`, additive/safe)
Migration `tier1_evidence_riskflags_decay_rejectcode`:
- `evidence_strength` (explicit|inferred|none), `evidence_quote`, `evidence_sources` (jsonb),
  `evidence_as_of` (date) — **D1** painpoint evidence rubric.
- `evidence_decay_weight` (numeric) — **N9** recency decay weight.
- `risk_flags` (jsonb) — **N5** anti-fit flags (flag, never suppress).
- `reject_reason_code` (text) — **N1** structured Gate-B rejection reason.
- Indexes on `evidence_strength`, `reject_reason_code`.

### n8n workflow

**I1 — SerpAPI is now a real Exa fallback** (was orphaned: output wired, no input).
- `Exa: Combined Search` → `options.response.response.neverError = true` (a 429/5xx returns a
  body with no `results` instead of throwing).
- New IF node **`Exa Has Results?`** after Exa: `({{ ($json.results||[]).length }}) > 0`.
  - true  → `Normalise Search` (unchanged path)
  - false → `SerpAPI: Fallback Search` → `Normalise Search`
- `SerpAPI: Fallback Search` query now reads the candidate from the batch
  (`$('Batch for Web Search').item.json.*`) — post-Exa `$json` is the response, not the candidate.

**I6 — counts/venue parameterised** (were hardcoded magic numbers).
- `Pick 100 Publishers`: `TARGET_COUNT` from webhook body `target_count`, default 100
  (schedule runs have no body → default).
- `Select & Split`: `DRAFT_BUDGET` (default 35) and `SCORE_FLOOR` (default 10) from webhook
  body `draft_budget` / `score_floor`.
- Discovery webhook body now accepts: `{ run_id, target_count, draft_budget, score_floor }`.

**I2 / T3 — already implemented in v10; not a real gap.** The critique (written from wiring
only) flagged a multi-model fan-out. The live v10 does **not** fan out: `Select & Split`
already gates spend (`SCORE_FLOOR`, `DRAFT_BUDGET`, excludes drafted, best-first),
`Prepare LLM Items` calls **one** model per lead, and C/skip tiers get a cheap extract-only
prompt. The only residue was the misleading node name — renamed
`LLM: Intel + Draft (All Models)` → **`LLM: Intel + Draft`**.

**D1 / N5 / N9 — evidence/flags/decay wiring** (`build-final-record.APPLIED.js`).
`Build Final Record` now emits `evidence_strength`, `evidence_quote`, `evidence_sources`,
`evidence_as_of`, `evidence_decay_weight`, `risk_flags`. It **prefers LLM-emitted** fields and
**falls back to heuristics** from existing intel (founder_quote/pain_signal → strength+quote+source;
sunset/zero-playtime → an `inactive` risk flag). N9 decay = `exp(-age_days/180)`, null when undated.
JSONB fields are `JSON.stringify`-ed for the Postgres node.

`Upsert to Supabase` uses `autoMapInputData`, which maps incoming keys to columns by name at
runtime — the new fields persist because the columns now exist. (If a future run shows them
null, refresh the node's cached column list in the UI; the cached schema was not edited here.)

## Prompt upgrade — APPLIED & VERIFIED LIVE (`prepare-llm-items.PROMPT-UPGRADE.js`)

Upgrades the `Prepare LLM Items` node so the **LLM itself** emits the D1 rubric
(`evidence_strength`/`quote`/`sources`/`evidence_as_of`) and N5 `risk_flags` with real dated
sources — elevating D1/N5 from heuristic to model-sourced and giving N9 actual dates to decay.

**Applied** via the n8n MCP (`setNodeParameter` on `Prepare LLM Items`), verified by read-back-diff
(byte-identical to target). Two changes vs the prior node, both in the TASK/JSON section only:
1. Expanded the `TASK:` line with a D1 EVIDENCE RUBRIC + N5 ANTI-FIT instruction.
2. Added the 5 evidence/risk fields to the returned JSON shape.

**Compatible with the CAG-from-DB integration** (added concurrently by another agent): a new
`Apply CAG from DB` node sits `Prepare LLM Items → Apply CAG from DB → LLM` and regex-swaps only
the `=== GAMERSLAB PRODUCT BRIEF === … === END GAMERSLAB BRIEF ===` block with the editable
`cag_context` value. My additions are outside that block, so the baked brief (now a fallback) and
the markers the regex depends on are preserved. Verified post-edit: brief markers intact (2),
`Apply CAG from DB` present, wiring unchanged.

## UI / Edge (critique v2 · D1 / N5 / N1)

Code changes (in repo, typechecked via `tsc --noEmit`, UI verified in the live preview):
- **Contract** (`poc/ui/src/data/types.ts` + `gamerslab-poc/supabase/functions/_shared/types.ts`,
  kept in lockstep): `Lead.evidenceStrength` (D1), `Lead.riskFlags` (N5), `RiskFlag`,
  `RejectReasonCode` (N1).
- **Edge `_shared/mapper.ts`**: reads the new columns; `evidenceOf` leads with the structured
  D1 quote/source/date; `toLead` emits `evidenceStrength` + `riskFlags`.
- **Edge `leads/index.ts`**: PATCH accepts `{ status, reasonCode, reason }` and writes
  `reject_reason_code` + `reject_reason` + `reviewed_at` on reject (N1).
- **UI `LeadRow.tsx`**: D1 evidence-strength badge, N5 risk-flag warning chips, and the N1
  "Why reject?" reason picker (verified live — opens on reject, all 6 reason chips render).
- **UI `leadService.ts` / `PipelineProvider.tsx` / `GateBScreen.tsx`**: thread `reasonCode`
  through `setLeadStatus`.
- Sample D1/N5 data added to `seed.ts` (fixtures mode) for demo.

**Edge redeploy — DONE & VERIFIED.** `leads` is deployed at **v3** (`verify_jwt:false`) as a
single self-contained file (`leads.DEPLOYED-bundle.ts`, `_shared` inlined to avoid relative-path
resolution on the MCP deploy). Verified live: `GET /leads` → 200 with `riskFlags` on every lead;
the N1 PATCH round-trip persisted `reject_reason_code` + `reject_reason` + `reviewed_at` (test row
restored). Existing rows show no D1 badge until re-enriched by a discovery run — correct, not a bug.

> NOTE: the deployed v3 is a **bundle**; the repo source of truth stays the multi-file
> `leads/index.ts` + `_shared/*`. Redeploying from repo via CLI produces the equivalent.
> Optional follow-up: `discovery` + `outreach` still bundle the pre-edit mapper (v2) —
> non-breaking; redeploy them the same way to surface D1/N5 on their payloads too.

## Verification
- I1 wiring re-read from live: `Batch→Exa→Exa Has Results?→{Normalise | SerpAPI→Normalise}`. ✓
- `Build Final Record` live diff vs intended: identical. ✓
- End-to-end column persistence confirms on the next discovery run (schedule: daily 09:00).

## Contact enrichment lift + WHOIS removal — APPLIED & PUBLISHED LIVE (2026-06-23)

Lifts socials/contact coverage on the cards (founder/contact/socials were resolving ~5-17%).
Premise check first: the `how/lead_contact_enrichment_options_DRAFT.md` proposal of press-kit
`data.xml` parsing + per-site /about scraping was **empirically refuted** (0/8 real studios had a
parseable data.xml — modern sites are SPAs returning HTML shells; /about scrape hit 2/8 and added
3-7s timeout latency). So that path was **not** shipped. What shipped:

- **WHOIS removed.** Deleted the `WHOIS Lookup` node (0% real registrants by law: ICANN
  Registration Data Policy / GDPR redaction). Rewired `Normalise Search → Fetch Publisher Website`.
  `Merge All Data` no longer references the node; `whois_registrant_*` emitted as `''` so
  `Build Final Record` (`src.whois_registrant_* || ''`) is unaffected.
- **Search-result social mining** (`merge-all-data.ENRICH-SOCIALS.APPLIED.js`). The pipeline already
  runs an Exa search per lead (`<studio> contact email founder press`, 10 results); it mined only
  emails. Now `Merge All Data` also mines canonical twitter / linkedin / discord URLs from the
  result **links**. SPA-proof (Exa surfaces the studio's real social URLs regardless of site render)
  and adds **zero** fetches. Social priority: homepage scrape → contact-page scrape → search links.
- **Contact-page socials** (`scrape-contact-page.SOCIALS.APPLIED.js`). The already-fetched
  contact/about page now also yields twitter/linkedin/discord, not just emails.

**Applied** via the n8n MCP (`removeNode` + `addConnection` + two `setNodeParameter`) and
**published** (activeVersionId = 66c4f192). Verified structurally (WHOIS gone, rewire correct,
no dangling refs) and the Merge logic validated locally against real domains. **Not yet run-tested
end-to-end** — the lift surfaces on the next discovery run; existing rows are not retro-enriched.
Tier-4 paid people-data (founder name + LinkedIn) remains the open pre-gate decision in the DRAFT.
