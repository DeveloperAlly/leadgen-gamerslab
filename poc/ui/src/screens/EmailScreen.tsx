import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { Card, Eyebrow } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { usePipeline } from "../state/PipelineProvider";
import { leadService } from "../data/leadService";
import { space, radius } from "../theme/tokens";
import type { EmailAccount } from "../data/types";
import {
  MailIcon,
  SendIcon,
  LockIcon,
  CheckIcon,
  XIcon,
} from "../components/icons";

const providerLabel = (p?: EmailAccount["provider"]) =>
  p === "microsoft" ? "Microsoft 365" : "Google Workspace";

export function EmailScreen() {
  const { actions } = usePipeline();
  const [account, setAccount] = useState<EmailAccount | null>(null);
  const [busy, setBusy] = useState<"google" | "microsoft" | "disconnect" | "test" | null>(null);

  const refresh = () => leadService.getEmailAccount().then(setAccount);

  useEffect(() => {
    refresh();
  }, []);

  const connect = async (provider: "google" | "microsoft") => {
    setBusy(provider);
    try {
      const { url } = await leadService.startEmailConnect(provider);
      if (url) {
        window.location.href = url; // live: hand off to the provider consent screen
        return;
      }
      await refresh(); // fixtures: connected locally
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
      await refresh();
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

  return (
    <AppShell maxWidth={720}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Email</h1>
      <p style={{ margin: "0 0 22px", fontSize: 15, color: "var(--text-secondary)" }}>
        Connect the inbox outreach is sent from. It sends as you, which gives the best deliverability.
      </p>

      {!connected ? (
        <Card>
          <Eyebrow color="var(--accent)">Outreach email</Eyebrow>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: "2px 0 6px" }}>
            Connect the inbox you'll send from
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            One click. We never see your password — only a revocable token, encrypted and scoped to you.
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
      ) : (
        <Card>
          <Eyebrow color="var(--accent)">Connected account</Eyebrow>
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
      )}
    </AppShell>
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
