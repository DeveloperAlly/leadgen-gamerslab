import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { GateBanner } from "../components/ui/GateBanner";
import { LeadRow } from "../components/ui/LeadRow";
import { Button } from "../components/ui/Button";
import { ShieldIcon, ArrowRightIcon } from "../components/icons";
import { copy } from "../data/fixtures/copy";
import { radius, space } from "../theme/tokens";
import type { Lead } from "../data/types";

function sortLeads(leads: Lead[], onlyVerified: boolean, sortDesc: boolean): Lead[] {
  const filtered = onlyVerified ? leads.filter((l) => l.verified) : leads.slice();
  return filtered.sort((a, b) => (sortDesc ? b.score - a.score : a.score - b.score));
}

export function GateBScreen() {
  const { state, actions, derived } = usePipeline();
  const visible = sortLeads(state.leads, state.onlyVerified, state.sortDesc);

  return (
    <AppShell maxWidth={920}>
      <GateBanner eyebrow={copy.gateB.eyebrow} heading={copy.gateB.heading} sub={copy.gateB.sub} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
          flexWrap: "wrap",
          margin: `${space.lg}px 0`,
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          <b style={{ color: "var(--text-primary)" }}>{state.foundCount} found</b> · {derived.verifiedCount} verified ·{" "}
          {derived.approvedCount} approved
        </span>
        <div style={{ display: "flex", gap: space.sm }}>
          <FilterToggle active={state.onlyVerified} onClick={actions.toggleVerified} />
          <SortToggle desc={state.sortDesc} onClick={actions.toggleSort} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
        {visible.map((lead) => (
          <LeadRow
            key={lead.id}
            lead={lead}
            expanded={state.expandedLead === lead.id}
            onToggle={() => actions.toggleExpand(lead.id)}
            onApprove={() => actions.setLeadStatus(lead.id, "approved")}
            onReject={(code) => actions.setLeadStatus(lead.id, "rejected", code)}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
          flexWrap: "wrap",
          marginTop: space.xl,
          paddingTop: space.lg,
          borderTop: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          <b style={{ color: "var(--text-primary)" }}>{derived.approvedCount}</b> leads approved
        </span>
        <div style={{ display: "flex", gap: space.sm }}>
          <Button variant="secondary" onClick={actions.sendToCrm}>
            Send to CRM
          </Button>
          <Button trailingIcon={<ArrowRightIcon size={16} strokeWidth={2} />} onClick={actions.exportApproved}>
            Export {derived.approvedCount} approved
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

const filterBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 13px",
  borderRadius: radius.pill,
  cursor: "pointer",
};

function FilterToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...filterBase,
        background: active ? "var(--accent-soft)" : "var(--bg-surface)",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      <ShieldIcon size={14} strokeWidth={2.2} />
      Verified only
    </button>
  );
}

function SortToggle({ desc, onClick }: { desc: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...filterBase,
        background: "var(--bg-surface)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {desc ? "Score: high → low" : "Score: low → high"}
    </button>
  );
}
