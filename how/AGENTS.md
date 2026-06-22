# how/ — Process & Operations

Orientation for agents: this directory holds how the project works — critique, plans,
and (later) the build/runbooks.

## Contents

- `pipeline_critique.md` — critical analysis of the proposed end-to-end process pipeline,
  with gaps, risks, and research-grounded improvements. Self-critique gate output.
- `plan_poc_to_production.md` — the phased plan and tasklist from GamersLab POC to
  production-ready white-label product, with the modular/portable mandate baked in and the
  gated missions sequenced before any build.
- `infra_stack_and_layers_DRAFT.md` — **the HOW** (subordinate to `what/business_process_model_DRAFT.md`):
  the per-layer infra stack (foundations F1–F4 + spine L1–L7), every 2026 API verified, v9 patterns
  folded in. Embeds `infra_stack_diagram.svg`. Feeds Mission M2.
- `infra_stack_diagram.svg` — the foundations + pipeline-spine diagram (embedded in the doc above).
- `ui_design_prompt.md` — Mission M3 design brief to feed Claude Design for the UI.

Nothing here authorises a build. The build gate lives in `STATE.md`.
