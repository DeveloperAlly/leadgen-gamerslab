import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { GateBanner } from "../components/ui/GateBanner";
import { ProspectCard } from "../components/ui/ProspectCard";
import { Button } from "../components/ui/Button";
import { Card, Eyebrow } from "../components/ui/Card";
import { BellIcon, SendIcon } from "../components/icons";
import { copy } from "../data/fixtures/copy";
import { radius, space } from "../theme/tokens";
import type { OutreachStage } from "../data/types";

const columns: { key: OutreachStage; label: string; token: string }[] = [
  { key: "contacted", label: "Contacted", token: "--accent" },
  { key: "replied", label: "Replied", token: "--highlight-ink" },
  { key: "success", label: "Success", token: "--success" },
  { key: "partial", label: "Partial", token: "--warning" },
  { key: "lost", label: "Lost", token: "--text-muted" },
];

export function ProspectTrackingScreen() {
  const { state, actions, derived } = usePipeline();
  const awaiting = state.outreach.filter((o) => o.stage === "awaiting");

  return (
    <AppShell maxWidth={920}>
      {derived.pendingApprovals > 0 && (
        <div style={{ marginBottom: space.lg }}>
          <GateBanner
            eyebrow={copy.gateC.eyebrow}
            heading={`${derived.pendingApprovals} messages need your approval before they send`}
            sub={copy.gateC.sub}
            icon={<BellIcon size={20} strokeWidth={2} />}
          />
        </div>
      )}

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space.lg, marginBottom: space.xl }}>
        <SummaryStat label="Contacted" value={derived.contactedTotal} />
        <SummaryStat label="Replied" value={derived.repliedTotal} />
        <SummaryStat label="Success" value={derived.successCount} color="var(--success)" />
      </div>

      {/* Awaiting approval */}
      {awaiting.length > 0 && (
        <section style={{ marginBottom: space.xl }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: space.md }}>Awaiting your approval</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
            {awaiting.map((o) => (
              <Card key={o.id} style={{ border: "1px solid var(--highlight)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                  <span
                    style={{
                      flex: "none",
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      background: "var(--bg-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {o.initials}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{o.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{o.channel}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: radius.pill,
                      background: "var(--highlight-soft)",
                      color: "var(--highlight-ink)",
                    }}
                  >
                    Awaiting approval
                  </span>
                </div>

                <div
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--text-primary)",
                    marginBottom: space.md,
                  }}
                >
                  {o.draft}
                </div>

                <div style={{ display: "flex", gap: space.sm }}>
                  <Button leadingIcon={<SendIcon size={16} strokeWidth={2.2} />} onClick={() => actions.approveOutreach(o.id)}>
                    Approve &amp; send
                  </Button>
                  <Button variant="ghost" onClick={() => undefined}>
                    Edit draft
                  </Button>
                  <Button variant="ghost" onClick={() => actions.skipOutreach(o.id)}>
                    Skip
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Prospect board */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: space.md }}>Prospect board</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: space.md }}>
        {columns.map((col) => {
          const items = state.outreach.filter((o) => o.stage === col.key);
          return (
            <div key={col.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px 10px",
                  borderBottom: `2px solid var(${col.token})`,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{col.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
                {items.map((o) => (
                  <ProspectCard key={o.id} prospect={o} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
    </Card>
  );
}
