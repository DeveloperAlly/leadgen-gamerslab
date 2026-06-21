import { scoreColor } from "../../theme/scoreColor";
import { useTheme } from "../../theme/ThemeProvider";

interface Meter {
  label: string;
  value: number;
}

interface TwoSidedScoreProps {
  /** "Value to you" and "Prospect match", each 0–100. */
  meters: [Meter, Meter];
}

/** Two thin colour-stepped meters: value-to-you and prospect-match. */
export function TwoSidedScore({ meters }: TwoSidedScoreProps) {
  const { theme } = useTheme();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {meters.map((m) => {
        const c = scoreColor(m.value, theme);
        return (
          <div key={m.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                fontWeight: 600,
                marginBottom: 3,
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>{m.label}</span>
              <span style={{ color: c.fg }}>{m.value}</span>
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "var(--bg-subtle)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${m.value}%`,
                  height: "100%",
                  borderRadius: 2,
                  background: c.fg,
                  transition: "width .3s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
