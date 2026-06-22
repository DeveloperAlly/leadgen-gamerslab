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
  | "profile"
  | "cag"
  | "outreach"
  | "email"
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
  /** Draft message, present while awaiting approval. */
  draft?: string;
  /** Last-event label once the prospect has moved past awaiting. */
  last?: string;
}

/** The inbox a tenant has connected to send outreach from (Gmail/Outlook OAuth). */
export interface EmailAccount {
  connected: boolean;
  provider?: "google" | "microsoft";
  /** The address outreach sends as. */
  fromEmail?: string;
  displayName?: string;
  /** Provider daily-send ceiling (~500 free Gmail, ~2000 Workspace, ~10000 M365). */
  dailyCap?: number;
  /** Sends counted against the cap today. */
  sentToday?: number;
  scopes?: string[];
  status?: "connected" | "expired" | "revoked";
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
