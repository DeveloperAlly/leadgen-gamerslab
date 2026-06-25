# Prospect Dossier - Build Spec (the concrete target) - DRAFT

**Status:** DRAFT, PRE-GATE. This is a build spec, not a build. No engine changes are authorised by this
doc (`STATE.md`, CLAUDE.md non-negotiable #1). It exists so that when the build is approved there is one
unambiguous target instead of five loosely-coupled passes.

**Created:** 2026-06-24 · **Owner:** Ally · **Author:** Claude (Cowork)
**Reads from / extends:**
[`how/prospect_dossier_research_DRAFT.md`](prospect_dossier_research_DRAFT.md) (the why + the template),
[`how/prospect_dossier_steam_intake.svg`](prospect_dossier_steam_intake.svg) (the process diagram),
`gamerslab-poc/SPEC.md` §4.1 (real `publishers` columns, verified live 2026-06-24),
`gamerslab-poc/ARCHITECTURE.md` §4 (the v10 engine node graph),
`how/poc_fix_backlog.md` (T1/T2/T3 prerequisites), `how/contact_enrichment_waterfall_DRAFT.md`.

---

## 0. Decisions locked this session (do not relitigate)

| # | Decision | Chosen | Consequence for this spec |
|---|----------|--------|---------------------------|
| D-a | Next artifact | **Spec first** (this doc) | No engine edits until a separate build gate. |
| D-b | Coverage-gate strictness | **Trigger-only, contact optional** | Gate hard-requires a fresh sourced trigger OR demand signal. The decision-maker waterfall still runs and a named contact is scored/preferred, but its absence never blocks a draft. A role inbox is an acceptable send target when that is all we have. |
| D-c | `why_now` storage | **`publishers` columns now** | Add `why_now*` columns directly (the engine reads `publishers`); do not wait for the v2 structured tables. |
| D-d | Entity re-key | **Wave 2** | Fillers in Wave 1 write to the `publishers` row; the publisher-entity promotion + suppression land in Wave 2 (small migration, outsized safety). |
| D-e | Decision-maker paid people-data | **Free-only for v1** | Paid adapter (Hunter/Apollo on client key, opt-in) stays a gated follow-up, not in this build. |
| D-f | Human-detail slot | **Keep as its own slot** | Enforce the "1 to 2 specific details max" rule at draft time, not by dropping the slot. |

Everything below honours these. Where a choice is still open it is flagged in §9, not silently defaulted.

---

## 1. The object - dossier slot schema

Six per-lead slots plus an entity-level relationship strip. Every slot value is a **provenance quad**, never
a bare string:

```
slot := {
  value:             "<fact / quote / name>",
  source_url:        "<where it came from>",     // no URL  => slot is EMPTY
  date:              "YYYY-MM-DD",               // no date => slot is EMPTY; drives decay
  evidence_strength: explicit | inferred | none  // rubric from pipeline_critique_v2 D1
}
```

A slot with a `value` but no `source_url` or no `date` is **empty by definition**. That single rule is what
makes "verifiable" a check rather than an adjective.

| # | Slot | Existing columns (reuse) | New columns (this spec) | Gate role (per D-b) |
|---|------|--------------------------|--------------------------|---------------------|
| 1 | Decision-maker | `contact_name`, `contact_role`, `contact_email`, `contact_email_all`, `contact_source`, `email_valid`, `email_status`, `twitter_handle`, `linkedin_company_url`, `discord_url` | `contact_as_of` (date) | best-effort, scored, NOT blocking |
| 2 | Why-now trigger | `release_date`, `coming_soon`, `game_phase` | `why_now`, `why_now_source`, `why_now_as_of`, `trigger_class`, `why_now_decay_weight` | one of {2,3} REQUIRED |
| 3 | Demand signal | `evidence_quote`, `evidence_sources` (jsonb), `evidence_as_of`, `evidence_strength`, `evidence_decay_weight`, `pain_signal` | (reuse evidence_*) | one of {2,3} REQUIRED |
| 4 | Human detail | `founder_name`, `founder_quote`, `founder_quote_source` | `founder_quote_as_of` (date) | optional, lifts quality |
| 5 | Peer match | `peer_publisher_ref`, `pitch_angle`, `best_ugc_app`, `ugc_app_pitch`, `gamerslab_hook` | `peer_match_method` (text: deterministic\|llm) | REQUIRED (near-always passes) |
| 6 | Qualification | `pre_score`, `fit_score`, `value_score`, `match_score`, `score_rationale`, `recommended_action`, `risk_flags` (jsonb) | `dimension_breakdown` (jsonb) | drives priority, not a hard gate |
| - | Relationship strip (entity) | `pipeline_status`, `sent_at`, `replied_at`, `reviewed_by`, `outreach_thread_id`, `sequence_status` | `publisher_key`, `journey_stage`, `do_not_contact`, `already_customer`, `opted_out` | suppression checked before every touch (Wave 2) |

All existing-column names verified live against `public.publishers` on 2026-06-24.

---

## 2. Schema migration (DDL spec - NOT applied)

To be applied as one migration at build time, permission-first. Additive only, no drops, no backfill of
human-entered data.

```sql
-- Wave 0 (foundations): per-slot provenance the engine does not yet carry
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS why_now             text,
  ADD COLUMN IF NOT EXISTS why_now_source      text,
  ADD COLUMN IF NOT EXISTS why_now_as_of       date,
  ADD COLUMN IF NOT EXISTS trigger_class       text,   -- funding|exec|launch|patch|update|coming_soon|pain_velocity
  ADD COLUMN IF NOT EXISTS why_now_decay_weight numeric, -- slot-2 decay; demand keeps evidence_decay_weight
  ADD COLUMN IF NOT EXISTS founder_quote_as_of date,
  ADD COLUMN IF NOT EXISTS contact_as_of       date,
  ADD COLUMN IF NOT EXISTS peer_match_method   text,   -- deterministic|llm
  ADD COLUMN IF NOT EXISTS dimension_breakdown jsonb;

-- Wave 2 (entity + suppression)
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS publisher_key   text,
  ADD COLUMN IF NOT EXISTS journey_stage   text,
  ADD COLUMN IF NOT EXISTS do_not_contact  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS already_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out       boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS publishers_publisher_key_idx ON public.publishers (publisher_key);
```

---

## 3. The coverage gate (per D-b: trigger-only, contact optional)

A node placed **immediately before** the v10 draft step (`Apply CAG from DB` -> `Prepare LLM Items`).
It reads the filled slots and routes:

**draft_ready == true** requires ALL of:
1. **Fresh sourced trigger or demand.** Slot 2 OR Slot 3 is grounded: has `source_url`, has a `date`
   inside its class window (§4.2 decay table), and `evidence_strength != 'none'`.
2. **Peer resolved.** Slot 5 has a `peer_publisher_ref` with `peer_match_method='deterministic'`.
3. **No cited-but-ungrounded slot.** Any slot whose value will be cited in the draft must not be
   `evidence_strength='none'` (the §2.3 "0.84% worse-than-generic" guard).

Contact (Slot 1) is **NOT** in the gate. If a named contact exists it raises the priority score and the
send targets the person; if only a role inbox exists, the lead still drafts and sends there.

**Routing:**
- all hold -> `draft_ready` -> proceed to draft.
- a required slot is empty but fillable -> `enrich_more` -> re-run the next adapter / waterfall step for that slot, then re-gate.
- a required slot is unfillable or only stale -> `hold` (write `recommended_action='hold_no_trigger'`); the empty slot is surfaced, no blind draft.

This flips the current failure mode: today 75% of A/B rows draft empty with no evidence gate (D1). Here an
empty trigger is **visible** and **non-drafting** instead of a hollow email.

---

## 4. Per-filler node specs

Each filler is a node (or small node cluster) added to the v10 engine `MouIeDmDAAHKIpDn` between
`Merge All Data` and `Build Final Record`. Each writes its provenance quad. Each is built behind the
**venue-adapter / config seam** (modularity mandate #7): the call is a Steam/Exa adapter, the keyword sets
and rubrics are tenant config derived from the CAG, the extraction is engine-generic.

### 4.1 Filler 3 - Demand signal (BUILD FIRST: cheapest, highest, uniquely ours)

- **Input:** `steam_app_id`.
- **Call (verified 2026):** `GET https://store.steampowered.com/appreviews/<appid>?json=1`
  `&filter=recent&language=english&num_per_page=100&review_type=all&purchase_type=all&cursor=*`.
  Response: `query_summary` (`total_positive/total_negative`), `reviews[]` each with
  `review` (text), `timestamp_created` (unix), `voted_up`, `author.playtime_forever`.
- **Extraction (engine-generic):** keep reviews from roughly the last 90 days
  (`timestamp_created`); keyword/LLM filter for **demand language** matching the CAG's offering set
  (config: `tracker, leaderboard, stats, companion, rival, tournament, ladder, ranking, second screen`);
  pick the single strongest dated quote (prefer high `playtime_forever`, recent, `voted_up=false` pain or
  explicit feature request).
- **Writes:** `evidence_quote` (the verbatim line), `evidence_sources` (`[{url, date}]`, url = the Steam
  review permalink or the appreviews query), `evidence_as_of` = review date, `evidence_strength='explicit'`
  when a verbatim dated request is found else `none`. Also refresh `pain_signal` from the same evidence.
- **Fallback:** none in v1 (Discord/community mining is a later adapter). If no qualifying review, slot is
  empty (`none`).
- **Free-tier:** unauthenticated public endpoint, no key, 1 request per app. Cache per `steam_app_id`.
- **Modularity:** Steam `appreviews` = venue-signal adapter; the demand keyword set = tenant config; the
  pick-strongest logic = engine-generic.
- **Acceptance:** run over 20 fresh apps;
  `SELECT count(*) FILTER (WHERE evidence_strength='explicit') FROM publishers WHERE created_at > '<ts>';`
  a meaningful share carry a verbatim dated quote with a resolvable source url.

### 4.2 Filler 2 - Why-now trigger (the #1 relevance lever)

- **Input:** `steam_app_id`, plus `release_date`/`coming_soon` already computed, plus prior-run
  `total_reviews` for velocity delta.
- **Calls (verified 2026):**
  - `GET https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=<appid>&count=10&maxlength=600&format=json`.
    Response: `appnews.newsitems[]` each with `date` (unix), `url`, `title`, `contents`. Keep items inside
    the trigger window; classify as `launch` / `patch` / `update`.
  - Compute **review-velocity delta** = (`total_reviews` now - last run) over days elapsed; a spike is a
    `pain_velocity` trigger.
  - Derive `launch` / `coming_soon` window from `release_date`.
- **Decay windows (config, from research §2.2):**

  | `trigger_class` | window (fresh) |
  |---|---|
  | funding | ~90 days |
  | exec / champion move | 30 to 90 days |
  | launch / major patch | days to weeks |
  | pain_velocity (review spike) | 5 to 10 days |

- **Writes:** `why_now` (one line), `why_now_source` (news url or "steam:appreviews-velocity" or
  "steam:release_date"), `why_now_as_of` (event date), `trigger_class`,
  `why_now_decay_weight = exp(-age_days / halflife[class])` (slot-2 decay; demand owns
  `evidence_decay_weight`, never shared). Promote `game_phase`/launch-window to a
  **primary** `Pre-Score` weight (today it is computed but unweighted).
- **Fallback:** Exa news search on the studio name (engine-generic adapter) when Steam News is empty.
- **Free-tier:** GetNewsForApp is keyless; Exa fallback uses the existing budget, capped 1 query.
- **Modularity:** Steam News + release_date = venue adapter; trigger classes + windows = config. The
  canonical class table (windows, half-lives, the explicit-vs-inferred strength rule) lives in one file,
  `gamerslab-poc/workflow/config/trigger-classes.DRAFT.json`; the filler and the gate both mirror it and
  must stay equal to it (no second hand-maintained copy).
- **Acceptance:** new rows carry a populated `why_now` + `why_now_as_of` at a usable rate; `trigger_class`
  distribution is non-degenerate; a stale event shows a low `why_now_decay_weight`.

### 4.3 Filler 1 - Decision-maker waterfall (runs, but does not gate, per D-b)

- **Input:** `publisher_website`, studio name, captured socials.
- **Waterfall (per field, stop at first verified; free tiers only in v1):**
  Steam `support_info.email` -> site contact-page scrape -> Exa search
  (`<studio> publishing OR business development OR dev relations contact`) -> SerpAPI fallback ->
  email pattern-guess + MX/`email_valid` verify. **Paid people-data is out of scope (D-e).**
- **Writes:** `contact_name`, `contact_role`, `contact_email`, `contact_source`, `contact_as_of`,
  `email_valid`, `email_status`. Role-rank: prefer a named BD/dev-relations/founder over a shared inbox.
- **Effect on the lead:** a named verified contact raises the Slot 6 priority score and sets the send
  target; only a role inbox is acceptable and non-blocking.
- **Free-tier:** unchanged Exa budget; MX check is free.
- **Modularity:** all adapters engine-generic; the paid tier is an opt-in config slot, dark in v1.
- **Acceptance:** named-contact real-rate on new A/B rows rises from the current ~3% toward an agreed
  target; every contact carries a `contact_source` and `contact_as_of`.

### 4.4 Filler 5 - Deterministic peer match (gate-required, must be true)

- **Input:** `primary_genre`, `steam_tags`, the boolean feature flags
  (`has_online_pvp`, `has_steam_workshop`, `has_steam_leaderboards`, `has_online_coop`).
- **Logic (engine-generic matcher over tenant config):** a declared map from
  genre/feature vector to the nearest of the six GamersLab catalogue games and the exact UGC offering it
  proves (the six peers are already tagged: Maelstrom->PvP, NightSpawn->survival, Dark Table->card, ...).
  Nearest-vector wins; ties break by shared feature count.
- **Writes:** `peer_publisher_ref`, `pitch_angle`, `best_ugc_app`, `ugc_app_pitch`, `gamerslab_hook`,
  `peer_match_method='deterministic'`. Replaces today's LLM free-choice / hardcoded ternary.
- **Modularity:** the six-peer catalogue map = **tenant config** (GamersLab data, not engine logic); the
  matcher = engine-generic.
- **Acceptance:** every new row has a `peer_publisher_ref` with `method='deterministic'`; spot-check that
  the matched peer is genre-true for a sample of 20.

### 4.5 Filler 4 - Human detail (optional, lifts quality)

- **Input:** `publisher_website`, `twitter_handle`, `linkedin_company_url` (captured today, never read).
- **Call:** Exa search + contents over the studio site / devblog / roadmap / recent interview or post;
  extract one mirrorable line (a roadmap promise, a devlog phrase, the founder's own wording).
- **Writes:** `founder_quote` (or a generic research line), `founder_quote_source`, `founder_quote_as_of`.
  Strictly one line; the draft prompt already caps specifics and must keep total specifics to 1 to 2
  (research §2.3, enforced at draft per D-f).
- **Free-tier:** one Exa query, reusing the budget freed by re-pointing the contact query.
- **Modularity:** Exa = engine-generic; the sources-to-mine list = config.
- **Acceptance:** when populated, the line carries a resolvable `source` and a `date`; empty otherwise (no
  fabrication).

### 4.6 Filler 6 - Two-sided qualification (drives priority, not a hard gate)

- **Input:** Steam facts (fit) and the Slot 2/3 trigger+demand (intent), scored against the CAG rubric.
- **Logic:** `fit = w1 * value_to_client + w2 * prospect_match`, defaults `w1=w2=0.5`, weights as config.
  Persist the per-dimension contributions and a short rationale.
- **Writes:** `fit_score`, `value_score`, `match_score`, `score_rationale`, `dimension_breakdown` (jsonb),
  `risk_flags` (flag-never-suppress, unchanged). Tier order now reflects fit, not just pre-LLM Steam flags.
- **Modularity:** rubric weights = tenant config (from CAG); scorer = engine-generic.
- **Acceptance:** new rows carry a non-flat `fit_score` that differentiates tiers and a stored breakdown;
  tier order changes vs pre-score-only on a sample.

---

## 5. Relationship strip + suppression (Wave 2)

- Add `publisher_key` (normalised publisher name or domain); backfill by derivation, dedup the funnel and
  the exclusion filter on it so a studio reached via a second game is not re-processed or double-pitched.
- `journey_stage` (new / contacted / replied / won / lost) and suppression booleans
  (`do_not_contact`, `already_customer`, `opted_out`) are **entity-level**; checked before every touch; a
  negative or removal reply sets `do_not_contact` across all of that publisher's games.
- The touch log already lives on the message entity (`step`/`variant`, `outreach_thread_id`); Wave 2 wires
  suppression + dedup, it does not rebuild the send path.

---

## 6. Build sequence (dependency-correct)

| Wave | Items | Why this order |
|------|-------|----------------|
| **0 - foundations** | T1 draft-repair, T2 -> T3 brief parity (existing backlog); the §2 migration; positive-reply metric + baseline | The dossier feeds the drafter. Fixing the 75% empty-draft + thinned-brief defects first is what makes every filler's lift measurable rather than masked. |
| **1 - fillers** | 4.1 demand -> 4.2 why-now -> 4.3 decision-maker -> 4.4 peer -> 4.5 human detail -> 4.6 qualification | Value/cost order. Demand + why-now satisfy the gate (D-b) first, so the gate can go live earliest. |
| **2 - gate + safety** | §3 coverage gate node; §5 entity re-key + suppression + dedup | Gate needs the fillers writing real slots; entity work is a small migration with outsized safety. |
| **3 - loop** | reply-intent classification -> journey_stage -> feed winning trigger/peer/genre back into Pre-Score weights | Closes the compounding loop once outcomes exist. |

Each wave: free-tier only (#8), verify the live node before editing (#1), prove with the acceptance test,
update `ARCHITECTURE.md` §4/§6 + §9 date in the same change, mirror to aDNA.

---

## 7. Modularity ledger (mandate #7 - per filler)

| Filler | Venue adapter (swappable) | Tenant config (per client) | Engine-generic |
|--------|---------------------------|-----------------------------|----------------|
| 3 demand | Steam `appreviews` | demand keyword set | pick-strongest, decay |
| 2 why-now | Steam News, release_date, velocity | trigger classes + windows | scoring, decay |
| 1 contact | site scrape / Exa / SerpAPI / MX | paid tier (opt-in, dark) | waterfall, role-rank |
| 5 peer | (none - internal) | the 6-peer catalogue map | nearest-vector matcher |
| 4 human | Exa | sources-to-mine list | extract-one-line |
| 6 qual | (none) | rubric weights | two-sided scorer |

If any filler bakes a GamersLab noun or a Steam assumption into engine code rather than adapter/config, it
is wrong (the modularity guard, research §11).

---

## 8. Definition of done (build gate, when approved)

- Migration applied; all new columns present; no human intake data touched.
- Each filler writes its provenance quad; no slot is non-empty without a `source_url` + `date`.
- The coverage gate blocks every draft that lacks a fresh sourced trigger/demand; an empty trigger is
  visibly routed to `hold`/`enrich_more`, never drafted.
- A discovery run over a fresh genre shows: explicit demand or why-now on a usable share of new A/B rows,
  deterministic peer on all, and the empty-draft rate near zero (the T1 fix held).
- `ARCHITECTURE.md` and `SPEC.md` updated in the same change; aDNA mirrored.

**Integration steps the fillers depend on (from the consistency review, must land in the same build wave):**

- **`Build Final Record` passthrough.** The new columns (`why_now`, `why_now_source`, `why_now_as_of`,
  `trigger_class`, `why_now_decay_weight`, `peer_match_method`, `dimension_breakdown`, `contact_as_of`,
  `founder_quote_as_of`) are written onto the in-flight item by the fillers but will NOT persist until
  `Build Final Record` carries them to the upsert. The gate reads them off the item in-run, so it works
  during a run, but the DB columns stay null until this passthrough is added. Close it in the same wave.
- **Filler 1 node order.** The decision-maker filler pre-seeds `email_valid=false`/`email_status='pending_mx'`
  and relies on the existing `Verify Email` -> `Classify Email` nodes running AFTER it. Integration must
  place filler 1 before `Verify Email`, or the pending state persists.
- **One canonical trigger-class config.** At integration, source the windows/half-lives/strength rule from
  `workflow/config/trigger-classes.DRAFT.json` in both the filler and the gate rather than keeping two
  inline copies (they are currently equal but can drift).

---

## 9. Still open (decide at build gate, not now)

1. Named-contact target rate for Filler 1 (what share counts as "good" given contact is non-blocking).
2. Whether `pain_velocity` (review-spike) needs its own column or rides `why_now`/`trigger_class` (default:
   rides `why_now`).
3. When to migrate slots to the v2 structured tables vs keep them on `publishers` (default: stay on
   `publishers` through v1).
4. Paid people-data adapter (Hunter/Apollo on client key) - separate decision memo if/when named coverage
   is the binding constraint.

---

## 10. Sources (verified for this spec)

- Steam app reviews API (request params + response schema), Steamworks, fetched 2026-06-24:
  https://partner.steamgames.com/doc/store/getreviews
- Steam ISteamNews `GetNewsForApp` (params: appid, count, maxlength, format, enddate), verified 2026-06-24:
  https://partner.steamgames.com/doc/webapi/isteamnews and
  https://developer.valvesoftware.com/wiki/Steam_Web_API
- Research + levers: `how/prospect_dossier_research_DRAFT.md` (and its §11 source list).
- Live `publishers` schema + fill-rates: Supabase `ccmwksmgoisijvyovgko`, queried 2026-06-24.

---

*DRAFT, pre-gate. No build authorised. Per CLAUDE.md: business process before technical, verify before
assert, modular mandate, free-for-Ally, permission-first.*
