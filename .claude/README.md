# .claude — agent settings & memory pointer

**Boot file:** the repo root [`CLAUDE.md`](../CLAUDE.md) is the canonical boot/router. Read it first,
then [`STATE.md`](../STATE.md), then the project README. Non-Claude agents: [`AGENTS.md`](../AGENTS.md).

## aDNA memory (the cross-surface brain)

Project state and decisions are persisted to the **AI-Ally Interface MCP**. Before generating
anything, `recall` / `search` it so you do not fabricate or duplicate existing work.

- **Tags:** `gamers-lab`, `lead-gen`, `whitelabel`
- **Owner:** Ally (ally@lilypad.tech)
- The repo folders are the human-readable mirror; the MCP is the agent memory. Keep them in sync —
  when a decision is made, record it to the MCP under the tags above.

## The three project areas (quick reference)

1. **GamersLab POC** (`gamerslab-poc/`) — built, active, v1.
2. **Shared UI** (`poc/ui/`) — one source, two build modes; never forked.
3. **White-label v2** (`whitelabel/`) — design, pre-gate, does not run.

Cross-cutting campaign context lives at the repo root (`who/ what/ how/`).
