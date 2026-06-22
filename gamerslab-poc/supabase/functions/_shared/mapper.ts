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
  LeadContact,
  LeadStatus,
  OutreachItem,
  OutreachStage,
  OutreachVariant,
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

  publisher_website: string | null;
  contact_email: string | null;
  contact_source: string | null;
  contact_name: string | null;
  contact_role: string | null;
  email_valid: boolean | null;
  email_status: string | null;

  twitter_handle: string | null;
  linkedin_company_url: string | null;
  discord_url: string | null;
  founder_name: string | null;

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

/** pipeline_status / message.status -> OutreachStage (Gate C board). */
const statusToStage = (s: string | null): OutreachStage => {
  switch (s) {
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

/**
 * Treat empty, whitespace-only, and the literal "unknown" sentinel as absent. The
 * GamersLab pipeline writes "unknown"/"" when enrichment failed to resolve a field, so
 * the UI must not render those as if they were real values.
 */
const clean = (v: string | null | undefined): string | undefined => {
  const t = (v ?? "").trim();
  if (!t || t.toLowerCase() === "unknown") return undefined;
  return t;
};

/** Normalize a bare domain/handle into an absolute https URL; pass through real URLs. */
const urlOf = (v: string | null): string | undefined => {
  const t = clean(v);
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

/** twitter_handle is stored as "@foo", "foo", or a full URL; normalize to a profile URL. */
const twitterUrl = (v: string | null): string | undefined => {
  const t = clean(v);
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://x.com/${t.replace(/^@+/, "")}`;
};

/** Build the public contact block, dropping sentinels. Returns undefined when nothing resolved. */
const contactOf = (p: PublisherRow): LeadContact | undefined => {
  const name = clean(p.contact_name) ?? clean(p.founder_name);
  const c: LeadContact = {
    website: urlOf(p.publisher_website),
    email: clean(p.contact_email),
    name,
    // A role is only meaningful alongside a name.
    role: name ? clean(p.contact_role) : undefined,
    twitter: twitterUrl(p.twitter_handle),
    linkedin: urlOf(p.linkedin_company_url),
    discord: urlOf(p.discord_url),
  };
  return Object.values(c).some(Boolean) ? c : undefined;
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
    // Public contact + presence (website, socials, email, human name); sentinels dropped.
    contact: contactOf(p),
    status: leadStatusOf(p.pipeline_status),
  };
}

/** A `message` row joined with its publisher's display fields. */
export interface MessageRow {
  id: string;
  publisher_id: string;
  step: number;
  variant: string;
  is_control: boolean;
  subject: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
  replied_at: string | null;
  publishers:
    | {
        publisher_name: string | null;
        game_name: string | null;
        contact_email: string | null;
        email_valid: boolean | null;
      }
    | null;
}

/** Columns to SELECT from `message` (with the publisher name + recipient embedded) for the board. */
export const MESSAGE_SELECT =
  "id,publisher_id,step,variant,is_control,subject,body,status,sent_at,replied_at," +
  "publishers(publisher_name,game_name,contact_email,email_valid)";

/**
 * Group `message` rows by publisher into the UI's OutreachItem shape. One item per
 * publisher; its A/B variants for the initial step are carried in `variants`. The
 * control variant supplies the convenience `subject`/`body` and the board's last-event.
 */
export function toOutreachItems(rows: MessageRow[]): OutreachItem[] {
  const byPublisher = new Map<string, MessageRow[]>();
  for (const r of rows) {
    const list = byPublisher.get(r.publisher_id) ?? [];
    list.push(r);
    byPublisher.set(r.publisher_id, list);
  }

  const items: OutreachItem[] = [];
  for (const [publisherId, msgs] of byPublisher) {
    const pub = msgs[0]!.publishers;
    const name = pub?.publisher_name || pub?.game_name || "Unknown publisher";
    // Control row drives the publisher-level stage/last-event and the convenience fields.
    const control = msgs.find((m) => m.is_control) ?? msgs[0]!;

    const variants: OutreachVariant[] = msgs
      .filter((m) => m.step === 1)
      .sort((a, b) => a.variant.localeCompare(b.variant))
      .map((m) => ({
        messageId: m.id,
        variant: m.variant,
        isControl: m.is_control,
        step: m.step,
        subject: m.subject ?? undefined,
        body: m.body ?? undefined,
        sentCount: m.sent_at ? 1 : 0,
        replyCount: m.replied_at ? 1 : 0,
      }));

    let last: string | undefined;
    if (control.replied_at) last = `Replied ${relDate(control.replied_at)}`;
    else if (control.sent_at) last = `Sent ${relDate(control.sent_at)}`;

    items.push({
      id: publisherId,
      name,
      initials: initialsOf(name),
      channel: "Email",
      stage: statusToStage(control.status),
      // Empty string means no contact was found — normalize to undefined so the UI's
      // "no recipient, can't send" branch fires instead of rendering a blank address.
      toEmail: pub?.contact_email?.trim() ? pub.contact_email.trim() : undefined,
      emailValid: pub?.email_valid ?? undefined,
      subject: control.subject ?? undefined,
      body: control.body ?? undefined,
      variants,
      last,
    });
  }
  return items;
}

/** Columns to SELECT for the lead/outreach views (keeps payloads lean). */
export const PUBLISHER_SELECT =
  "id,steam_app_id,game_name,publisher_name,primary_genre," +
  "game_phase,owners_estimate,review_score,total_reviews,publisher_website,contact_email,contact_source," +
  "contact_name,contact_role,email_valid,email_status,twitter_handle,linkedin_company_url,discord_url," +
  "founder_name,founder_quote,founder_quote_source,pain_signal,intel_summary," +
  "intel_quality,evidence_strength,evidence_quote,evidence_sources,evidence_as_of,risk_flags," +
  "pre_score,fit_score,outreach_tier,score_rationale,gamerslab_hook," +
  "draft_subject,draft_body,approved_subject,approved_body,pipeline_status,sent_at," +
  "replied_at,created_at";
