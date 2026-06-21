import { type TextareaHTMLAttributes } from "react";
import { fontSize, radius, space } from "../../theme/tokens";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Apply the accent border used while actively editing. */
  active?: boolean;
}

export function Textarea({ active, style, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      style={{
        width: "100%",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: radius.md,
        background: "var(--bg-surface)",
        color: "var(--text-primary)",
        fontSize: fontSize.base,
        lineHeight: 1.5,
        padding: `${space.md}px ${space.lg}px`,
        resize: "vertical",
        outline: "none",
        minHeight: 84,
        ...style,
      }}
    />
  );
}
