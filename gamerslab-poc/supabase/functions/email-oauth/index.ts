/**
 * email-oauth — connect an inbox to send outreach from (Gmail / Outlook OAuth).
 *
 *   POST /email-oauth/start    { provider }   -> { url }   (bearer-auth; UI redirects here)
 *   GET  /email-oauth/callback ?code&state    -> 302 back to the app  (provider redirect; public)
 *
 * start builds the provider consent URL. callback exchanges the code for a refresh token,
 * encrypts it (AES-256-GCM), and stores one active row in `email_accounts`. The token is
 * never returned to the browser. Design: how/email_send_pipeline_DRAFT.md §7.
 */

import { admin, errBody, json, preflight, requireBearer } from "../_shared/http.ts";
import {
  appReturnUrl,
  buildAuthUrl,
  encryptToken,
  exchangeCode,
  fetchFromEmail,
  PROVIDERS,
  type Provider,
} from "../_shared/email.ts";

const isProvider = (v: unknown): v is Provider => v === "google" || v === "microsoft";

const encodeState = (provider: Provider): string =>
  btoa(JSON.stringify({ provider, t: Date.now() })).replace(/=+$/, "");
const decodeState = (s: string): { provider?: Provider } => {
  try {
    return JSON.parse(atob(s));
  } catch {
    return {};
  }
};

const capFor = (provider: Provider): number => (provider === "microsoft" ? 10000 : 500);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const url = new URL(req.url);

  // ---- POST /email-oauth/start (authenticated) ----
  if (req.method === "POST" && url.pathname.endsWith("/start")) {
    const unauth = requireBearer(req);
    if (unauth) return unauth;

    let body: { provider?: string } = {};
    try {
      body = await req.json();
    } catch { /* empty */ }
    if (!isProvider(body.provider)) {
      return errBody("bad_request", "provider must be google or microsoft", 400);
    }
    if (!PROVIDERS[body.provider].clientId()) {
      return errBody("config_error", `${body.provider} OAuth app not configured`, 500);
    }
    return json({ url: buildAuthUrl(body.provider, encodeState(body.provider)) });
  }

  // ---- GET /email-oauth/callback (public; provider redirect) ----
  if (req.method === "GET" && url.pathname.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const { provider } = decodeState(state);
    if (!code || !isProvider(provider)) {
      return Response.redirect(appReturnUrl(false), 302);
    }

    try {
      const tokens = await exchangeCode(provider, code);
      if (!tokens.refresh_token) throw new Error("no refresh_token returned");
      const fromEmail = await fetchFromEmail(provider, tokens.access_token);
      const refresh_token_enc = await encryptToken(tokens.refresh_token);

      const db = admin();
      // One active account in v1: retire any existing before inserting the new one.
      await db.from("email_accounts").update({ status: "revoked" }).neq("status", "revoked");
      const { error } = await db.from("email_accounts").insert({
        provider,
        from_email: fromEmail,
        display_name: provider === "microsoft" ? "Microsoft 365" : "Google Workspace",
        refresh_token_enc,
        scopes: (tokens.scope ?? PROVIDERS[provider].scopes.join(" ")).split(" "),
        daily_cap: capFor(provider),
        status: "connected",
      });
      if (error) throw new Error(error.message);

      return Response.redirect(appReturnUrl(true), 302);
    } catch (_e) {
      return Response.redirect(appReturnUrl(false), 302);
    }
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
