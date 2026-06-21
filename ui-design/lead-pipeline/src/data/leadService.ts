/**
 * Data-access seam.
 *
 * This is the ONLY module the UI talks to for data. Today it resolves from local
 * fixtures so the app runs with no backend. To go live, replace each method body
 * with a `fetch` to the matching endpoint in docs/ENDPOINTS.md — the return types
 * are unchanged, so no component or store code has to change.
 *
 * Every method is async on purpose: it models the real network boundary even while
 * backed by fixtures, so swapping in HTTP later is a body-only change.
 */

import { tenant, usage } from "./fixtures/tenant";
import {
  seedDashboardInsights,
  seedFoundCount,
  seedGateFields,
  seedIntake,
  seedLeads,
  seedOutreach,
  seedSources,
  seedVenues,
} from "./fixtures/seed";
import type {
  DashboardInsights,
  GateFields,
  Intake,
  Lead,
  Mode,
  OutreachItem,
  Source,
  SourceType,
  Venue,
} from "./types";

/** Simulated network latency for the fixture backend (ms). Set 0 to disable. */
const LATENCY = 0;

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

const resolve = <T>(value: T): Promise<T> =>
  new Promise((res) => setTimeout(() => res(clone(value)), LATENCY));

let idSeq = 0;
const nextId = (prefix: string): string => {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
};

export interface DiscoveryResult {
  leads: Lead[];
  foundCount: number;
}

export const leadService = {
  /* ---- Bootstrap ---- */

  /** GET /api/tenant — tenant config + usage. */
  getTenant: () => resolve({ tenant, usage }),

  /* ---- Onboarding ---- */

  /** GET /api/sources — already-ingested context sources. */
  getSources: (): Promise<Source[]> => resolve(seedSources),

  /**
   * POST /api/sources — register a new context source. The backend kicks off a
   * parse/index job; the UI shows the parsing state until {@link getSource} reports done.
   */
  addSource: (type: SourceType, label: string): Promise<Source> =>
    resolve<Source>({ id: nextId("src"), type, label, parsing: true, done: false }),

  /** DELETE /api/sources/:id */
  removeSource: (_id: string): Promise<void> => resolve(undefined),

  /** GET /api/intake — saved guided-intake answers. */
  getIntake: (): Promise<Intake> => resolve(seedIntake),

  /** PUT /api/intake — persist intake answers. */
  saveIntake: (intake: Intake): Promise<Intake> => resolve(intake),

  /** GET /api/venues — suggested + confirmed search venues. */
  getVenues: (): Promise<Venue[]> => resolve(seedVenues),

  /** PATCH /api/venues — persist the enabled venue set + custom venues. */
  saveVenues: (venues: Venue[]): Promise<Venue[]> => resolve(venues),

  /* ---- Gate A: understanding ---- */

  /** GET /api/understanding — the AI's editable understanding of the business. */
  getGateFields: (): Promise<GateFields> => resolve(seedGateFields),

  /** PUT /api/understanding — persist edited understanding fields. */
  saveGateFields: (fields: GateFields): Promise<GateFields> => resolve(fields),

  /* ---- Discovery + Gate B ---- */

  /**
   * POST /api/discovery/run — start the long-running discovery + verification job.
   * Production: returns a job id to poll/stream. Fixtures resolve immediately with
   * the seed leads; the progress animation is driven client-side.
   */
  runDiscovery: (_mode: Mode): Promise<DiscoveryResult> =>
    resolve({ leads: seedLeads, foundCount: seedFoundCount }),

  /** GET /api/leads — discovered leads with evidence + two-sided scores. */
  getLeads: (): Promise<Lead[]> => resolve(seedLeads),

  /** PATCH /api/leads/:id — approve / reject / reset a lead. */
  setLeadStatus: (_id: string, _status: Lead["status"]): Promise<void> => resolve(undefined),

  /** POST /api/leads/export — export approved leads (returns a file/url in prod). */
  exportApproved: (_ids: string[]): Promise<void> => resolve(undefined),

  /** POST /api/crm/sync — push approved leads to the connected CRM. */
  sendToCrm: (_ids: string[]): Promise<void> => resolve(undefined),

  /* ---- Gate C: outreach ---- */

  /** GET /api/outreach — prospects across the board + drafts awaiting approval. */
  getOutreach: (): Promise<OutreachItem[]> => resolve(seedOutreach),

  /** POST /api/outreach/:id/approve — approve & send a drafted message. */
  approveOutreach: (_id: string): Promise<void> => resolve(undefined),

  /** POST /api/outreach/:id/skip — skip a draft (moves prospect to Lost). */
  skipOutreach: (_id: string): Promise<void> => resolve(undefined),

  /* ---- Learn & iterate ---- */

  /** GET /api/insights — conversion factors + suggested refinement. */
  getDashboardInsights: (): Promise<DashboardInsights> => resolve(seedDashboardInsights),

  /** POST /api/insights/refinement/apply — apply the suggested scoring refinement. */
  applyRefinement: (): Promise<void> => resolve(undefined),
};

export type LeadService = typeof leadService;
