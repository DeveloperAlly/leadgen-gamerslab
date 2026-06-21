import { usePipeline } from "../state/PipelineProvider";
import { OnboardingLayout } from "../layout/OnboardingLayout";
import { OnboardingFooter } from "../layout/OnboardingFooter";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Textarea } from "../components/ui/Textarea";
import { SegmentedToggle } from "../components/ui/SegmentedToggle";
import { ArrowLeftIcon, ArrowRightIcon } from "../components/icons";
import { intakeCopy } from "../data/fixtures/copy";
import { space } from "../theme/tokens";
import type { Mode } from "../data/types";

interface IntakeFieldProps {
  label: string;
  sub: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function IntakeField({ label, sub, value, placeholder, onChange }: IntakeFieldProps) {
  return (
    <Card className="rise">
      <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{label}</label>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 9 }}>{sub}</div>
      <Textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 70 }}
      />
    </Card>
  );
}

export function GuidedIntakeScreen() {
  const { state, actions } = usePipeline();
  const c = intakeCopy[state.mode];

  return (
    <OnboardingLayout
      step={1}
      footer={
        <OnboardingFooter
          left={
            <Button variant="ghost" leadingIcon={<ArrowLeftIcon size={16} strokeWidth={2} />} onClick={() => actions.go("context")}>
              Back
            </Button>
          }
          right={
            <Button size="lg" trailingIcon={<ArrowRightIcon size={16} strokeWidth={2} />} onClick={() => actions.go("venues")}>
              Save &amp; continue
            </Button>
          }
        />
      }
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: space.lg, marginBottom: space.lg }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 6px" }}>In your own words.</h1>
          <p style={{ margin: 0, fontSize: 16, color: "var(--text-secondary)" }}>
            This shapes everything we search for. Be specific.
          </p>
        </div>
        <SegmentedToggle<Mode>
          value={state.mode}
          onChange={actions.setMode}
          options={[
            { value: "customers", label: "Customers" },
            { value: "investors", label: "Investors" },
          ]}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
        <IntakeField
          label="What do you offer?"
          sub="The product or service, in one or two sentences."
          value={state.intake.offer}
          onChange={(v) => actions.updateIntake({ offer: v })}
        />
        <IntakeField
          label={c.q2Label}
          sub={c.q2Sub}
          value={state.intake.icp}
          placeholder={c.icpPlaceholder}
          onChange={(v) => actions.updateIntake({ icp: v })}
        />
        <IntakeField
          label={c.q3Label}
          sub="What a successful run looks like."
          value={state.intake.outcome}
          placeholder={c.outcomePlaceholder}
          onChange={(v) => actions.updateIntake({ outcome: v })}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.md }}>
          <IntakeField
            label="Where do leads come from today?"
            sub="Your current channels."
            value={state.intake.leadsToday}
            onChange={(v) => actions.updateIntake({ leadsToday: v })}
          />
          <IntakeField
            label="What makes a lead good?"
            sub="The signals that mean ready-to-buy."
            value={state.intake.goodLead}
            onChange={(v) => actions.updateIntake({ goodLead: v })}
          />
        </div>
      </div>
    </OnboardingLayout>
  );
}
