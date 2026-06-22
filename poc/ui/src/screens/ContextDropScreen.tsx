import { usePipeline } from "../state/PipelineProvider";
import { OnboardingLayout } from "../layout/OnboardingLayout";
import { OnboardingFooter } from "../layout/OnboardingFooter";
import { Dropzone } from "../components/ui/Dropzone";
import { Chip } from "../components/ui/Chip";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AtIcon,
  FileIcon,
  GlobeIcon,
  LockIcon,
  PlusIcon,
} from "../components/icons";
import { copy } from "../data/fixtures/copy";
import { space } from "../theme/tokens";
import type { SourceType } from "../data/types";

const sourceIcon: Record<SourceType, React.ReactNode> = {
  file: <FileIcon size={15} strokeWidth={2} />,
  url: <GlobeIcon size={15} strokeWidth={2} />,
  social: <AtIcon size={15} strokeWidth={2} />,
};

export function ContextDropScreen() {
  const { state, actions } = usePipeline();

  return (
    <OnboardingLayout
      step={0}
      footer={
        <OnboardingFooter
          left={
            <Button variant="ghost" leadingIcon={<ArrowLeftIcon size={16} strokeWidth={2} />} onClick={() => actions.go("signin")}>
              Back
            </Button>
          }
          right={
            <Button size="lg" trailingIcon={<ArrowRightIcon size={16} strokeWidth={2} />} onClick={() => actions.go("intake")}>
              Continue
            </Button>
          }
        />
      }
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 8px" }}>{copy.context.heading}</h1>
      <p style={{ margin: "0 0 26px", fontSize: 16, color: "var(--text-secondary)" }}>{copy.context.helper}</p>

      <Dropzone
        title={
          <span>
            Drop files, or <span style={{ color: "var(--accent)" }}>browse</span>
          </span>
        }
        hint={copy.context.dropzone}
        onBrowse={() => actions.addSource("file", "pitch-deck-2026.pdf")}
        onFiles={(files) => Array.from(files).forEach((f) => actions.addSource("file", f.name))}
      />

      {state.sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginTop: space.lg }}>
          {state.sources.map((s) => (
            <Chip
              key={s.id}
              icon={sourceIcon[s.type]}
              label={s.label}
              parsing={s.parsing}
              onRemove={() => actions.removeSource(s.id)}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: space.lg,
          marginTop: space.xl,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Website URL</label>
          <Input
            value={state.websiteInput}
            placeholder="yourstudio.com"
            leadingIcon={<GlobeIcon size={16} strokeWidth={2} />}
            onChange={(e) => actions.setWebsiteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && actions.addWebsite()}
            trailing={<AddBtn onClick={actions.addWebsite} />}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Social handles</label>
          <Input
            value={state.socialInput}
            placeholder="@yourstudio"
            leadingIcon={<AtIcon size={16} strokeWidth={2} />}
            onChange={(e) => actions.setSocialInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && actions.addSocial()}
            trailing={<AddBtn onClick={actions.addSocial} />}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: space.lg, color: "var(--text-muted)", fontSize: 13 }}>
        <LockIcon size={14} strokeWidth={2} />
        {copy.context.privacy}
      </div>
    </OnboardingLayout>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add"
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
