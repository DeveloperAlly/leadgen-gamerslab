/**
 * email-account — read / disconnect the connected sending inbox.
 *
 *   GET    /email-account   -> EmailAccount   (never returns the token)
 *   DELETE /email-account   -> 204            (soft-revoke; stops all sending)
 *
 * Backs the Connect-email screen's connected state. Design: how/email_send_pipeline_DRAFT.md §8.
 */

import { admin, errBody, json, noContent, preflight, requireBearer } from "../_shared/http.ts";

interface AccountRow {
  provider: string;
  from_email: string;
  display_name: string | null;
  scopes: string[] | null;
  daily_cap: number;
  sent_today: number;
  sent_today_date: string | null;
  status: string;
}

const today = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const db = admin();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("email_accounts")
      .select("provider, from_email, display_name, scopes, daily_cap, sent_today, sent_today_date, status")
      .eq("status", "connected")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return errBody("db_error", error.message, 500);
    if (!data) return json({ connected: false });

    const a = data as AccountRow;
    return json({
      connected: true,
      provider: a.provider,
      fromEmail: a.from_email,
      displayName: a.display_name ?? undefined,
      dailyCap: a.daily_cap,
      // Counter is per-day; show 0 once the date has rolled over.
      sentToday: a.sent_today_date === today() ? a.sent_today : 0,
      scopes: a.scopes ?? [],
      status: a.status,
    });
  }

  if (req.method === "DELETE") {
    const { error } = await db.from("email_accounts").update({ status: "revoked" }).eq("status", "connected");
    if (error) return errBody("db_error", error.message, 500);
    return noContent();
  }

  return errBody("method_not_allowed", `${req.method} not supported`, 405);
});
