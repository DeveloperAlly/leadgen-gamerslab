import { type CSSProperties, type ReactNode } from "react";
import { radius, space } from "../../theme/tokens";

interface CardProps {
  children: ReactNode;
  /** Override padding (defaults to 18px). */
  padding?: number;
  style?: CSSProperties;
  className?: string;
}

/** Surface card: radius 16, --shadow-sm, --bg-surface. */
export function Card({ children, padding = 18, style, className }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: radius.lg,
        boxShadow: "var(--shadow-sm)",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A simple uppercase eyebrow label. */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: color ?? "var(--text-muted)",
        marginBottom: space.xs,
      }}
    >
      {children}
    </div>
  );
}
