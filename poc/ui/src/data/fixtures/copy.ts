import type { Mode } from "../types";

/** Rotating status lines shown during discovery (driven by progress %). */
export const discoveryStatusLines = [
  "Reading your business context…",
  "Scanning Steam, funding feeds & showcases…",
  "Cross-checking signals across the web…",
  "Verifying and scoring matches…",
];

/** Intake question copy that swaps with the Customers ⇄ Investors mode. */
export interface IntakeModeCopy {
  q2Label: string;
  q2Sub: string;
  icpPlaceholder: string;
  q3Label: string;
  outcomePlaceholder: string;
}

export const intakeCopy: Record<Mode, IntakeModeCopy> = {
  customers: {
    q2Label: "Who's your ideal customer?",
    q2Sub: "The kind of company you most want to reach.",
    icpPlaceholder: "e.g. Indie & mid-size studios shipping PC/console games.",
    q3Label: "What outcome do you want?",
    outcomePlaceholder: "e.g. Book demos with studios that are pre-launch.",
  },
  investors: {
    q2Label: "Who's your ideal investor?",
    q2Sub: "The kind of fund or angel you most want to reach.",
    icpPlaceholder: "e.g. Seed-stage funds backing gaming & creator tools.",
    q3Label: "What are you raising for?",
    outcomePlaceholder: "e.g. Raise a $1.5M seed in the next quarter.",
  },
};

/** Static copy used across the flow. Kept out of components for easy reskin/i18n. */
export const copy = {
  signin: {
    reassurance:
      "Set up your lead pipeline in a few calm steps. We'll handle the searching — you stay in control.",
    emailLabel: "Work email",
    emailError: "Enter a valid email to continue.",
    passwordLabel: "Password",
    passwordError: "Incorrect password.",
  },
  context: {
    heading: "Tell us about your business.",
    helper:
      "Drop in whatever you've got. The more context we have, the sharper your leads. You can add more anytime.",
    dropzone: "PDFs, decks, docs — e.g. your one-pager, pitch deck, About page",
    privacy: "Your context is private to your workspace and never shared between tenants.",
  },
  gateA: {
    eyebrow: "Your turn to review",
    heading: "Here’s what we understood",
    sub: "Make it right before we go further. Edit anything that’s off — your leads are only as good as this.",
  },
  gateB: {
    eyebrow: "Your turn to review",
    heading: "Approve the ones worth pursuing",
    sub: "We found and verified these against live sources. Keep the good fits, skip the rest — only approved leads move forward.",
  },
  gateC: {
    eyebrow: "Your turn to review",
    sub: "Nothing goes out without your sign-off.",
  },
  discovery: {
    heading: "Searching and verifying across the web…",
    note: "This can take a minute — you can leave and we'll save it.",
  },
};

/** Field labels for the Gate A understanding cards. */
export const gateFieldLabels: Record<string, string> = {
  summary: "Business summary",
  icp: "Ideal customer (ICP)",
  pains: "Pain points",
  where: "Where to find them",
  channel: "Channel recommendation",
};

/** Confidence-chip metadata. */
export const confidenceMeta = {
  high: { label: "High confidence", token: "--success" },
  medium: { label: "Medium confidence", token: "--warning" },
  low: { label: "Low confidence", token: "--text-muted" },
} as const;
