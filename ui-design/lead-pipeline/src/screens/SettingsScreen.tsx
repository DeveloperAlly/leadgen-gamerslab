import { AppShell } from "../layout/AppShell";
import { Card, Eyebrow } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useTheme } from "../theme/ThemeProvider";
import { themeSwatches } from "../theme/tokens";
import { space } from "../theme/tokens";
import { appConfig } from "../config/appConfig";

export function SettingsScreen() {
  const { theme, setTheme } = useTheme();

  return (
    <AppShell maxWidth={720}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Settings</h1>
      <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--text-secondary)" }}>
        {appConfig.showThemeControls
          ? "Theme and model configuration for this workspace."
          : "Model configuration for this workspace."}
      </p>

      {/* Theme */}
      {appConfig.showThemeControls && (
      <Card style={{ marginBottom: space.lg }}>
        <Eyebrow>Theme</Eyebrow>
        <p style={{ margin: "2px 0 14px", fontSize: 14, color: "var(--text-secondary)" }}>
          Switching the palette reskins the whole product — layout and components stay identical.
        </p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {themeSwatches.map((s) => {
            const active = s.key === theme;
            return (
              <button
                key={s.key}
                onClick={() => setTheme(s.key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: s.dot,
                    border: `2px solid ${active ? "var(--text-primary)" : "transparent"}`,
                    boxShadow: "0 0 0 1px var(--border)",
                  }}
                />
                <span style={{ fontSize: 12, color: active ? "var(--text-primary)" : "var(--text-muted)", fontWeight: active ? 600 : 500 }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      )}

      {/* Model keys */}
      <Card>
        <Eyebrow>Model keys</Eyebrow>
        <p style={{ margin: "2px 0 14px", fontSize: 14, color: "var(--text-secondary)" }}>
          Bring your own model keys. Keys are stored per workspace and used for discovery, scoring,
          and draft generation.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Anthropic API key</label>
            <Input type="password" placeholder="sk-ant-…" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>OpenAI API key (optional)</label>
            <Input type="password" placeholder="sk-…" />
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
