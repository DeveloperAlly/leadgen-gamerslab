import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { Card, Eyebrow } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { scoreColor } from "../theme/scoreColor";
import { useTheme } from "../theme/ThemeProvider";
import {
  CheckIcon,
  GiftIcon,
  RefreshIcon,
  TargetIcon,
  TrendIcon,
} from "../components/icons";
import { space } from "../theme/tokens";
import type { Source } from "../data/types";

/** Human one-liner like "5 files · 1 site · 2 socials" derived from the real sources. */
function sourcesSummary(sources: Source[]): string {
  const n = (t: Source["type"]) => sources.filter((s) => s.type === t).length;
  const parts: string[] = [];
  const files = n("file");
  const sites = n("url");
  const socials = n("social");
  if (files) parts.push(`${files} file${files > 1 ? "s" : ""}`);
  if (sites) parts.push(`${sites} site${sites > 1 ? "s" : ""}`);
  if (socials) parts.push(`${socials} social${socials > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "No sources yet";
}

export function DashboardScreen() {
  const { state, actions, derived, insights } = usePipeline();
  const { theme } = useTheme();

  return (
    <AppShell maxWidth={980}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
          marginBottom: space.xl,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Your pipeline is live.</h1>
        <Button leadingIcon={<RefreshIcon size={16} strokeWidth={2} />} onClick={actions.startDiscovery}>
          Re-run discovery
        </Button>
      </div>

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space.lg }}>
        <Card>
          <Eyebrow>Pipeline status</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 700 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--success)" }} />
            Active
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
            Last run 2h ago · auto-refresh weekly
          </div>
        </Card>

        <Card>
          <Eyebrow>Leads</Eyebrow>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {derived.approvedCount} / {state.foundCount}
          </div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden" }}>
            <div style={{ width: `${derived.approvedPct}%`, height: "100%", background: "var(--success)" }} />
          </div>
        </Card>

        <Card>
          <Eyebrow>Sources ingested</Eyebrow>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{state.sources.length}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
            {sourcesSummary(state.sources)}
          </div>
        </Card>
      </div>

      {/* Recent runs + recommendation/next actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: space.lg, marginTop: space.lg }}>
        <Card>
          <Eyebrow>Recent runs</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
            {[
              ["Discovery + verification", "2h ago", "var(--success)"],
              ["Enrichment pass", "1d ago", "var(--success)"],
              ["Initial context index", "2d ago", "var(--success)"],
            ].map(([label, when, dot]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
                  {label}
                </div>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{when}</span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: space.lg }}>
          <Card style={{ background: "var(--highlight-soft)", border: "1px solid var(--highlight)" }}>
            <Eyebrow color="var(--highlight-ink)">Channel recommendation</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
              <TargetIcon size={15} strokeWidth={2} />
              {insights.channelRecommendation.title}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {insights.channelRecommendation.body}
            </p>
          </Card>

          <Card>
            <Eyebrow>Next actions</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {[
                { label: `Review ${derived.approvedCount} approved leads`, target: "gateB" as const },
                { label: `Approve ${derived.pendingApprovals} outreach messages`, target: "outreach" as const },
                { label: "Add more business context", target: "sources" as const },
              ].map(({ label, target }) => (
                <button
                  key={label}
                  onClick={() => actions.go(target)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: "1.5px solid var(--accent)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <CheckIcon size={13} strokeWidth={2.6} />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Learn & iterate */}
      <Card style={{ marginTop: space.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <TrendIcon size={16} strokeWidth={2} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Learn &amp; iterate</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--text-secondary)" }}>
          The engine watches what actually converts and tunes your scoring.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: space.xl }}>
          <div>
            <Eyebrow>What's converting</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {insights.converting.map((f) => {
                const c = scoreColor(f.pct, theme);
                return (
                  <div key={f.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                      <span style={{ color: c.fg, fontWeight: 600 }}>{f.pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden" }}>
                      <div style={{ width: `${f.pct}%`, height: "100%", background: c.fg }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {state.refinementDismissed ? (
            <Card>
              <Eyebrow>Suggested refinement</Eyebrow>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                Dismissed. New suggestions appear here after the next run.
              </p>
            </Card>
          ) : (
            <Card style={{ background: "var(--highlight-soft)", border: "1px solid var(--highlight)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <GiftIcon size={15} strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Suggested refinement</span>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {insights.refinement}
              </p>
              <div style={{ display: "flex", gap: space.sm }}>
                <Button onClick={actions.applyRefinement}>Apply refinement</Button>
                <Button variant="ghost" onClick={actions.dismissRefinement}>
                  Dismiss
                </Button>
              </div>
            </Card>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
