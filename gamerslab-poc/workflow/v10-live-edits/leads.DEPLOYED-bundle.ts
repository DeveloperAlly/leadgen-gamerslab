// AUTO-BUNDLED single-file deploy of the `leads` function (Tier 1: D1/N5/N1).
// Inlines _shared/{types,http,mapper}.ts to avoid relative-path resolution on deploy.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ---- types ---- */
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
  draft?: string;
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

/* ---- http ---- */
/**
 * Shared HTTP plumbing for every Edge Function: CORS, JSON responses, bearer auth,
 * and a service-role Supabase client.
 *
 * Auth model (v1 POC, per architecture spec §9): the integration layer is the trust
 * boundary. The web app sends a static `Authorization: Bearer <API_BEARER>`; functions
 * reject mismatches. The `publishers` table is single-tenant, so no tenant pinning is
 * needed in v1. v2 swaps this check for a Supabase JWT + RLS — the function surface is
 * unchanged.
 */



export const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

export const noContent = (): Response => new Response(null, { status: 204, headers: cors });

export const errBody = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status);

/** Handle the CORS preflight. Returns a Response to short-circuit, or null to continue. */
export const preflight = (req: Request): Response | null =>
  req.method === "OPTIONS" ? new Response(null, { status: 204, headers: cors }) : null;

/** Validate the static bearer. Returns null when OK, or a 401 Response when not. */
export const requireBearer = (req: Request): Response | null => {
  const expected = Deno.env.get("API_BEARER");
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || got !== expected) {
    return errBody("unauthorized", "Missing or invalid bearer token", 401);
  }
  return null;
};

/** Service-role client — server-side only, never shipped to the browser. */
export const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

/** Last path segment, e.g. /leads/abc -> "abc". Empty string if none. */
export const lastSegment = (url: string): string => {
  const path = new URL(url).pathname.replace(/\/+$/, "");
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
};

/* ---- mapper ---- */
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
  const draft =
    p.approved_body || p.draft_body
      ? `${p.approved_subject || p.draft_subject || ""}\n\n${
        p.approved_body || p.draft_body || ""
      }`.trim()
      : undefined;
  let last: string | undefined;
  if (p.replied_at) last = `Replied ${relDate(p.replied_at)}`;
  else if (p.sent_at) last = `Sent ${relDate(p.sent_at)}`;
  return {
    id: p.id,
    name,
    initials: initialsOf(name),
    channel: "Email",
    stage: outreachStageOf(p),
    draft,
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

/* ---- handler ---- */
/**
 * leads — Gate B surface. Reads discovered leads from `publishers`, mapped to the UI's
 * Lead shape; approve/reject writes back to `pipeline_status`.
 *
 *   GET    /leads?verified=true&sort=desc   -> { leads: Lead[], foundCount: number }
 *   PATCH  /leads/:id   { status }          -> Lead
 *   POST   /leads/export   { ids[] }        -> { url }   (CSV data URL in v1)
 *
 * Contract: poc/ui/docs/ENDPOINTS.md §6.
 */





// UI status -> publishers.pipeline_status. Only review transitions are writable here.
const STATUS_TO_DB: Record<LeadStatus, string> = {
  approved: "approved",
  rejected: "rejected",
  pending: "draft",
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();
  const url = new URL(req.url);

  // ---- GET /leads ----
  if (req.method === "GET") {
    const verifiedOnly = url.searchParams.get("verified") === "true";
    const sort = url.searchParams.get("sort") === "asc" ? true : false;

    let q = db
      .from("publishers")
      .select(PUBLISHER_SELECT)
      // Only rows that reached drafting are "leads"; backlog/skip rows are not surfaced.
      .in("pipeline_status", ["draft", "approved", "rejected", "sent", "replied"])
      .order("fit_score", { ascending: sort, nullsFirst: false });

    if (verifiedOnly) q = q.eq("email_valid", true);

    const { data, error } = await q;
    if (error) return errBody("db_error", error.message, 500);

    const leads = (data as unknown as PublisherRow[]).map(toLead);
    return json({ leads, foundCount: leads.length });
  }

  // ---- PATCH /leads/:id ----
  if (req.method === "PATCH") {
    const id = lastSegment(req.url);
    if (!id || id === "leads") return errBody("bad_request", "Missing lead id", 400);

    let body: { status?: LeadStatus; reasonCode?: string; reason?: string };
    try {
      body = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const target = body.status && STATUS_TO_DB[body.status];
    if (!target) return errBody("unprocessable", "status must be approved|rejected|pending", 422);

    const update: Record<string, unknown> = { pipeline_status: target };
    if (body.status === "rejected") {
      // N1 — capture the structured Gate-B rejection reason (the Learn-loop signal).
      const REASON_CODES = [
        "bad_fit",
        "wrong_contact",
        "weak_evidence",
        "bad_timing",
        "already_customer",
        "other",
      ];
      if (body.reasonCode && REASON_CODES.includes(body.reasonCode)) {
        update.reject_reason_code = body.reasonCode;
      }
      if (typeof body.reason === "string" && body.reason.trim()) {
        update.reject_reason = body.reason.trim().slice(0, 500);
      }
      update.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await db
      .from("publishers")
      .update(update)
      .eq("id", id)
      .select(PUBLISHER_SELECT)
      .single();
    if (error) return errBody("db_error", error.message, error.code === "PGRST116" ? 404 : 500);

    return json(toLead(data as unknown as PublisherRow));
  }

  // ---- POST /leads/export ----
  if (req.method === "POST" && url.pathname.endsWith("/export")) {
    let body: { ids?: string[] };
    try {
      body = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }
    const ids = body.ids ?? [];
    if (ids.length === 0) return errBody("unprocessable", "ids[] required", 422);

    const { data, error } = await db
      .from("publishers")
      .select(PUBLISHER_SELECT)
      .in("id", ids);
    if (error) return errBody("db_error", error.message, 500);

    const rows = (data as unknown as PublisherRow[]).map(toLead);
    const headers = ["name", "score", "verified", "venue", "reason"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((l) => [l.name, l.score, l.verified, l.venue, l.reason].map(esc).join(",")),
    ].join("\n");
    // v1: inline data URL (no Storage bucket dependency). v2 -> signed Storage URL.
    const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    return json({ url: dataUrl });
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
