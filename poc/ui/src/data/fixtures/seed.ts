import type {
  DashboardInsights,
  GateFields,
  Intake,
  Lead,
  OutreachItem,
  Source,
  Venue,
} from "../types";

/**
 * Seed data for the demo tenant (Gamers Lab). This is the ONLY place demo content
 * lives — components never hard-code data. To go live, replace the values returned
 * by leadService with API responses (see docs/ENDPOINTS.md); these fixtures stay as
 * fallback / storybook / offline data.
 */

export const seedSources: Source[] = [
  { id: "src-1", type: "file", label: "GamersLab-onepager.pdf", parsing: false, done: true },
];

export const seedIntake: Intake = {
  offer: "Structured playtesting + player analytics for game studios.",
  icp: "Indie & mid-size studios shipping PC/console games.",
  outcome: "Book demos with studios that are pre-launch.",
  leadsToday: "Community events, Discord, word of mouth.",
  goodLead: "Funded, pre-launch, no in-house research.",
};

export const seedGateFields: GateFields = {
  summary: {
    text: "Gamers Lab helps indie and mid-size game studios run structured playtests and turn scattered session data into clear, shippable design decisions — before launch, not after.",
    conf: "high",
  },
  icp: {
    text: "Studios of 5–60 people building PC or console games, usually post-prototype and 6–18 months from launch, with no dedicated player-research role.",
    conf: "medium",
  },
  pains: {
    text: "Feedback lives in Discord threads and spreadsheets. Small teams can't staff research, so they often discover what's broken after release — when fixes are slow and costly.",
    conf: "high",
  },
  where: {
    text: 'Steam "upcoming" pages, recently-funded studios (game funds, Kickstarter), indie showcases (Day of the Devs, WASD), r/gamedev, and game-industry LinkedIn.',
    conf: "medium",
  },
  channel: {
    text: "Warm-first, CRM-driven. Many studios already meet Gamers Lab at community events — lead with warm intros and event follow-ups, and reserve cold outreach for newly-funded teams.",
    conf: "low",
    why: "Your strongest signal is existing community presence, not cold volume.",
  },
};

export const seedVenues: Venue[] = [
  { id: "venue-1", name: 'Steam — "Upcoming" & wishlists', platform: "Steam", strength: "strong", note: "Where pre-launch studios show traction", on: true },
  { id: "venue-2", name: "r/gamedev & r/IndieDev", platform: "Reddit", strength: "strong", note: "Founders openly discuss playtest pains", on: true },
  { id: "venue-3", name: "Game showcases — WASD, Day of the Devs", platform: "Events", strength: "strong", note: "Warm, high-intent — you already attend", on: true },
  { id: "venue-4", name: "Indie dev Discords", platform: "Discord", strength: "medium", note: "High-trust communities, slower to reach", on: true },
  { id: "venue-5", name: "X / Twitter gamedev", platform: "X", strength: "medium", note: "Public signals & founder posts", on: true },
  { id: "venue-6", name: "LinkedIn — studios & publishers", platform: "LinkedIn", strength: "weak", note: "Better for larger studios", on: false },
  { id: "venue-7", name: "TikTok / YouTube devlogs", platform: "Video", strength: "weak", note: "Emerging signal, noisy", on: false },
];

/** The total "found" count reported at Gate B (some are below the display cut). */
export const seedFoundCount = 18;

export const seedLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Pixel Forge Studios",
    initials: "PF",
    score: 94,
    valueScore: 92,
    matchScore: 96,
    verified: true,
    reason: 'Closed a $2.1M seed and posted a "first UX hire" role — actively building a research function.',
    source: "TechCrunch",
    meta: ["14 people", "Seattle", "38k wishlists"],
    venue: "Steam",
    status: "pending",
    evidenceStrength: "explicit",
    evidence: [
      { q: "We just hired our first UX person and we’re building research from scratch.", src: "Founder · LinkedIn", date: "3d ago" },
      { q: "$2.1M seed round announced, led by a dedicated gaming fund.", src: "TechCrunch", date: "1w ago" },
      { q: "38,000 Steam wishlists on a title that hasn’t shipped yet.", src: "SteamDB", date: "Today" },
    ],
  },
  {
    id: "lead-2",
    name: "Hollow Oak Interactive",
    initials: "HO",
    score: 88,
    valueScore: 86,
    matchScore: 90,
    verified: true,
    reason: 'Wishlists surging on an unreleased title; founder posted about "flying blind on playtest data."',
    source: "Steam · X",
    meta: ["9 people", "Remote", "Pre-launch"],
    venue: "Reddit",
    status: "pending",
    evidenceStrength: "inferred",
    evidence: [
      { q: "Honestly flying blind on playtest data right now — it’s all vibes.", src: "Founder · X", date: "2d ago" },
      { q: "Wishlist velocity up 3× this month.", src: "Steam", date: "5d ago" },
    ],
  },
  {
    id: "lead-3",
    name: "Neon Drift Games",
    initials: "ND",
    score: 81,
    valueScore: 84,
    matchScore: 78,
    verified: true,
    reason: "Second title in production; hiring two designers this quarter.",
    source: "LinkedIn",
    meta: ["28 people", "Berlin", "Series A"],
    venue: "LinkedIn",
    status: "pending",
    evidence: [
      { q: "Hiring 2 game designers as we scale content for our next title.", src: "LinkedIn Jobs", date: "1w ago" },
      { q: "Second title officially entered production.", src: "Press release", date: "2w ago" },
    ],
  },
  {
    id: "lead-4",
    name: "Voxel Republic",
    initials: "VR",
    score: 74,
    valueScore: 70,
    matchScore: 78,
    verified: true,
    reason: "Featured at the WASD 2026 showcase; pre-launch with no research tooling detected.",
    source: "WASD",
    meta: ["11 people", "London"],
    venue: "Events",
    status: "pending",
    evidence: [
      { q: "Showcased an unreleased build at WASD 2026.", src: "WASD lineup", date: "3w ago" },
      { q: "No research or analytics tooling detected in their stack.", src: "Enrichment", date: "Today" },
    ],
  },
  {
    id: "lead-5",
    name: "Starbound Collective",
    initials: "SC",
    score: 66,
    valueScore: 64,
    matchScore: 68,
    verified: false,
    reason: "Active in r/gamedev about playtest pains; small but highly engaged.",
    source: "Reddit",
    meta: ["5 people", "Austin"],
    venue: "Reddit",
    status: "pending",
    evidence: [
      { q: "How do you all run playtests without a budget or a research hire?", src: "r/gamedev", date: "4d ago" },
    ],
  },
  {
    id: "lead-6",
    name: "Lumen Tactics",
    initials: "LT",
    score: 58,
    valueScore: 60,
    matchScore: 56,
    verified: false,
    reason: "Early prototype stage — fit is plausible but timing may be too early.",
    source: "itch.io",
    meta: ["4 people", "Remote"],
    venue: "X",
    status: "pending",
    evidenceStrength: "none",
    riskFlags: [
      { flag: "early_stage", evidence: "Pre-vertical-slice prototype; timing likely too early", source: "itch.io" },
    ],
    evidence: [
      { q: "Posted an early prototype gif — pre-vertical-slice.", src: "itch.io", date: "1w ago" },
    ],
  },
  {
    id: "lead-7",
    name: "Granite & Gold",
    initials: "GG",
    score: 41,
    valueScore: 44,
    matchScore: 38,
    verified: false,
    reason: "Mobile-first studio; partial ICP match with a platform mismatch.",
    source: "App Store",
    meta: ["18 people", "Toronto"],
    venue: "LinkedIn",
    status: "pending",
    evidence: [
      { q: "Mobile-first F2P title in soft launch.", src: "App Store", date: "2w ago" },
    ],
  },
];

export const seedOutreach: OutreachItem[] = [
  { id: "out-1", name: "Pixel Forge Studios", initials: "PF", channel: "Warm intro", stage: "awaiting", subject: "Pixel Forge playtests, structured before launch", body: "Hi Maya, huge congrats on the seed. Saw you’re standing up a UX research function. We help studios run structured playtests and turn the data into clear design calls before launch. Worth a 20-min look next week?" },
  { id: "out-2", name: "Hollow Oak Interactive", initials: "HO", channel: "Cold email", stage: "awaiting", subject: "Turning playtest feedback into shippable calls", body: "Hi, noticed wishlists climbing on your next title. We help small teams turn scattered playtest feedback into shippable design decisions, fast. Open to a quick intro this week?" },
  { id: "out-3", name: "Neon Drift Games", initials: "ND", channel: "Warm intro", stage: "contacted", last: "Sent 1d ago" },
  { id: "out-8", name: "Maple & Bit", initials: "MB", channel: "Cold email", stage: "contacted", last: "Sent 3d ago" },
  { id: "out-4", name: "Voxel Republic", initials: "VR", channel: "Cold email", stage: "replied", last: "Replied 4h ago" },
  { id: "out-9", name: "Ashen Foundry", initials: "AF", channel: "Warm intro", stage: "replied", last: "Replied 1d ago" },
  { id: "out-5", name: "Lumen Tactics", initials: "LT", channel: "Warm intro", stage: "success", last: "Demo booked — trialing" },
  { id: "out-6", name: "Starbound Collective", initials: "SC", channel: "Cold email", stage: "partial", last: "Interested, not now" },
  { id: "out-7", name: "Granite & Gold", initials: "GG", channel: "Cold email", stage: "lost", last: "No fit — platform mismatch" },
];

export const seedDashboardInsights: DashboardInsights = {
  converting: [
    { label: "Recently funded", pct: 62 },
    { label: "Founder posted about playtest pain", pct: 54 },
    { label: "Steam wishlist surge", pct: 48 },
    { label: "Found via Reddit / r/gamedev", pct: 41 },
    { label: "Found via LinkedIn", pct: 14 },
  ],
  refinement:
    "The engine noticed — prospects found on Reddit / r/gamedev are converting 2.9× better than LinkedIn. Want me to weight community signals higher and de-prioritise LinkedIn on the next run?",
  channelRecommendation: {
    title: "Warm-first, CRM-driven",
    body: "Lead with warm intros and event follow-ups. Reserve cold outreach for newly-funded teams.",
  },
};
