import { hexA } from "../lib/hexA";
import { isLightTheme, themes, type ColorTokenName, type ThemeKey } from "./tokens";

export interface ScoreColor {
  /** The token name the score maps to (e.g. "--success"). */
  token: ColorTokenName;
  /** A `var(--token)` reference for foreground use (text, bars). */
  fg: string;
  /** Low-alpha tint of the step colour, for badge backgrounds. */
  bg: string;
}

/**
 * Colour-stepping shared by every 0–100 badge and meter:
 *   >=85 success · 70–84 accent · 55–69 warning · <55 danger
 * Badge background is the step colour at low alpha (≈13% light, ≈18% dark).
 */
export function scoreColor(score: number, theme: ThemeKey): ScoreColor {
  let token: ColorTokenName;
  if (score >= 85) token = "--success";
  else if (score >= 70) token = "--accent";
  else if (score >= 55) token = "--warning";
  else token = "--danger";

  const hex = themes[theme][token];
  const alpha = isLightTheme(theme) ? 0.13 : 0.18;

  return { token, fg: `var(${token})`, bg: hexA(hex, alpha) };
}
