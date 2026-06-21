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
  GateFieldKey,
  Intake,
  LeadStatus,
  Mode,
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
 * Initial state is hydrated from the data layer's seed. In production the provider
 * would instead call leadService.get*() in an effect and populate via SET_* actions
 * (the actions already exist for exactly that); the shape is identical either way.
 */
const initialState: PipelineState = {
  mode: "customers",
  screen: appConfig.requireSignin ? "signin" : appConfig.postLoginScreen,
  email: "",
  signinState: "idle",
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
  loadingPct: 0,
  loadingMsgIdx: 0,
  outreach: clone(seedOutreach),
  toast: null,
};

export interface PipelineActions {
  go: (screen: ScreenKey) => void;
  setMode: (mode: Mode) => void;
  setEmail: (email: string) => void;
  signinContinue: () => void;
  addSource: (type: SourceType, label: string) => void;
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
  setLeadStatus: (id: string, status: LeadStatus) => void;
  toggleExpand: (id: string) => void;
  toggleSort: () => void;
  toggleVerified: () => void;
  exportApproved: () => void;
  sendToCrm: () => void;
  approveOutreach: (id: string) => void;
  skipOutreach: (id: string) => void;
  applyRefinement: () => void;
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

  const insights = seedDashboardInsights;

  const actions = useMemo<PipelineActions>(() => {
    const addSource = (type: SourceType, label: string) => {
      void leadService.addSource(type, label).then((source) => {
        dispatch({ type: "ADD_SOURCE", source });
        // The parse/index job completes asynchronously.
        setTimeout(() => dispatch({ type: "MARK_SOURCE_DONE", id: source.id }), 1500);
      });
    };

    return {
      go: (screen) => dispatch({ type: "GO", screen }),
      setMode: (mode) => dispatch({ type: "SET_MODE", mode }),
      setEmail: (email) => dispatch({ type: "SET_EMAIL", email }),
      signinContinue: () => {
        if (!VALID_EMAIL.test(stateRef.current.email)) {
          dispatch({ type: "SET_SIGNIN_STATE", state: "error" });
          return;
        }
        dispatch({ type: "SET_SIGNIN_STATE", state: "loading" });
        setTimeout(() => dispatch({ type: "GO", screen: appConfig.postLoginScreen }), 850);
      },
      addSource,
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
        // PoC build runs no fake discovery loader; leads are already present.
        if (!appConfig.enableDiscoveryLoader) {
          showToast("Discovery refreshed");
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
      setLeadStatus: (id, status) => {
        dispatch({ type: "SET_LEAD_STATUS", id, status });
        void leadService.setLeadStatus(id, status);
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
        dispatch({ type: "SET_OUTREACH_STAGE", id, stage: "contacted", last: "Sent just now" });
        void leadService.approveOutreach(id);
        showToast("Message approved & sent");
      },
      skipOutreach: (id) => {
        dispatch({ type: "SET_OUTREACH_STAGE", id, stage: "lost", last: "Skipped" });
        void leadService.skipOutreach(id);
      },
      applyRefinement: () => {
        void leadService.applyRefinement();
        showToast("Refinement applied — re-scoring future runs");
      },
      restart: () => {
        if (discoveryTimer.current) clearInterval(discoveryTimer.current);
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
    () => ({ state, actions, derived, insights }),
    [state, actions, derived, insights],
  );

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
  return ctx;
}

export { discoveryStatusLines };
