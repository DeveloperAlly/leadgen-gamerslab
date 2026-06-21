import type { ScreenKey } from "../data/types";

/**
 * Build-mode configuration — the single switch between the Gamers Lab PoC and the
 * full white-label product. Selected by Vite's build mode:
 *   - "full" (default) — the complete flow, used by the white-label build.
 *   - "poc"            — the trimmed Gamers Lab proof-of-concept (`--mode poc`).
 *
 * Every screen stays in source regardless; this only controls what a given build
 * presents. To produce the PoC build: `npm run build:poc` (runs `vite build --mode poc`).
 */

export type AppMode = "poc" | "full";

export interface AppConfig {
  mode: AppMode;
  /** Gate the app behind the sign-in screen. */
  requireSignin: boolean;
  /** Where the user lands after sign-in (or on load when sign-in is off). */
  postLoginScreen: ScreenKey;
  /** Screens this build will render; anything else falls back to postLoginScreen. */
  enabledScreens: ScreenKey[];
  /** Run the guided onboarding flow (context → intake → venues → Gate A). */
  enableOnboarding: boolean;
  /** Show the animated discovery loader; when off, "Re-run discovery" is a no-op toast. */
  enableDiscoveryLoader: boolean;
  /** Show theme-switching in Settings (the whitelabel palette) + the floating restart aid. */
  showThemeControls: boolean;
}

const full: AppConfig = {
  mode: "full",
  requireSignin: true,
  postLoginScreen: "context",
  enabledScreens: [
    "signin",
    "context",
    "intake",
    "venues",
    "gateA",
    "loading",
    "gateB",
    "dashboard",
    "sources",
    "outreach",
    "settings",
  ],
  enableOnboarding: true,
  enableDiscoveryLoader: true,
  showThemeControls: true,
};

const poc: AppConfig = {
  mode: "poc",
  requireSignin: true,
  postLoginScreen: "dashboard",
  // No onboarding, no discovery loader. Keep a connectable context page (Sources).
  enabledScreens: ["signin", "dashboard", "gateB", "outreach", "sources", "settings"],
  enableOnboarding: false,
  enableDiscoveryLoader: false,
  showThemeControls: false,
};

// Driven by Vite's build mode: `vite build --mode poc` / `vite --mode poc` (see the
// build:poc / dev:poc npm scripts). Any other mode (production, development) is "full".
const mode: AppMode = import.meta.env.MODE === "poc" ? "poc" : "full";

export const appConfig: AppConfig = mode === "poc" ? poc : full;

/** Whether a screen is reachable in the current build. */
export const isScreenEnabled = (screen: ScreenKey): boolean =>
  appConfig.enabledScreens.includes(screen);
