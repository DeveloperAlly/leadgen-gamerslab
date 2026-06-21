import { useTheme } from "../theme/ThemeProvider";
import { usePipeline } from "../state/PipelineProvider";
import { themeSwatches } from "../theme/tokens";
import { radius } from "../theme/tokens";

/**
 * Floating demo aid: live theme switcher + restart. Not part of the product chrome —
 * it exists so a reviewer can watch the runtime reskin. Remove for production.
 */
export function PrototypeControls() {
  const { theme, setTheme } = useTheme();
  const { actions } = usePipeline();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: radius.pill,
        boxShadow: "var(--shadow-md)",
        padding: "8px 14px",
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        {themeSwatches.map((s) => (
          <button
            key={s.key}
            title={s.label}
            aria-label={`Theme: ${s.label}`}
            onClick={() => setTheme(s.key)}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              cursor: "pointer",
              padding: 0,
              background: s.dot,
              border: `2px solid ${theme === s.key ? "var(--text-primary)" : "transparent"}`,
              boxShadow: "0 0 0 1px var(--border)",
            }}
          />
        ))}
      </div>
      <span style={{ width: 1, height: 20, background: "var(--border)" }} />
      <button
        onClick={actions.restart}
        style={{
          border: "none",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Restart
      </button>
    </div>
  );
}
