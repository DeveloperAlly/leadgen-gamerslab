/**
 * email-test-send — send a test message from the connected inbox to itself.
 *
 *   POST /email-test-send   -> { ok: true, to }
 *
 * Proves the stored token still mints an access token and the provider accepts a send,
 * before the user trusts the pipeline with it. Mints the access token from the encrypted
 * refresh token, sends, and bumps the daily counter. Enforces the daily cap.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { decryptToken, refreshAccessToken, sendMail, type Provider } from "../_shared/email.ts";

const today = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  if (req.method !== "POST") return errBody("method_not_allowed", "POST only", 405);

  const db = admin();
  const { data, error } = await db
    .from("email_accounts")
    .select("id, provider, from_email, refresh_token_enc, daily_cap, sent_today, sent_today_date")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return errBody("db_error", error.message, 500);
  if (!data || !data.refresh_token_enc) {
    return errBody("no_account", "No connected inbox to send from", 409);
  }

  const sameDay = data.sent_today_date === today();
  const sentToday = sameDay ? data.sent_today : 0;
  if (sentToday >= data.daily_cap) {
    return errBody("cap_reached", `Daily send cap (${data.daily_cap}) reached`, 429);
  }

  try {
    const refresh = await decryptToken(data.refresh_token_enc);
    const accessToken = await refreshAccessToken(data.provider as Provider, refresh);
    await sendMail(
      data.provider as Provider,
      accessToken,
      data.from_email,
      data.from_email, // test send goes to self
      "GamersLab outreach test send",
      "This is a test from your GamersLab outreach setup. If you received this, sending works.",
    );
  } catch (e) {
    return errBody("send_failed", (e as Error).message, 502);
  }

  await db
    .from("email_accounts")
    .update({ sent_today: sentToday + 1, sent_today_date: today(), last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return json({ ok: true, to: data.from_email });
});
