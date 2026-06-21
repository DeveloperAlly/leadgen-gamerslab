import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { fontWeight, radius } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

/** Pill-shaped button in three variants. All colour reads from theme tokens. */
export function Button({
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  fullWidth,
  children,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);

  const sizing =
    size === "lg"
      ? { padding: "13px 24px", fontSize: 16 }
      : { padding: "11px 18px", fontSize: 15 };

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: radius.pill,
    fontWeight: fontWeight.semibold,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "background .15s, color .15s, border-color .15s",
    width: fullWidth ? "100%" : undefined,
    ...sizing,
  } as const;

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      border: "none",
      background: hover && !disabled ? "var(--accent-hover)" : "var(--accent)",
      color: "var(--on-accent)",
      boxShadow: "var(--shadow-sm)",
    },
    secondary: {
      border: "1px solid var(--border)",
      background: hover && !disabled ? "var(--bg-subtle)" : "var(--bg-surface)",
      color: "var(--text-primary)",
    },
    ghost: {
      border: "1px solid var(--border)",
      background: hover && !disabled ? "var(--bg-subtle)" : "var(--bg-surface)",
      color: "var(--text-secondary)",
    },
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
