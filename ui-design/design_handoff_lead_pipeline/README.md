# Handoff: White-Label Lead-Generation Pipeline

## Overview
A white-label, multi-tenant lead-generation pipeline product. A business drops in its context
(files, website, socials), answers a short guided intake, confirms where its customers are, and
the product runs a lead-gen pipeline: discovering, scoring (two-sided), and helping reach the
right customers or investors. There are **three human review gates**:
- **Gate A** — review the AI's understanding of the business (editable summary).
- **Gate B** — review the discovered leads (each with an evidence dossier and two-sided score).
- **Gate C** — approve each outreach message before it sends (notification-driven).

The first tenant is **Gamers Lab**, but the product is a **portable template**: every screen reads
from abstract theme tokens, so swapping the token set reskins the entire product with **zero layout
changes**. Treat that portability as the #1 architectural constraint — never hard-code a colour or
the tenant name into layout/structure.

## About the Design Files
The files in this bundle are **design references created in HTML** — a single interactive prototype
showing the intended look and behaviour. They are **not production code to copy directly**. The task
is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI,
native, etc.) using its established patterns, component library, and state tooling. If no environment
exists yet, choose the most appropriate framework and implement there.

The prototype is authored as a "Design Component" (a streaming HTML format). Ignore that wrapper —
read it for layout, tokens, copy, and behaviour, then rebuild idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colours, typography, spacing, copy, and interactions are all
specified below and present in the prototype. Recreate the UI pixel-accurately using the codebase's
existing libraries, but honour the exact tokens and measurements in this README.

---

## Theming System (the core requirement)

Implement these as runtime-swappable tokens (CSS custom properties, a theme context/provider, or the
platform equivalent). **Every screen and component must read from token names — never literals.**
Switching the token set must change only colour, logo, and type; layout and components stay identical.

### Token names
`--bg-canvas`, `--bg-surface`, `--bg-subtle`, `--border`,
`--text-primary`, `--text-secondary`, `--text-muted`,
`--accent`, `--accent-hover`, `--accent-soft`, `--on-accent`,
`--highlight`, `--highlight-soft`, `--highlight-ink`,
`--success`, `--success-soft`, `--warning`, `--danger`, `--logo`,
`--shadow-sm`, `--shadow-md`.

### Theme 1 — Neutral Default (warm, light — the white-label baseline)
| token | value |
|---|---|
| bg-canvas | `#FAF9F6` |
| bg-surface | `#FFFFFF` |
| bg-subtle | `#F3F1EC` |
| border | `#E7E4DD` |
| text-primary | `#2B2A27` |
| text-secondary | `#6B6862` |
| text-muted | `#9A968E` |
| accent | `#2F6F62` |
| accent-hover | `#265B50` |
| accent-soft | `#E5F0EC` |
| on-accent | `#FFFFFF` |
| highlight | `#C9792E` |
| highlight-soft | `#F8ECD9` |
| highlight-ink | `#9A5816` |
| success / success-soft | `#2E7D5B` / `#E4F1E9` |
| warning | `#B8860B` |
| danger | `#B4453C` |
| logo | `#2F6F62` |
| shadow-sm | `0 1px 2px rgba(43,42,39,.05), 0 1px 3px rgba(43,42,39,.04)` |
| shadow-md | `0 8px 30px rgba(43,42,39,.10), 0 2px 8px rgba(43,42,39,.06)` |

### Theme 2 — Gamers Lab (dark — current default in the prototype)
Shared dark base for all dark themes:
| token | value |
|---|---|
| bg-canvas | `#0D1F2D` |
| bg-surface | `#15293A` |
| bg-subtle | `#1C3547` |
| border | `#294657` |
| text-primary | `#EAF1F6` |
| text-secondary | `#9FB3C2` |
| text-muted | `#62788B` |
| success / success-soft | `#3CCB7F` / `#16271F` |
| warning | `#F5C451` |
| danger | `#FF6B6B` |
| shadow-sm | `0 1px 2px rgba(0,0,0,.4)` |
| shadow-md | `0 10px 34px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.4)` |

Gamers Lab accent set (on the dark base):
| token | value |
|---|---|
| accent | `#7C5CFF` |
| accent-hover | `#6A49F0` |
| accent-soft | `#221C42` |
| on-accent | `#FFFFFF` |
| highlight | `#34D399` |
| highlight-soft | `#123026` |
| highlight-ink | `#34D399` |
| logo | `#7C5CFF` |

> The prototype also carried extra accent presets (midnight `#5B8BFF`, aqua `#2DD4BF`, emerald
> `#34D399`, ember `#FB923C`, rose `#FB6F92`) layered on the same dark base — keep the theming layer
> general enough to register more token sets, even though the live build is currently locked to Gamers Lab.

### Scale tokens
- **Radius:** sm `8px`, md `12px`, lg `16px`; pills/avatars fully rounded (`999px`).
- **Spacing scale (px):** `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- **Type:** humanist sans (prototype uses **Inter**). Sizes `12 / 14 / 16 / 20 / 28 / 36`. Body ≥16px.
  Weights 400/500/600/700. Headings letter-spacing `-0.02em`. Line-height ~1.5 body, ~1.05–1.2 headings.
  Eyebrows: 11–12px, weight 700, `letter-spacing .08em`, UPPERCASE.

### Score colour-stepping (used by all 0–100 badges and meters)
- `≥85` → `--success`
- `70–84` → `--accent`
- `55–69` → `--warning`
- `<55` → `--danger`

Badge background = the step colour at low alpha (≈13% on light themes, ≈18% on dark).

---

## Global Structure

- **App shell** (post-onboarding screens): slim left sidebar nav + top bar.
  - Sidebar (210px): logo + tenant name; nav items **Dashboard, Pipeline, Leads, Sources, Settings**;
    a **Usage meter** pinned to the bottom (credits, e.g. `320 / 1,000`, with a progress bar).
    Active item: `--accent` text on `--accent-soft` fill, radius 10px.
  - Top bar (58px): screen title (left); right side has a **notification bell** with a count badge
    (the badge uses `--highlight` with dark ink, shown when Gate C approvals are pending), tenant name,
    and a circular avatar (`--accent-soft` fill, `--accent` initial).
- **Onboarding flow** hides the sidebar (focused mode) and shows a **4-step stepper** header:
  **Context → Intake → Venues → Review**. Footer: "Back" (ghost, left) + primary "Continue"/"Save &
  continue" (right). Stepper: completed/active circles filled `--accent` with `--on-accent`; pending
  circles `--bg-subtle` with `--border` + `--text-muted`; connectors `--accent` when passed else `--border`.

### Reusable components to build
Button (primary / secondary / ghost — all pill-shaped), Input, Textarea, File **Dropzone**,
Source **Chip** (file/url/social, with parsing shimmer + remove), **Card** (radius 16, `--shadow-sm`),
editable **Field card**, **Stepper**, **Gate banner** (distinct "your turn to review" banner on
`--highlight-soft` with `--highlight` border + a `--highlight` icon tile), **Lead row** (with expandable
evidence dossier + two-sided score), **Score badge**, **two-sided score meter** (two thin bars),
**Venue card** (with toggle switch), **Prospect board card**, **Usage meter**, **Toast**,
**Toggle** (segmented Customers ⇄ Investors), Empty/Loading states.

---

## Screens / Views

The full flow order: **Sign in → Context drop → Guided intake → Venue map → Gate A → (Discovery
loading) → Gate B → Dashboard → Sources → Prospect tracking (Gate C).**

### 1 · Sign in
- **Purpose:** authenticate / enter the product.
- **Layout:** centered 380px column on `--bg-canvas`. Logo mark + tenant name + one-line reassurance
  ("Set up your lead pipeline in a few calm steps. We'll handle the searching — you stay in control.").
  A `--bg-surface` card (radius 16, `--shadow-md`, padding ~26px): "Work email" label, email input with
  a leading mail icon, primary **"Continue with email"** button (pill, full width), an "or" divider, and
  a secondary **"Continue with Google"** button (Google G mark). Below the card: small "How it works ↗" link.
- **States:** default; loading (spinner in the primary button); error (inline danger row "Enter a valid
  email to continue." shown when the email fails `/.+@.+\..+/`).

### 2 · Context drop (onboarding step 1)
- **Purpose:** ingest business context.
- **Layout:** 660px column. H1 "Tell us about your business." + helper copy. A large **Dropzone**
  (2px dashed `--border`, `--bg-subtle` fill, radius 16; hover → `--accent` border + `--accent-soft`
  fill) with an upload icon tile, "Drop files, or **browse**", and "PDFs, decks, docs — e.g. your
  one-pager, pitch deck, About page". Added sources render as **chips** (parsing shimmer → indexed check;
  remove ✕). Two inputs in a 2-col grid: **Website URL** (globe icon, + button) and **Social handles**
  (@ icon, + button) — Enter or + adds a chip. Privacy reassurance row with a lock icon.
- **States:** empty; sources added/parsing (chip shows an animated "parsing" pill for ~1.5s then an
  indexed check); error.

### 3 · Guided intake (onboarding step 2)
- **Purpose:** capture the business in the user's words.
- **Layout:** 660px column. Header with a **Customers ⇄ Investors** segmented toggle (top-right) that
  rewrites question copy. Stacked field cards (each `--bg-surface`, radius 16, `--shadow-sm`):
  *What do you offer?* · *Who's your ideal customer/investor?* · *What outcome do you want? / What are
  you raising for?* · then a 2-col row: *Where do leads come from today?* · *What makes a lead good?*
  Each card: 16px label, muted sub-label, textarea.
- **Toggle copy swaps** (Customers → Investors):
  - Q2 label: "Who's your ideal customer?" → "Who's your ideal investor?"
  - Q3 label: "What outcome do you want?" → "What are you raising for?"
  - plus matching placeholders.

### 4 · Venue map (onboarding step 3) — *differentiated screen*
- **Purpose:** the client confirms **where their customers actually are** before discovery runs.
  Discovery only searches enabled venues.
- **Layout:** 680px column. Eyebrow "VENUE MAP" with a pin icon; H1 "Where do your customers actually
  hang out?"; helper copy showing the active count ("**N active.**"). A vertical list of **venue cards**;
  each card: a pin-icon tile, the venue name + a strength badge ("Strong signal" `--success` /
  "Medium" `--warning` / "Weak" `--text-muted`), a `platform · note` sub-line, and a **toggle switch**
  (42×25 track; `--accent` on / `--bg-subtle` off; white knob slides). Disabled venues dim to ~55% and
  use `--border`; enabled use `--accent` border. Below the list: an input + "Add" button to add a custom
  venue (forum, subreddit, Discord, event).
- **Seed venues:** Steam upcoming/wishlists (strong), r/gamedev & r/IndieDev (strong), game showcases
  WASD/Day of the Devs (strong), indie dev Discords (medium), X/Twitter gamedev (medium),
  LinkedIn studios/publishers (weak, off), TikTok/YouTube devlogs (weak, off).

### 5 · Gate A — Review & edit summary (onboarding step 4) — *most important onboarding screen*
- **Purpose:** the human confirms/corrects the AI's understanding before discovery.
- **Layout:** 720px column. A **Gate banner** ("YOUR TURN TO REVIEW" / "Here's what we understood" /
  "Make it right before we go further. Edit anything that's off — your leads are only as good as this.").
  Then editable **Field cards**: *Business summary* · *Ideal customer (ICP)* · *Pain points* · *Where to
  find them* · *Channel recommendation* (the last includes a one-line italic "why"). Each card header
  has the title, a small **AI-confidence chip** (High `--success` / Medium `--warning` / Low `--text-muted`,
  with a shield/alert icon), and an "Edit" affordance. Editing swaps the body for a textarea (accent
  border) + Save/Cancel; Save shows a "Saved" toast. Footer: "Keep editing" (ghost, left) +
  primary "Looks right — find leads →" (right) which kicks off discovery.

### 6 · Discovery (loading)
- **Purpose:** async search + verify; this takes real time so it must feel reassuring.
- **Layout:** centered 440px column. A spinner ring around a search icon, H2 "Searching and verifying
  across the web…", a rotating status line (e.g. "Reading your business context…", "Scanning Steam,
  funding feeds & showcases…", "Cross-checking signals across the web…", "Verifying and scoring
  matches…"), a progress bar (0→100%), and "X% complete · This can take a minute — you can leave and
  we'll save it." On 100%, transition to Gate B.

### 7 · Gate B — Review leads — *differentiated screen*
- **Purpose:** the human approves/rejects discovered leads.
- **Layout:** in the app shell (sidebar + top bar). 920px content column. A **Gate banner** ("YOUR TURN
  TO REVIEW" / "Approve the ones worth pursuing" / "We found and verified these against live sources.
  Keep the good fits, skip the rest — only approved leads move forward."). A counts header
  ("18 found · N verified · N approved") plus a **"Verified only"** filter toggle and a
  **score sort** toggle (high→low / low→high). Then a list of **Lead rows**.
- **Lead row** (`--bg-surface`, radius 14, `--shadow-sm`; border becomes `--accent` when expanded,
  `--success`/`--danger` when approved/rejected; rejected rows dim to 55%):
  - Left: 46px initials tile.
  - Middle: name + a "Verified" pill (`--success`/`--success-soft` with shield) when verified; a
    one-line **match reason**; a row with a **source link** (external-link icon) + meta chips
    (e.g. "14 people", "Seattle", "38k wishlists"); and an **"Evidence dossier · N signals"** disclosure button.
  - Right (140px): the composite **Score badge** (0–100, colour-stepped) on top of a **two-sided score**:
    two labelled thin meters — **"Value to you"** and **"Prospect match"** (each 0–100, colour-stepped,
    its own bar). Below: round **Reject (✕)** and **Approve (✓)** buttons (approve fills `--success`
    when active; reject fills `--danger` when active).
  - **Evidence dossier** (expands below the row, separated by a top border): heading "WHY THIS IS A
    MATCH — THE EVIDENCE", then a list of quoted evidence items, each with a left accent rule, the quote
    in `--text-primary`, and a `source-link · date` line. This per-lead painpoint-evidence dossier is the moat.
- **Footer:** "N leads approved" (left) + "Send to CRM" (secondary) + "Export N approved →" (primary).
- **States:** loading (screen 6), populated, empty, error.

### 8 · Dashboard
- **Purpose:** calm post-onboarding overview.
- **Layout:** in the shell. 980px column. Header "Your pipeline is live." + "Re-run discovery" primary
  button (refresh icon). Then a 3-up stat card row: **Pipeline status** (Active, success dot, "Last run
  2h ago · auto-refresh weekly"), **Leads** (approved/found with a success progress bar), **Sources
  ingested** ("5 files · 1 site · 2 socials"). A 2-col row: **Recent runs** (list with status dots) +
  a right column with a **Channel recommendation** card (on `--highlight-soft`/`--highlight`: "Warm-first,
  CRM-driven") and a **Next actions** checklist. Below, full-width: the **Learn & iterate** panel.
- **Learn & iterate panel** (Stage 5 — *differentiated*): heading + "The engine watches what actually
  converts and tunes your scoring." Left half: **"What's converting"** — labelled horizontal bars
  (e.g. "Recently funded 62%", "Founder posted about playtest pain 54%", "Steam wishlist surge 48%",
  "Found via Reddit / r/gamedev 41%", "Found via LinkedIn 14%"), colour-stepped. Right half:
  **"Suggested refinement"** card on `--highlight-soft`: "The engine noticed — prospects found on
  Reddit / r/gamedev are converting 2.9× better than LinkedIn. Want me to weight community signals
  higher and de-prioritise LinkedIn on the next run?" with **"Apply refinement"** (primary) + "Dismiss".
- **Settings** (entry from sidebar) should expose **bring-your-own model keys** and **theme** selection.

### 9 · Sources (ongoing management)
- **Purpose:** add/remove context anytime after onboarding (re-run discovery to pick up new signals).
- **Layout:** in the shell. 840px column. H1 "Sources" + helper. A card with the Dropzone + the two
  add inputs (website / social). Then "Ingested · N" and a list of **source rows** (icon tile, label,
  type label, an "Indexed"/"Parsing…" pill, remove button).

### 10 · Prospect tracking — Gate C (sidebar "Pipeline") — *differentiated screen*
- **Purpose:** approve outreach messages (Gate C) and track every prospect through outcomes.
- **Layout:** in the shell. 920px column.
  - If approvals are pending: a **Gate banner** with a bell icon — "YOUR TURN TO REVIEW" / "N messages
    need your approval before they send" / "Nothing goes out without your sign-off."
  - A 3-up summary row: **Contacted**, **Replied**, **Success** (success count in `--success`).
  - **"Awaiting your approval"** section: per-message cards (`--highlight` border) with the prospect,
    channel, an "Awaiting approval" pill, the **draft message** in a readable block, and actions:
    **"Approve & send"** (primary, send icon), "Edit draft", "Skip". Approving moves the prospect to
    Contacted and fires a "Message approved & sent" toast; skipping moves it to Lost.
  - **Prospect board:** a 5-column board — **Contacted → Replied → Success → Partial → Lost** — each
    column has a coloured header rule + count, and small prospect cards (initials, name, channel, last-event line).

## Interactions & Behavior
- **Navigation:** the prototype links the whole flow; in production wire real routing. Onboarding
  Continue/Back advances the stepper; "Looks right — find leads" → discovery → Gate B; sidebar nav
  jumps between Dashboard / Pipeline(=Prospect tracking) / Leads(=Gate B) / Sources / Settings.
- **Notification bell** in the top bar shows the count of pending Gate-C approvals and links to Prospect tracking.
- **Discovery** runs a timed progress simulation in the prototype (~6–15% steps every ~380ms with a
  rotating status line); replace with real async job + polling/streaming.
- **Lead actions:** approve/reject toggle per row; "Verified only" filter; score sort toggle; dossier expand/collapse.
- **Gate A editing:** inline textarea edit per field card with Save/Cancel + toast.
- **Venue toggles** enable/disable search venues; custom venues can be added.
- **Animations:** entrances rise a few px (transform-only, ~0.4s ease). Toasts fade in near bottom-center,
  auto-dismiss ~1.9s. Toggle knob + switch fills animate ~0.15s. Respect `prefers-reduced-motion`.
- **Hover/press:** primary buttons darken to `--accent-hover`; cards/ghosts lift to `--bg-subtle`;
  focus-visible = 2px `--accent` outline, 2px offset.

## State Management
- `theme` (token-set key; default `gamerslab`), `mode` (`customers` | `investors`).
- `screen`/route. `email`, `signinState` (idle/loading/error).
- `sources[]` (`{type, label, parsing, done}`), `websiteInput`, `socialInput`.
- `intake{}` (offer, icp, outcome, leadsToday, goodLead).
- `venues[]` (`{name, platform, strength, note, on}`), `venueInput`.
- `fields{}` (Gate A: each `{text, conf, why?}`), `editingField`, `editDraft`.
- `leads[]` (`{name, initials, score, valueScore, matchScore, verified, reason, source, meta[], venue,
  evidence[{q,src,date}], status: pending|approved|rejected}`), `expandedLead`, `sortDesc`, `onlyVerified`.
- `outreach[]` (`{name, initials, channel, stage: awaiting|contacted|replied|success|partial|lost,
  draft?, last?}`).
- Derived: found/verified/approved counts, contacted/replied/success totals, pending approvals, approved %.
- Data fetching (production): context parsing/indexing jobs; discovery+verification job (long-running);
  enrichment; outreach send + reply tracking; the learn/iterate scoring model.

## Assets
- **Icons:** all icons in the prototype are inline SVG paths (Lucide-style, 2px stroke, round caps).
  Use the codebase's existing icon set (Lucide recommended): mail, upload, globe, at, x, check, search,
  edit, sparkles, arrow-right/left, external-link, home, git-flow, users, layers, sliders, refresh,
  shield, plus, lock, bell, send, clock, reply, calendar, chevron, map-pin, target, trending-up, gift.
- **Logo:** placeholder diamond/portal mark tinted with `--logo`. Replace per tenant (`--logo` token + a
  swappable mark — that's the only brand asset change needed to reskin).
- **Fonts:** Inter (Google Fonts) in the prototype — substitute the codebase's humanist sans if it has one.
- No bitmap images; company "logos" in lead rows are initials tiles.

## Files
- `Lead Pipeline Prototype.dc.html` — the full interactive prototype (all 10 screens, real state,
  Gate A/B/C, venue map, two-sided scoring, evidence dossier, prospect board, learn & iterate).
  Default theme is Gamers Lab (dark). Read the logic class for exact seed data, copy, and token values.
- `Lead Pipeline Prototype (standalone).html` — self-contained offline build of the same prototype
  (fonts + runtime inlined). Open this directly in a browser to click through the flow — no server needed.
- `Design Board.dc.html` — a static board showing the token sets (both themes), the component kit, and
  the screens as labelled frames. Good reference for tokens and component anatomy.
