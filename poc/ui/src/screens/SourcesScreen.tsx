import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { Card } from "../components/ui/Card";
import { Dropzone } from "../components/ui/Dropzone";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { AtIcon, FileIcon, GlobeIcon, PlusIcon, XIcon } from "../components/icons";
import { radius, space } from "../theme/tokens";
import type { SourceType } from "../data/types";

const bigIcon: Record<SourceType, React.ReactNode> = {
  file: <FileIcon size={18} strokeWidth={2} />,
  url: <GlobeIcon size={18} strokeWidth={2} />,
  social: <AtIcon size={18} strokeWidth={2} />,
};

const typeLabel: Record<SourceType, string> = {
  file: "Document",
  url: "Website",
  social: "Social",
};

export function SourcesScreen() {
  const { state, actions } = usePipeline();

  return (
    <AppShell maxWidth={840}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sources</h1>
      <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--text-secondary)" }}>
        Add or remove context anytime. Re-run discovery to pick up new signals.
      </p>

      <Card>
        <Dropzone
          title={
            <span>
              Drop files, or <span style={{ color: "var(--accent)" }}>browse</span>
            </span>
          }
          hint="PDFs, decks, docs — anything that explains your business"
          onBrowse={() => actions.addSource("file", "research-notes.pdf")}
          onFiles={(files) => Array.from(files).forEach((f) => actions.addSource("file", f.name))}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.md, marginTop: space.lg }}>
          <Input
            value={state.websiteInput}
            placeholder="Add a website…"
            leadingIcon={<GlobeIcon size={16} strokeWidth={2} />}
            onChange={(e) => actions.setWebsiteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && actions.addWebsite()}
            trailing={<AddBtn onClick={actions.addWebsite} />}
          />
          <Input
            value={state.socialInput}
            placeholder="Add your X / Twitter handle…"
            leadingIcon={<AtIcon size={16} strokeWidth={2} />}
            onChange={(e) => actions.setSocialInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && actions.addSocial()}
            trailing={<AddBtn onClick={actions.addSocial} />}
          />
        </div>
        <p style={{ margin: `${space.md}px 0 0`, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Documents and websites are read into your intake (they sit as <b>Queued</b> until the ingestion
          pipeline processes them). X / Twitter is stored as a reference for now and ingested once you connect
          a key — LinkedIn and Discord aren't supported as sources.
        </p>
      </Card>

      <div style={{ margin: `${space.xl}px 0 ${space.md}px`, fontSize: 14, fontWeight: 600 }}>
        Ingested · {state.sources.length}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        {state.sources.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: space.md,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: radius.md,
              padding: "12px 14px",
            }}
          >
            <span
              style={{
                flex: "none",
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {bigIcon[s.type]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{typeLabel[s.type]}</div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: radius.pill,
                background: s.done ? "var(--success-soft)" : "var(--bg-subtle)",
                color: s.done ? "var(--success)" : "var(--text-muted)",
              }}
              className={s.parsing ? "shimmer" : undefined}
            >
              {s.done ? "Indexed" : s.parsing ? "Parsing…" : "Queued"}
            </span>
            <button
              onClick={() => actions.removeSource(s.id)}
              aria-label={`Remove ${s.label}`}
              style={{ display: "flex", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
            >
              <XIcon size={16} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: space.xl }}>
        <Button variant="secondary" onClick={() => actions.go("dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </AppShell>
  );
}

/** Inline add button for the website / social inputs (also addable via Enter). */
function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add source"
      style={{
        display: "flex",
        flex: "none",
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "none",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <PlusIcon size={18} strokeWidth={2.2} />
    </button>
  );
}
