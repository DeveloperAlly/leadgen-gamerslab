import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { themes, type ThemeKey, type ThemeTokens } from "./tokens";

interface ThemeContextValue {
  theme: ThemeKey;
  tokens: ThemeTokens;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  defaultTheme?: ThemeKey;
  children: ReactNode;
}

/**
 * Applies the active token set as CSS custom properties on a wrapper element.
 * Everything below reads `var(--token)`, so swapping the theme reskins the tree
 * with no component changes.
 */
export function ThemeProvider({ defaultTheme = "gamerslab", children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeKey>(defaultTheme);
  const tokens = themes[theme];

  const handleSetTheme = useCallback((key: ThemeKey) => setTheme(key), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, tokens, setTheme: handleSetTheme }),
    [theme, tokens, handleSetTheme],
  );

  // Token map doubles as the inline style that defines the CSS variables.
  const rootStyle = tokens as unknown as CSSProperties;

  return (
    <ThemeContext.Provider value={value}>
      <div
        data-theme={theme}
        style={{
          ...rootStyle,
          width: "100%",
          height: "100%",
          minHeight: "100%",
          color: "var(--text-primary)",
          background: "var(--bg-canvas)",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
