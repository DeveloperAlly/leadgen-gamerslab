/**
 * email-thread — the live Gmail conversation for a prospect (sent + replies).
 *
 *   GET /email-thread?publisher_id=<id>  -> { messages: [{ from, date, body, fromMe }] }
 *
 * Resolves the prospect's thread_id from its step-1 message, mints a Gmail access token
 * from the connected inbox (the same decrypt+refresh the broker uses), fetches the full
 * thread, and returns each message's sender, date, and plaintext body. Powers the
 * collapsible conversation panel on the Pipeline page.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { decryptToken, refreshAccessToken, type Provider } from "../_shared/email.ts";

const decodeB64url = (s: string): string => {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    return new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
};

// deno-lint-ignore no-explicit-any
const headerOf = (payload: any, name: string): string =>
  // deno-lint-ignore no-explicit-any
  (payload?.headers ?? []).find((h: any) => (h.name ?? "").toLowerCase() === name)?.value ?? "";

// deno-lint-ignore no-explicit-any
function plainText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeB64url(payload.body.data);
  for (const p of payload.parts ?? []) {
    const t = plainText(p);
    if (t) return t;
  }
  return "";
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const publisherId = url.searchParams.get("publisher_id");
  if (!publisherId) return errBody("bad_request", "publisher_id required", 400);

  const db = admin();
  const { data: m1 } = await db
    .from("message")
    .select("thread_id")
    .eq("publisher_id", publisherId)
    .eq("step", 1)
    .not("thread_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!m1?.thread_id) return json({ messages: [] });

  const { data: acct } = await db
    .from("email_accounts")
    .select("provider, from_email, refresh_token_enc")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!acct?.refresh_token_enc) return json({ messages: [] });

  try {
    const refresh = await decryptToken(acct.refresh_token_enc);
    const accessToken = await refreshAccessToken(acct.provider as Provider, refresh);
    const me = (acct.from_email ?? "").toLowerCase();
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${m1.thread_id}?format=full`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return json({ messages: [] });
    const thread = await res.json();
    // deno-lint-ignore no-explicit-any
    const messages = (thread.messages ?? []).map((m: any) => {
      const from = headerOf(m.payload, "from");
      const date = headerOf(m.payload, "date");
      const body = (plainText(m.payload) || m.snippet || "").trim();
      return { from, date, body, fromMe: from.toLowerCase().includes(me) };
    });
    return json({ messages });
  } catch (e) {
    return errBody("thread_failed", (e as Error).message, 502);
  }
});
