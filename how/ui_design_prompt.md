# UI Design Prompt — for Claude Design (Mission M3)

> **How to use:** paste everything inside the `═══ PROMPT ═══` block into Claude Design.
> It is written so the design is **provably modular/white-label**: one layout, two themes
> (neutral default + GamersLab overlay). This is a **design-stage** artifact — it produces
> mockups for the gate, not a build. Aesthetic: **warm, approachable (Notion-like)**.

---

═══ PROMPT ═══

You are designing the UI for **a white-label lead-generation pipeline product**. The first
tenant is **Gamers Lab**, but the design must be a **portable template**: every screen reads
from theme tokens, so swapping the theme produces a different client's product with **zero
layout changes**. Treat that portability as the #1 acceptance test.

## Product in one line
A business drops in its context (files, website, socials), answers a short guided intake, and
the product produces a running lead-gen pipeline — discovering, scoring, and helping reach the
right customers (or investors). Two moments hand control to the human: **Gate A** (review the
AI's understanding of the business) and **Gate B** (review the discovered leads).

## Design intent
- **Warm and approachable (Notion-like).** Soft surfaces, generous whitespace, rounded corners,
  friendly humanist type, gentle guidance and microcopy. The user may be non-technical and
  slightly nervous — the UI should feel calm, trustworthy, and easy, never corporate or dense.
- **Quietly premium.** Restrained palette, crisp hierarchy. Confidence without noise.
- **Accessible.** WCAG AA contrast in BOTH themes, visible keyboard focus, ≥16px body text,
  clear labels, no meaning by colour alone.

## Theming system (build with tokens — this proves modularity)
Define abstract tokens and supply two value sets. **Use the token names everywhere; never
hard-code a colour or the word "Gamers Lab" into a layout.**

Tokens: `--bg-canvas`, `--bg-surface`, `--bg-subtle`, `--border`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-soft` (tint),
`--highlight` (secondary accent), `--success`, `--warning`, `--danger`, `--logo`.
Scale tokens: radius `--r-sm:8 --r-md:12 --r-lg:16`; spacing `4 8 12 16 24 32 48`;
type — humanist sans (e.g. Inter), sizes `12 / 14 / 16 / 20 / 28 / 36`, comfortable line-height.

**Theme 1 — Neutral Default (the white-label baseline, warm):**
| token | value |
|---|---|
| bg-canvas | #FAF9F6 (warm paper) |
| bg-surface | #FFFFFF |
| bg-subtle | #F3F1EC |
| border | #E7E4DD |
| text-primary | #2B2A27 |
| text-secondary | #6B6862 |
| text-muted | #9A968E |
| accent | #2F6F62 (calm teal-green) |
| accent-hover | #265B50 |
| accent-soft | #E5F0EC |
| highlight | #C9792E (warm amber, for gates/attention) |
| success / warning / danger | #2E7D5B / #B8860B / #B4453C |

**Theme 2 — GamersLab Overlay (same layout, applied theme):**
| token | value |
|---|---|
| bg-canvas | #0F1117 (deep) |
| bg-surface | #171A22 |
| bg-subtle | #1F2330 |
| border | #2B3040 |
| text-primary | #ECEEF5 |
| text-secondary | #A9B0C2 |
| text-muted | #6E7689 |
| accent | #7C5CFF (electric violet) |
| accent-hover | #6A49F0 |
| accent-soft | #211C3D |
| highlight | #B6FF3C (lime, for gates/attention) |
| success / warning / danger | #3CCB7F / #F5C451 / #FF6B6B |

Render the **key screens in BOTH themes** (at minimum: Context drop, Gate A, Gate B) so the
viewer can see the identical layout reskinned. This is the portability proof.

## Global structure & components
- **App shell:** slim left sidebar nav (Dashboard, Pipeline, Leads, Sources, Settings) + top bar
  (`--logo`, tenant name, account menu). Sidebar hidden during the onboarding flow (focused mode).
- **Onboarding flow:** a 3-step **stepper** — Context → Intake → Review — shown as a calm progress
  header. Big primary "Continue" button bottom-right; "Back" left.
- **Component kit to define:** Button (primary/secondary/ghost), Input/Textarea, File **Dropzone**,
  Source **Chip** (file/url/social with remove), **Card**, editable **Field card**, **Stepper**,
  **Gate banner** (a distinct, friendly "your turn to review" banner using `--highlight`),
  **Lead row** (logo, name, match-reason w/ source link, **Score badge**, approve/reject),
  **Score badge** (0–100, colour-stepped via tokens), **Usage meter**, **Empty/Loading states**,
  Toggle (Customers ⇄ Investors), Toast.

## The six screens (full flow)

**1 · Sign in.** Centered warm card on `--bg-canvas`. `--logo` mark, one-line reassurance, email
field + "Continue with Google". Tiny "How it works" link. States: default, loading, error.

**2 · Context drop** (onboarding step 1). Heading "Tell us about your business." Large friendly
**Dropzone** ("Drop files, or browse — PDFs, decks, docs"); below it two inputs: **Website URL**
and **Social handles** (add multiple → Chips). Added sources show as chips with a parsing
shimmer. Helper microcopy + example ("e.g. your one-pager, pitch deck, About page"). Reassurance:
"You can add more anytime." States: empty, sources added/parsing, error.

**3 · Guided intake** (onboarding step 2). A short, conversational form, one friendly section at a
time: *What do you offer / your value props* · *Who's your ideal customer* · *What outcome do you
want* (a **Customers ⇄ Investors** toggle at the top sets the mode) · *Where do you get leads
today* · *What makes a lead good for you*. Progress + "Save & continue". Calm, not a wall of fields.

**4 · Review & edit summary — GATE A** (onboarding step 3). **The most important screen.** A
warm **Gate banner**: "Here's what we understood — make it right before we go further." Then
editable **Field cards**: *Business summary* · *Ideal customer (ICP)* · *Pain points* · *Where to
find them* · *Channel recommendation* (cold vs warm/CRM-driven, with a one-line why). Each card is
inline-editable with a subtle "edit" affordance and a small AI-confidence chip. Primary: "Looks
right — find leads"; secondary: "Keep editing". States: review (AI-generated), editing, saved.

**5 · Review leads — GATE B.** Results of discovery. First an async **loading state** (friendly:
"Searching and verifying across the web…" with a progress feel, since this takes time). Then a
list of **Lead rows**: company/investor logo, name, **why it matches** (one line + a small source
link for trust), key enriched fields, and a **Score badge**. Per-row Approve/Reject + bulk select;
filter/sort by score; counts header ("18 found · 12 verified"). Gate banner: "Approve the ones
worth pursuing." Primary: "Export approved" / "Send to CRM". Empty + error states.

**6 · Dashboard.** Calm overview after onboarding. Cards: *Pipeline status*, *Sources ingested*,
*Leads discovered / approved*, *Channel recommendation*, *Recent runs*, *Next actions*. A
**Usage meter** (credits/cost — transparency builds trust). "Re-run discovery" button. Settings
entry exposes **model keys (bring-your-own)** and **theme**. Scannable, never busy.

## Prototype
Link the flow clickably: Sign in → Context drop → Intake → Gate A → (loading) → Gate B →
Dashboard. Make the two gate banners visually unmistakable as "human review" moments.

## Deliverables (from Claude Design)
1. A **tokens / style board** showing both themes side by side.
2. A **component kit** (the components listed above).
3. **Six screen layouts**, with the 3 key screens shown in **both themes**.
4. A **clickable prototype** of the full flow.

## Acceptance criteria (judge the design against these)
1. **Portability:** switching the theme token set (Neutral → GamersLab) changes only colour, logo
   and type — **layout and components are identical**. No "Gamers Lab" baked into structure.
2. **Non-technical-friendly:** a first-time, non-technical user could complete onboarding unaided.
3. **Gates are obvious:** Gate A and Gate B clearly read as "your turn to review and decide."
4. **Warmth + trust:** feels approachable and calm; discovery results show verification sources.
5. **Accessible:** AA contrast and clear focus in both themes.

═══ END PROMPT ═══

---

## Notes for Ally (not part of the prompt)
- The prompt deliberately forces **both themes** on the key screens — that's the live proof of the
  modular mandate from `CLAUDE.md` (§7). If a reviewer can reskin without moving a box, we're portable.
- Mode toggle **Customers ⇄ Investors** is included so the one-engine "customers AND fundraising"
  positioning (see `../what/research/competitor_analysis.md` §6, §8) shows up in the UI from day one.
- The two gate banners map exactly to **human gate A (summary)** and **human gate B (leads)** in the
  architecture (`pipeline_critique.md` §4). They are the quality moat — designed to be unmissable.
- Tweak the token hex values freely; they're starting points, not commitments.
