/**
 * Data-access seam — the ONLY module the UI talks to for data.
 *
 * v1 wiring: each method calls the matching Edge Function (see docs/ENDPOINTS.md and
 * supabase/functions/*). Return types are unchanged, so no component or store code
 * changes. When `VITE_USE_FIXTURES === "true"` (or no API base is configured) it falls
 * back to the original local fixtures, so the prototype still runs with no backend.
 *
 * Config (Vite env):
 *   VITE_API_BASE     e.g. https://<project>.functions.supabase.co   (no trailing slash)
 *   VITE_API_BEARER   the static API_BEARER the Edge Functions expect
 *   VITE_USE_FIXTURES "true" to force fixtures
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
  EmailAccount,
  GateFields,
  Intake,
  Lead,
  Mode,
  OutreachItem,
  RejectReasonCode,
  Source,
  SourceType,
  Venue,
} from "./types";

export interface DiscoveryResult {
  leads: Lead[];
  foundCount: number;
}

export interface TenantContext {
  cagBlock: string;
  updatedAt: string | null;
}

export interface IntakeSuggestion {
  id: string;
  question_key: string;
  suggested_answer: string;
  source_label: string | null;
  confidence: string | null;
  quote: string | null;
}

export interface IntakeBank {
  answers: Record<string, string>;
  suggestions: IntakeSuggestion[];
  updatedAt: string | null;
}

/** Offline fallback for the intake bank (live values live in Supabase `intake_answer`). */
const seedIntakeBank: Record<string, string> = {
  offer: "A permissioned data layer + UGC app suite that lifts revenue, DLC and CCU for Steam titles.",
  a1_oneliner: "GamersLab links games and UGC apps via one SDK. Data flows out to app builders; nothing flows back in.",
  a2_problem: "UGC apps today are scraped & brittle, have no permissions, bottleneck on the studio, and fragment identity.",
  a3_numbers: "+31% revenue, +115% CCU after year 5; +20% console players after year 1.",
};

/** Offline fallback for the business-context editor (the live value lives in Supabase). */
const seedCagBlock =
  "=== GAMERSLAB PRODUCT BRIEF ===\n" +
  "GamersLab is the permissioned data layer linking games and UGC apps. Studios integrate " +
  "once via a lightweight SDK; game data flows out to UGC app builders (Grudge Goblin, " +
  "Tournament Garden). Free for studios, ~2 afternoons to integrate. Lead with Grudge Goblin " +
  "for multiplayer/PvP titles. Keep emails under 130 words, one stat, one CTA question. " +
  "Contact: contact@gamerslab.gg\n=== END GAMERSLAB BRIEF ===";

/* ------------------------------------------------------------------ config */

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const API_BEARER = import.meta.env.VITE_API_BEARER ?? "";
const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === "true" || API_BASE === "";

/**
 * Fixture-mode email account, persisted in localStorage so the Connect-email screen
 * demos end-to-end (connect → connected → disconnect) with no backend. Live mode talks
 * to the email-* Edge Functions instead.
 */
const EMAIL_STORE = "gl.emailAccount";
const loadEmailFixture = (): EmailAccount => {
  try {
    const raw = localStorage.getItem(EMAIL_STORE);
    if (raw) return JSON.parse(raw) as EmailAccount;
  } catch {
    /* ignore */
  }
  return { connected: false };
};
const saveEmailFixture = (provider: "google" | "microsoft"): EmailAccount => {
  const account: EmailAccount = {
    connected: true,
    provider,
    fromEmail: provider === "google" ? "ally@gamerslab.com" : "ally@gamerslab.onmicrosoft.com",
    displayName: provider === "google" ? "Google Workspace" : "Microsoft 365",
    dailyCap: provider === "google" ? 2000 : 10000,
    sentToday: 18,
    scopes: provider === "google" ? ["gmail.send", "gmail.readonly"] : ["Mail.Send", "Mail.Read"],
    status: "connected",
  };
  try {
    localStorage.setItem(EMAIL_STORE, JSON.stringify(account));
  } catch {
    /* ignore */
  }
  return account;
};

/* ----------------------------------------------------------- fixture seam */

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

const resolve = <T>(value: T): Promise<T> => Promise.resolve(clone(value));

let idSeq = 0;
const nextId = (prefix: string): string => `${prefix}-${(idSeq += 1)}`;

/* --------------------------------------------------------------- http seam */

const req = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_BEARER}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch { /* ignore */ }
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------- service */

export const leadService = {
  /* ---- Bootstrap ---- */
  getTenant: () =>
    USE_FIXTURES
      ? resolve({ tenant, usage })
      : req<{ tenant: typeof tenant; usage: typeof usage }>("/tenant"),

  /* ---- Onboarding ---- */
  getSources: (): Promise<Source[]> =>
    USE_FIXTURES ? resolve(seedSources) : req<Source[]>("/sources"),

  addSource: (type: SourceType, label: string): Promise<Source> =>
    USE_FIXTURES
      ? resolve<Source>({ id: nextId("src"), type, label, parsing: true, done: false })
      : req<Source>("/sources", { method: "POST", body: JSON.stringify({ type, label }) }),

  removeSource: (id: string): Promise<void> =>
    USE_FIXTURES ? resolve(undefined) : req<void>(`/sources/${id}`, { method: "DELETE" }),

  /** Upload a real document (bytes -> Storage) and register it as a queued source. */
  uploadDocument: async (file: File): Promise<Source> => {
    if (USE_FIXTURES) {
      return resolve<Source>({ id: nextId("src"), type: "file", label: file.name, parsing: false, done: false });
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("label", file.name);
    const res = await fetch(`${API_BASE}/sources`, {
      method: "POST",
      headers: { authorization: `Bearer ${API_BEARER}` },
      body: fd,
    });
    if (!res.ok) throw new Error(`POST /sources (upload) -> ${res.status}`);
    return (await res.json()) as Source;
  },

  getIntake: (): Promise<Intake> =>
    USE_FIXTURES ? resolve(seedIntake) : req<Intake>("/intake"),

  saveIntake: (intake: Intake): Promise<Intake> =>
    USE_FIXTURES
      ? resolve(intake)
      : req<Intake>("/intake", { method: "PUT", body: JSON.stringify(intake) }),

  getVenues: (): Promise<Venue[]> =>
    USE_FIXTURES ? resolve(seedVenues) : req<Venue[]>("/venues"),

  saveVenues: (venues: Venue[]): Promise<Venue[]> =>
    USE_FIXTURES
      ? resolve(venues)
      : req<Venue[]>("/venues", { method: "PATCH", body: JSON.stringify(venues) }),

  /* ---- Gate A: understanding ---- */
  getGateFields: (): Promise<GateFields> =>
    USE_FIXTURES ? resolve(seedGateFields) : req<GateFields>("/understanding"),

  saveGateFields: (fields: GateFields): Promise<GateFields> =>
    USE_FIXTURES
      ? resolve(fields)
      : req<GateFields>("/understanding", { method: "PUT", body: JSON.stringify(fields) }),

  /* ---- Discovery + Gate B ---- */
  /**
   * Starts the real discovery run and polls until done, then returns the leads. Keeps the
   * original signature so DiscoveryScreen is unchanged. Fixtures resolve immediately.
   */
  runDiscovery: async (mode: Mode): Promise<DiscoveryResult> => {
    if (USE_FIXTURES) return resolve({ leads: seedLeads, foundCount: seedFoundCount });
    const { jobId } = await req<{ jobId: string }>("/discovery/run", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    // Poll up to ~10 minutes (discovery is minutes-long; architecture spec §13).
    for (let i = 0; i < 200; i++) {
      const s = await req<
        | { status: "running"; pct: number; stage: string }
        | { status: "failed"; pct: number; error?: string }
        | { status: "done"; pct: number; result: DiscoveryResult }
      >(`/discovery/${jobId}`);
      if (s.status === "done") return s.result;
      if (s.status === "failed") throw new Error(s.error ?? "Discovery failed");
      await sleep(3000);
    }
    throw new Error("Discovery timed out");
  },

  getLeads: (): Promise<Lead[]> =>
    USE_FIXTURES
      ? resolve(seedLeads)
      : req<{ leads: Lead[]; foundCount: number }>("/leads").then((r) => r.leads),

  setLeadStatus: (
    id: string,
    status: Lead["status"],
    reasonCode?: RejectReasonCode,
    reason?: string,
  ): Promise<void> =>
    USE_FIXTURES
      ? resolve(undefined)
      : req<unknown>(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reasonCode, reason }),
      }).then(() => undefined),

  exportApproved: (ids: string[]): Promise<void> =>
    USE_FIXTURES
      ? resolve(undefined)
      : req<{ url: string }>("/leads/export", { method: "POST", body: JSON.stringify({ ids }) })
        .then(({ url }) => {
          // Trigger a browser download of the returned CSV URL.
          const a = document.createElement("a");
          a.href = url;
          a.download = "leads.csv";
          a.click();
        }),

  // v1: no CRM connected. Kept as a no-op so the Gate B button resolves cleanly.
  sendToCrm: (_ids: string[]): Promise<void> => resolve(undefined),

  /* ---- Gate C: outreach ---- */
  getOutreach: (): Promise<OutreachItem[]> =>
    USE_FIXTURES ? resolve(seedOutreach) : req<OutreachItem[]>("/outreach"),

  approveOutreach: (id: string): Promise<void> =>
    USE_FIXTURES
      ? resolve(undefined)
      : req<unknown>(`/outreach/${id}/approve`, { method: "POST" }).then(() => undefined),

  skipOutreach: (id: string): Promise<void> =>
    USE_FIXTURES
      ? resolve(undefined)
      : req<unknown>(`/outreach/${id}/skip`, { method: "POST" }).then(() => undefined),

  /* ---- Email send identity (the inbox outreach sends from) ---- */
  getEmailAccount: (): Promise<EmailAccount> =>
    USE_FIXTURES ? resolve(loadEmailFixture()) : req<EmailAccount>("/email-account"),

  /**
   * Begin connecting an inbox. Live mode returns the provider consent URL to redirect
   * the browser to; fixtures simulate a successful connect locally and return no url.
   */
  startEmailConnect: (provider: "google" | "microsoft"): Promise<{ url: string }> => {
    if (USE_FIXTURES) {
      saveEmailFixture(provider);
      return resolve({ url: "" });
    }
    return req<{ url: string }>("/email-oauth/start", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  },

  disconnectEmail: (): Promise<void> => {
    if (USE_FIXTURES) {
      try {
        localStorage.removeItem(EMAIL_STORE);
      } catch {
        /* ignore */
      }
      return resolve(undefined);
    }
    return req<void>("/email-account", { method: "DELETE" });
  },

  sendTestEmail: (): Promise<void> =>
    USE_FIXTURES
      ? resolve(undefined)
      : req<unknown>("/email-test-send", { method: "POST" }).then(() => undefined),

  /* ---- Learn & iterate ---- */
  getDashboardInsights: (): Promise<DashboardInsights> =>
    USE_FIXTURES ? resolve(seedDashboardInsights) : req<DashboardInsights>("/insights"),

  applyRefinement: (): Promise<void> =>
    USE_FIXTURES
      ? resolve(undefined)
      : req<void>("/insights/refinement/apply", { method: "POST" }).then(() => undefined),

  /* ---- Intake answer bank (structured questions; composed into the CAG) ---- */
  getIntakeBank: (): Promise<IntakeBank> =>
    USE_FIXTURES
      ? resolve({ answers: seedIntakeBank, suggestions: [], updatedAt: null })
      : req<IntakeBank>("/intake-bank"),

  saveIntakeBank: (answers: Record<string, string>): Promise<IntakeBank> =>
    USE_FIXTURES
      ? resolve({ answers, suggestions: [], updatedAt: new Date().toISOString() })
      : req<IntakeBank>("/intake-bank", { method: "PUT", body: JSON.stringify({ answers }) }),

  acceptSuggestion: (id: string): Promise<IntakeBank> =>
    USE_FIXTURES
      ? resolve({ answers: seedIntakeBank, suggestions: [], updatedAt: new Date().toISOString() })
      : req<IntakeBank>("/intake-bank/accept", { method: "POST", body: JSON.stringify({ id }) }),

  dismissSuggestion: (id: string): Promise<IntakeBank> =>
    USE_FIXTURES
      ? resolve({ answers: seedIntakeBank, suggestions: [], updatedAt: new Date().toISOString() })
      : req<IntakeBank>("/intake-bank/dismiss", { method: "POST", body: JSON.stringify({ id }) }),

  /* ---- Business context (the editable CAG block the pipeline reads each run) ---- */
  getContext: (): Promise<TenantContext> =>
    USE_FIXTURES
      ? resolve({ cagBlock: seedCagBlock, updatedAt: null })
      : req<TenantContext>("/context"),

  saveContext: (cagBlock: string): Promise<TenantContext> =>
    USE_FIXTURES
      ? resolve({ cagBlock, updatedAt: new Date().toISOString() })
      : req<TenantContext>("/context", { method: "PUT", body: JSON.stringify({ cagBlock }) }),
};

export type LeadService = typeof leadService;
