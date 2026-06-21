import { usePipeline } from "../state/PipelineProvider";
import { BellIcon } from "../components/icons";
import { tenant } from "../data/fixtures/tenant";
import { shellTitle } from "./nav";
import { space } from "../theme/tokens";

/** Top bar: screen title, notification bell with pending-approval count, tenant + avatar. */
export function TopBar() {
  const { state, actions, derived } = usePipeline();
  const title = shellTitle[state.screen] ?? "Dashboard";
  const pending = derived.pendingApprovals;

  return (
    <header
      style={{
        height: 58,
        flex: "none",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>{title}</span>

      <div style={{ display: "flex", alignItems: "center", gap: space.lg }}>
        <button
          onClick={() => actions.go("outreach")}
          aria-label={pending ? `${pending} approvals pending` : "Notifications"}
          style={{
            position: "relative",
            display: "flex",
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <BellIcon size={18} strokeWidth={2} />
          {pending > 0 && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -3,
                minWidth: 16,
                height: 16,
                borderRadius: 99,
                background: "var(--highlight)",
                color: "#1a1a1a",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {pending}
            </span>
          )}
        </button>

        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>
          {tenant.name}
        </span>

        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {tenant.name.charAt(0)}
        </span>
      </div>
    </header>
  );
}
