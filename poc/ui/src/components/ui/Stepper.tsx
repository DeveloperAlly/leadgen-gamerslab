import { Fragment } from "react";
import { fontSize } from "../../theme/tokens";
import { CheckIcon } from "../icons";

interface StepperProps {
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
}

/** Onboarding stepper: completed/active filled accent, pending subtle. */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "14px 28px 16px",
        maxWidth: 760,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const filled = done || active;
        return (
          <Fragment key={label}>
            <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  background: filled ? "var(--accent)" : "var(--bg-subtle)",
                  color: filled ? "var(--on-accent)" : "var(--text-muted)",
                  border: filled ? "none" : "1px solid var(--border)",
                }}
              >
                {done ? <CheckIcon size={14} strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  marginLeft: 9,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 14px",
                  borderRadius: 2,
                  background: i < current ? "var(--accent)" : "var(--border)",
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
