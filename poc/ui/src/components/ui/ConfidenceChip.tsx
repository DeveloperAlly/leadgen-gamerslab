import { confidenceMeta } from "../../data/fixtures/copy";
import type { Confidence } from "../../data/types";
import { AlertIcon, ShieldIcon } from "../icons";

interface ConfidenceChipProps {
  conf: Confidence;
}

/** AI-confidence chip: High/Medium/Low with a shield (or alert for low) icon. */
export function ConfidenceChip({ conf }: ConfidenceChipProps) {
  const meta = confidenceMeta[conf];
  const Icon = conf === "low" ? AlertIcon : ShieldIcon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: `var(${meta.token})`,
      }}
    >
      <Icon size={12} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}
