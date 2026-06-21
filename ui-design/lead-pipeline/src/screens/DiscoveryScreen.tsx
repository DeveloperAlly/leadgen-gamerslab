import { usePipeline, discoveryStatusLines } from "../state/PipelineProvider";
import { SearchIcon } from "../components/icons";
import { copy } from "../data/fixtures/copy";
import { space } from "../theme/tokens";

export function DiscoveryScreen() {
  const { state } = usePipeline();
  const pct = state.loadingPct;
  const msg = discoveryStatusLines[state.loadingMsgIdx];

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: space.xl }}>
      <div className="rise" style={{ width: 440, maxWidth: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: space.xl }}>
          <div style={{ position: "relative", width: 76, height: 76 }}>
            <span
              className="spin"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "3px solid var(--bg-subtle)",
                borderTopColor: "var(--accent)",
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <SearchIcon size={30} strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{copy.discovery.heading}</h2>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--text-secondary)", minHeight: 20 }}>{msg}</p>

        <div style={{ height: 8, borderRadius: 4, background: "var(--bg-subtle)", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 4,
              background: "var(--accent)",
              transition: "width .35s ease",
            }}
          />
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          {pct}% complete · {copy.discovery.note}
        </p>
      </div>
    </div>
  );
}
