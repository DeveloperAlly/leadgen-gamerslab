# CLAUDE.md — Campaign Router & Governance

> **This is the boot file.** Any agent (Claude Code, Cowork, web) starting in this
> project reads this first, then `STATE.md`, then the relevant doc in `what/` or `how/`.
> Purpose of this campaign: **supply the context Claude will otherwise forget** so a
> fresh chat boots already aligned, with zero re-explaining.

## What this campaign is

**Campaign:** `gamers_lab_lead_gen`
**Created:** 2026-06-21
**Owner:** Ally (ally@lilypad.tech)
**One line:** Build a **modular, portable, white-label lead-generation pipeline** for
businesses. **Gamers Lab is ground-zero POC** — but everything (including the front end)
is designed from day one to be lifted out and re-used for any client.

## Non-negotiables (from Ally's Operating Doctrine)

1. **No build before the gate.** Lifecycle: `research → plan → framework → audit →
   design (incl. UI + verified architecture) → [ONE HARD HUMAN GATE / APPROVE] →
   build → verify → extract`. Anything produced before approval is marked **DRAFT**.
2. **Look at data/tools before asking.** Draft options and present; never blank-interrogate.
3. **Continuity.** Recall + search aDNA before generating. Never fabricate what already exists.
4. **Verify before asserting.** Every external API/call relied on in the architecture spec
   must be verified against **2026** docs. Proof over claims.
5. **Always show a visual** of structure / what tracks are running (where, when, human vs agent).
6. **Self-critique gate.** Audit every doc/plan against researched frameworks before presenting.
7. **Modular mandate is law.** If a design decision couples the POC to "Gamers Lab" in a way
   that can't be cleanly re-templated, it is wrong. Front end included.
8. **Free for Ally first.** The POC must run on free tiers / the client's own keys. No spend by Ally to prove it.

## The gate we are at

We are in **RESEARCH + DESIGN, pre-gate**. We do **NOT** build GamersLab until Ally can
**visualise the UI and the pipeline architecture stack** and approves. See `STATE.md`.

## Map

```
gamers_lab_lead_gen/
├── CLAUDE.md                       ← you are here (boot + governance)
├── STATE.md                        ← read second: current state, gate status, tracks
├── who/AGENTS.md                   ← people / orgs / actors
├── what/
│   ├── AGENTS.md
│   ├── campaign_master.md          ← north star, scope, success criteria, artifacts index
│   └── research/
│       └── competitor_analysis.md  ← Task 2: deep+broad market scan, who's winning + why
└── how/
    ├── AGENTS.md
    ├── pipeline_critique.md        ← Task 3: critique of the proposed pipeline + gaps
    └── plan_poc_to_production.md   ← Task 4: phased plan + tasklist (POC = template)
```

## Persistence

Critical project state + decisions are also saved to the **AI-Ally Interface MCP**
(cross-surface brain) under tags `gamers-lab`, `lead-gen`, `whitelabel` so any surface
can `recall` them. This folder is the human-readable mirror; the MCP is the agent memory.
