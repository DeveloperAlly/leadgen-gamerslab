import { usePipeline } from "../state/PipelineProvider";
import { OnboardingLayout } from "../layout/OnboardingLayout";
import { OnboardingFooter } from "../layout/OnboardingFooter";
import { VenueCard } from "../components/ui/VenueCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ArrowLeftIcon, ArrowRightIcon, PinIcon } from "../components/icons";
import { space } from "../theme/tokens";

export function VenueMapScreen() {
  const { state, actions, derived } = usePipeline();

  return (
    <OnboardingLayout
      step={2}
      maxWidth={680}
      footer={
        <OnboardingFooter
          left={
            <Button variant="ghost" leadingIcon={<ArrowLeftIcon size={16} strokeWidth={2} />} onClick={() => actions.go("intake")}>
              Back
            </Button>
          }
          right={
            <Button size="lg" trailingIcon={<ArrowRightIcon size={16} strokeWidth={2} />} onClick={() => actions.go("gateA")}>
              Continue
            </Button>
          }
        />
      }
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginTop: 8,
        }}
      >
        <PinIcon size={13} strokeWidth={2} />
        Venue map
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 8px" }}>
        Where do your customers actually hang out?
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 15, color: "var(--text-secondary)" }}>
        From your context, we think these are the places worth searching. Turn off anywhere that isn't
        a fit — we'll only hunt where you point us.{" "}
        <b style={{ color: "var(--text-primary)" }}>{derived.venuesOnCount} active.</b>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
        {state.venues.map((v) => (
          <VenueCard key={v.id} venue={v} onToggle={() => actions.toggleVenue(v.id)} />
        ))}
      </div>

      <div style={{ display: "flex", gap: space.sm, marginTop: space.lg }}>
        <div style={{ flex: 1 }}>
          <Input
            value={state.venueInput}
            placeholder="Add a forum, subreddit, Discord, or event…"
            onChange={(e) => actions.setVenueInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && actions.addVenue()}
          />
        </div>
        <Button variant="secondary" onClick={actions.addVenue}>
          Add
        </Button>
      </div>
    </OnboardingLayout>
  );
}
