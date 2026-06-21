import { fontSize, radius } from "../../theme/tokens";

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: [SegmentOption<T>, SegmentOption<T>];
  value: T;
  onChange: (value: T) => void;
}

/** Segmented pill toggle (e.g. Customers ⇄ Investors). */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: "var(--bg-subtle)",
        borderRadius: radius.pill,
        border: "1px solid var(--border)",
      }}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "7px 16px",
              borderRadius: radius.pill,
              border: "none",
              fontSize: fontSize.sm,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all .15s",
              background: on ? "var(--bg-surface)" : "transparent",
              color: on ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: on ? "var(--shadow-sm)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
