import { useState } from "react";
import { Card, Eyebrow } from "./ui/Card";
import { Button } from "./ui/Button";
import { usePipeline } from "../state/PipelineProvider";
import { leadService } from "../data/leadService";
import { space, radius } from "../theme/tokens";
import type { EmailAccount } from "../data/types";
import { MailIcon, SendIcon, LockIcon, CheckIcon, XIcon } from "./icons";

const providerLabel = (p?: EmailAccount["provider"]) =>
  p === "microsoft" ? "Microsoft 365" : "Google Workspace";

/**
 * The "inbox outreach sends from" connection panel. Lives inside Settings (no longer a
 * standalone screen). Reads the shared `emailAccount` from the store so the Pipeline page
 * shows the same source of truth; writes back via `setEmailAccount` after connect/disconnect.
 */
export function EmailConnectionCard() {
  const { state, actions } = usePipeline();
  const account = state.emailAccount;
  const [busy, setBusy] = useState<"google" | "disconnect" | "test" | null>(null);

  const connect = async (provider: "google" | "microsoft") => {
    setBusy("google");
    try {
      const { url } = await leadService.startEmailConnect(provider);
      if (url) {
        window.location.href = url; // live: hand off to the provider consent screen
        return;
      }
      const fresh = await leadService.getEmailAccount(); // fixtures: connected locally
      actions.setEmailAccount(fresh);
      actions.notify(`Connected ${providerLabel(provider)}`);
    } catch {
      actions.notify("Couldn't start the connection");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await leadService.disconnectEmail();
      const fresh = await leadService.getEmailAccount();
      actions.setEmailAccount(fresh);
      actions.notify("Inbox disconnected");
    } catch {
      actions.notify("Couldn't disconnect");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      await leadService.sendTestEmail();
      actions.notify("Test email sent");
    } catch {
      actions.notify("Test send failed");
    } finally {
      setBusy(null);
    }
  };

  const connected = account?.connected === true;

  if (!connected) {
    return (
      <Card style={{ marginBottom: space.lg }}>
        <Eyebrow color="var(--accent)">Outreach email</Eyebrow>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: "2px 0 6px" }}>
          Connect the inbox you'll send from
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          Approved outreach sends as you, from this inbox — best deliverability. One click. We never
          see your password — only a revocable token, encrypted and scoped to you.
        </p>
        <div style={{ display: "flex", gap: space.md, flexWrap: "wrap" }}>
          <Button
            leadingIcon={<MailIcon size={17} strokeWidth={2} />}
            disabled={busy !== null}
            onClick={() => connect("google")}
          >
            Continue with Gmail
          </Button>
        </div>
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            margin: "16px 0 0",
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          <LockIcon size={14} strokeWidth={2} />
          Grants send and read-your-replies on this account only. Revoke anytime here or from your
          provider account.
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: space.lg }}>
      <Eyebrow color="var(--accent)">Outreach email</Eyebrow>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 16px" }}>
        <span
          style={{
            flex: "none",
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "var(--bg-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
          }}
        >
          <MailIcon size={20} strokeWidth={2} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{account?.fromEmail}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {providerLabel(account?.provider)}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 11px",
            borderRadius: radius.pill,
            background: "var(--success-soft, var(--bg-subtle))",
            color: "var(--success)",
          }}
        >
          <CheckIcon size={13} strokeWidth={2.5} />
          Connected
        </span>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 14,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <MetaRow label="Daily send headroom" value={`about ${(account?.dailyCap ?? 0).toLocaleString()} / day`} />
        <MetaRow label="Sent today" value={String(account?.sentToday ?? 0)} />
        <MetaRow label="Scope" value={(account?.scopes ?? []).join(", ") || "send, read replies"} />
      </div>

      <div style={{ display: "flex", gap: space.md, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          leadingIcon={<SendIcon size={16} strokeWidth={2} />}
          disabled={busy !== null}
          onClick={sendTest}
        >
          Send a test email
        </Button>
        <Button
          variant="ghost"
          leadingIcon={<XIcon size={16} strokeWidth={2} />}
          disabled={busy !== null}
          onClick={disconnect}
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          Disconnect
        </Button>
      </div>
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
