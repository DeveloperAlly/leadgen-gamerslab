/**
 * outreach — Gate C board. A/B message variants + prospect states, read from `message`.
 *
 *   GET   /outreach                         -> OutreachItem[]  (one item per publisher; A/B + follow-up inside)
 *   PATCH /outreach/message/:messageId      -> OutreachItem    (edit one variant or a step-2 follow-up)
 *   POST  /outreach/:publisherId/approve    -> OutreachItem    (approve step-1; fires the n8n send)
 *   POST  /outreach/:publisherId/skip       -> OutreachItem    (move to lost)
 *   POST  /outreach/:publisherId/won|lost   -> OutreachItem    (outcome on a replied prospect)
 *   POST  /outreach/:publisherId/follow-up  -> OutreachItem    (create a step-2 follow-up DRAFT, no send)
 *   POST  /outreach/:publisherId/send-follow-up -> OutreachItem (persist edits + send the follow-up in-thread)
 *
 * `message` is the read-model. Step-1 rows are synced from `publishers` by the DB trigger;
 * step-2 (follow-up) rows are written directly. won/lost + the follow-up outcome data are the
 * substrate the learning loop reads. Design: how/pipeline_messaging_ab_sequencing_DRAFT.md.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface MessageRow {
  id: string;
  publisher_id: string;
  step: number;
  variant: string;
  is_control: boolean;
  subject: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
  replied_at: string | null;
  publishers:
    | { publisher_name: string | null; game_name: string | null; contact_email: string | null; email_valid: boolean | null }
    | null;
}

const MESSAGE_SELECT =
  "id,publisher_id,step,variant,is_control,subject,body,status,sent_at,replied_at," +
  "publishers(publisher_name,game_name,contact_email,email_valid)";

const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

const relDate = (iso: string | null): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
};

const statusToStage = (s: string | null): string => {
  switch (s) {
    case "won":
      return "success";
    case "lost":
      return "lost";
    case "replied":
      return "replied";
    case "sent":
    case "approved":
      return "contacted";
    case "rejected":
    case "skip":
      return "lost";
    default:
      return "awaiting";
  }
};

function toOutreachItems(rows: MessageRow[]): unknown[] {
  const byPublisher = new Map<string, MessageRow[]>();
  for (const r of rows) {
    const list = byPublisher.get(r.publisher_id) ?? [];
    list.push(r);
    byPublisher.set(r.publisher_id, list);
  }

  const items: unknown[] = [];
  for (const [publisherId, msgs] of byPublisher) {
    const step1 = msgs.filter((m) => m.step === 1);
    const pub = (step1[0] ?? msgs[0]!).publishers;
    const name = pub?.publisher_name || pub?.game_name || "Unknown publisher";
    const control = step1.find((m) => m.is_control) ?? step1[0] ?? msgs[0]!;

    const variants = step1
      .sort((a, b) => a.variant.localeCompare(b.variant))
      .map((m) => ({
        messageId: m.id,
        variant: m.variant,
        isControl: m.is_control,
        step: m.step,
        subject: m.subject ?? undefined,
        body: m.body ?? undefined,
        sentCount: m.sent_at ? 1 : 0,
        replyCount: m.replied_at ? 1 : 0,
      }));

    // A pending follow-up draft (step-2, not yet sent) surfaced for review/edit.
    const f = msgs.find((m) => m.step === 2 && (m.status === "draft" || m.status === "approved") && !m.sent_at);
    const followUp = f ? { messageId: f.id, subject: f.subject ?? "", body: f.body ?? "" } : undefined;

    let last: string | undefined;
    if (control.replied_at) last = `Replied ${relDate(control.replied_at)}`;
    else if (control.sent_at) last = `Sent ${relDate(control.sent_at)}`;

    items.push({
      id: publisherId,
      name,
      initials: initialsOf(name),
      channel: "Email",
      stage: statusToStage(control.status),
      toEmail: pub?.contact_email?.trim() ? pub.contact_email.trim() : undefined,
      emailValid: pub?.email_valid ?? undefined,
      subject: control.subject ?? undefined,
      body: control.body ?? undefined,
      variants,
      followUp,
      last,
    });
  }
  return items;
}

const parsePath = (url: string): { seg1?: string; seg2?: string } => {
  const parts = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const i = parts.indexOf("outreach");
  return { seg1: parts[i + 1], seg2: parts[i + 2] };
};

async function publisherItem(db: SupabaseClient, publisherId: string) {
  const { data, error } = await db
    .from("message")
    .select(MESSAGE_SELECT)
    .eq("publisher_id", publisherId)
    .order("step", { ascending: true })
    .order("variant", { ascending: true });
  if (error) return { error };
  const items = toOutreachItems((data ?? []) as unknown as MessageRow[]);
  return { item: items[0] ?? null };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();

  // ---- GET /outreach ----
  if (req.method === "GET") {
    const { data, error } = await db
      .from("message")
      .select(MESSAGE_SELECT)
      .in("step", [1, 2])
      .in("status", ["draft", "approved", "rejected", "sent", "replied", "won", "lost"])
      .neq("body", "")
      .order("publisher_id", { ascending: true })
      .order("step", { ascending: true })
      .order("variant", { ascending: true });
    if (error) return errBody("db_error", error.message, 500);
    return json(toOutreachItems((data ?? []) as unknown as MessageRow[]));
  }

  // ---- PATCH /outreach/message/:messageId ---- edit one variant or a follow-up draft.
  if (req.method === "PATCH") {
    const { seg1, seg2: messageId } = parsePath(req.url);
    if (seg1 !== "message" || !messageId) {
      return errBody("bad_request", "Use PATCH /outreach/message/:messageId", 400);
    }
    let payload: { subject?: unknown; body?: unknown };
    try {
      payload = await req.json();
    } catch {
      return errBody("bad_request", "Invalid JSON body", 400);
    }

    const { data: msg, error: mErr } = await db
      .from("message")
      .select("publisher_id,variant,step")
      .eq("id", messageId)
      .single();
    if (mErr) return errBody("db_error", mErr.message, mErr.code === "PGRST116" ? 404 : 500);

    // Step-2 (follow-up) rows are written directly; step-1 writes the publishers column
    // (mirrored into message by the sync trigger).
    if (msg.step >= 2) {
      const patch: Record<string, string> = {};
      if (typeof payload.subject === "string") patch.subject = payload.subject;
      if (typeof payload.body === "string") patch.body = payload.body;
      if (Object.keys(patch).length === 0) return errBody("bad_request", "Provide subject and/or body", 400);
      const { error: uErr } = await db.from("message").update(patch).eq("id", messageId);
      if (uErr) return errBody("db_error", uErr.message, 500);
      const { item, error } = await publisherItem(db, msg.publisher_id);
      if (error) return errBody("db_error", error.message, 500);
      return json(item);
    }

    const patch: Record<string, string> = {};
    if (typeof payload.subject === "string") {
      patch[msg.variant === "B" ? "approved_subject_b" : "approved_subject"] = payload.subject;
    }
    if (typeof payload.body === "string") patch.approved_body = payload.body;
    if (Object.keys(patch).length === 0) {
      return errBody("bad_request", "Provide subject and/or body", 400);
    }

    const { error: uErr } = await db.from("publishers").update(patch).eq("id", msg.publisher_id);
    if (uErr) return errBody("db_error", uErr.message, 500);

    const { item, error } = await publisherItem(db, msg.publisher_id);
    if (error) return errBody("db_error", error.message, 500);
    return json(item);
  }

  // ---- POST /outreach/:publisherId/{approve,skip,won,lost,follow-up,send-follow-up} ----
  if (req.method === "POST") {
    const { seg1: id, seg2: action } = parsePath(req.url);
    if (!id) return errBody("bad_request", "Missing publisher id", 400);
    if (!["approve", "skip", "won", "lost", "follow-up", "send-follow-up"].includes(action ?? "")) {
      return errBody("bad_request", "unknown action", 400);
    }

    // Create a step-2 follow-up DRAFT (does not send). The UI reviews/edits it, then calls
    // send-follow-up. Subject/body come from the UI editor; a template is the fallback.
    if (action === "follow-up") {
      let payload: { subject?: unknown; body?: unknown } = {};
      try {
        payload = await req.json();
      } catch { /* template */ }

      const { data: m1, error: e1 } = await db
        .from("message")
        .select("subject, thread_id")
        .eq("publisher_id", id)
        .eq("step", 1)
        .eq("is_control", true)
        .limit(1)
        .maybeSingle();
      if (e1) return errBody("db_error", e1.message, 500);
      if (!m1?.thread_id) return errBody("not_sent", "Send the initial email before following up", 422);

      const { data: pub } = await db.from("publishers").select("tenant_id").eq("id", id).single();
      const subject = typeof payload.subject === "string" && payload.subject.trim()
        ? payload.subject
        : (m1.subject ? (m1.subject.startsWith("Re:") ? m1.subject : `Re: ${m1.subject}`) : "Following up");
      const body = typeof payload.body === "string" && payload.body.trim()
        ? payload.body
        : "Hi, just following up on my note below in case it slipped through. " +
          "Would this be a fit for your team? Happy to share a quick example.";

      const { error: cErr } = await db
        .from("message")
        .upsert(
          { tenant_id: pub?.tenant_id, publisher_id: id, step: 2, variant: "A", is_control: true, subject, body, status: "draft", sent_at: null, thread_id: m1.thread_id },
          { onConflict: "publisher_id,step,variant" },
        );
      if (cErr) return errBody("db_error", cErr.message, 500);

      const { item, error: rErr } = await publisherItem(db, id);
      if (rErr) return errBody("db_error", rErr.message, 500);
      return json(item);
    }

    // Persist any final edits to the follow-up draft, then send it in-thread.
    if (action === "send-follow-up") {
      let payload: { subject?: unknown; body?: unknown } = {};
      try {
        payload = await req.json();
      } catch { /* send as-is */ }

      const { data: f, error: fErr } = await db
        .from("message")
        .select("id")
        .eq("publisher_id", id)
        .eq("step", 2)
        .is("sent_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fErr) return errBody("db_error", fErr.message, 500);
      if (!f) return errBody("no_followup", "No follow-up draft to send", 404);

      const patch: Record<string, string> = { status: "approved" };
      if (typeof payload.subject === "string" && payload.subject.trim()) patch.subject = payload.subject;
      if (typeof payload.body === "string" && payload.body.trim()) patch.body = payload.body;
      const { error: uErr } = await db.from("message").update(patch).eq("id", f.id);
      if (uErr) return errBody("db_error", uErr.message, 500);

      const sendUrl = Deno.env.get("N8N_SEND_WEBHOOK_URL");
      if (sendUrl) {
        const secret = Deno.env.get("N8N_WEBHOOK_SECRET");
        try {
          await fetch(sendUrl, {
            method: "POST",
            headers: { "content-type": "application/json", ...(secret ? { "x-webhook-secret": secret } : {}) },
            body: JSON.stringify({ publisher_id: id, message_id: f.id }),
          });
        } catch (_e) { /* swallowed */ }
      }

      const { item, error: rErr } = await publisherItem(db, id);
      if (rErr) return errBody("db_error", rErr.message, 500);
      return json(item);
    }

    // Outcome on a replied prospect (the learning data). publishers first so the sync
    // trigger can't clobber the message stamp.
    if (action === "won" || action === "lost") {
      const status = action;
      const { error: pErr } = await db.from("publishers").update({ pipeline_status: status }).eq("id", id);
      if (pErr) return errBody("db_error", pErr.message, pErr.code === "PGRST116" ? 404 : 500);
      const { error: mErr } = await db.from("message").update({ status }).eq("publisher_id", id).eq("step", 1);
      if (mErr) return errBody("db_error", mErr.message, 500);
      const { item, error: rErr } = await publisherItem(db, id);
      if (rErr) return errBody("db_error", rErr.message, 500);
      return json(item);
    }

    // Guard: never approve-and-send a publisher with no recipient.
    if (action === "approve") {
      const { data: pub, error: pErr } = await db.from("publishers").select("contact_email").eq("id", id).single();
      if (pErr) return errBody("db_error", pErr.message, pErr.code === "PGRST116" ? 404 : 500);
      if (!pub?.contact_email?.trim()) {
        return errBody("no_recipient", "This publisher has no contact email, cannot send", 422);
      }
    }

    const patch = action === "approve" ? { pipeline_status: "approved" } : { pipeline_status: "rejected" };
    const { error } = await db.from("publishers").update(patch).eq("id", id);
    if (error) return errBody("db_error", error.message, error.code === "PGRST116" ? 404 : 500);

    if (action === "approve") {
      const sendUrl = Deno.env.get("N8N_SEND_WEBHOOK_URL");
      if (sendUrl) {
        const secret = Deno.env.get("N8N_WEBHOOK_SECRET");
        try {
          await fetch(sendUrl, {
            method: "POST",
            headers: { "content-type": "application/json", ...(secret ? { "x-webhook-secret": secret } : {}) },
            body: JSON.stringify({ publisher_id: id }),
          });
        } catch (_e) { /* swallowed */ }
      }
    }

    const { item, error: rErr } = await publisherItem(db, id);
    if (rErr) return errBody("db_error", rErr.message, 500);
    return json(item);
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
