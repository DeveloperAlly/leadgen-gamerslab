# Lead Pipeline

A white-label, multi-tenant lead-generation pipeline UI, built in React + TypeScript (Vite).
Rebuilt from the design handoff (`../design_handoff_lead_pipeline/`) as production-shaped,
modular, portable code.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

No backend required — the app runs entirely on local fixtures.

## What this implements

The full 10-screen flow with the three human review gates:

**Sign in → Context drop → Guided intake → Venue map → Gate A (review understanding) →
Discovery → Gate B (review leads) → Dashboard → Sources → Prospect tracking (Gate C)** +
Settings.

- **Gate A** — editable AI understanding with confidence chips.
- **Gate B** — discovered leads with per-lead evidence dossiers and two-sided scores.
- **Gate C** — outreach drafts approved before they send, plus a 5-column prospect board.
- **Learn & iterate** — conversion factors + a suggested scoring refinement.

## Three architectural guarantees

### 1. Data is separated from the UI
No component hard-codes data. The flow is:

```
fixtures (src/data/fixtures/*)  →  leadService (src/data/leadService.ts)  →  store (src/state)  →  components
```

- `src/data/fixtures/` — all seed content (leads, evidence, venues, outreach, copy, tenant).
- `src/data/leadService.ts` — the **single seam** to data. Every method is async and maps
  1:1 to an endpoint in `docs/ENDPOINTS.md`.
- Components read state via `usePipeline()` and never import fixtures for display logic.

**To go live:** replace each `leadService` method body with a `fetch`. Return types are
unchanged, so nothing else has to change.

### 2. It is portable and modular
- No coupling to any host app. Standard Vite + React structure; lift `src/` into any React
  project.
- Icons are imported only from `src/components/icons` (one swap point over `lucide-react`).
- UI primitives in `src/components/ui` are self-contained and prop-driven.

### 3. Theming is runtime-swappable (the #1 design constraint)
- Every colour reads from a **token** (`var(--accent)`, `var(--bg-surface)`, …) — never a
  literal. Token sets live in `src/theme/tokens.ts`; `ThemeProvider` applies the active set
  as CSS custom properties.
- Switching themes changes only colour, logo tint, and type — **zero layout changes**.
- Seven themes ship (neutral white-label baseline + Gamers Lab + 5 presets). Add a tenant by
  registering one entry in `themes`. Try the live switcher (bottom-right floating control).

## Layout

```
src/
  theme/         tokens (data) · ThemeProvider · scoreColor
  data/          types · fixtures/ · leadService (the API seam)
  state/         pipelineReducer (pure) · PipelineProvider (side effects + actions)
  components/
    icons/       single icon seam over lucide-react
    ui/          Button, Input, Card, Chip, Dropzone, Stepper, GateBanner,
                 ScoreBadge, TwoSidedScore, Switch, SegmentedToggle, FieldCard,
                 LeadRow, VenueCard, ProspectCard, UsageMeter, Toast …
  layout/        Sidebar, TopBar, AppShell, OnboardingLayout, nav
  screens/       one file per screen (11)
  App.tsx        providers + screen router
docs/
  ENDPOINTS.md   the API contract every screen needs
```

## Scale tokens

Radius `8/12/16/999` · spacing `4·8·12·16·24·32·48` · type `12/14/16/20/28/36` (Inter).
Score colour-stepping: `≥85` success · `70–84` accent · `55–69` warning · `<55` danger.

## Notes

- `PrototypeControls` (bottom-right) is a demo aid for theme switching + restart — remove
  for production.
- Sign-in, discovery timing, and source parsing are simulated client-side; see
  `docs/ENDPOINTS.md` for how they map to real async jobs.
