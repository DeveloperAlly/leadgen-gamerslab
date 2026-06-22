import { useState } from "react";
import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { GateBanner } from "../components/ui/GateBanner";
import { ProspectCard } from "../components/ui/ProspectCard";
import { Button } from "../components/ui/Button";
import { Card, Eyebrow } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { AlertIcon, BellIcon, CheckIcon, EditIcon, MailIcon } from "../components/icons";
import { copy } from "../data/fixtures/copy";
import { radius, space } from "../theme/tokens";
import type { EmailAccount, OutreachItem, OutreachStage, OutreachVariant } from "../data/types";

const columns: { key: OutreachStage; label: string; token: string }[] = [
  { key: "contacted", label: "Contacted", token: "--accent" },
  { key: "replied", label: "Replied", token: "--highlight-ink" },
  { key: "success", label: "Success", token: "--success" },
  { key: "partial", label: "Partial", token: "--warning" },
  { key: "lost", label: "Lost", token: "--text-muted" },
];

/** ~200 sends/variant is the floor for a meaningful cold-email A/B read (see research). */
const AB_MIN_PER_VARIANT = 200;

export function ProspectTrackingScreen() {
  const { state, actions, derived } = usePipeline();
  const awaiting = state.outreach.filter((o) => o.stage === "awaiting");
  // Selected A/B variant per prospect (defaults to the control row).
  const [selected, setSelected] = useState<Record<string, string>>({});

  return (
    <AppShell maxWidth={920}>
      <SenderBanner account={state.emailAccount} onConnect={() => actions.go("settings")} />

      {derived.pendingApprovals > 0 && (
        <div style={{ marginBottom: space.lg }}>
          <GateBanner
            eyebrow={copy.gateC.eyebrow}
            heading={`${derived.pendingApprovals} messages need your approval before they send`}
            sub={copy.gateC.sub}
            icon={<BellIcon size={20} strokeWidth={2} />}
          />
        </div>
      )}

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space.lg, marginBottom: space.xl }}>
        <SummaryStat label="Contacted" value={derived.contactedTotal} />
        <SummaryStat label="Replied" value={derived.repliedTotal} />
        <SummaryStat label="Success" value={derived.successCount} color="var(--success)" />
      </div>

      {/* Awaiting approval */}
      {awaiting.length > 0 && (
        <section style={{ marginBottom: space.xl }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: space.md }}>Awaiting your approval</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
            {awaiting.map((o) => (
              <AwaitingCard
                key={o.id}
                item={o}
                selectedMessageId={selected[o.id]}
                onSelectVariant={(mid) => setSelected((s) => ({ ...s, [o.id]: mid }))}
                editingMessageId={state.editingMessageId}
                draftSubject={state.outreachSubject}
                draftBody={state.outreachBody}
                actions={actions}
              />
            ))}
          </div>
        </section>
      )}

      {/* Prospect board */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: space.md }}>Prospect board</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: space.md }}>
        {columns.map((col) => {
          const items = state.outreach.filter((o) => o.stage === col.key);
          return (
            <div key={col.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px 10px",
                  borderBottom: `2px solid var(${col.token})`,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{col.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
                {items.map((o) => (
                  <ProspectCard key={o.id} prospect={o} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function AwaitingCard({
  item,
  selectedMessageId,
  onSelectVariant,
  editingMessageId,
  draftSubject,
  draftBody,
  actions,
}: {
  item: OutreachItem;
  selectedMessageId?: string;
  onSelectVariant: (messageId: string) => void;
  editingMessageId: string | null;
  draftSubject: string;
  draftBody: string;
  actions: ReturnType<typeof usePipeline>["actions"];
}) {
  // Fall back to a single synthetic control if the backend returned no variants.
  const variants: OutreachVariant[] = item.variants?.length
    ? item.variants
    : [{ messageId: item.id, variant: "A", isControl: true, step: 1, subject: item.subject, body: item.body, sentCount: 0, replyCount: 0 }];
  const control = variants.find((v) => v.isControl) ?? variants[0]!;
  const sel = variants.find((v) => v.messageId === selectedMessageId) ?? control;
  const editing = editingMessageId === sel.messageId;
  const hasAB = variants.length > 1;
  // No recipient = nowhere to send. Block approval so a draft can't fire into the void.
  const canSend = Boolean(item.toEmail);

  return (
    <Card style={{ border: "1px solid var(--highlight)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
        <span
          style={{
            flex: "none", width: 40, height: 40, borderRadius: 11, background: "var(--bg-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
          }}
        >
          {item.initials}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.channel} · Initial email</div>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radius.pill,
            background: "var(--highlight-soft)", color: "var(--highlight-ink)",
          }}
        >
          Awaiting approval
        </span>
      </div>

      {/* Recipient — the address this draft sends TO, with deliverability state. */}
      <RecipientLine toEmail={item.toEmail} emailValid={item.emailValid} />

      {/* A/B variant tabs (only when more than one variant exists) */}
      {hasAB && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {variants.map((v) => {
            const active = v.messageId === sel.messageId;
            return (
              <button
                key={v.messageId}
                onClick={() => onSelectVariant(v.messageId)}
                style={{
                  padding: "4px 12px", borderRadius: radius.pill, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--highlight-soft)" : "transparent",
                  color: "var(--text-primary)", cursor: "pointer",
                }}
              >
                Variant {v.variant}{v.isControl ? " · control" : ""}
              </button>
            );
          })}
        </div>
      )}

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: space.sm, marginBottom: space.md }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Subject</label>
          <Input
            value={draftSubject}
            onChange={(e) => actions.setOutreachSubject(e.target.value)}
            placeholder="Subject line"
          />
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginTop: space.xs }}>
            Body{hasAB ? " (shared across variants)" : ""}
          </label>
          <Textarea
            value={draftBody}
            onChange={(e) => actions.setOutreachBody(e.target.value)}
            style={{ minHeight: 120 }}
          />
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: radius.md,
            padding: "12px 14px", marginBottom: space.md,
          }}
        >
          {sel.subject && (
            <div
              style={{
                fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
                paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Subject: </span>
              {sel.subject}
            </div>
          )}
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {sel.body}
          </div>
        </div>
      )}

      {/* Honest A/B accumulation state (no fake winner below the sample floor) */}
      {hasAB && !editing && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: space.md }}>
          A/B subject test · {variants.map((v) => `${v.variant}: ${v.sentCount} sent, ${v.replyCount} replies`).join("   ·   ")}
          {" · "}accumulating, needs ~{AB_MIN_PER_VARIANT} sends per variant to call a winner
        </div>
      )}

      {editing ? (
        <div style={{ display: "flex", gap: space.sm }}>
          <Button onClick={actions.saveOutreachDraft}>Save draft</Button>
          <Button variant="ghost" onClick={actions.cancelEditOutreach}>Cancel</Button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: space.sm }}>
          <Button
            leadingIcon={<CheckIcon size={16} strokeWidth={2.4} />}
            disabled={!canSend}
            onClick={() => actions.approveOutreach(item.id)}
          >
            {canSend ? "Approve draft" : "No recipient — can't send"}
          </Button>
          <Button variant="ghost" leadingIcon={<EditIcon size={15} strokeWidth={2} />} onClick={() => actions.startEditVariant(sel.messageId)}>
            Edit{hasAB ? ` variant ${sel.variant}` : " draft"}
          </Button>
          <Button variant="ghost" onClick={() => actions.skipOutreach(item.id)}>Skip</Button>
        </div>
      )}
    </Card>
  );
}

/**
 * The "To:" line on an approval card. Answers "where does this send?" at a glance, and
 * flags when there is no contact (can't send) or the address failed MX validation.
 */
function RecipientLine({ toEmail, emailValid }: { toEmail?: string; emailValid?: boolean }) {
  const missing = !toEmail;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 11px",
        marginBottom: 10,
        borderRadius: radius.md,
        fontSize: 13,
        border: `1px solid ${missing ? "var(--warning)" : "var(--border)"}`,
        background: missing ? "var(--warning-soft, var(--bg-subtle))" : "var(--bg-subtle)",
      }}
    >
      <MailIcon size={14} strokeWidth={2} />
      {missing ? (
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          No contact email found — this can't send until one is added
        </span>
      ) : (
        <>
          <span style={{ color: "var(--text-muted)" }}>To</span>
          <strong style={{ color: "var(--text-primary)" }}>{toEmail}</strong>
          {emailValid === true && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--success)", fontSize: 12, fontWeight: 600 }}>
              <CheckIcon size={12} strokeWidth={2.5} /> verified
            </span>
          )}
          {emailValid === false && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--warning)", fontSize: 12, fontWeight: 600 }}>
              <AlertIcon size={12} strokeWidth={2} /> unverified
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Makes the destination of approved drafts unmistakable: outreach sends *from* this inbox.
 * When nothing is connected, the approve buttons would have nowhere to send — so this warns
 * and links straight to Settings where the inbox is connected.
 */
function SenderBanner({
  account,
  onConnect,
}: {
  account: EmailAccount | null;
  onConnect: () => void;
}) {
  const connected = account?.connected === true;
  const providerLabel = account?.provider === "microsoft" ? "Microsoft 365" : "Google Workspace";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "11px 14px",
        marginBottom: space.lg,
        borderRadius: radius.md,
        border: `1px solid ${connected ? "var(--border)" : "var(--warning)"}`,
        background: connected ? "var(--bg-subtle)" : "var(--warning-soft, var(--bg-subtle))",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 30,
          height: 30,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface, var(--bg))",
          color: connected ? "var(--accent)" : "var(--warning)",
        }}
      >
        {connected ? <MailIcon size={16} strokeWidth={2} /> : <AlertIcon size={16} strokeWidth={2} />}
      </span>

      {connected ? (
        <div style={{ flex: 1, fontSize: 13.5, color: "var(--text-secondary)" }}>
          Approved messages send from{" "}
          <strong style={{ color: "var(--text-primary)" }}>{account?.fromEmail}</strong>{" "}
          <span style={{ color: "var(--text-muted)" }}>· {providerLabel}</span>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, fontSize: 13.5, color: "var(--text-primary)" }}>
            No sending inbox connected — approved messages have nowhere to send yet.
          </div>
          <Button variant="secondary" onClick={onConnect}>
            Connect in Settings
          </Button>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
    </Card>
  );
}
