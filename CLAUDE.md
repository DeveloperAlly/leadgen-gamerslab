# CLAUDE.md — Repo Boot & Router (leadgen-gamerslab)

> **This is the boot file. Read it first, every session, before touching anything.**
> Then read `STATE.md` (current gate + tracks), then the README of whichever project you are
> working in. Same content is mirrored in `AGENTS.md` for non-Claude agents.

<br/>

## STOP — there are THREE project areas here. Know which one you are in.

| # | Area | What it is | Folder | Runs? |
|---|------|------------|--------|-------|
| — | **aDNA campaign (context for everything)** | The governance, research, business-process and architecture context that spans all projects. Read before any work. | **repo root**: `CLAUDE.md`, `AGENTS.md`, `STATE.md`, `who/`, `what/`, `how/` | n/a (context) |
| 1 | **GamersLab POC** — *active / current* | The **built** Steam-publisher outreach pipeline (v1). n8n workflow + `publishers` table + Supabase Edge Functions (v1 integration API, wired to the **v10** n8n instance). | `gamerslab-poc/` | **Yes** |
| 2 | **Shared UI (the template)** | **One** React source tree, **two build modes**: `--mode poc` (GamersLab) and default (white-label). This is the portable shell both products use — **not** two codebases. | `poc/ui/` (+ `poc/design-refs/`) | **Yes** (built) |
| 3 | **White-label v2** — *design / pre-gate* | The productisation of the POC into a modular white-label product. Design/governance only — **does not run yet**. Source-of-truth specs live in the root `how/`. | `whitelabel/` | **No** |

**The rule:** before you act, state which area you are in. "GamersLab POC" = `gamerslab-poc/` (built, current).
"White-label v2" = `whitelabel/` (design only). The UI is **one source** at `poc/ui/` — never fork it.
If a task is ambiguous about which project, **ask before acting**.

<br/>

## Map

```
leadgen-gamerslab/
├── CLAUDE.md / AGENTS.md / README.md   ← boot, router, repo map
├── STATE.md                            ← current gate + tracks (read second)
├── who/  what/  how/                   ← aDNA campaign context (research, business process, architecture)
├── .claude/                            ← Claude/aDNA settings + pointer to the aDNA MCP memory
│
├── poc/                                ← shared, portable build surfaces
│   ├── ui/                             ← the ONE UI source (two build modes: poc | full)
│   └── design-refs/                    ← white-label UI design references (HTML prototypes)
│
├── gamerslab-poc/                      ← PROJECT 1 — GamersLab POC (v1, BUILT, ACTIVE)
│   ├── workflow/                       ← n8n outreach workflow (live instance is v10)
│   ├── supabase/                       ← schema + v1 integration API (Edge Functions)
│   ├── docs/                           ← spec, requirements, CAG brief
│   └── README.md
│
└── whitelabel/                         ← PROJECT 3 — white-label v2 (DESIGN, PRE-GATE)
    └── README.md                       ← scaffold; specs live in root how/
```

<br/>

## Non-negotiables (Ally's operating doctrine — apply to ALL areas)

1. **No build before the gate.** Lifecycle: `research → plan → framework → audit → design (incl.
   UI + verified architecture) → [ONE HARD HUMAN GATE / APPROVE] → build → verify → extract`.
   Anything produced before approval is marked **DRAFT**.
2. **Look at data/tools before asking.** Draft options and present; never blank-interrogate.
3. **Continuity.** Recall + search the aDNA memory before generating. Never fabricate what exists.
4. **Verify before asserting.** Every external API/call relied on must be verified against **2026**
   docs. Proof over claims.
5. **Always show a visual** of structure / what tracks are running (where, when, human vs agent).
6. **Self-critique gate.** Audit every doc/plan against researched frameworks before presenting.
7. **Modular mandate is law.** If a design couples the POC to "Gamers Lab" in a way that can't be
   cleanly re-templated, it is wrong. **Front end included** — the UI is one portable source,
   reskinned by tokens, never forked per tenant.
8. **Free for Ally first.** The POC runs on free tiers / the client's own keys. No spend by Ally.
9. **Business process before technical — always.** Model the WHAT/WHY (actors, real steps,
   decisions) and confirm it **before** designing any technical stack. Leading with infra before a
   confirmed business-process model is a defined failure mode.
10. **Permission-first execution.** Before ANY action: (a) state the task in one line; (b) ask;
    (c) wait for a clear "yes". No assuming intent, no bundling unrequested extras, no regenerating
    what already exists. Acting without a confirmed, defined task is a defined failure mode.

<br/>

## Where the campaign is

We are in **RESEARCH + DESIGN, pre-gate** for white-label v2. The GamersLab POC (area 1) is built
and active. We do **NOT** build white-label v2 until Ally can visualise the UI and the pipeline
architecture and approves. See `STATE.md`.

<br/>

## Persistence (aDNA memory)

Critical state + decisions are mirrored to the **AI-Ally Interface MCP** (cross-surface brain)
under tags `gamers-lab`, `lead-gen`, `whitelabel`. Any surface can `recall` them. This folder is the
human-readable mirror; the MCP is the agent memory. See `.claude/README.md` for how to recall.
