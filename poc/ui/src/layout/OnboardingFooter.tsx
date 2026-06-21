import { type ReactNode } from "react";

interface FooterShellProps {
  left: ReactNode;
  right: ReactNode;
}

/** Sticky onboarding footer bar: a left slot (Back) and a right slot (primary action). */
export function OnboardingFooter({ left, right }: FooterShellProps) {
  return (
    <div
      style={{
        flex: "none",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
        padding: "16px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      {left}
      {right}
    </div>
  );
}
