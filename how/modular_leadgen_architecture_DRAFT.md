# Modular Lead-Gen Re-Architecture (DRAFT, pre-gate)

Status: RECONCILED / PARTLY SUPERSEDED (2026-06-23). After reading the repo I confirmed the
source -> intake -> CAG deriver ALREADY EXISTS and runs: Source Ingestion (`ertFL6pi4wlJ3lMJ`)
+ intake bank + Context Builder (`G5Mkf1KUmr6LHJdV`). This doc's "deriver" and "spec from
sources" sections describe built infra, not a greenfield need. The white-label generalisations
here (connector registry, spec/prompts-as-config, G8 outcome loop) overlap
`how/pipeline_critique_v2.md` (esp. its white-label backlog) which is the live source of truth.
The genuinely-open, actionable items are folded into `how/priority_tasks_rubric_emails_DRAFT.md`.
Keep this doc only as the white-label target picture; do not treat it as net-new scope.

Original status line (retained): design + audit only, no build before the gate.

Governing principle (absolute): ZERO hardcoding. Every element the pipeline uses must either
(a) derive from the client's own source materials, or (b) be explicit tenant-editable config on
the Context page. Nothing client-specific may live in engine code or in a baked prompt. All
prompts are tenant-editable and surfaced on the Context page.

Where pure derivation is impossible, that is a GAP and it is named in section 5, not papered
over with a hidden default.

---

## 0. Locked decisions (recorded at design time, pre-build)

- D1 (G1) Discovery connector: OPERATOR-SET, Steam only for the POC, behind a clean normalized
  candidate boundary. Connector registry deferred to a later phase. The boundary, not the
  plurality, is what Phase 1 proves.
- D2 (G3/G8) Scoring weights: SHIP AS EDITABLE ASSUMPTIONS. The deriver proposes weights from
  the prose, labelled assumption (no source_ref), client-tunable on the Context page. The
  outcome-refit loop (G8) is a later phase. Until then, fit is a visible hypothesis.
- D3 Build scope: PHASE 1 = spec + prompts as config (see section 9). Onboarding deriver,
  connector registry, and the G8 outcome loop are explicitly deferred and must remain visible
  as deferred, not silently absent.
- D4 (G7) RECOMMENDED, to confirm at gate: a separate tenant OPERATIONS store (budget, target
  count, rate limits, model, decay half-life), distinct from the value-prop spec.
- D5 (G6) RECOMMENDED, to confirm at gate: the JSON output contract / template structure is
  engine-seeded and version-pinned; ALL instructional and descriptive content inside prompts is
  tenant-editable on the Context page.

---

## 1. The model

ONE generic engine. Per tenant, the only things that vary are: the Value-Prop Spec and the
Prompts, both shown and editable on the Context page. The spec is DERIVED from the tenant's own
sources by an onboarding step with a human gate. Inputs the sources cannot supply are routed to
explicit tenant config or an intake question, never to a code default.

```
ONBOARDING (per tenant, once)              RUNTIME (every run, generic engine)
client sources (deck, site, intake)        discovery connector -> normalized candidates
   |  deriver prompt (editable)                |  scoring engine reads spec.fit_signals
derive Value-Prop Spec + Prompts             fit score + per-signal explanation
   |  proof validator (cite-or-drop)           |  qualify gate (spec threshold)
HUMAN GATE: review/edit on Context page       qualified leads
   |                                           |  draft prompt (editable) + spec
tenant spec + prompts stored (tenant_id) --->  A/B drafts -> HUMAN GATE: approve -> send
                                    (runtime reads spec + prompts)
```

Test of correctness: a new white-label client is added by supplying their materials and
approving the derived spec. If anything else must change in code, the design has failed.

---

## 2. The Value-Prop Spec (tenant-scoped, Context-page editable)

Generic schema, no client nouns. Generalises today's `cag_context` into `tenant_spec`.

```
tenant_id
product:        { name, one_liner, what_it_is, offer{pricing_model, terms, time_to_value,
                  control_points[], safety_points[]} }
icp:            { description, persona[], segments:[{key,definition,core_pitch,fear,desire,hook}] }
fit_signals:    [ {key, concept, attribute_binding, direction(+|-), weight, thresholds,
                   rationale, source_ref} ]
disqualifiers:  [ {concept, rule, source_ref} ]
anti_fit_flags: [ {flag, detect, action:"flag_only"} ]
positioning:    [ {key, when_signal, audience} ]
objections:     [ {objection, response, source_ref} ]
proof:          [ {claim, value, source_url, as_of} ]      # cited only; validator drops uncited
voice:          { principles[], banned[], cta_rules }
discovery:      { connector_ref, query, blocked_list, candidate_filter }
```

Every leaf carries a `source_ref` where it claims to be derived. A leaf with no source_ref is,
by definition, either a gap-filled config value or an intake answer, and is visibly marked as
such on the Context page (derived vs operator-set).

---

## 3. Prompts are config, not code (Context-page inventory)

All prompts are tenant-editable and appear on the Context page. Each is a template that assembles
ONLY spec fields plus the candidate data; no client facts are written into the template body.

| Prompt | Role | Editable | Note |
|---|---|---|---|
| Spec deriver | turns sources -> spec | yes | bootstrap; system-seeded (see GAP 6) |
| Proof validator | drops any stat not cited in sources | yes | enforces zero-fabrication |
| Discovery query | turns ICP -> search/query terms | yes | bounded by connector (GAP 1/2) |
| Qualification / score | scores a candidate from spec.fit_signals | yes | gates advancement |
| Email draft (A) | writes the email from spec | yes | one scaffold, spec-injected |
| Variant builder (B) | second variant per spec strategy | yes | see A/B note |
| Reply classifier | classifies inbound replies | yes | currently code; promote to prompt |

The Context page shows, per prompt: the editable template, and a read-only preview of the
spec/data it will inject, so the client sees exactly what the model receives.

---

## 4. Derivation matrix (what derives from where)

The core audit. For each spec element: its source, and whether the client's sources ALONE can
produce it. "No" entries are the gaps in section 5.

| Spec element | Source | Derivable from sources alone? | Gap |
|---|---|---|---|
| product (what/offer/one-liner) | deck + site | Yes | - |
| proof / stats | deck + site, cited | Yes (validator) | claims absent from sources excluded (G9) |
| icp.segments | deck | Yes if present | thin sources (G5) |
| icp.persona | deck | Yes if present | thin sources (G5) |
| positioning angles | deck | Yes if present | thin sources (G5) |
| objections | deck | Yes if present | thin sources (G5) |
| voice.principles | deck pitch-notes | Mostly | global house rules are operator-set, not client (G10) |
| fit_signals: which signals + direction | deck ICP | Yes (ordinal) | - |
| fit_signals: weights, thresholds, tiers | none | NO | G3 |
| disqualifiers: concept (e.g. "exclude majors") | deck | Yes | - |
| disqualifiers: enumerated list (the 30 names) | none | NO | G4 |
| discovery.connector (which data source/API) | none | NO | G1 |
| discovery.candidate_entity (attributes) | connector | NO (connector-defined) | G2 |
| fit_signals.attribute_binding (concept -> field) | modeling | NO | G2 |
| discovery.query terms | ICP + connector | Partial | G1/G2 |
| operations (budget, target count, rate, model, decay) | none | NO (infra/cost) | G7 |
| prompt: deriver (bootstrap) | none | NO (chicken/egg) | G6 |
| prompts: qualify/draft/validate templates | engine default | template only | content fully derived; template is seed (G6) |
| outcome weighting (learn from replies) | reply data | NO (no data yet) | G8 |

---

## 5. NAMED GAPS (where "derive from sources" provably cannot reach)

These are the honest limits. None is resolved by a hidden code default. Each is routed to a
connector registry, explicit tenant config, an intake question, or an outcome loop, and each is
a decision for the gate.

- G1 Discovery source selection. A pitch deck says WHO the ICP is, never which API to mine to
  find them. "Target lean game studios past peak CCU" does not resolve to "call SteamSpy
  all.json then Steam appdetails." Resolution: a connector REGISTRY the deriver proposes from
  (matched to ICP domain), confirmed by the operator at the human gate. The chosen connector is
  tenant config, not code. Steam is the first registry entry.

- G2 Signal-to-attribute binding + candidate schema. The value prop names concepts ("active
  community", "competitive play"). Whether those are measurable, and as which concrete field,
  is defined by the connector, not the deck. "Active community" -> `avg_playtime_2weeks > N`?
  `discord_members`? That mapping is modeling the sources do not contain. Resolution: each
  connector publishes its candidate attribute schema; the deriver binds spec concepts to
  available attributes and FLAGS any concept with no available attribute as unmeasurable for
  this connector. Unbound signals are shown to the client, not silently dropped.

- G3 Scoring weights and thresholds. Prose yields ORDINAL priority (pvp matters more than
  coop), never CARDINAL weights (+25 vs +5) or cut-offs (tier A = 60). Today's numbers are
  invented. Resolution path: (1) the deriver proposes relative weights from the prose, labelled
  ASSUMPTION with no source_ref; (2) the client tunes them on the Context page; (3) once outcome
  data exists (G8), weights are refit to actual replies. Until G8, fit is a stated hypothesis,
  not a learned truth. This must be visible, not hidden.

- G4 Enumerated exclusions. "Exclude major publishers" is derivable as a concept; the actual
  list of 30 names is world/operator knowledge absent from the deck. Resolution: store the
  concept in the spec; the enumerated list is operator config (or an LLM-proposed list the
  operator confirms), marked operator-set, never code.

- G5 Thin-source completeness. GamersLab's deck is unusually rich (persona, objection map,
  pitch ladder, voice notes). A thinner client deck leaves segments/objections/voice empty. The
  deriver must DETECT missing spec sections and raise intake questions, never invent content to
  fill them. Completeness of the spec is bounded by richness of the sources; the gap surfaces as
  intake, not fabrication.

- G6 The bootstrap prompt. The deriver prompt runs before any tenant spec exists, so it cannot
  itself be derived. It is the one irreducible system-seeded prompt. It is still exposed and
  editable on the Context page, but it ships as an engine default. Same for the qualify/draft
  template STRUCTURE (the JSON shape): structure is engine-seed, all CONTENT is spec-injected.
  The line between "engine template" and "tenant content" is a decision for the gate.

- G7 Operational parameters. Draft budget (35/run), target count (100), rate limits, model
  choice, evidence decay half-life (180d) are functions of API tier and cost, not the client's
  pitch. They belong in a separate tenant OPERATIONS config, orthogonal to the value-prop spec.
  Not a derivation at all; must not masquerade as one.

- G8 Outcome feedback. A truly derived "good lead" learns from who actually replied/converted.
  No reply outcome is fed back into scoring today. Without it, every weight in G3 is a guess.
  Resolution: wire reply/positive-reply outcomes (the reply-poll already detects them) back as
  the signal that refits fit_signals weights over time. This is the difference between a
  hypothesis and a model. Currently missing end to end.

- G9 Client-believed but undocumented claims. Stats the client "knows" but never put in the
  deck (e.g. a market-size figure) have no source and are correctly excluded by the validator.
  If the client wants them, intake must capture them WITH a source; no source, no claim.

- G10 House rules vs client voice. Some voice constraints (no em dashes, no emojis) are Ally's
  global house rules, not the client's. These are operator-level voice config layered over the
  derived client voice, marked as such.

---

## 6. Coupling audit: what moves out of code (unchanged from prior draft, retained)

| Welded today (live v10) | Becomes |
|---|---|
| CAG prose, stats, named apps (Prepare LLM Items / cag_context) | spec.product / spec.proof (cited) / spec.voice, derived |
| pre_score points table (Pre-Score) | spec.fit_signals (data) + G3 weights |
| `_s` rank = 50% appid newness (Pick 100) | spec.discovery config |
| BLOCKED publisher list (Pick 100) | spec.discovery.blocked_list + G4 |
| Steam category IDs + game_phase (Extract Steam Data) | Steam connector + candidate schema (G1/G2) |
| bestUgcApp / pitchAngle if/else (Prepare LLM Items) | spec.icp.segments + LLM choice |
| fit_score computed then ignored (Build Final Record) | spec-driven, gates advancement |
| draft/qualify prompts in node code | editable prompts on Context page |

---

## 7. Open decisions for the gate

1. G1 connector model: registry + operator-confirm now, or operator-set connector only for the
   POC (Steam) with the registry deferred?
2. G3 weights: ship deriver-proposed weights as editable assumptions now, and treat outcome
   refit (G8) as a later phase? Or block on G8?
3. G6 template line: how much prompt STRUCTURE is engine-seed vs fully tenant-authored?
4. Operations config (G7): confirm a separate tenant operations store, distinct from the spec.
5. Phasing: which gaps must be closed in the re-architecture build vs explicitly deferred (with
   the deferral visible, per G3/G8).

No build proceeds until these are decided and the re-architecture is approved.

---

## 9. Phase 1 scope (locked by D3) — what the approved build would cover

IN (the re-architecture build, once approved at the gate):
- New `tenant_spec` table (generalises `cag_context`); all GamersLab content moved IN as derived
  data with source_refs, every fabricated stat/app purged.
- New tenant `prompts` store; the qualify, draft, variant, proof-validator, and reply-classifier
  prompts moved out of node code into editable templates. Structure engine-seeded (D5).
- Separate tenant `operations` store (D4): budget, target count, rate limits, model, decay.
- Generic scoring engine reads `spec.fit_signals`; the `pre_score` table becomes spec rows with
  assumption-labelled weights (D2). `fit_score` (spec-driven) GATES advancement.
- Steam connector behind a normalized candidate boundary (D1); `game_phase`, category-id signals
  become connector-published candidate attributes bound to spec signals (with unbound concepts
  surfaced, per G2).
- Context page extended to edit the spec AND every prompt, showing derived vs operator-set per
  field, and a read-only preview of what each prompt will inject.

OUT (explicitly deferred, must stay visible as deferred):
- Onboarding deriver (deck + site -> spec). Phase 1 seeds the GamersLab spec by hand FROM the
  sources as a stand-in for the deriver's output; the deriver workflow itself is later.
- Connector registry / any non-Steam connector.
- G8 outcome-learning loop (reply outcomes refitting weights).

Acceptance for Phase 1: no client fact exists in engine code or a baked prompt; the GamersLab
spec + prompts are fully editable on the Context page; scoring and drafting read only the spec;
swapping the spec content would re-aim the pipeline with zero code change.

---

## 8. Worked instance (not code)

`cag_grounded_prompts_DRAFT.md` is retained ONLY as an example of the spec the deriver would
produce for tenant = GamersLab, to prove the schema holds a real client. It is not bespoke
logic and is not a build target.
```
