import { useState, type ReactNode } from "react";
import { fontSize, radius, space } from "../../theme/tokens";
import { UploadIcon } from "../icons";

interface DropzoneProps {
  title: ReactNode;
  hint: string;
  onBrowse: () => void;
  onFiles?: (files: FileList) => void;
}

/** File dropzone: dashed border, hover highlights to accent. */
export function Dropzone({ title, hint, onBrowse, onFiles }: DropzoneProps) {
  const [over, setOver] = useState(false);

  return (
    <button
      type="button"
      onClick={onBrowse}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (onFiles && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        else onBrowse();
      }}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: space.md,
        border: `2px dashed ${over ? "var(--accent)" : "var(--border)"}`,
        background: over ? "var(--accent-soft)" : "var(--bg-subtle)",
        borderRadius: radius.lg,
        padding: `${space.xxl}px ${space.xl}px`,
        cursor: "pointer",
        transition: "border-color .15s, background .15s",
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
        }}
      >
        <UploadIcon size={26} strokeWidth={1.7} />
      </span>
      <span style={{ fontSize: fontSize.base, fontWeight: 600, color: "var(--text-primary)" }}>
        {title}
      </span>
      <span style={{ fontSize: fontSize.sm, color: "var(--text-secondary)", textAlign: "center" }}>
        {hint}
      </span>
    </button>
  );
}
