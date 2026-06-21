/**
 * Domain model for the lead-generation pipeline.
 * These types are the contract between the data layer (fixtures / API) and the UI.
 * The API endpoint shapes in docs/ENDPOINTS.md map directly onto these.
 */

export type Mode = "customers" | "investors";

export type ScreenKey =
  | "signin"
  | "context"
  | "intake"
  | "venues"
  | "gateA"
  | "loading"
  | "gateB"
  | "dashboard"
  | "sources"
  | "outreach"
  | "settings";

export type SourceType = "file" | "url" | "social";

export interface Source {
  id: string;
  type: SourceType;
  label: string;
  /** True while the source is being parsed/indexed. */
  parsing: boolean;
  /** True once parsing/indexing has completed. */
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

/** A single editable understanding field shown at Gate A. */
export interface GateField {
  text: string;
  conf: Confidence;
  /** Optional one-line rationale (used by the channel recommendation). */
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
  /** Whether discovery should search this venue. */
  on: boolean;
}

export interface EvidenceItem {
  /** The quoted signal. */
  q: string;
  /** Source attribution, e.g. "Founder · LinkedIn". */
  src: string;
  /** Human date label, e.g. "3d ago". */
  date: string;
}

export type LeadStatus = "pending" | "approved" | "rejected";

export interface Lead {
  id: string;
  name: string;
  initials: string;
  /** Composite 0–100 score. */
  score: number;
  /** Two-sided: value of this lead to you, 0–100. */
  valueScore: number;
  /** Two-sided: how well you match the prospect, 0–100. */
  matchScore: number;
  verified: boolean;
  reason: string;
  source: string;
  meta: string[];
  venue: string;
  evidence: EvidenceItem[];
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
  /** Draft message, present while awaiting approval. */
  draft?: string;
  /** Last-event label once the prospect has moved past awaiting. */
  last?: string;
}

/** A "what's converting" bar on the Learn & iterate panel. */
export interface ConversionFactor {
  label: string;
  pct: number;
}

export interface DashboardInsights {
  converting: ConversionFactor[];
  refinement: string;
  channelRecommendation: {
    title: string;
    body: string;
  };
}
