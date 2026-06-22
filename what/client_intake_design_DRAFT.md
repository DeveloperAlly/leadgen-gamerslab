# Client Intake Design — Questions + Document Pack for the CAG/RAG — DRAFT

**Status:** 🟡 **DRAFT — PRE-GATE.** This designs **Stage 1 (Client Business Discovery)** of the
business process (`business_process_model_DRAFT.md`): the questions we ask a client, and the
documents we ask them to supply, so that the AI builds a **rich, evidence-grounded understanding
of the client and its prospects** — captured as an **LLM-friendly CAG block now, RAG corpus
later**. Nothing here authorises a build (`STATE.md`).

**Created:** 2026-06-22 · **Owner:** Ally · **Reads from:** `business_process_model_DRAFT.md`
(Stage 1–2), `gamerslab-poc/docs/cag-block.md` (the live CAG it must reproduce),
`gamerslab-poc/docs/spec.md` (Stage 03 intel + Stage 04 scoring), `product_requirements_DRAFT.md`
(FR-1.x). Grounded in named frameworks (see §2, sources at end).

> **Portability first (mandate #7).** This is the **white-label intake template**. It is a
> question *bank* + a *document pack spec* that is the same for every client; only the **answers**
> change. §6 instantiates it for **GamersLab** and proves it regenerates the existing CAG block
> byte-for-concept — i.e. a second client = new answers, not new questions.

---

## 1. What "best intelligence" means here (the design target)

The unit of value (per the process model) is **"a verified, evidence-backed reason this specific
prospect should care about this specific client."** Intake exists to make that possible. So the
questions are reverse-engineered from **what every downstream step needs to fire**:

| Downstream step (skill) | What it needs from intake |
|---|---|
| `venue-mapping` | where prospects congregate + the access method + proxy→entity hops |
| discovery / `find()` | ICP fit criteria + **disqualifiers** + the exclusion of known prospects |
| `painpoint-verification` | the **exact pain the client solves** + what *evidence* counts as proof + trigger events |
| `two-sided-scoring` | fit weights (value-to-client) × prospect-match signals |
| `grounded-outreach` | proof points, peers, objections, **voice guardrails**, CTA rules |
| `learn` loop | the client's definition of a "good lead" / "success" to grade against |

If a question doesn't feed one of these, it's cut. Intake is not a brand survey — it is the
**fuel spec for the pipeline.**

---

## 2. Design principles (the frameworks, and how each shows up)

1. **Separate FIT from INTENT (ICP best practice, 2025–26).** *Fit* = structural ("should we
   ever sell to this account") from firmographics, technographics, and persona. *Intent/trigger*
   = timing ("are they ready now") from events and signals. Intent lifts scoring accuracy ~4× over
   firmographic-only. → Section B splits **B1 Fit**, **B2 Disqualifiers**, **B3 Pain + triggers**.
2. **Value Proposition Canvas / JTBD (Strategyzer).** Capture customer **Jobs / Pains / Gains**
   and the client's **Pain-relievers / Gain-creators**; "fit" is when they line up. This is the
   spine of Section A's value-prop block *and* the painpoint we later verify on each prospect.
3. **The Mom Test (Fitzpatrick).** Don't ask the client to theorise an "ideal customer" in the
   abstract — anchor every prospect question in **real, past, specific** customers (their last few
   wins and losses). Concrete history beats aspiration and dodges false validation.
4. **Trigger events / signal-based selling.** Ask the client which **real-world events** make a
   prospect ready (funding, hiring, launch, a public complaint, a product patch). These become both
   discovery signals and the **evidence bar** for painpoint verification.
5. **Watering-hole / community-led prospecting.** Prospects gather in specific venues (Steam,
   Reddit, Discord, GitHub, niche forums, marketplaces) — *not* "the generic web." Capture the
   venue, the **access method**, and any **proxy→entity hop** (e.g. mine games → hop to publisher).
6. **CAG vs RAG content split.** A **small, stable, curated brief** belongs in CAG (loaded every
   call); a **large, changing corpus** belongs in RAG (retrieved per prospect). Intake must produce
   both, and tag which is which (see §7–8).

---

## 3. How a question becomes intelligence (the pipeline)

```
            SECTION A (client)              SECTION B (customer/prospect)
                  │                                   │
                  ▼                                   ▼
        ┌───────────────────┐               ┌───────────────────┐
        │  CAG BLOCK (hot)   │◄── curated ──►│  ICP + Venue Map   │
        │ small · stable ·   │   synthesis   │  + disqualifiers   │
        │ loaded every call  │               └───────────────────┘
        └─────────┬─────────┘                          │
                  │                                     ▼
   raw docs ──►  RAG corpus (retrieved per prospect) ──►  S2 discover → verify pain → score
                  │                                     ▼
                  └────────────► grounded outreach ───► track ───► learn (updates CAG + weights)
```

Each question below is tagged: **→CAG** (feeds the always-loaded brief), **→RAG** (feeds the
retrieved corpus), **→VENUE / →FIT / →INTENT / →VOICE** (which skill it fuels), and **[Mom-Test]**
where it must be asked against real history, not hypotheticals.

---

## 4. SECTION A — Client (the business)

> Goal: understand the client well enough to (a) write the always-loaded brief and (b) judge which
> prospects should care. Keep it tight — the *documents* (§7) carry the bulk; questions fill gaps
> and force the *judgements* a document won't state.

### A1 — Identity & offer  →CAG
1. In one sentence, what is the business and who is it for? *(the one-liner)*
2. What do you actually sell — product lines / modules / services? List each with a one-line "what
   it does for the user." →CAG →RAG
3. How does it work, briefly, and what does a buyer have to do to adopt it (effort, integration,
   time-to-value)? *(pre-empts the "how hard is this" objection)*
4. What does it cost / what's the commercial model? What's "the catch" a sceptic assumes?
5. What stage is the business (pre-launch, early traction, scaling)? Why does this matter for tone?

### A2 — Value proposition: Jobs / Pains / Gains  →CAG  *(Value Proposition Canvas)*
6. What **job** is the customer really trying to get done (functional, social, emotional)?
7. What are the **pains** they hit doing it today — the costs, risks, frustrations, workarounds? List
   the top 3, sharpest first. *(this is the pain we will verify on each prospect)*
8. What **gains** do they want — outcomes, savings, status — that they don't get today?
9. For each top pain/gain, **how exactly** does your product relieve/create it (pain-reliever /
   gain-creator)? One line each.
10. What do you do that a customer **cannot get** from the obvious alternatives (incl. "do nothing"
    and DIY)? *(the wedge)*

### A3 — Proof & credibility  →CAG (the *approved* facts) · →RAG (the long versions)
11. What are your **hard numbers** — outcomes, traction, ROI — that are **true and quotable**? Give
    the exact figure + the source/date for each. *(these become the ONLY stats outreach may use)*
12. Name **3–5 reference customers/peers** and the one-line result for each — especially ones similar
    to who we'll target (genre / size / stage). →CAG (shortlist) →RAG (full stories)
13. Who's on the team and what's the single most **credible signal** for a prospect (e.g. "X shipped
    50 of these")? Who should a warm intro come from? →CAG →INTENT
14. What awards / press / partnerships lend authority? →RAG

### A4 — Voice & guardrails  →CAG  *(the rails that keep outreach honest + on-brand)*
15. Describe the voice in 3–5 adjectives. Paste 1–2 **real messages you'd be proud to have sent.** →RAG
16. **Banned** phrases, claims, and topics — anything we must *never* say (false claims, off-limits
    positioning, words you hate). →CAG
17. The **top 3 objections** a prospect raises, and your best honest rebuttal to each. →CAG
18. Hard format rules for outreach (length, links, attachments, number of asks). →CAG

### A5 — Goals & "what good looks like"  →CAG · feeds `learn`
19. What outcome do you want from this pipeline (meetings? trials? intros?) and **what does a
    *good lead* look like** to you — concretely? *(the grading key for Stage 5)*
20. What's the single **CTA** you want every approved message to drive toward? →CAG

---

## 5. SECTION B — Customer / Prospect (who, why-now, where)

> Goal: a usable **ICP (fit + disqualifiers)**, a **verifiable pain + trigger** definition, the
> **decision-maker + warm-intro** map, and a **venue map** with access methods. Anchor in real
> history wherever marked **[Mom-Test]**.

### B1 — Ideal-customer FIT (structural)  →FIT →CAG
21. **[Mom-Test]** Tell me about your **last 3–5 best customers/wins.** For each: who were they
    (size, type, stage), and *why did it land*? *(we extract the real ICP from these, not a wish)*
22. **Firmographics:** what type of organisation, size band, stage, geography, business model?
23. **Technographics / context:** what must already be true about them — tools they use, platforms
    they're on, features they ship, a category they operate in? *(machine-detectable "they're a fit"
    signals)*
24. **Persona:** what kind of person/role is the right entity to reach, and what do they care about?
25. Is the target the **end entity, or a proxy we hop from**? (e.g. "find the *game*, then the
    *publisher* behind it"). →VENUE

### B2 — Disqualifiers / poor fit (negative criteria — first-class)  →FIT →CAG
26. **[Mom-Test]** Tell me about deals that **went nowhere or churned.** What did they have in
    common? *(the strongest source of real disqualifiers)*
27. Who should we **never** contact — too big/slow, wrong stage, no budget, competitor, dormant,
    ethically off-limits? Give the bright-line rules. →CAG
28. What's an instant "archive this lead" signal? *(saves the expensive enrich/score steps)*

### B3 — The pain on the prospect side + trigger/intent  →INTENT →CAG
29. How would you **recognise**, from the outside, that a prospect *has* the pain you solve? What
    public evidence would prove it? *(sets the painpoint-verification evidence bar — the moat)*
30. What **trigger events** make a prospect ready *now* (funding, hiring a relevant role, a launch,
    a patch, a public complaint, a milestone)? Rank them. →INTENT
31. Are there **distinct segments** that need a different angle (e.g. new vs established)? Define the
    split and the angle for each. →CAG
32. How strong must the evidence be to count — explicit public statement, or reasonable inference?
    *(precision/recall dial for scoring)* **Default (resolved):** pass on **≥1 cited *explicit*
    signal OR ≥2 corroborating *inferred* signals**; label each lead `explicit / inferred / unclear`,
    show the basis at Gate B, tune from outcomes. (Strict = higher precision, fewer leads; loose =
    higher recall, more false positives that dilute the "evidence-backed" moat.)

### B4 — Decision-maker & warm-intro map  →INTENT
33. Inside a target, **who decides** vs who influences vs who blocks? *(buying committee)*
34. What **warm-intro paths** exist (the team's network, shared investors, communities, alumni)? How
    do we surface "we have a warm path here" as a signal?
35. Which **contact types are acceptable** (named person only? role addresses ok?) and what verifies
    a contact is real/deliverable?

### B5 — Venue map: where they congregate + how to reach the data  →VENUE →CAG
36. **[Mom-Test]** Where do your best customers actually **hang out / get discovered** — the specific
    platforms, communities, marketplaces, directories, events? *(not "online" — name them)*
37. For each venue: is there an **API / list / dataset**, or is it closed (needs an alternative
    path)? Rank venues by value × accessibility.
38. Any **proxy datasets** that reveal the target indirectly (e.g. a marketplace of their *products*,
    a public registry, a review site)? →VENUE
39. Any **lists you already have** of known prospects/customers? *(used as the exclusion set so we
    never re-process them — Stage 2.1a)*

### B6 — Outreach context  →VOICE
40. Best **channel** to reach this prospect (email, LinkedIn, the community itself, a form)?
41. What tone/length lands with *this audience* specifically (may differ from A4 house voice)?

---

## 6. The GamersLab instantiation (worked example — proves portability + completeness)

Same questions, GamersLab's answers — and every section of the **live CAG block** is regenerated,
confirming the bank is complete (self-critique gate).

| CAG block section (existing) | Produced by question(s) |
|---|---|
| WHAT IT IS / one-liner | A1.1–A1.3 |
| THE PROBLEM IT SOLVES (4 pains) | A2.7 + B3.29 |
| REAL NUMBERS (use these, no others) | A3.11 |
| CURRENT GAMES (peer references) | A3.12 + B1.21 |
| LIVE UGC APPS (Grudge Goblin etc.) | A1.2 |
| TWO PITCH ANGLES (by game phase) | B3.30–B3.31 + A2 |
| THREE OBJECTIONS to pre-dissolve | A4.17 |
| SDK & INTEGRATION | A1.2–A1.3 |
| BEST FIT PUBLISHER PROFILE (strong) | B1.22–B1.24 |
| POOR FIT — do not draft, archive | B2.26–B2.28 |
| CONTACT & CTA | A5.20 + B4.35 |
| TEAM (credibility; Ryan Waller) | A3.13 |
| BANNED PHRASES & FALSE CLAIMS | A4.16 |
| *(venue: Steam → SteamSpy → publisher hop)* | B1.25 + B5.36–B5.38 |
| *(exclusion of already-drafted)* | B5.39 |

**Sample tailored phrasing for GamersLab** (B-section, Mom-Test style):
- B1.21 → "Of the 6 studios already on the platform, which were the *easiest yes*, and what did they
  have in common?"
- B3.29 → "When a studio *needs* GamersLab, what shows publicly — Steam Workshop enabled? players
  building scrapers in the forums? a companion-app request in reviews?"
- B5.36 → "Beyond Steam, where do the *right* studios gather — which subreddits, Discords, festivals,
  storefronts (itch.io, Epic)?"

Net: **zero GamersLab-specific questions** — only GamersLab-specific *answers*. A new client drops
in their own answers and the same machine runs.

---

## 7. Recommended document pack for the CAG / RAG

What to **ask the client to hand over**, split by where it lands. Rule of thumb from the research:
**CAG = small, stable, curated, always-loaded** (keep it tight — low single-digit thousands of
tokens); **RAG = large, changing, retrieved per prospect.**

### 7a. CAG layer — the always-loaded brief (curate to the essentials)
| # | Document | Priority | Intelligence it yields |
|---|---|---|---|
| C1 | **One-page product brief** (what it is, how it works, cost/catch) | MUST | the spine of every prompt |
| C2 | **ICP definition + disqualifiers** (fit, technographic signals, bright-line "never") | MUST | discovery + scoring filters |
| C3 | **Jobs/Pains/Gains map** + pain-relievers | MUST | the pain we verify; the angle |
| C4 | **Approved facts sheet** — the *only* quotable numbers, each with source/date | MUST | stops fabricated stats |
| C5 | **Peer / case-study shortlist** (one-liners, tagged by segment) | MUST | "your peer is already here" |
| C6 | **Voice & guardrails** — adjectives, banned phrases, claim rules, format limits | MUST | on-brand, honest outreach |
| C7 | **Objection → rebuttal list** (top 3) | SHOULD | pre-dissolve hesitation |
| C8 | **Venue map summary** + trigger-event list + warm-intro paths | SHOULD | timing + where + who |

### 7b. RAG layer — the retrieved corpus (the long-form source of truth)
| # | Document | Priority | Intelligence it yields |
|---|---|---|---|
| R1 | **Full case studies / customer stories** | MUST | per-prospect peer match + proof |
| R2 | **Website + product/SDK docs** (export or let us crawl) | MUST | accurate "how it works" detail |
| R3 | **Pitch / sales deck** | SHOULD | positioning, narrative, proof |
| R4 | **Past high-performing outreach** (real emails/DMs) | SHOULD | voice few-shots (best brand signal) |
| R5 | **Founder talks / podcasts / interview transcripts** | SHOULD | quotable, human credibility |
| R6 | **Blog / PR / announcements** | SHOULD | freshness, narrative, triggers |
| R7 | **Competitor battlecards / comparison notes** | NICE | differentiation under objection |
| R8 | **Testimonials / reviews / community quotes** | NICE | third-party social proof |
| R9 | **Pricing & packaging detail** | NICE | qualify, handle cost objection |
| R10 | **FAQ / long objection library** | NICE | depth beyond the CAG top-3 |
| R11 | **Existing prospect/customer lists (CSV)** | MUST* | exclusion set (never re-process) |

\*R11 isn't grounding content — it's the **known-set** the discovery step excludes at source (2.1a).

### 7c. Format rules for LLM-friendliness (applies to both layers)
- **Text/markdown over PDF/slides** where possible; clean headings so RAG chunks cleanly.
- **Facts as one claim per line**, each with a **source + date** — makes them quotable and auditable.
- **Date and attribute** everything; stale or unsourced claims are worse than none.
- **De-duplicate**; keep the CAG ruthlessly small (it's loaded on *every* call — bloat = cost + drift).
- Mark anything **confidential / do-not-quote** explicitly so it informs but never ships.
- **CAG size budget (resolved):** target the always-loaded block at **≤ ~2–4k tokens**. On free
  OpenRouter models "CAG" is a curated block *re-sent every call* (not KV-cache reuse — provider
  caching can't be relied on across a free multi-model fan-out), and `:free` calls are $0, so the
  binding constraint is the **context-window floor + answer quality**, not cache cost. The model
  router admits only free models **≥ a context floor (default 128K)** so the budget is deterministic;
  the editor enforces it with a token-count guard. (See `how/infra_stack_and_layers_DRAFT.md` F4 + L2.)

---

## 8. How intake → CAG now, RAG later (the build-order)

1. **Now (POC / CAG-first):** run Section A+B questions → synthesise the **CAG block** (C1–C8) →
   load it every call (matches today's `cag_context` table + Business-context editor). Hand the raw
   docs in as light context only if they fit.
2. **Later (RAG):** ingest R1–R10 into the vector store, retrieve per prospect at verify/draft time;
   keep the curated CAG as the stable core (**hybrid CAG+RAG** is the 2025 norm). R11 always feeds
   the exclusion set, never the prompt.
3. **Learn loop:** outcomes edit the CAG (which pains/peers/objections actually convert) and the
   scoring weights — the per-client compounding asset.

---

## 9. Open questions for Ally (before this is more than DRAFT)

1. **Delivery form (STILL OPEN):** is intake a **conversational AI interview** (adaptive, Mom-Test
   follow-ups) or a **static form**? The 41 questions are the bank; an AI interviewer would ask ~15
   and probe. *Deferred — explicitly out of scope of the pre-fill spec below.*
2. **Who answers (RESOLVED → spec):** pre-fill from the docs, ask only the judgement gaps. Designed in
   [`../how/v2_onboarding_prefill_spec_DRAFT.md`](../how/v2_onboarding_prefill_spec_DRAFT.md).
3. **CAG size budget (RESOLVED):** target **≤ ~2–4k tokens**; deterministic via a free-model
   **context floor (128K)**; quality-bound, not cache-bound. See §7c + `how/infra_stack_and_layers_DRAFT.md`.
4. **Evidence bar (RESOLVED → default):** a lead passes painpoint verification on **≥1 cited
   *explicit* signal OR ≥2 corroborating *inferred* signals**; every lead is labelled
   `explicit / inferred / unclear` and the basis is visible at Gate B, tunable from outcomes. See B3.32.
5. Should I turn this into (a) the **AI-interviewer prompt/skill** (needs #1 first), (b) a
   **client-facing intake form/checklist**, and/or (c) the **document-request email** — once you
   approve the question bank?
