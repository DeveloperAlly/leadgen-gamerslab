/**
 * publishers -> UI mapping (the core of the v1 GamersLab adapter).
 *
 * GamersLab stores one row per Steam game/publisher in `publishers`. The UI speaks a
 * generic Lead/Outreach model. This file is the single, documented translation between
 * the two. Every field choice is deliberate; gaps where the GamersLab schema has no
 * equivalent are marked V1-GAP with the chosen fallback.
 *
 * Source schema: supabase/schema.sql. UI contract: _shared/types.ts.
 */

import type {
  EvidenceItem,
  Lead,
  LeadStatus,
  OutreachItem,
  OutreachStage,
  RiskFlag,
} from "./types.ts";

/** The columns of `publishers` this adapter reads. (Subset of supabase/schema.sql.) */
export interface PublisherRow {
  id: string;
  steam_app_id: string;
  game_name: string | null;
  publisher_name: string | null;
  primary_genre: string | null;
  game_phase: string | null;
  owners_estimate: string | null;
  review_score: number | null;
  total_reviews: number | null;

  contact_email: string | null;
  contact_source: string | null;
  email_valid: boolean | null;
  email_status: string | null;

  founder_quote: string | null;
  founder_quote_source: string | null;
  pain_signal: string | null;
  intel_summary: string | null;
  intel_quality: string | null; // gold | silver | bronze | no_signal

  evidence_strength: string | null; // explicit | inferred | none (D1)
  evidence_quote: string | null; // painpoint evidence quote (D1)
  evidence_sources: unknown; // jsonb string[] of source urls (D1)
  evidence_as_of: string | null; // date the evidence is from (D1/N9)
  risk_flags: unknown; // jsonb RiskFlag[] (N5)

  pre_score: number | null;
  fit_score: number | null;
  outreach_tier: string | null; // A | B | C | skip
  score_rationale: string | null;
  gamerslab_hook: string | null;

  draft_subject: string | null;
  draft_body: string | null;
  approved_subject: string | null;
  approved_body: string | null;

  pipeline_status: string | null; // draft | skip | approved | rejected | sent | replied
  sent_at: string | null;
  replied_at: string | null;
  created_at: string | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const relDate = (iso: string | null): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
};

/** publishers.pipeline_status -> Lead.status (Gate B approve/reject view). */
const leadStatusOf = (s: string | null): LeadStatus => {
  switch (s) {
    case "approved":
    case "sent":
    case "replied":
      return "approved";
    case "rejected":
    case "skip":
      return "rejected";
    default:
      return "pending"; // draft / null
  }
};

/** publishers.pipeline_status -> OutreachStage (Gate C board). */
const outreachStageOf = (p: PublisherRow): OutreachStage => {
  switch (p.pipeline_status) {
    case "replied":
      return "replied";
    case "sent":
      return "contacted";
    // V1-GAP: v1 never sends. Approving a draft is the terminal action, so it shows on
    // the board as "contacted" (architecture spec §4: POC stages to contacted, no send).
    case "approved":
      return "contacted";
    case "rejected":
    case "skip":
      return "lost";
    default:
      return "awaiting"; // draft / null — has a draft awaiting approval
  }
};

/** jsonb columns arrive parsed; tolerate a stringified fallback. */
const asArray = <T>(v: unknown): T[] => {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const evidenceOf = (p: PublisherRow): EvidenceItem[] => {
  const out: EvidenceItem[] = [];
  // D1/N9: prefer the dated evidence date when present, else fall back to discovery date.
  const date = (p.evidence_as_of && relDate(`${p.evidence_as_of}T00:00:00Z`)) || relDate(p.created_at);
  const sources = asArray<string>(p.evidence_sources);
  // D1: the structured painpoint-evidence quote leads the dossier when present.
  if (p.evidence_quote) {
    out.push({ q: p.evidence_quote, src: sources[0] || p.contact_source || "Evidence", date });
  }
  if (p.founder_quote && p.founder_quote !== p.evidence_quote) {
    out.push({
      q: p.founder_quote,
      src: p.founder_quote_source || "Founder",
      date: relDate(p.created_at),
    });
  }
  if (p.pain_signal && p.pain_signal !== p.evidence_quote) {
    out.push({ q: p.pain_signal, src: "Pain signal", date });
  }
  if (p.intel_summary && out.length === 0) {
    out.push({ q: p.intel_summary, src: p.contact_source || "Intel", date });
  }
  return out;
};

const metaOf = (p: PublisherRow): string[] =>
  [
    p.primary_genre,
    p.game_phase,
    p.owners_estimate ? `~${p.owners_estimate} owners` : null,
    p.outreach_tier ? `Tier ${p.outreach_tier}` : null,
    p.intel_quality && p.intel_quality !== "no_signal"
      ? `${p.intel_quality} intel`
      : null,
  ].filter((x): x is string => Boolean(x));

export function toLead(p: PublisherRow): Lead {
  const name = p.publisher_name || p.game_name || "Unknown publisher";
  // V1-GAP: publishers has no two-sided score. fit_score is the composite; pre_score is
  // the cheap pre-LLM signal. Map composite=fit_score, value=fit_score, match=pre_score
  // as the best available proxies. v2 produces true value/match.
  const composite = clamp(p.fit_score ?? p.pre_score ?? 0);
  return {
    id: p.id,
    name,
    initials: initialsOf(name),
    score: composite,
    valueScore: clamp(p.fit_score ?? composite),
    matchScore: clamp(p.pre_score ?? composite),
    // V1-GAP: "verified" = we found a deliverable contact (MX-valid). Closest signal the
    // GamersLab pipeline produces to the UI's verified badge.
    verified: Boolean(p.email_valid),
    reason: p.score_rationale || p.gamerslab_hook || "",
    source: `${p.game_name || "Steam title"} · Steam`,
    meta: metaOf(p),
    venue: "Steam",
    evidence: evidenceOf(p),
    // D1: overall evidence strength (only the three valid values pass through).
    evidenceStrength: ["explicit", "inferred", "none"].includes(p.evidence_strength ?? "")
      ? (p.evidence_strength as Lead["evidenceStrength"])
      : undefined,
    // N5: anti-fit warnings, surfaced — never used to drop the lead.
    riskFlags: asArray<RiskFlag>(p.risk_flags).filter((f) => f && f.flag),
    status: leadStatusOf(p.pipeline_status),
  };
}

export function toOutreachItem(p: PublisherRow): OutreachItem {
  const name = p.publisher_name || p.game_name || "Unknown publisher";
  // Subject and body are kept separate end to end — the human edits each independently.
  // Prefer the human-approved values over the LLM draft when present.
  const subject = p.approved_subject || p.draft_subject || undefined;
  const body = p.approved_body || p.draft_body || undefined;
  let last: string | undefined;
  if (p.replied_at) last = `Replied ${relDate(p.replied_at)}`;
  else if (p.sent_at) last = `Sent ${relDate(p.sent_at)}`;
  return {
    id: p.id,
    name,
    initials: initialsOf(name),
    channel: "Email",
    stage: outreachStageOf(p),
    subject,
    body,
    last,
  };
}

/** Columns to SELECT for the lead/outreach views (keeps payloads lean). */
export const PUBLISHER_SELECT =
  "id,steam_app_id,game_name,publisher_name,primary_genre," +
  "game_phase,owners_estimate,review_score,total_reviews,contact_email,contact_source," +
  "email_valid,email_status,founder_quote,founder_quote_source,pain_signal,intel_summary," +
  "intel_quality,evidence_strength,evidence_quote,evidence_sources,evidence_as_of,risk_flags," +
  "pre_score,fit_score,outreach_tier,score_rationale,gamerslab_hook," +
  "draft_subject,draft_body,approved_subject,approved_body,pipeline_status,sent_at," +
  "replied_at,created_at";
