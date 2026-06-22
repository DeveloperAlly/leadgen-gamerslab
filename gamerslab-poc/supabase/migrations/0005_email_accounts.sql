-- Email send identity — the inbox a tenant connects to send approved outreach from.
-- Design: how/email_send_pipeline_DRAFT.md §5. Splits WHO sends (this table, app data)
-- from HOW it sends (n8n, which reads the token per-send). The `publishers` flow is
-- single-tenant in v1, so one connected account is expected; `tenant_id` is carried for
-- v2 multi-tenant but not enforced yet. RLS on + no policy = service-role-only access
-- (Edge Functions use the service-role client, which bypasses RLS), matching `runs`.
--
-- The refresh token is stored encrypted (AES-256-GCM) by the Edge Function before insert;
-- the column never holds plaintext and is never returned to the browser.

CREATE TABLE IF NOT EXISTS public.email_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  tenant_id          UUID,                              -- v2-ready; v1 publishers flow is single-tenant
  provider           TEXT NOT NULL,                     -- google | microsoft
  from_email         TEXT NOT NULL,                     -- the address we send as
  display_name       TEXT,

  refresh_token_enc  TEXT,                              -- AES-256-GCM ciphertext (iv:tag:data b64); set server-side only
  scopes             TEXT[] NOT NULL DEFAULT '{}',

  daily_cap          INT NOT NULL DEFAULT 500,          -- provider ceiling: ~500 free Gmail, ~2000 Workspace, ~10000 M365
  sent_today         INT NOT NULL DEFAULT 0,            -- count for sent_today_date; reset when the date rolls
  sent_today_date    DATE,

  status             TEXT NOT NULL DEFAULT 'connected', -- connected | expired | revoked
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at       TIMESTAMPTZ
);

-- One active (non-revoked) account per tenant in v1. Partial unique index treats the
-- single-tenant case (tenant_id IS NULL) as one slot too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_one_active
  ON public.email_accounts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON public.email_accounts(status);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Reuse the shared updated_at trigger function defined in schema.sql.
DROP TRIGGER IF EXISTS email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
