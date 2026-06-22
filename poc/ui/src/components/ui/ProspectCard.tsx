import type { OutreachItem } from "../../data/types";
import { radius } from "../../theme/tokens";

interface ProspectCardProps {
  prospect: OutreachItem;
}

/** Small prospect card for a board column: initials, name, channel, last-event line. */
export function ProspectCard({ prospect }: ProspectCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: radius.md,
        padding: 11,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            flex: "none",
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "var(--bg-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
          }}
        >
          {prospect.initials}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {prospect.name}
        </span>
      </div>
      <div style={{ marginTop: 7, fontSize: 11, color: "var(--text-muted)" }}>{prospect.channel}</div>
      {prospect.last && (
        <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-secondary)" }}>{prospect.last}</div>
      )}
    </div>
  );
}
