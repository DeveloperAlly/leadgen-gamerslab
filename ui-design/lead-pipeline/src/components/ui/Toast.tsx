import { radius } from "../../theme/tokens";
import { CheckIcon } from "../icons";

interface ToastProps {
  message: string | null;
}

/** Toast: fades in near bottom-centre, auto-dismissed by the store. */
export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div
      className="toast-in"
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        background: "var(--text-primary)",
        color: "var(--bg-canvas)",
        borderRadius: radius.pill,
        padding: "11px 18px",
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "var(--shadow-md)",
        zIndex: 50,
      }}
    >
      <CheckIcon size={16} strokeWidth={2.6} />
      {message}
    </div>
  );
}
