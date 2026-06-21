import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
  /** Max width of the centred content column. */
  maxWidth?: number;
}

/** Post-onboarding shell: sidebar + top bar + scrollable content column. */
export function AppShell({ children, maxWidth = 980 }: AppShellProps) {
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 24px" }}>
          <div style={{ maxWidth, margin: "0 auto", width: "100%" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
