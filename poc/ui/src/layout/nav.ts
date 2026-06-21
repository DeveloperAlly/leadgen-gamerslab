import type { ScreenKey } from "../data/types";
import {
  FlowIcon,
  HomeIcon,
  LayersIcon,
  SlidersIcon,
  UsersIcon,
} from "../components/icons";

export interface NavItem {
  label: string;
  Icon: typeof HomeIcon;
  target: ScreenKey;
}

/** Sidebar navigation. Targets reuse the flow's screen keys. */
export const navItems: NavItem[] = [
  { label: "Dashboard", Icon: HomeIcon, target: "dashboard" },
  { label: "Pipeline", Icon: FlowIcon, target: "outreach" },
  { label: "Leads", Icon: UsersIcon, target: "gateB" },
  { label: "Sources", Icon: LayersIcon, target: "sources" },
  { label: "Settings", Icon: SlidersIcon, target: "settings" },
];

/** Which nav label is active for a given screen. */
export const activeNavForScreen: Partial<Record<ScreenKey, string>> = {
  dashboard: "Dashboard",
  outreach: "Pipeline",
  gateB: "Leads",
  sources: "Sources",
  settings: "Settings",
};

/** Title shown in the top bar per in-shell screen. */
export const shellTitle: Partial<Record<ScreenKey, string>> = {
  dashboard: "Dashboard",
  outreach: "Prospect tracking",
  gateB: "Leads",
  sources: "Sources",
  settings: "Settings",
};
