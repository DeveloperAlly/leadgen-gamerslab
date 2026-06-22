import { usePipeline } from "../state/PipelineProvider";
import { radius } from "../theme/tokens";

/**
 * Floating demo aid: restart the prototype run. Not part of the product chrome —
 * remove for production. The theme switcher now lives only in Settings (Settings →
 * Theme), so the palette isn't floating over every screen.
 */
export function PrototypeControls() {
  const { actions } = usePipeline();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        alignItems: "center",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: radius.pill,
        boxShadow: "var(--shadow-md)",
        padding: "8px 14px",
        zIndex: 40,
      }}
    >
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
