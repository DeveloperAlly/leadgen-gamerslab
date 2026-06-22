import type {
  DashboardInsights,
  GateFieldKey,
  GateFields,
  Intake,
  Lead,
  LeadStatus,
  Mode,
  OutreachItem,
  ScreenKey,
  Source,
  Venue,
} from "../data/types";
import type { TenantConfig } from "../data/fixtures/tenant";

export type SigninState = "idle" | "loading" | "error";
export type DataState = "idle" | "loading" | "ready" | "error";

export interface Usage {
  used: number;
  total: number;
}

export interface PipelineState {
  mode: Mode;
  screen: ScreenKey;

  email: string;
  password: string;
  signinState: SigninState;

  /** Live bootstrap data (hydrated from the backend on mount; seeded for fixtures). */
  tenant: TenantConfig;
  usage: Usage;
  insights: DashboardInsights;
  dataState: DataState;
  dataError: string | null;

  sources: Source[];
  websiteInput: string;
  socialInput: string;

  intake: Intake;

  venues: Venue[];
  venueInput: string;

  fields: GateFields;
  editingField: GateFieldKey | null;
  editDraft: string;

  leads: Lead[];
  foundCount: number;
  expandedLead: string | null;
  sortDesc: boolean;
  onlyVerified: boolean;
  refinementDismissed: boolean;

  loadingPct: number;
  loadingMsgIdx: number;

  outreach: OutreachItem[];
  editingOutreach: string | null;
  outreachSubject: string;
  outreachBody: string;

  toast: string | null;
}

export type HydratePayload = Partial<
  Pick<
    PipelineState,
    "tenant" | "usage" | "insights" | "leads" | "foundCount" | "sources" | "outreach"
  >
>;

export type PipelineAction =
  | { type: "GO"; screen: ScreenKey }
  | { type: "SET_MODE"; mode: Mode }
  | { type: "SET_EMAIL"; email: string }
  | { type: "SET_PASSWORD"; password: string }
  | { type: "SET_SIGNIN_STATE"; state: SigninState }
  | { type: "HYDRATE"; payload: HydratePayload }
  | { type: "SET_DATA_STATE"; state: DataState; error?: string }
  | { type: "DISMISS_REFINEMENT" }
  | { type: "START_EDIT_OUTREACH"; id: string; subject: string; body: string }
  | { type: "SET_OUTREACH_SUBJECT"; value: string }
  | { type: "SET_OUTREACH_BODY"; value: string }
  | { type: "SAVE_OUTREACH_DRAFT" }
  | { type: "CANCEL_EDIT_OUTREACH" }
  | { type: "SET_SOURCES"; sources: Source[] }
  | { type: "ADD_SOURCE"; source: Source }
  | { type: "MARK_SOURCE_DONE"; id: string }
  | { type: "REMOVE_SOURCE"; id: string }
  | { type: "SET_WEBSITE_INPUT"; value: string }
  | { type: "SET_SOCIAL_INPUT"; value: string }
  | { type: "UPDATE_INTAKE"; patch: Partial<Intake> }
  | { type: "SET_VENUES"; venues: Venue[] }
  | { type: "TOGGLE_VENUE"; id: string }
  | { type: "ADD_VENUE"; venue: Venue }
  | { type: "SET_VENUE_INPUT"; value: string }
  | { type: "START_EDIT_FIELD"; key: GateFieldKey; draft: string }
  | { type: "SET_EDIT_DRAFT"; value: string }
  | { type: "SAVE_FIELD"; key: GateFieldKey }
  | { type: "CANCEL_EDIT" }
  | { type: "SET_LEADS"; leads: Lead[]; foundCount: number }
  | { type: "SET_LEAD_STATUS"; id: string; status: LeadStatus }
  | { type: "TOGGLE_EXPAND"; id: string }
  | { type: "TOGGLE_SORT" }
  | { type: "TOGGLE_VERIFIED" }
  | { type: "SET_LOADING"; pct: number; msgIdx: number }
  | { type: "SET_OUTREACH_STAGE"; id: string; stage: OutreachItem["stage"]; last: string }
  | { type: "SHOW_TOAST"; message: string }
  | { type: "CLEAR_TOAST" }
  | { type: "RESET_SIGNIN" };

export function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case "GO":
      return { ...state, screen: action.screen };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_EMAIL":
      return { ...state, email: action.email, signinState: "idle" };
    case "SET_PASSWORD":
      return { ...state, password: action.password, signinState: "idle" };
    case "SET_SIGNIN_STATE":
      return { ...state, signinState: action.state };
    case "HYDRATE":
      return { ...state, ...action.payload };
    case "SET_DATA_STATE":
      return { ...state, dataState: action.state, dataError: action.error ?? null };
    case "DISMISS_REFINEMENT":
      return { ...state, refinementDismissed: true };
    case "START_EDIT_OUTREACH":
      return {
        ...state,
        editingOutreach: action.id,
        outreachSubject: action.subject,
        outreachBody: action.body,
      };
    case "SET_OUTREACH_SUBJECT":
      return { ...state, outreachSubject: action.value };
    case "SET_OUTREACH_BODY":
      return { ...state, outreachBody: action.value };
    case "SAVE_OUTREACH_DRAFT":
      return {
        ...state,
        outreach: state.outreach.map((o) =>
          o.id === state.editingOutreach
            ? { ...o, subject: state.outreachSubject, body: state.outreachBody }
            : o,
        ),
        editingOutreach: null,
      };
    case "CANCEL_EDIT_OUTREACH":
      return { ...state, editingOutreach: null };
    case "SET_SOURCES":
      return { ...state, sources: action.sources };
    case "ADD_SOURCE":
      return { ...state, sources: [...state.sources, action.source] };
    case "MARK_SOURCE_DONE":
      return {
        ...state,
        sources: state.sources.map((s) =>
          s.id === action.id ? { ...s, parsing: false, done: true } : s,
        ),
      };
    case "REMOVE_SOURCE":
      return { ...state, sources: state.sources.filter((s) => s.id !== action.id) };
    case "SET_WEBSITE_INPUT":
      return { ...state, websiteInput: action.value };
    case "SET_SOCIAL_INPUT":
      return { ...state, socialInput: action.value };
    case "UPDATE_INTAKE":
      return { ...state, intake: { ...state.intake, ...action.patch } };
    case "SET_VENUES":
      return { ...state, venues: action.venues };
    case "TOGGLE_VENUE":
      return {
        ...state,
        venues: state.venues.map((v) => (v.id === action.id ? { ...v, on: !v.on } : v)),
      };
    case "ADD_VENUE":
      return { ...state, venues: [...state.venues, action.venue], venueInput: "" };
    case "SET_VENUE_INPUT":
      return { ...state, venueInput: action.value };
    case "START_EDIT_FIELD":
      return { ...state, editingField: action.key, editDraft: action.draft };
    case "SET_EDIT_DRAFT":
      return { ...state, editDraft: action.value };
    case "SAVE_FIELD":
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.key]: { ...state.fields[action.key], text: state.editDraft },
        },
        editingField: null,
      };
    case "CANCEL_EDIT":
      return { ...state, editingField: null };
    case "SET_LEADS":
      return { ...state, leads: action.leads, foundCount: action.foundCount };
    case "SET_LEAD_STATUS":
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === action.id
            ? { ...l, status: l.status === action.status ? "pending" : action.status }
            : l,
        ),
      };
    case "TOGGLE_EXPAND":
      return { ...state, expandedLead: state.expandedLead === action.id ? null : action.id };
    case "TOGGLE_SORT":
      return { ...state, sortDesc: !state.sortDesc };
    case "TOGGLE_VERIFIED":
      return { ...state, onlyVerified: !state.onlyVerified };
    case "SET_LOADING":
      return { ...state, loadingPct: action.pct, loadingMsgIdx: action.msgIdx };
    case "SET_OUTREACH_STAGE":
      return {
        ...state,
        outreach: state.outreach.map((o) =>
          o.id === action.id ? { ...o, stage: action.stage, last: action.last } : o,
        ),
      };
    case "SHOW_TOAST":
      return { ...state, toast: action.message };
    case "CLEAR_TOAST":
      return { ...state, toast: null };
    case "RESET_SIGNIN":
      return { ...state, screen: "signin", email: "", password: "", signinState: "idle" };
    default:
      return state;
  }
}
