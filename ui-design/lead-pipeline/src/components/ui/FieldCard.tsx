import { Card } from "./Card";
import { ConfidenceChip } from "./ConfidenceChip";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { EditIcon } from "../icons";
import type { Confidence } from "../../data/types";
import { space } from "../../theme/tokens";

interface FieldCardProps {
  label: string;
  text: string;
  conf: Confidence;
  why?: string;
  editing: boolean;
  draft: string;
  onEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Editable understanding card (Gate A): title + confidence chip + inline edit. */
export function FieldCard({
  label,
  text,
  conf,
  why,
  editing,
  draft,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
}: FieldCardProps) {
  return (
    <Card className="rise">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: space.md }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{label}</span>
          <ConfidenceChip conf={conf} />
        </div>
        {!editing && (
          <button
            onClick={onEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <EditIcon size={13} strokeWidth={2} />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <Textarea active value={draft} onChange={(e) => onDraftChange(e.target.value)} autoFocus />
          <div style={{ display: "flex", gap: space.sm, marginTop: space.md }}>
            <Button size="md" onClick={onSave}>
              Save
            </Button>
            <Button size="md" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)" }}>
            {text}
          </p>
          {why && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--text-muted)",
              }}
            >
              {why}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
