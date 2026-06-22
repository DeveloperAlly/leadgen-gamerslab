import { scoreColor } from "../../theme/scoreColor";
import { useTheme } from "../../theme/ThemeProvider";
import { radius } from "../../theme/tokens";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

/** Composite 0–100 score badge, colour-stepped, on a low-alpha tint of its step colour. */
export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const { theme } = useTheme();
  const c = scoreColor(score, theme);
  const dims = size === "md" ? { w: 52, h: 40, fs: 20 } : { w: 42, h: 32, fs: 16 };

  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: radius.md,
        background: c.bg,
        color: c.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: dims.fs,
        flex: "none",
      }}
    >
      {score}
    </div>
  );
}
