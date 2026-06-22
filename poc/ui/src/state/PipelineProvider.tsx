import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { leadService } from "../data/leadService";
import { tenant, usage } from "../data/fixtures/tenant";
import {
  seedDashboardInsights,
  seedFoundCount,
  seedGateFields,
  seedIntake,
  seedLeads,
  seedOutreach,
  seedSources,
  seedVenues,
} from "../data/fixtures/seed";
import { discoveryStatusLines } from "../data/fixtures/copy";
import { appConfig } from "../config/appConfig";
import type {
  DashboardInsights,
  EmailAccount,
  GateFieldKey,
  Intake,
  LeadStatus,
  Mode,
  RejectReasonCode,
  ScreenKey,
  SourceType,
  VenueStrength,
} from "../data/types";
import {
  pipelineReducer,
  type PipelineState,
} from "./pipelineReducer";

const clone = <T,>(v: T): T =>
  typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);

/**
 * The sign-in gate is client-side only (shared password / email check). Persist a
 * "passed the gate" flag so a page reload doesn't force re-entry every time. Scoped to
 * the build mode and kept in localStorage (survives reloads and closing the tab/browser;
 * cleared on Sign out). Swap to sessionStorage if it should clear when the tab closes.
 */
const GATE_STORAGE_KEY = `gl.gatePassed.${appConfig.mode}`;

const readGatePassed = (): boolean => {
  if (!appConfig.requireSignin) return true;
  try {
    return localStorage.getItem(GATE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeGatePassed = (passed: boolean): void => {
  try {
    if (passed) localStorage.setItem(GATE_STORAGE_KEY, "1");
    else localStorage.removeItem(GATE_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode / SSR) — gate falls back to in-memory only */
  }
};

/**
 * Initial state is hydrated from the data layer's seed. In production the provider
 * would instead call leadService.get*() in an effect and populate via SET_* actions
 * (the actions already exist for exactly that); the shape is identical either way.
 */
const initialState: PipelineState = {
  mode: "customers",
  screen: readGatePassed() ? appConfig.postLoginScreen : "signin",
  focusId: null,
  email: "",
  password: "",
  signinState: "idle",
  tenant: clone(tenant),
  usage: clone(usage),
  insights: clone(seedDashboardInsights),
  emailAccount: null,
  dataState: "idle",
  dataError: null,
  sources: clone(seedSources),
  websiteInput: "",
  socialInput: "",
  intake: clone(seedIntake),
  venues: clone(seedVenues),
  venueInput: "",
  fields: clone(seedGateFields),
  editingField: null,
  editDraft: "",
  leads: clone(seedLeads),
  foundCount: seedFoundCount,
  expandedLead: null,
  sortDesc: true,
  onlyVerified: false,
  refinementDismissed: false,
  loadingPct: 0,
  loadingMsgIdx: 0,
  outreach: clone(seedOutreach),
  editingMessageId: null,
  outreachSubject: "",
  outreachBody: "",
  toast: null,
};

export interface PipelineActions {
  /** Navigate to a screen, optionally focusing a publisher id (links lead <-> outreach). */
  go: (screen: ScreenKey, focusId?: string) => void;
  setMode: (mode: Mode) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  signinContinue: () => void;
  setEmailAccount: (account: EmailAccount | null) => void;
  notify: (message: string) => void;
  addSource: (type: SourceType, label: string) => void;
  uploadSource: (file: File) => void;
  removeSource: (id: string) => void;
  setWebsiteInput: (value: string) => void;
  setSocialInput: (value: string) => void;
  addWebsite: () => void;
  addSocial: () => void;
  updateIntake: (patch: Partial<Intake>) => void;
  toggleVenue: (id: string) => void;
  setVenueInput: (value: string) => void;
  addVenue: () => void;
  startEditField: (key: GateFieldKey) => void;
  setEditDraft: (value: string) => void;
  saveField: (key: GateFieldKey) => void;
  cancelEdit: () => void;
  startDiscovery: () => void;
  setLeadStatus: (id: string, status: LeadStatus, reasonCode?: RejectReasonCode) => void;
  toggleExpand: (id: string) => void;
  toggleSort: () => void;
  toggleVerified: () => void;
  exportApproved: () => void;
  sendToCrm: () => void;
  approveOutreach: (id: string) => void;
  skipOutreach: (id: string) => void;
  /** Final outcome on a replied prospect. */
  markWon: (id: string) => void;
  markLost: (id: string) => void;
  /** Re-pull the outreach board from the backend (the store hydrates once on mount). */
  refreshOutreach: () => void;
  startEditVariant: (messageId: string) => void;
  setOutreachSubject: (value: string) => void;
  setOutreachBody: (value: string) => void;
  saveOutreachDraft: () => void;
  cancelEditOutreach: () => void;
  applyRefinement: () => void;
  dismissRefinement: () => void;
  restart: () => void;
}

export interface PipelineDerived {
  approvedCount: number;
  verifiedCount: number;
  approvedPct: number;
  pendingApprovals: number;
  contactedTotal: number;
  repliedTotal: number;
  successCount: number;
  venuesOnCount: number;
}

interface PipelineContextValue {
  state: PipelineState;
  actions: PipelineActions;
  derived: PipelineDerived;
  insights: DashboardInsights;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

const VALID_EMAIL = /.+@.+\..+/;

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pipelineReducer, initialState);

  const discoveryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(
    () => () => {
      if (discoveryTimer.current) clearInterval(discoveryTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    dispatch({ type: "SHOW_TOAST", message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: "CLEAR_TOAST" }), 1900);
  }, []);

  // Hydrate the store from the data layer once on mount. With a live API this loads the
  // real backend data; with fixtures it resolves the seed. Either way the UI shows what
  // the data layer actually returns instead of a frozen client-side copy.
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "SET_DATA_STATE", state: "loading" });
    Promise.all([
      leadService.getTenant(),
      leadService.getSources(),
      leadService.getLeads(),
      leadService.getOutreach(),
      leadService.getDashboardInsights(),
      leadService.getEmailAccount(),
    ])
      .then(([tenantRes, sources, leads, outreach, insights, emailAccount]) => {
        if (cancelled) return;
        dispatch({
          type: "HYDRATE",
          payload: {
            tenant: tenantRes.tenant,
            usage: tenantRes.usage,
            sources,
            leads,
            foundCount: leads.length,
            outreach,
            insights,
            emailAccount,
          },
        });
        dispatch({ type: "SET_DATA_STATE", state: "ready" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatch({
          type: "SET_DATA_STATE",
          state: "error",
          error: err instanceof Error ? err.message : "Failed to load data",
        });
        showToast("Couldn't reach the backend — showing cached data");
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const actions = useMemo<PipelineActions>(() => {
    const addSource = (type: SourceType, label: string) => {
      // Persists a real `source` row; it returns "queued" until the Context Builder
      // workflow processes it (no fake parse timer — the status reflects the backend).
      void leadService.addSource(type, label).then((source) => {
        dispatch({ type: "ADD_SOURCE", source });
      });
    };

    return {
      go: (screen, focusId) => dispatch({ type: "GO", screen, focusId }),
      setMode: (mode) => dispatch({ type: "SET_MODE", mode }),
      setEmail: (email) => dispatch({ type: "SET_EMAIL", email }),
      setPassword: (password) => dispatch({ type: "SET_PASSWORD", password }),
      setEmailAccount: (account) => dispatch({ type: "SET_EMAIL_ACCOUNT", account }),
      notify: (message) => showToast(message),
      signinContinue: () => {
        const ok =
          appConfig.signinMode === "password"
            ? stateRef.current.password === appConfig.gatePassword
            : VALID_EMAIL.test(stateRef.current.email);
        if (!ok) {
          dispatch({ type: "SET_SIGNIN_STATE", state: "error" });
          return;
        }
        dispatch({ type: "SET_SIGNIN_STATE", state: "loading" });
        writeGatePassed(true);
        setTimeout(() => dispatch({ type: "GO", screen: appConfig.postLoginScreen }), 850);
      },
      addSource,
      uploadSource: (file: File) => {
        // Uploads the real bytes to Storage; the returned source is "queued" until the
        // Source Ingestion workflow downloads + extracts it.
        void leadService.uploadDocument(file).then((source) => dispatch({ type: "ADD_SOURCE", source }));
      },
      removeSource: (id) => {
        void leadService.removeSource(id);
        dispatch({ type: "REMOVE_SOURCE", id });
      },
      setWebsiteInput: (value) => dispatch({ type: "SET_WEBSITE_INPUT", value }),
      setSocialInput: (value) => dispatch({ type: "SET_SOCIAL_INPUT", value }),
      addWebsite: () => {
        const value = stateRef.current.websiteInput.trim();
        if (!value) return;
        addSource("url", value);
        dispatch({ type: "SET_WEBSITE_INPUT", value: "" });
      },
      addSocial: () => {
        const value = stateRef.current.socialInput.trim();
        if (!value) return;
        addSource("social", value);
        dispatch({ type: "SET_SOCIAL_INPUT", value: "" });
      },
      updateIntake: (patch) => dispatch({ type: "UPDATE_INTAKE", patch }),
      toggleVenue: (id) => dispatch({ type: "TOGGLE_VENUE", id }),
      setVenueInput: (value) => dispatch({ type: "SET_VENUE_INPUT", value }),
      addVenue: () => {
        const name = stateRef.current.venueInput.trim();
        if (!name) return;
        const strength: VenueStrength = "medium";
        dispatch({
          type: "ADD_VENUE",
          venue: {
            id: `venue-custom-${Date.now()}`,
            name,
            platform: "Custom",
            strength,
            note: "Added by you",
            on: true,
          },
        });
      },
      startEditField: (key) =>
        dispatch({ type: "START_EDIT_FIELD", key, draft: stateRef.current.fields[key].text }),
      setEditDraft: (value) => dispatch({ type: "SET_EDIT_DRAFT", value }),
      saveField: (key) => {
        dispatch({ type: "SAVE_FIELD", key });
        void leadService.saveGateFields(stateRef.current.fields);
        showToast("Saved");
      },
      cancelEdit: () => dispatch({ type: "CANCEL_EDIT" }),
      startDiscovery: () => {
        // PoC build runs no fake discovery loader: re-pull the latest leads + insights
        // from the backend instead of pretending to run a minutes-long discovery job.
        if (!appConfig.enableDiscoveryLoader) {
          void Promise.all([
            leadService.getLeads(),
            leadService.getDashboardInsights(),
          ])
            .then(([leads, insights]) => {
              dispatch({ type: "SET_LEADS", leads, foundCount: leads.length });
              dispatch({ type: "HYDRATE", payload: { insights } });
              showToast("Pipeline refreshed");
            })
            .catch(() => showToast("Couldn't refresh — backend unreachable"));
          return;
        }
        dispatch({ type: "GO", screen: "loading" });
        dispatch({ type: "SET_LOADING", pct: 0, msgIdx: 0 });
        void leadService.runDiscovery(stateRef.current.mode).then((result) => {
          dispatch({ type: "SET_LEADS", leads: result.leads, foundCount: result.foundCount });
        });
        if (discoveryTimer.current) clearInterval(discoveryTimer.current);
        discoveryTimer.current = setInterval(() => {
          const pct = Math.min(100, stateRef.current.loadingPct + Math.round(6 + Math.random() * 9));
          const idx = pct < 25 ? 0 : pct < 55 ? 1 : pct < 82 ? 2 : 3;
          dispatch({ type: "SET_LOADING", pct, msgIdx: idx });
          if (pct >= 100 && discoveryTimer.current) {
            clearInterval(discoveryTimer.current);
            discoveryTimer.current = null;
            setTimeout(() => dispatch({ type: "GO", screen: "gateB" }), 550);
          }
        }, 380);
      },
      setLeadStatus: (id, status, reasonCode) => {
        dispatch({ type: "SET_LEAD_STATUS", id, status });
        void leadService.setLeadStatus(id, status, reasonCode);
      },
      toggleExpand: (id) => dispatch({ type: "TOGGLE_EXPAND", id }),
      toggleSort: () => dispatch({ type: "TOGGLE_SORT" }),
      toggleVerified: () => dispatch({ type: "TOGGLE_VERIFIED" }),
      exportApproved: () => {
        const ids = stateRef.current.leads.filter((l) => l.status === "approved").map((l) => l.id);
        void leadService.exportApproved(ids);
        showToast(`${ids.length} leads exported`);
      },
      sendToCrm: () => {
        const ids = stateRef.current.leads.filter((l) => l.status === "approved").map((l) => l.id);
        void leadService.sendToCrm(ids);
        showToast("Sent to CRM");
      },
      approveOutreach: (id) => {
        // The pipeline stages drafts for outreach; it does not auto-send (see spec §07).
        dispatch({ type: "SET_OUTREACH_STAGE", id, stage: "contacted", last: "Approved for outreach" });
        void leadService.approveOutreach(id);
        showToast("Draft approved");
      },
      skipOutreach: (id) => {
        dispatch({ type: "SET_OUTREACH_STAGE", id, stage: "lost", last: "Skipped" });
        void leadService.skipOutreach(id);
      },
      markWon: (id) => {
        dispatch({ type: "SET_OUTREACH_STAGE", id, stage: "success", last: "Marked won" });
        void leadService.markOutcome(id, "won");
        showToast("Marked won");
      },
      markLost: (id) => {
        dispatch({ type: "SET_OUTREACH_STAGE", id, stage: "lost", last: "Marked lost" });
        void leadService.markOutcome(id, "lost");
        showToast("Marked lost");
      },
      refreshOutreach: () => {
        void leadService
          .getOutreach()
          .then((outreach) => dispatch({ type: "HYDRATE", payload: { outreach } }))
          .catch(() => {});
      },
      startEditVariant: (messageId) => {
        let v;
        for (const o of stateRef.current.outreach) {
          const found = o.variants.find((x) => x.messageId === messageId);
          if (found) { v = found; break; }
        }
        dispatch({
          type: "START_EDIT_OUTREACH",
          messageId,
          subject: v?.subject ?? "",
          body: v?.body ?? "",
        });
      },
      setOutreachSubject: (value) => dispatch({ type: "SET_OUTREACH_SUBJECT", value }),
      setOutreachBody: (value) => dispatch({ type: "SET_OUTREACH_BODY", value }),
      saveOutreachDraft: () => {
        const messageId = stateRef.current.editingMessageId;
        const { outreachSubject, outreachBody } = stateRef.current;
        dispatch({ type: "SAVE_OUTREACH_DRAFT" });
        if (messageId) void leadService.updateOutreach(messageId, outreachSubject, outreachBody);
        showToast("Draft saved");
      },
      cancelEditOutreach: () => dispatch({ type: "CANCEL_EDIT_OUTREACH" }),
      applyRefinement: () => {
        void leadService.applyRefinement();
        showToast("Refinement applied — re-scoring future runs");
      },
      dismissRefinement: () => dispatch({ type: "DISMISS_REFINEMENT" }),
      restart: () => {
        if (discoveryTimer.current) clearInterval(discoveryTimer.current);
        writeGatePassed(false);
        dispatch({ type: "RESET_SIGNIN" });
      },
    };
  }, [showToast]);

  const derived = useMemo<PipelineDerived>(() => {
    const approvedCount = state.leads.filter((l) => l.status === "approved").length;
    const verifiedCount = state.leads.filter((l) => l.verified).length;
    return {
      approvedCount,
      verifiedCount,
      approvedPct: Math.round((approvedCount / state.foundCount) * 100),
      pendingApprovals: state.outreach.filter((o) => o.stage === "awaiting").length,
      contactedTotal: state.outreach.filter((o) => o.stage !== "awaiting").length,
      repliedTotal: state.outreach.filter((o) =>
        ["replied", "success", "partial"].includes(o.stage),
      ).length,
      successCount: state.outreach.filter((o) => o.stage === "success").length,
      venuesOnCount: state.venues.filter((v) => v.on).length,
    };
  }, [state.leads, state.outreach, state.venues, state.foundCount]);

  const value = useMemo<PipelineContextValue>(
    () => ({ state, actions, derived, insights: state.insights }),
    [state, actions, derived],
  );

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
  return ctx;
}

export { discoveryStatusLines };
