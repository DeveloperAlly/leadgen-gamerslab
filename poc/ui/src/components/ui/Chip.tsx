import { type ReactNode } from "react";
import { fontSize, radius, space } from "../../theme/tokens";
import { CheckIcon, XIcon } from "../icons";

interface ChipProps {
  icon?: ReactNode;
  label: string;
  /** Show the animated parsing pill instead of the indexed check. */
  parsing?: boolean;
  onRemove?: () => void;
}

/** Source chip: icon + label, a parsing shimmer → indexed check, and a remove ✕. */
export function Chip({ icon, label, parsing, onRemove }: ChipProps) {
  return (
    <span
      className="rise"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: space.sm,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        borderRadius: radius.pill,
        padding: "6px 10px 6px 12px",
        fontSize: fontSize.sm,
        color: "var(--text-primary)",
        maxWidth: "100%",
      }}
    >
      {icon && <span style={{ color: "var(--text-secondary)", display: "flex" }}>{icon}</span>}
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {parsing ? (
        <span
          className="shimmer"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            background: "var(--bg-surface)",
            borderRadius: radius.pill,
            padding: "2px 8px",
          }}
        >
          parsing…
        </span>
      ) : (
        <span style={{ color: "var(--success)", display: "flex" }}>
          <CheckIcon size={14} strokeWidth={2.6} />
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          style={{
            display: "flex",
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 2,
          }}
        >
          <XIcon size={14} strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}
