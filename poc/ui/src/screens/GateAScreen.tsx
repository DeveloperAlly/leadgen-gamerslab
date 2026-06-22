import { usePipeline } from "../state/PipelineProvider";
import { OnboardingLayout } from "../layout/OnboardingLayout";
import { OnboardingFooter } from "../layout/OnboardingFooter";
import { GateBanner } from "../components/ui/GateBanner";
import { FieldCard } from "../components/ui/FieldCard";
import { Button } from "../components/ui/Button";
import { ArrowRightIcon } from "../components/icons";
import { copy, gateFieldLabels } from "../data/fixtures/copy";
import { space } from "../theme/tokens";
import type { GateFieldKey } from "../data/types";

const fieldOrder: GateFieldKey[] = ["summary", "icp", "pains", "where", "channel"];

export function GateAScreen() {
  const { state, actions } = usePipeline();

  return (
    <OnboardingLayout
      step={3}
      maxWidth={720}
      footer={
        <OnboardingFooter
          left={
            <Button variant="ghost" onClick={() => actions.go("venues")}>
              Keep editing
            </Button>
          }
          right={
            <Button size="lg" trailingIcon={<ArrowRightIcon size={17} strokeWidth={2} />} onClick={actions.startDiscovery}>
              Looks right — find leads
            </Button>
          }
        />
      }
    >
      <div style={{ marginTop: 8, marginBottom: space.lg }}>
        <GateBanner eyebrow={copy.gateA.eyebrow} heading={copy.gateA.heading} sub={copy.gateA.sub} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
        {fieldOrder.map((key) => {
          const field = state.fields[key];
          return (
            <FieldCard
              key={key}
              label={gateFieldLabels[key]}
              text={field.text}
              conf={field.conf}
              why={field.why}
              editing={state.editingField === key}
              draft={state.editDraft}
              onEdit={() => actions.startEditField(key)}
              onDraftChange={actions.setEditDraft}
              onSave={() => actions.saveField(key)}
              onCancel={actions.cancelEdit}
            />
          );
        })}
      </div>
    </OnboardingLayout>
  );
}
