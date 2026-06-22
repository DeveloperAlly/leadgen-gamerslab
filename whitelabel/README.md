# White-label v2

> **Status: DESIGN — pre-gate. Nothing here builds yet.** This is the productisation of the
> GamersLab POC into a modular, multi-tenant white-label product. See the root [`CLAUDE.md`](../CLAUDE.md)
> and [`STATE.md`](../STATE.md) for the gate.

## What this is

v2 keeps the **exact** Edge-Function surface and the **same UI source** (`../poc/ui/`, default
build mode), and swaps the backend underneath (generic schema, Exa/OpenRouter, per-tenant config).
The UI never changes between v1 and v2 — that is the whole point of the modular mandate.

## Source-of-truth specs (in the root campaign context, not duplicated here)

| Spec | Path |
|------|------|
| Verified architecture (M2) | [`../how/architecture_spec_M2_DRAFT.md`](../how/architecture_spec_M2_DRAFT.md) |
| Phase delivery | [`../how/v2_phase_delivery_DRAFT.md`](../how/v2_phase_delivery_DRAFT.md) |
| System architecture diagram | [`../how/v2_system_architecture.svg`](../how/v2_system_architecture.svg) |
| Build packages | [`../how/v2_build_packages.svg`](../how/v2_build_packages.svg) |
| Data model (ERD) | [`../how/v2_data_model_erd.svg`](../how/v2_data_model_erd.svg) |
| Phase roadmap | [`../how/v2_phase_roadmap.svg`](../how/v2_phase_roadmap.svg) |
| Infra stack & layers | [`../how/infra_stack_and_layers_DRAFT.md`](../how/infra_stack_and_layers_DRAFT.md) |
| Onboarding doc-first pre-fill (Stage 1) | [`../how/v2_onboarding_prefill_spec_DRAFT.md`](../how/v2_onboarding_prefill_spec_DRAFT.md) |
| Client intake design (questions + doc pack) | [`../what/client_intake_design_DRAFT.md`](../what/client_intake_design_DRAFT.md) |
| POC → production plan | [`../how/plan_poc_to_production.md`](../how/plan_poc_to_production.md) |
| Product requirements | [`../what/research/product_requirements_DRAFT.md`](../what/research/product_requirements_DRAFT.md) |

## When the gate opens

Build code lands **here** (`whitelabel/`). Until then this folder is a scaffold — design only.
