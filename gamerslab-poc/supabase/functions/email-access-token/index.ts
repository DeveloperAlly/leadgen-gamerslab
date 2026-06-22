/**
 * email-access-token — the broker. Mints a short-lived provider access token from the
 * stored (encrypted) refresh token so n8n never touches the refresh token or the crypto
 * key. n8n calls this, then makes the Gmail send / thread-read HTTP calls itself.
 *
 *   POST /email-access-token   -> { provider, from_email, access_token }
 *
 * Server-to-server only: protected by the same static API_BEARER (set it in the n8n env so
 * the workflows can call with Authorization: Bearer). Design: how/email_send_pipeline_DRAFT.md §6.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import { decryptToken, refreshAccessToken, type Provider } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  if (req.method !== "POST") return errBody("method_not_allowed", "POST only", 405);

  const db = admin();
  const { data, error } = await db
    .from("email_accounts")
    .select("provider, from_email, refresh_token_enc")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return errBody("db_error", error.message, 500);
  if (!data || !data.refresh_token_enc) {
    return errBody("no_account", "No connected inbox", 409);
  }

  try {
    const refresh = await decryptToken(data.refresh_token_enc);
    const access_token = await refreshAccessToken(data.provider as Provider, refresh);
    return json({ provider: data.provider, from_email: data.from_email, access_token });
  } catch (e) {
    return errBody("token_failed", (e as Error).message, 502);
  }
});
