import type { Lead } from "../../data/types";
import { radius, space } from "../../theme/tokens";
import { ScoreBadge } from "./ScoreBadge";
import { TwoSidedScore } from "./TwoSidedScore";
import { CheckIcon, ChevronIcon, ExternalIcon, ShieldIcon, XIcon } from "../icons";

interface LeadRowProps {
  lead: Lead;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const actionBtn = (active: boolean, tone: "success" | "danger" | "muted"): React.CSSProperties => ({
  width: 34,
  height: 34,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: `1px solid ${active ? `var(--${tone === "muted" ? "border" : tone})` : "var(--border)"}`,
  background: active && tone !== "muted" ? `var(--${tone})` : "var(--bg-surface)",
  color: active && tone !== "muted" ? "#fff" : `var(--${tone === "muted" ? "text-muted" : tone})`,
});

/** Lead row with verification pill, match reason, meta chips, two-sided score, and evidence dossier. */
export function LeadRow({ lead, expanded, onToggle, onApprove, onReject }: LeadRowProps) {
  const approved = lead.status === "approved";
  const rejected = lead.status === "rejected";
  const borderColor = approved
    ? "var(--success)"
    : rejected
      ? "var(--danger)"
      : expanded
        ? "var(--accent)"
        : "var(--border)";

  return (
    <div
      className="rise"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: "var(--shadow-sm)",
        opacity: rejected ? 0.55 : 1,
        transition: "border-color .15s, opacity .15s",
      }}
    >
      <div style={{ display: "flex", gap: space.lg, alignItems: "flex-start" }}>
        {/* Initials tile */}
        <div
          style={{
            flex: "none",
            width: 46,
            height: 46,
            borderRadius: radius.md,
            background: "var(--bg-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-secondary)",
          }}
        >
          {lead.initials}
        </div>

        {/* Middle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{lead.name}</span>
            {lead.verified && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--success)",
                  background: "var(--success-soft)",
                  borderRadius: radius.pill,
                  padding: "2px 9px",
                }}
              >
                <ShieldIcon size={12} strokeWidth={2.2} />
                Verified
              </span>
            )}
          </div>

          <p style={{ margin: "5px 0 9px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {lead.reason}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: space.md, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent)",
              }}
            >
              <ExternalIcon size={12} strokeWidth={2.2} />
              {lead.source}
            </span>
            {lead.meta.map((m) => (
              <span
                key={m}
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  background: "var(--bg-subtle)",
                  borderRadius: radius.pill,
                  padding: "2px 9px",
                }}
              >
                {m}
              </span>
            ))}
          </div>

          <button
            onClick={onToggle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 11,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            <span
              style={{
                display: "flex",
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform .15s",
              }}
            >
              <ChevronIcon size={16} strokeWidth={2.2} />
            </span>
            Evidence dossier · {lead.evidence.length} signals
          </button>
        </div>

        {/* Right: score + actions */}
        <div style={{ flex: "none", width: 140, display: "flex", flexDirection: "column", gap: space.md }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ScoreBadge score={lead.score} />
          </div>
          <TwoSidedScore
            meters={[
              { label: "Value to you", value: lead.valueScore },
              { label: "Prospect match", value: lead.matchScore },
            ]}
          />
          <div style={{ display: "flex", gap: space.sm, justifyContent: "flex-end" }}>
            <button onClick={onReject} aria-label="Reject lead" style={actionBtn(rejected, "danger")}>
              <XIcon size={16} strokeWidth={2.4} />
            </button>
            <button onClick={onApprove} aria-label="Approve lead" style={actionBtn(approved, "success")}>
              <CheckIcon size={17} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>

      {/* Evidence dossier */}
      {expanded && (
        <div style={{ marginTop: space.lg, paddingTop: space.lg, borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 11,
            }}
          >
            Why this is a match — the evidence
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
            {lead.evidence.map((ev, i) => (
              <div key={i} style={{ borderLeft: "2px solid var(--accent)", paddingLeft: space.md }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  “{ev.q}”
                </p>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                  {ev.src} · {ev.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
