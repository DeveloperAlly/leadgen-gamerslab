import { type InputHTMLAttributes, type ReactNode } from "react";
import { fontSize, radius, space } from "../../theme/tokens";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  /** Optional element rendered at the right edge (e.g. an add button). */
  trailing?: ReactNode;
}

/** Text input with optional leading icon and trailing slot. */
export function Input({ leadingIcon, trailing, style, ...rest }: InputProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space.md,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: radius.md,
        padding: `0 ${space.md}px`,
      }}
    >
      {leadingIcon && (
        <span style={{ color: "var(--text-muted)", display: "flex", flex: "none" }}>{leadingIcon}</span>
      )}
      <input
        {...rest}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--text-primary)",
          fontSize: fontSize.base,
          padding: "13px 0",
          ...style,
        }}
      />
      {trailing}
    </div>
  );
}
