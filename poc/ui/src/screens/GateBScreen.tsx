import { useState } from "react";
import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { GateBanner } from "../components/ui/GateBanner";
import { LeadRow } from "../components/ui/LeadRow";
import { Button } from "../components/ui/Button";
import { ShieldIcon, ArrowRightIcon, ChevronIcon, SparkleIcon } from "../components/icons";
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

      <HowThisWorks />

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

/**
 * Collapsible explainer at the top of Gate B: how these leads were found, how the two
 * scores are produced, and what the Verified badge means. Collapsed by default so it
 * never crowds the review list; the "Verified" line mirrors the badge tooltip in LeadRow.
 */
function HowThisWorks() {
  const [open, setOpen] = useState(false);

  const rows: { term: string; body: string }[] = [
    {
      term: "Found",
      body: "We scan your active venues (Steam) for games and publishers that match your ICP, then enrich each one with public data: game stats, reviews, owner estimates, contact details and socials.",
    },
    {
      term: "Scored",
      body: "An AI model rates every prospect against your business context. The large number is the overall fit (0–100). “Value to you” is how well the prospect fits what you offer; “Prospect match” is how strong a fit you are for them.",
    },
    {
      term: "Evidence",
      body: "Each score is backed by real quotes and signals. Expand a card’s evidence dossier to see the source behind every claim.",
    },
    {
      term: "Verified",
      body: "A green Verified badge means we found a deliverable contact email (it passed mail-server validation). Use “Verified only” to hide leads we can’t reach yet.",
    },
  ];

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: radius.md,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: space.sm,
          width: "100%",
          padding: "12px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--text-secondary)",
        }}
      >
        <SparkleIcon size={15} strokeWidth={2} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
          How these leads are found and scored
        </span>
        <span
          style={{
            display: "flex",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s",
          }}
        >
          <ChevronIcon size={16} strokeWidth={2.2} />
        </span>
      </button>

      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: space.md,
            padding: "0 14px 14px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {rows.map((r) => (
            <div key={r.term} style={{ display: "flex", gap: space.md, marginTop: space.md }}>
              <span
                style={{
                  flex: "none",
                  width: 78,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                {r.term}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                {r.body}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
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
