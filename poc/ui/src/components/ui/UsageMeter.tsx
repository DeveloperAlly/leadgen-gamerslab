import { fontSize, radius } from "../../theme/tokens";

interface UsageMeterProps {
  used: number;
  total: number;
}

/** Credits usage meter, pinned to the bottom of the sidebar. */
export function UsageMeter({ used, total }: UsageMeterProps) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: radius.md,
        padding: 12,
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 7,
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>Usage</span>
        <span style={{ color: "var(--text-muted)", fontSize: fontSize.xs }}>
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "var(--accent)" }} />
      </div>
    </div>
  );
}
