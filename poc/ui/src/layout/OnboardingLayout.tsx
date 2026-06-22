import { type ReactNode } from "react";
import { Stepper } from "../components/ui/Stepper";

/** Onboarding step labels, in order. */
export const onboardingSteps = ["Context", "Intake", "Venues", "Review"];

interface OnboardingLayoutProps {
  /** Zero-based active step index. */
  step: number;
  /** Content column width (defaults to 660). */
  maxWidth?: number;
  children: ReactNode;
  /** Sticky footer (Back / Continue, or Gate A actions). */
  footer?: ReactNode;
}

/** Focused onboarding frame: hides the sidebar, shows the 4-step stepper + footer. */
export function OnboardingLayout({ step, maxWidth = 660, children, footer }: OnboardingLayoutProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Stepper steps={onboardingSteps} current={step} />
      <main style={{ flex: 1, overflowY: "auto", padding: "8px 28px 28px" }}>
        <div style={{ maxWidth, margin: "0 auto", width: "100%" }}>{children}</div>
      </main>
      {footer}
    </div>
  );
}

interface OnboardingFooterProps {
  onBack: () => void;
  onNext: () => void;
  backLabel?: string;
  nextLabel?: string;
  children?: never;
}

export { type OnboardingFooterProps };
