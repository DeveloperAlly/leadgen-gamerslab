import { useEffect, useState } from "react";
import { usePipeline } from "../state/PipelineProvider";
import { AppShell } from "../layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { AlertIcon, ArrowRightIcon, CheckIcon, ChevronIcon, EditIcon, MailIcon, ReplyIcon, SendIcon, XIcon } from "../components/icons";
import { leadService } from "../data/leadService";
import { radius, space } from "../theme/tokens";
import type { EmailAccount, OutreachItem, OutreachStage, OutreachVariant, ThreadMessage } from "../data/types";

/** ~200 sends/variant is the floor for a meaningful cold-email A/B read (see research). */
const AB_MIN_PER_VARIANT = 200;

/** The pipeline spine. A prospect moves New -> Contacted -> Replied -> Won or Lost. */
const STAGES: { key: OutreachStage; label: string; token: string }[] = [
  { key: "awaiting", label: "New", token: "--highlight-ink" },
  { key: "contacted", label: "Contacted", token: "--accent" },
  { key: "replied", label: "Replied", token: "--success" },
  { key: "success", label: "Won", token: "--success" },
  { key: "lost", label: "Lost", token: "--text-muted" },
];

export function ProspectTrackingScreen() {
  const { state, actions } = usePipeline();
  const [stage, setStage] = useState<OutreachStage>("awaiting");
  // Selected A/B variant per prospect (defaults to the control row).
  const [selected, setSelected] = useState<Record<string, string>>({});
  // Lead.id === OutreachItem.id, so one lookup links each prospect back to its lead.
  const leadScoreById = new Map(state.leads.map((l) => [l.id, l.score]));

  // The store hydrates once on app mount; re-pull when the board opens so backend
  // transitions (sent, replied) appear without a full page reload.
  useEffect(() => {
    actions.refreshOutreach();
  }, [actions]);

  // A jump from a lead focuses its prospect: switch to its stage tab and scroll it in.
  useEffect(() => {
    if (state.screen === "outreach" && state.focusId) {
      const item = state.outreach.find((o) => o.id === state.focusId);
      if (item) setStage(item.stage);
      requestAnimationFrame(() => {
        document.getElementById(`prospect-${state.focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [state.focusId, state.screen, state.outreach]);

  const countFor = (key: OutreachStage) => state.outreach.filter((o) => o.stage === key).length;
  const items = state.outreach.filter((o) => o.stage === stage);

  return (
    <AppShell maxWidth={920}>
      <SenderBanner account={state.emailAccount} onConnect={() => actions.go("settings")} />

      {/* Stage toggle — the spine of the pipeline */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: space.xl,
          borderBottom: "1px solid var(--border)",
          paddingBottom: space.md,
        }}
      >
        {STAGES.map((s) => {
          const active = s.key === stage;
          const n = countFor(s.key);
          return (
            <button
              key={s.key}
              onClick={() => setStage(s.key)}
              style={{
                padding: "8px 15px",
                borderRadius: radius.pill,
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${active ? `var(${s.token})` : "var(--border)"}`,
                background: active ? "var(--highlight-soft)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {s.label}
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? `var(${s.token})` : "var(--text-muted)" }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyStage stage={stage} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          {items.map((o) => (
            <div
              key={o.id}
              id={`prospect-${o.id}`}
              style={{
                borderRadius: radius.md,
                boxShadow: state.focusId === o.id ? "0 0 0 2px var(--accent-soft)" : undefined,
                transition: "box-shadow .15s",
              }}
            >
              {stage === "awaiting" ? (
                <AwaitingCard
                  item={o}
                  selectedMessageId={selected[o.id]}
                  onSelectVariant={(mid) => setSelected((sel) => ({ ...sel, [o.id]: mid }))}
                  editingMessageId={state.editingMessageId}
                  draftSubject={state.outreachSubject}
                  draftBody={state.outreachBody}
                  actions={actions}
                />
              ) : (
                <StageCard
                  item={o}
                  leadScore={leadScoreById.get(o.id)}
                  onOpenLead={() => actions.go("gateB", o.id)}
                  actions={actions}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

const stagePill = (stage: OutreachStage): { label: string; bg: string; fg: string } => {
  switch (stage) {
    case "contacted":
      return { label: "Contacted", bg: "var(--highlight-soft)", fg: "var(--accent)" };
    case "replied":
      return { label: "Replied", bg: "var(--success-soft, var(--bg-subtle))", fg: "var(--success)" };
    case "success":
      return { label: "Won", bg: "var(--success-soft, var(--bg-subtle))", fg: "var(--success)" };
    case "lost":
      return { label: "Lost", bg: "var(--bg-subtle)", fg: "var(--text-muted)" };
    default:
      return { label: "Awaiting", bg: "var(--bg-subtle)", fg: "var(--text-muted)" };
  }
};

/**
 * A non-awaiting prospect: contacted, replied, won, or lost. Shows the recipient, the
 * subject that went out, and stage-appropriate actions. Replied is the one that acts:
 * Mark won / Mark lost, which persists the outcome to Supabase for the learning loop.
 */
function StageCard({
  item,
  leadScore,
  onOpenLead,
  actions,
}: {
  item: OutreachItem;
  leadScore?: number;
  onOpenLead: () => void;
  actions: ReturnType<typeof usePipeline>["actions"];
}) {
  const pill = stagePill(item.stage);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleThread = () => {
    const next = !open;
    setOpen(next);
    if (next && thread === null && !loading) {
      setLoading(true);
      leadService.getThread(item.id).then(setThread).catch(() => setThread([])).finally(() => setLoading(false));
    }
  };

  return (
    <Card>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {item.last ?? item.channel}
              {typeof leadScore === "number" ? ` · score ${leadScore}` : ""}
            </span>
            <button
              onClick={onOpenLead}
              title="View this prospect's lead and evidence"
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 12, fontWeight: 600, color: "var(--accent)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              View lead
              <ArrowRightIcon size={12} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radius.pill,
            background: pill.bg, color: pill.fg,
          }}
        >
          {item.stage === "replied" && <ReplyIcon size={12} strokeWidth={2.2} />}
          {pill.label}
        </span>
      </div>

      <RecipientLine toEmail={item.toEmail} emailValid={item.emailValid} />

      {item.subject && (
        <div
          style={{
            background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: radius.md,
            padding: "10px 13px", fontSize: 13,
            marginBottom: item.stage === "replied" || item.stage === "contacted" ? space.md : 0,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Subject: </span>
          {item.subject}
        </div>
      )}

      {/* Collapsible live conversation (sent + replies, pulled from the Gmail thread). */}
      <div style={{ marginBottom: space.md }}>
        <button
          onClick={toggleThread}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12.5, fontWeight: 600, color: "var(--accent)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <span style={{ display: "inline-flex", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }}>
            <ChevronIcon size={14} strokeWidth={2.4} />
          </span>
          {open ? "Hide conversation" : "View conversation"}
        </button>
        {open && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading conversation…</div>}
            {!loading && thread && thread.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No messages in this thread yet.</div>
            )}
            {!loading && thread?.map((m, i) => <ThreadBubble key={i} m={m} />)}
          </div>
        )}
      </div>

      {item.stage === "replied" && (
        <div style={{ display: "flex", gap: space.sm, flexWrap: "wrap" }}>
          <Button leadingIcon={<CheckIcon size={16} strokeWidth={2.4} />} onClick={() => actions.markWon(item.id)}>
            Mark won
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<XIcon size={15} strokeWidth={2} />}
            onClick={() => actions.markLost(item.id)}
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            Mark lost
          </Button>
        </div>
      )}

      {item.followUp ? (
        <FollowUpEditor draft={item.followUp} onSend={(s, b) => actions.sendFollowUp(item.id, s, b)} />
      ) : item.stage === "contacted" ? (
        <div style={{ display: "flex", gap: space.sm, flexWrap: "wrap" }}>
          <Button leadingIcon={<SendIcon size={16} strokeWidth={2} />} onClick={() => actions.followUp(item.id)}>
            Follow up
          </Button>
          <Button variant="ghost" leadingIcon={<XIcon size={15} strokeWidth={2} />} onClick={() => actions.markLost(item.id)}>
            Mark lost
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** One message in the conversation panel. Sent (you) accents in --accent; replies in --success. */
function ThreadBubble({ m }: { m: ThreadMessage }) {
  const accent = m.fromMe ? "var(--accent)" : "var(--success)";
  const when = (() => {
    const d = new Date(m.date);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  })();
  return (
    <div
      style={{
        borderLeft: `3px solid ${accent}`,
        borderRadius: 0,
        background: "var(--bg-subtle)",
        padding: "9px 12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{m.fromMe ? "You" : m.from}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{when}</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{m.body}</div>
    </div>
  );
}

/** Review + edit a step-2 follow-up before it sends (in the same thread, "Re:" subject). */
function FollowUpEditor({
  draft,
  onSend,
}: {
  draft: { messageId: string; subject: string; body: string };
  onSend: (subject: string, body: string) => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [sending, setSending] = useState(false);
  return (
    <div
      style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--highlight)",
        borderRadius: radius.md,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--highlight-ink)", marginBottom: 10 }}>
        Follow-up draft · review before sending
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Subject</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginTop: space.xs }}>Message</label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 110 }} />
      </div>
      <div style={{ display: "flex", gap: space.sm, marginTop: space.md }}>
        <Button
          leadingIcon={<SendIcon size={16} strokeWidth={2} />}
          disabled={sending}
          onClick={() => {
            setSending(true);
            onSend(subject, body);
          }}
        >
          {sending ? "Sending…" : "Send follow-up"}
        </Button>
      </div>
    </div>
  );
}

function EmptyStage({ stage }: { stage: OutreachStage }) {
  const msg =
    stage === "awaiting"
      ? "No drafts awaiting your approval."
      : stage === "contacted"
        ? "Nothing sent and awaiting a reply yet."
        : stage === "replied"
          ? "No replies yet. They land here when a prospect responds."
          : stage === "success"
            ? "No won deals yet."
            : "Nothing lost.";
  return (
    <Card>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", padding: "8px 4px" }}>{msg}</div>
    </Card>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.channel} · Initial email</span>
            <button
              onClick={() => actions.go("gateB", item.id)}
              title="View this prospect's lead and evidence"
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 12, fontWeight: 600, color: "var(--accent)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              View lead
              <ArrowRightIcon size={12} strokeWidth={2.4} />
            </button>
          </div>
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
 * The "To:" line on a card. Answers "where does this send?" at a glance, and flags when
 * there is no contact (can't send) or the address failed MX validation.
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
 * and links to Settings where the inbox is connected.
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
