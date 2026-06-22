/**
 * Email send identity — shared crypto + provider helpers for the email-* functions.
 *
 * Splits WHO sends (this layer: OAuth + token storage) from HOW it sends (n8n reads the
 * token per-send). Endpoints/scopes verified against official Google + Microsoft docs
 * (2026-06-22): see how/email_send_pipeline_DRAFT.md §4/§6.
 *
 * Tokens are encrypted AES-256-GCM with EMAIL_TOKEN_KEY (a base64 32-byte key) before
 * they touch the DB, and only ever decrypted server-side.
 */

export type Provider = "google" | "microsoft";

/* --------------------------------------------------------------- token crypto */

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const cryptoKey = (): Promise<CryptoKey> => {
  const raw = Deno.env.get("EMAIL_TOKEN_KEY");
  if (!raw) throw new Error("EMAIL_TOKEN_KEY not set");
  return crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
};

/** AES-256-GCM → "ivB64:cipherB64" (cipher includes the auth tag). */
export const encryptToken = async (plain: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), enc.encode(plain));
  return `${b64(iv)}:${b64(ct)}`;
};

export const decryptToken = async (packed: string): Promise<string> => {
  const [ivB64, ctB64] = packed.split(":");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivB64) },
    await cryptoKey(),
    unb64(ctB64),
  );
  return dec.decode(pt);
};

/* ------------------------------------------------------------- provider config */

const MS_TENANT = Deno.env.get("MS_TENANT") || "common"; // common | organizations | <tenant-id>

interface ProviderCfg {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
}

export const PROVIDERS: Record<Provider, ProviderCfg> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "openid",
      "email",
    ],
    clientId: () => Deno.env.get("GOOGLE_CLIENT_ID"),
    clientSecret: () => Deno.env.get("GOOGLE_CLIENT_SECRET"),
  },
  microsoft: {
    authUrl: `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
    scopes: [
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/Mail.Read",
      "offline_access",
      "openid",
      "email",
    ],
    clientId: () => Deno.env.get("MS_CLIENT_ID"),
    clientSecret: () => Deno.env.get("MS_CLIENT_SECRET"),
  },
};

export const redirectUri = (): string =>
  `${Deno.env.get("EMAIL_REDIRECT_BASE")}/email-oauth/callback`;

/** App URL the callback bounces back to after storing the token. */
export const appReturnUrl = (ok: boolean): string => {
  const base = Deno.env.get("EMAIL_APP_URL") || "";
  return `${base}/?email=${ok ? "connected" : "error"}`;
};

/* --------------------------------------------------------------- OAuth helpers */

export const buildAuthUrl = (provider: Provider, state: string): string => {
  const cfg = PROVIDERS[provider];
  const p = new URLSearchParams({
    client_id: cfg.clientId() ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: cfg.scopes.join(" "),
    state,
  });
  if (provider === "google") {
    p.set("access_type", "offline"); // required to receive a refresh_token
    p.set("prompt", "consent"); // force refresh_token re-issue on re-auth
    p.set("include_granted_scopes", "true");
  } else {
    p.set("response_mode", "query");
  }
  return `${cfg.authUrl}?${p.toString()}`;
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

const tokenRequest = async (provider: Provider, form: Record<string, string>): Promise<TokenResponse> => {
  const cfg = PROVIDERS[provider];
  const body = new URLSearchParams({
    client_id: cfg.clientId() ?? "",
    client_secret: cfg.clientSecret() ?? "",
    ...form,
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`${provider} token endpoint ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
};

export const exchangeCode = (provider: Provider, code: string): Promise<TokenResponse> =>
  tokenRequest(provider, {
    code,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });

/** Mint a fresh access token from a stored refresh token (n8n + test-send use this). */
export const refreshAccessToken = async (provider: Provider, refreshToken: string): Promise<string> => {
  const t = await tokenRequest(provider, {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    ...(provider === "microsoft" ? { scope: PROVIDERS.microsoft.scopes.join(" ") } : {}),
  });
  return t.access_token;
};

/** Resolve the address we send as, from the freshly-issued access token. */
export const fetchFromEmail = async (provider: Provider, accessToken: string): Promise<string> => {
  if (provider === "google") {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const j = await res.json();
    return j.email ?? "";
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const j = await res.json();
  return j.mail ?? j.userPrincipalName ?? "";
};

/* ------------------------------------------------------------------- send mail */

const base64url = (s: string): string =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Send one message as the authenticated user. Used by the test-send function; the
 * production outreach send is the n8n workflow, which makes the same calls.
 */
export const sendMail = async (
  provider: Provider,
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> => {
  if (provider === "google") {
    const raw = base64url(
      `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\n` +
        `Content-Type: text/plain; charset=UTF-8\r\n\r\n${body}`,
    );
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) throw new Error(`gmail send ${res.status}: ${await res.text()}`);
    return;
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok && res.status !== 202) throw new Error(`graph sendMail ${res.status}: ${await res.text()}`);
};
