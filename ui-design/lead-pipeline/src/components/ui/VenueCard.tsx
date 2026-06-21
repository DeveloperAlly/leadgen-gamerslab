import type { Venue, VenueStrength } from "../../data/types";
import { radius, space } from "../../theme/tokens";
import { PinIcon } from "../icons";
import { Switch } from "./Switch";

const strengthMeta: Record<VenueStrength, { label: string; token: string }> = {
  strong: { label: "Strong signal", token: "--success" },
  medium: { label: "Medium", token: "--warning" },
  weak: { label: "Weak", token: "--text-muted" },
};

interface VenueCardProps {
  venue: Venue;
  onToggle: () => void;
}

/** Venue card with pin tile, strength badge, platform·note sub-line, and a toggle. */
export function VenueCard({ venue, onToggle }: VenueCardProps) {
  const meta = strengthMeta[venue.strength];
  return (
    <div
      className="rise"
      style={{
        display: "flex",
        gap: 13,
        alignItems: "center",
        background: "var(--bg-surface)",
        border: `1px solid ${venue.on ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "var(--shadow-sm)",
        opacity: venue.on ? 1 : 0.55,
        transition: "border-color .15s, opacity .15s",
      }}
    >
      <div
        style={{
          flex: "none",
          width: 40,
          height: 40,
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: venue.on ? "var(--accent-soft)" : "var(--bg-subtle)",
          color: venue.on ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        <PinIcon size={18} strokeWidth={2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{venue.name}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              padding: "2px 8px",
              borderRadius: radius.pill,
              background: "var(--bg-subtle)",
              color: `var(${meta.token})`,
            }}
          >
            {meta.label}
          </span>
        </div>
        <div style={{ marginTop: 3, fontSize: 13, color: "var(--text-muted)" }}>
          {venue.platform} · {venue.note}
        </div>
      </div>

      <Switch on={venue.on} onToggle={onToggle} label={`Toggle ${venue.name}`} />
    </div>
  );
}
