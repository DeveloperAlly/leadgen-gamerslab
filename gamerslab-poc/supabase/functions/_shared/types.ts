/**
 * UI contract types — the shape the React app expects.
 *
 * These mirror `poc/ui/src/data/types.ts` EXACTLY. The integration
 * layer's only job is to map GamersLab's `publishers` rows onto these shapes, so the UI
 * runs on real data without a single component change. When v2 (whitelabel) swaps the
 * backend, it implements this same contract — the UI never knows which backend answered.
 *
 * Keep in lockstep with the UI types file. If the UI types change, change these.
 */

export type Mode = "customers" | "investors";

export type SourceType = "file" | "url" | "social";

export interface Source {
  id: string;
  type: SourceType;
  label: string;
  parsing: boolean;
  done: boolean;
}

export interface Intake {
  offer: string;
  icp: string;
  outcome: string;
  leadsToday: string;
  goodLead: string;
}

export type Confidence = "high" | "medium" | "low";

export interface GateField {
  text: string;
  conf: Confidence;
  why?: string;
}

export type GateFieldKey = "summary" | "icp" | "pains" | "where" | "channel";
export type GateFields = Record<GateFieldKey, GateField>;

export type VenueStrength = "strong" | "medium" | "weak";

export interface Venue {
  id: string;
  name: string;
  platform: string;
  strength: VenueStrength;
  note: string;
  on: boolean;
}

export interface EvidenceItem {
  q: string;
  src: string;
  date: string;
}

export type LeadStatus = "pending" | "approved" | "rejected";

/** N5 — an anti-fit signal. Surfaced as a warning; never auto-suppresses the lead. */
export interface RiskFlag {
  flag: string;
  evidence: string;
  source?: string;
}

/** N1 — structured Gate-B rejection reason (the Learn-loop signal). */
export type RejectReasonCode =
  | "bad_fit"
  | "wrong_contact"
  | "weak_evidence"
  | "bad_timing"
  | "already_customer"
  | "other";

export interface Lead {
  id: string;
  name: string;
  initials: string;
  score: number;
  valueScore: number;
  matchScore: number;
  verified: boolean;
  reason: string;
  source: string;
  meta: string[];
  venue: string;
  evidence: EvidenceItem[];
  /** D1 — overall painpoint evidence strength. */
  evidenceStrength?: "explicit" | "inferred" | "none";
  /** N5 — anti-fit signals, surfaced as warnings (never auto-suppressed). */
  riskFlags?: RiskFlag[];
  status: LeadStatus;
}

export type OutreachStage =
  | "awaiting"
  | "contacted"
  | "replied"
  | "success"
  | "partial"
  | "lost";

export interface OutreachItem {
  id: string;
  name: string;
  initials: string;
  channel: string;
  stage: OutreachStage;
  subject?: string;
  body?: string;
  last?: string;
}

export interface ConversionFactor {
  label: string;
  pct: number;
}

export interface DashboardInsights {
  converting: ConversionFactor[];
  refinement: string;
  channelRecommendation: { title: string; body: string };
}

/** Discovery run state, polled by the loading screen. Backed by the `runs` table. */
export interface RunState {
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  progress: number; // 0-100
  counts: { found?: number; verified?: number; approved?: number };
  error?: string;
}
