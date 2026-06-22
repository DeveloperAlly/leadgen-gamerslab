import { useEffect, useRef, useState } from "react";
import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { Card, Eyebrow } from "../components/ui/Card";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { leadService } from "../data/leadService";
import { space } from "../theme/tokens";

/**
 * Business context — the CAG block the pipeline reads on every run. Composed from the
 * Sources intake (documents, socials, site) plus guided answers; editable here and saved
 * to Supabase (`cag_context`). Today it's a direct text editor; the structured-data
 * rebuild turns this into the reviewed output of the Sources intelligence.
 */
export function ContextScreen() {
  const { actions } = usePipeline();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "saving">("loading");
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    leadService
      .getContext()
      .then(({ cagBlock, updatedAt }) => {
        setText(cagBlock);
        setSaved(cagBlock);
        setUpdatedAt(updatedAt);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const dirty = text !== saved && text.trim().length > 0;

  const save = () => {
    setStatus("saving");
    leadService
      .saveContext(text)
      .then(({ cagBlock, updatedAt }) => {
        setSaved(cagBlock);
        setUpdatedAt(updatedAt);
        setStatus("ready");
        actions.notify("Business context saved");
      })
      .catch(() => {
        setStatus("ready");
        actions.notify("Couldn't save — backend unreachable");
      });
  };

  return (
    <AppShell maxWidth={840}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Business context</h1>
      <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        This is the live brief the pipeline reads on <b style={{ color: "var(--text-primary)" }}>every run</b> to
        score publishers and draft outreach. It's built from your <b style={{ color: "var(--text-primary)" }}>Sources</b>
        {" "}(documents, socials, site); edit it here and changes take effect on the next discovery run.
      </p>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Eyebrow>CAG context block</Eyebrow>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {status === "loading"
              ? "Loading…"
              : updatedAt
                ? `Last updated ${new Date(updatedAt).toLocaleString()}`
                : "Not yet edited"}
          </span>
        </div>

        {status === "error" ? (
          <div style={{ fontSize: 14, color: "var(--danger)" }}>
            Couldn't load the context from the backend.
          </div>
        ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === "loading"}
            active={dirty}
            style={{
              minHeight: 460,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre",
              overflowWrap: "normal",
            }}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: space.md, marginTop: space.lg }}>
          <Button onClick={save} disabled={!dirty || status === "saving"}>
            {status === "saving" ? "Saving…" : "Save context"}
          </Button>
          {dirty && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Unsaved changes</span>}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onClick={() => actions.go("sources")}>
            Back to sources
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
