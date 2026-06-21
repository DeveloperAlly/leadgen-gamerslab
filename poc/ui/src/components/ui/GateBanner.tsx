import { type ReactNode } from "react";
import { radius, space } from "../../theme/tokens";
import { SparkleIcon } from "../icons";

interface GateBannerProps {
  eyebrow: string;
  heading: string;
  sub: string;
  /** Icon shown in the highlight tile (defaults to the sparkle). */
  icon?: ReactNode;
}

/** "Your turn to review" banner — highlight-soft fill, highlight border + icon tile. */
export function GateBanner({ eyebrow, heading, sub, icon }: GateBannerProps) {
  return (
    <div
      className="rise"
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        background: "var(--highlight-soft)",
        border: "1px solid var(--highlight)",
        borderRadius: radius.lg,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: 11,
          background: "var(--highlight)",
          color: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon ?? <SparkleIcon size={20} />}
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--highlight-ink)",
            marginBottom: space.xs,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", marginBottom: space.xs }}>
          {heading}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {sub}
        </p>
      </div>
    </div>
  );
}
