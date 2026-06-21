/**
 * Theming system — the core portability requirement.
 *
 * Every screen and component reads from these token NAMES, never colour literals.
 * Switching the active token set reskins the entire product (colour, logo tint, type)
 * with zero layout changes. To onboard a new tenant, register another entry in `themes`
 * — nothing else in the app changes.
 *
 * Colour tokens are applied at runtime as CSS custom properties (see ThemeProvider).
 * Scale tokens (radius, spacing, type) are constants — they do not vary by theme.
 */

export type ColorTokenName =
  | "--bg-canvas"
  | "--bg-surface"
  | "--bg-subtle"
  | "--border"
  | "--text-primary"
  | "--text-secondary"
  | "--text-muted"
  | "--accent"
  | "--accent-hover"
  | "--accent-soft"
  | "--on-accent"
  | "--highlight"
  | "--highlight-soft"
  | "--highlight-ink"
  | "--success"
  | "--success-soft"
  | "--warning"
  | "--danger"
  | "--logo"
  | "--shadow-sm"
  | "--shadow-md";

export type ThemeTokens = Record<ColorTokenName, string>;

export type ThemeKey =
  | "neutral"
  | "gamerslab"
  | "midnight"
  | "aqua"
  | "emerald"
  | "ember"
  | "rose";

/** Shared dark base reused by every dark accent preset. */
const dark = {
  "--bg-canvas": "#0D1F2D",
  "--bg-surface": "#15293A",
  "--bg-subtle": "#1C3547",
  "--border": "#294657",
  "--text-primary": "#EAF1F6",
  "--text-secondary": "#9FB3C2",
  "--text-muted": "#62788B",
  "--success": "#3CCB7F",
  "--success-soft": "#16271F",
  "--warning": "#F5C451",
  "--danger": "#FF6B6B",
  "--shadow-sm": "0 1px 2px rgba(0,0,0,.4)",
  "--shadow-md": "0 10px 34px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.4)",
} satisfies Partial<ThemeTokens>;

/** Build a dark theme by layering an accent set onto the shared dark base. */
const mk = (
  accent: string,
  accentHover: string,
  accentSoft: string,
  onAccent: string,
  highlight: string,
  highlightSoft: string,
  highlightInk: string,
): ThemeTokens => ({
  ...dark,
  "--accent": accent,
  "--accent-hover": accentHover,
  "--accent-soft": accentSoft,
  "--on-accent": onAccent,
  "--highlight": highlight,
  "--highlight-soft": highlightSoft,
  "--highlight-ink": highlightInk,
  "--logo": accent,
});

export const themes: Record<ThemeKey, ThemeTokens> = {
  // Neutral default — warm, light. The white-label baseline.
  neutral: {
    "--bg-canvas": "#FAF9F6",
    "--bg-surface": "#FFFFFF",
    "--bg-subtle": "#F3F1EC",
    "--border": "#E7E4DD",
    "--text-primary": "#2B2A27",
    "--text-secondary": "#6B6862",
    "--text-muted": "#9A968E",
    "--accent": "#2F6F62",
    "--accent-hover": "#265B50",
    "--accent-soft": "#E5F0EC",
    "--on-accent": "#FFFFFF",
    "--highlight": "#C9792E",
    "--highlight-soft": "#F8ECD9",
    "--highlight-ink": "#9A5816",
    "--success": "#2E7D5B",
    "--success-soft": "#E4F1E9",
    "--warning": "#B8860B",
    "--danger": "#B4453C",
    "--logo": "#2F6F62",
    "--shadow-sm": "0 1px 2px rgba(43,42,39,.05),0 1px 3px rgba(43,42,39,.04)",
    "--shadow-md": "0 8px 30px rgba(43,42,39,.10),0 2px 8px rgba(43,42,39,.06)",
  },
  // Gamers Lab — the first tenant (dark default in the prototype).
  gamerslab: mk("#7C5CFF", "#6A49F0", "#221C42", "#FFFFFF", "#34D399", "#123026", "#34D399"),
  midnight: mk("#5B8BFF", "#4574EE", "#161E36", "#FFFFFF", "#FACC15", "#2A2410", "#FACC15"),
  aqua: mk("#2DD4BF", "#1FB9A6", "#0E2A2A", "#04231F", "#FBBF24", "#2A2210", "#FBBF24"),
  emerald: mk("#34D399", "#22B886", "#0F2A20", "#04230F", "#FBBF24", "#2A2210", "#FBBF24"),
  ember: mk("#FB923C", "#F47A1F", "#2A1A0E", "#2A1402", "#56C7F5", "#0E2733", "#7DD3FC"),
  rose: mk("#FB6F92", "#F2557C", "#2C1620", "#2A0A12", "#A3E635", "#23280F", "#BEF264"),
};

/** Whether a theme uses the light or dark base — affects score-badge alpha. */
export const isLightTheme = (key: ThemeKey): boolean => key === "neutral";

/** Theme picker metadata for the Settings / palette control. */
export interface ThemeSwatch {
  key: ThemeKey;
  label: string;
  dot: string;
}

export const themeSwatches: ThemeSwatch[] = [
  { key: "neutral", label: "Daylight", dot: "#2F6F62" },
  { key: "gamerslab", label: "Violet", dot: "#7C5CFF" },
  { key: "midnight", label: "Midnight", dot: "#5B8BFF" },
  { key: "aqua", label: "Aqua", dot: "#2DD4BF" },
  { key: "emerald", label: "Emerald", dot: "#34D399" },
  { key: "ember", label: "Ember", dot: "#FB923C" },
  { key: "rose", label: "Rose", dot: "#FB6F92" },
];

/* ---- Scale tokens (constant across themes) ---- */

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Spacing scale (px): 4 · 8 · 12 · 16 · 24 · 32 · 48 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fontSize = {
  eyebrow: 12,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const fontFamily =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
