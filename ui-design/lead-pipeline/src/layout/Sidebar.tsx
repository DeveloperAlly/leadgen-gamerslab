import { usePipeline } from "../state/PipelineProvider";
import { Logo } from "../components/icons";
import { UsageMeter } from "../components/ui/UsageMeter";
import { tenant, usage } from "../data/fixtures/tenant";
import { activeNavForScreen, navItems } from "./nav";
import { radius, space } from "../theme/tokens";

/** Slim left nav: logo + tenant name, nav items, usage meter pinned to the bottom. */
export function Sidebar() {
  const { state, actions } = usePipeline();
  const active = activeNavForScreen[state.screen] ?? "Dashboard";

  return (
    <aside
      style={{
        width: 210,
        flex: "none",
        borderRight: "1px solid var(--border)",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        padding: space.lg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: space.md, padding: "4px 6px 18px" }}>
        <Logo size={28} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>{tenant.name}</span>
      </div>

      <nav style={{ flex: 1 }}>
        {navItems.map(({ label, Icon, target }) => {
          const on = label === active;
          return (
            <button
              key={label}
              onClick={() => actions.go(target)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                padding: "9px 11px",
                borderRadius: radius.sm + 2,
                border: "none",
                fontSize: 14,
                fontWeight: on ? 600 : 500,
                cursor: "pointer",
                marginBottom: 2,
                textAlign: "left",
                color: on ? "var(--accent)" : "var(--text-secondary)",
                background: on ? "var(--accent-soft)" : "transparent",
              }}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </nav>

      <UsageMeter used={usage.used} total={usage.total} />
    </aside>
  );
}
