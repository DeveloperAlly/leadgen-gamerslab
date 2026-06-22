# AGENTS.md — Repo Boot & Router (leadgen-gamerslab)

> For Codex / Cowork / aDNA / any non-Claude agent. **Mirror of `CLAUDE.md`** — if you can read
> `CLAUDE.md`, read that (it is canonical). Read `STATE.md` next, then the project README.

## STOP — there are THREE project areas here. Know which one you are in.

| # | Area | What it is | Folder | Runs? |
|---|------|------------|--------|-------|
| — | **aDNA campaign (context for everything)** | Governance, research, business-process, architecture context spanning all projects. Read before any work. | **repo root**: `who/`, `what/`, `how/`, `STATE.md` | n/a |
| 1 | **GamersLab POC** — *active/current* | The **built** Steam-publisher outreach pipeline (v1): n8n workflow + `publishers` table + Supabase Edge Functions (wired to the **v10** n8n instance). | `gamerslab-poc/` | **Yes** |
| 2 | **Shared UI (template)** | **One** React source, **two build modes**: `--mode poc` (GamersLab) and default (white-label). The portable shell both products use — **not** two codebases. | `poc/ui/` (+ `poc/design-refs/`) | **Yes** |
| 3 | **White-label v2** — *design/pre-gate* | Productisation into a modular white-label product. Design/governance only — **does not run**. Specs live in root `how/`. | `whitelabel/` | **No** |

**Rule:** before acting, state which area you are in. GamersLab POC = `gamerslab-poc/` (built).
White-label v2 = `whitelabel/` (design only). The UI is **one source** at `poc/ui/` — never fork it.
Ambiguous which project? **Ask before acting.**

## Operating doctrine (applies to all areas)

No build before the human gate · look at data/tools before asking · recall the aDNA memory before
generating · verify every external API against 2026 docs · modular mandate is law (front end is one
portable source) · free-for-Ally-first · business process before technical · permission-first (state
task, ask, wait for yes).

Full detail + the repo map are in `CLAUDE.md`. Current gate/tracks are in `STATE.md`. aDNA memory:
AI-Ally Interface MCP, tags `gamers-lab` / `lead-gen` / `whitelabel`.
