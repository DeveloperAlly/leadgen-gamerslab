/**
 * GamersLab fixed config for the onboarding surfaces.
 *
 * The GamersLab pipeline has no per-user Sources/Intake/Venues/Gate-A backing — the ICP,
 * venues (Steam), and business understanding are baked into the v10 workflow's prompts
 * and CAG block. For v1 these endpoints serve this fixed config so the app runs end-to-end.
 * In v2 (whitelabel) these become real per-tenant rows. Content sourced from
 * docs/cag-block.md, docs/spec.md, and docs/requirements.md.
 */

import type { DashboardInsights, GateFields, Intake, Source, Venue } from "./types.ts";

export const TENANT = { name: "Gamers Lab", defaultTheme: "gamerslab" } as const;

/** Daily LLM draft budget acts as the usage cap (OpenRouter free → 1,000/day after $10). */
export const USAGE_LIMIT = 1000;

export const SOURCES: Source[] = [
  { id: "src-cag", type: "file", label: "GamersLab product brief (CAG)", parsing: false, done: true },
  { id: "src-site", type: "url", label: "gamerslab.gg", parsing: false, done: true },
  { id: "src-stats", type: "file", label: "Case studies — revenue / DLC / CCU", parsing: false, done: true },
];

export const INTAKE: Intake = {
  offer:
    "A permissioned data layer plus UGC app suite (Grudge Goblin, Tournament Garden) that " +
    "lifts revenue, DLC attach, and concurrent players for existing Steam titles.",
  icp:
    "Indie and mid-size Steam publishers with multiplayer-leaning titles (roguelite, survival, " +
    "battle royale, fighting, strategy, sports) in launch or growth phase.",
  outcome: "Booked intro calls with publishers who integrate a GamersLab UGC app.",
  leadsToday: "Manual Steam browsing and generic cold email — slow, low reply rate.",
  goodLead:
    "A publisher with a live or just-launched multiplayer title, a reachable decision-maker, " +
    "and a real pain signal we can reference.",
};

export const VENUES: Venue[] = [
  { id: "venue-steam", name: "Steam", platform: "Steam (SteamSpy)", strength: "strong", note: "Primary discovery source — genre-tagged catalogue.", on: true },
  { id: "venue-reddit", name: "Reddit", platform: "r/gamedev, r/indiegaming", strength: "medium", note: "Founder participation + pain signals.", on: false },
  { id: "venue-x", name: "X / Twitter", platform: "X", strength: "medium", note: "Founder announcements and quotes.", on: false },
  { id: "venue-itch", name: "itch.io", platform: "itch.io", strength: "weak", note: "Some indie publishers list direct contacts.", on: false },
];

export const GATE_FIELDS: GateFields = {
  summary: {
    text:
      "GamersLab is a permissioned data layer and UGC app suite for game publishers. Integrations " +
      "have driven +31% revenue and +115% concurrent players by year five on existing titles.",
    conf: "high",
  },
  icp: {
    text:
      "Steam publishers of multiplayer-leaning games (roguelite, survival, battle royale, fighting, " +
      "strategy, sports) in launch or growth phase, small enough to act but established enough to integrate.",
    conf: "high",
  },
  pains: {
    text:
      "Publishers struggle to sustain concurrent players, retention, and DLC attach after launch; " +
      "mature titles decline without new engagement loops.",
    conf: "medium",
  },
  where: {
    text: "Steam — discovered via SteamSpy genre tags, enriched with Steam store + web intel.",
    conf: "high",
    why: "The full target population lists on Steam with public signals to score against.",
  },
  channel: {
    text: "Personalised cold email referencing a founder quote or player signal, 100–130 words, one stat, one CTA.",
    conf: "high",
    why: "Publishers respond to specific, researched outreach over generic pitches.",
  },
};

export const INSIGHTS: DashboardInsights = {
  converting: [
    { label: "Gold intel (founder quote)", pct: 48 },
    { label: "Multiplayer / PvP titles", pct: 31 },
    { label: "Launch / growth phase", pct: 21 },
  ],
  refinement:
    "Prioritise publishers with gold-tier intel and a live multiplayer title; deprioritise no-signal rows.",
  channelRecommendation: {
    title: "Email with researched intel",
    body:
      "Cold email that opens with a founder quote or player signal outperforms generic outreach. " +
      "Keep it 100–130 words, lead with one real stat, end with one CTA question.",
  },
};
