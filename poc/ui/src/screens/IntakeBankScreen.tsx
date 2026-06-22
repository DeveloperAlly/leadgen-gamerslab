import { useEffect, useRef, useState } from "react";
import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { Card, Eyebrow } from "../components/ui/Card";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { leadService } from "../data/leadService";
import { space } from "../theme/tokens";

/** The white-label question bank (catalog). Same questions for every client; only answers
 *  change. Each key maps to a section of the composed CAG (see client_intake_design_DRAFT). */
interface Question {
  key: string;
  label: string;
}
const SECTIONS: { id: string; title: string; blurb: string; questions: Question[] }[] = [
  {
    id: "A",
    title: "A · Your business",
    blurb: "What you offer, the proof, and the rails that keep outreach honest.",
    questions: [
      { key: "offer", label: "In one sentence, what do you offer and who is it for?" },
      { key: "a1_oneliner", label: "What is it / how does it work (the brief's “what it is”)?" },
      { key: "a1_apps", label: "Your live products / apps — name + what each does" },
      { key: "a1_sdk", label: "How does a buyer adopt it (integration, effort, time-to-value)?" },
      { key: "a2_problem", label: "The top pains your customer hits today" },
      { key: "a3_numbers", label: "Hard, quotable numbers — the only stats outreach may use" },
      { key: "a3_peers", label: "Reference customers / peers (one-liner each, by segment)" },
      { key: "a3_team", label: "Team & the most credible signal for a prospect" },
      { key: "a4_objections", label: "Top objections + your honest rebuttal to each" },
      { key: "a4_banned", label: "Banned phrases / claims + hard format rules" },
      { key: "a5_cta", label: "The one CTA every message should drive toward" },
      { key: "a5_contact", label: "Contact details / who a warm intro comes from" },
      { key: "outcome", label: "What outcome do you want from this pipeline?" },
      { key: "good_lead", label: "What does a “good lead” look like to you?" },
    ],
  },
  {
    id: "B",
    title: "B · Your prospects",
    blurb: "Who to target, who to avoid, why-now, and where they gather.",
    questions: [
      { key: "b1_icp", label: "Ideal-customer fit (firmographics, stage, signals)" },
      { key: "b1_fit_strong", label: "Strong-fit signals — what makes a great prospect" },
      { key: "b2_poorfit", label: "Poor fit / never-contact (disqualifiers)" },
      { key: "b3_pitch_angles", label: "Pitch angles by segment (e.g. new vs established)" },
      { key: "b3_pain_signals", label: "How you recognise the pain from the outside (public evidence)" },
      { key: "b5_venue", label: "Where prospects congregate + how you reach them" },
      { key: "leads_today", label: "Where do leads come from today?" },
    ],
  },
];

export function IntakeBankScreen() {
  const { actions } = usePipeline();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "saving">("loading");
  const [open, setOpen] = useState<Record<string, boolean>>({ A: true, B: true });
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    leadService
      .getIntakeBank()
      .then(({ answers, updatedAt }) => {
        setAnswers(answers);
        setSaved(answers);
        setUpdatedAt(updatedAt);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const dirty = JSON.stringify(answers) !== JSON.stringify(saved);
  const set = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  const save = () => {
    setStatus("saving");
    leadService
      .saveIntakeBank(answers)
      .then(({ answers, updatedAt }) => {
        setAnswers(answers);
        setSaved(answers);
        setUpdatedAt(updatedAt);
        setStatus("ready");
        actions.notify("Intake saved — context is rebuilding");
      })
      .catch(() => {
        setStatus("ready");
        actions.notify("Couldn't save — backend unreachable");
      });
  };

  return (
    <AppShell maxWidth={860}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Business intake</h1>
          <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.55, maxWidth: 640 }}>
            Your answers are the intelligence behind the pipeline — they compose the{" "}
            <b style={{ color: "var(--text-primary)" }}>Context</b> brief used to score publishers and draft
            outreach. Edit anytime; saving rebuilds the context for the next run.
          </p>
        </div>
        <span style={{ flex: "none", fontSize: 12, color: "var(--text-muted)", paddingTop: 12 }}>
          {status === "loading"
            ? "Loading…"
            : updatedAt
              ? `Saved ${new Date(updatedAt).toLocaleString()}`
              : "Not yet saved"}
        </span>
      </div>

      {status === "error" ? (
        <div style={{ fontSize: 14, color: "var(--danger)" }}>Couldn't load intake from the backend.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space.lg }}>
          {SECTIONS.map((sec) => (
            <Card key={sec.id}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left",
                }}
              >
                <span>
                  <Eyebrow>{sec.title}</Eyebrow>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{sec.blurb}</div>
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{open[sec.id] ? "Hide" : "Show"}</span>
              </button>

              {open[sec.id] && (
                <div style={{ display: "flex", flexDirection: "column", gap: space.md, marginTop: space.lg }}>
                  {sec.questions.map((q) => (
                    <div key={q.key}>
                      <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                        {q.label}
                      </label>
                      <Textarea
                        value={answers[q.key] ?? ""}
                        placeholder="—"
                        onChange={(e) => set(q.key, e.target.value)}
                        style={{ minHeight: 64 }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: space.md }}>
            <Button onClick={save} disabled={!dirty || status === "saving"}>
              {status === "saving" ? "Saving…" : "Save intake"}
            </Button>
            {dirty && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Unsaved changes</span>}
            <span style={{ flex: 1 }} />
            <Button variant="secondary" onClick={() => actions.go("cag")}>
              View composed context
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
