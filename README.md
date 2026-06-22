# leadgen-gamerslab

A modular, portable, white-label **lead-generation pipeline** for businesses. **GamersLab is the
ground-zero proof-of-concept**; everything (front end included) is designed to be lifted out and
re-used for any client.

> **Agents:** read [`CLAUDE.md`](CLAUDE.md) (or [`AGENTS.md`](AGENTS.md)) and [`STATE.md`](STATE.md)
> before doing anything.

## Three project areas

| Area | What it is | Where | Status |
|------|------------|-------|--------|
| **aDNA campaign** | Cross-cutting context: research, business process, architecture, governance | repo root — `who/`, `what/`, `how/`, `STATE.md` | Living context |
| **1 · GamersLab POC** | The **built** Steam-publisher outreach pipeline (v1): n8n + Supabase + v1 integration API | [`gamerslab-poc/`](gamerslab-poc/) | **Active / built** |
| **2 · Shared UI** | One React source, two build modes (`poc` = GamersLab, `full` = white-label) + design refs | [`poc/`](poc/) | Built |
| **3 · White-label v2** | Productising the POC into a modular white-label product | [`whitelabel/`](whitelabel/) | Design — pre-gate |

The UI is **one source tree** at `poc/ui/`. The GamersLab POC is `npm run build:poc`; the white-label
product is the default build. Two products, one codebase — never forked (modular mandate, see
`CLAUDE.md` #7).

## Quick start per area

- **Run / extend the GamersLab POC** → [`gamerslab-poc/README.md`](gamerslab-poc/README.md)
- **Work on the UI** → `cd poc/ui && npm install && npm run dev` (or `npm run dev:poc`)
- **Deploy the integration API** → [`gamerslab-poc/supabase/functions/README.md`](gamerslab-poc/supabase/functions/README.md)
- **White-label v2 design** → [`whitelabel/README.md`](whitelabel/README.md) + root `how/`

## Campaign context

The repo root holds the aDNA campaign — the WHAT (`what/`: business process, competitor research,
requirements), the HOW (`how/`: pipeline critique, plan, infra stack, architecture, UI brief, v2
design), and the WHO (`who/`). Current gate and running tracks: [`STATE.md`](STATE.md).
