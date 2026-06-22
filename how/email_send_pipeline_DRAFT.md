# Email Send Pipeline — Identity & Delivery — DRAFT

**Status:** 🟡 **DRAFT — PRE-GATE.** Nothing here authorises a build (`STATE.md`). This is the
design for the **send layer** the POC deliberately deferred. It supersedes the "NO sending"
terminal state in [`infra_stack_and_layers_DRAFT.md`](infra_stack_and_layers_DRAFT.md) **L6** for
the case where a tenant opts to send from the product.

**Created:** 2026-06-22 · **Owner:** Ally · **Reads from:**
[`infra_stack_and_layers_DRAFT.md`](infra_stack_and_layers_DRAFT.md) (F2 Auth+Tenancy, L5
Orchestrate, L6 Hand-off), [`../poc/design-refs/INTEGRATIONS.md`](../poc/design-refs/INTEGRATIONS.md)
(§1 OAuth, §10 Outreach/Messaging).
**Diagrams:** [`email_send_architecture.svg`](email_send_architecture.svg) ·
[`email_connect_screen_mock.svg`](email_connect_screen_mock.svg).

---

## 1. Scope (read this first)

This spec resolves **one** decision: **how an approved draft actually leaves the building, and how a
non-technical user connects the inbox it sends from.**

Today the POC drafts and stops. `POST /outreach/:id/approve` sets `pipeline_status='approved'` and
returns — nothing sends ([`gamerslab-poc/supabase/functions/outreach/index.ts`](../gamerslab-poc/supabase/functions/outreach/index.ts)).
There is no UI to connect a sending identity, no sender credential storage, and no send/poll
execution. That is by design for v1; this doc designs the layer that turns it on.

**Out of scope / still OPEN:** cold-sequencing cadence (multi-step follow-ups), CRM sync, and
open/click tracking pixels. This spec covers **single-message send + reply detection** only — the
minimum that makes the approve button real.

---

## 2. Principle — split identity from execution

The load-bearing decision. Two concerns that today's POC conflates:

| Concern | What it is | Where it lives | Per-tenant? |
|---|---|---|---|
| **WHO sends** | the OAuth token + the from-address | **app data** — Supabase `email_accounts` | **yes** |
| **HOW it sends** | the actual send call + the reply poll | **n8n execution** — stateless about identity | no — one shared engine |

n8n credentials are an **instance-global, builder-facing** surface — they are *not* an end-user
OAuth store. If "connect my Gmail" tried to land as an n8n credential, multi-tenant and white-label
both break. So the identity layer is **app + Supabase**, and n8n simply **reads the per-tenant token
from the DB at send time**. One shared n8n instance then serves every tenant. This mirrors the
existing doctrine: F4 keeps model keys out of n8n via Vault BYOK; we do the same for sender tokens.

---

## 3. Why a separate pipeline from v10

The v10 GamersLab workflow is a **batch discovery + draft engine**: schedule trigger → mine
publishers → verify email → classify → draft → upsert. It is unattended, batch-shaped, and needs
**no sender identity**. Sending is the opposite shape:

| | v10 (existing) | Send / Reply (new) |
|---|---|---|
| Trigger | schedule (daily) | **event** (on approve) / **schedule** (poll) |
| Granularity | batch (100s of rows) | **per-message** |
| Identity | none | **per-tenant token, required** |
| Inbound | none | **reply detection** |

Folding sending into v10 would couple a clean batch pipeline to per-tenant credentials and inbound
polling — a modular-mandate violation. So: **separate n8n workflows, same shared instance** (not a
separate instance — needless ops for a POC). It is **two** new workflows, not one:

1. **Send** — webhook-triggered by the approve endpoint, one message at a time.
2. **Reply poll** — scheduled; checks each connected mailbox and stamps `replied_at`.

See [`email_send_architecture.svg`](email_send_architecture.svg).

---

## 4. Identity model — provider choice

**Gmail / Outlook OAuth — not SMTP, not SendGrid/Resend.**

- A non-technical user can authorise an inbox in one click. They **cannot** set SPF/DKIM/DMARC DNS
  records, which transactional providers (SendGrid/Resend/Postmark) require for deliverability.
- OAuth sends **as the user's real inbox** — the right deliverability profile for 1:1 outreach, and
  replies land naturally in their inbox/thread.
- Free, and aligns with INTEGRATIONS.md §1 already assuming **Google OAuth** for sign-in. The same
  Google app/consent screen extends to the Gmail send scope.

**Scopes (least-privilege):** Gmail → `gmail.send` + `gmail.readonly` (for reply poll, or the
narrower metadata scope). Microsoft Graph → `Mail.Send` + `Mail.Read`.

**Constraint to design around:** Gmail caps sends at **~500/day (free) / ~2,000/day (Workspace)**;
Microsoft ~10,000/day. Fine for outreach volume, but the per-tenant daily cap must be **surfaced in
the UI and enforced before send** (the "Daily send headroom" line in the mockup). This pairs with
the existing OpenRouter draft-budget ceiling already tracked in `STATE.md`.

---

## 5. Data contract — `email_accounts`

New table, one row per connected inbox, keyed by tenant. Tokens encrypted at rest (Supabase Vault /
`pgsodium`), **never** returned to the browser.

```
email_accounts {
  id                 uuid pk
  tenant_id          uuid   fk → tenants     -- RLS: tenant isolation (F2)
  provider           text                    -- 'google' | 'microsoft'
  from_email         text                    -- the address we send as
  display_name       text
  refresh_token_enc  bytea                   -- encrypted; access-token minted on demand
  scopes             text[]
  daily_cap          int                     -- provider ceiling (500 / 2000 / 10000)
  sent_today         int    default 0        -- reset by the poll/cron at midnight tz
  status             text                    -- 'connected' | 'expired' | 'revoked'
  connected_at       timestamptz
  last_used_at       timestamptz
}
```

`publishers` already carries the send-state columns — **no schema change there**: `approved_subject`,
`approved_body`, `pipeline_status`, `sent_at`, `replied_at` exist and are currently unused. The send
workflow populates `sent_at`; the reply poll populates `replied_at`.

---

## 6. The two workflow shapes

### 6a. Send (event-triggered)
```
approve endpoint ──webhook──► [Send workflow]
   1. fetch publisher row (approved_subject/body) + tenant_id
   2. fetch email_accounts row for tenant; check status + sent_today < daily_cap
   3. mint access token from refresh_token_enc (provider token endpoint)
   4. provider send API  (Gmail users.messages.send / Graph sendMail)
   5. on 2xx → publishers.sent_at = now, pipeline_status='sent', email_accounts.sent_today++
   6. on error → pipeline_status='send_failed', surface in UI; no silent drop
```

### 6b. Reply poll (scheduled)
```
[Reply poll]  every N minutes
   1. for each connected email_accounts row:
   2.   mint access token; query mailbox for replies since last_used_at
   3.   match reply → publishers row by thread/message-id or recipient
   4.   set publishers.replied_at, pipeline_status='replied'  → bell notification (INTEGRATIONS §14)
```

Both read the token from `email_accounts`; neither stores identity in n8n. Provider API calls are
HTTP-Request nodes (not native credential nodes) precisely so the token is per-tenant DB data.

> **Verify-before-build:** every provider endpoint above (Gmail `users.messages.send`, Graph
> `sendMail`, both OAuth token endpoints + scopes) must be checked against 2026 docs at M2 — this
> doc asserts the shape, not the verified call signatures.

---

## 7. OAuth flow (who-sets-it-up path)

```
User (Settings → Email)
  │ click "Continue with Gmail"
  ▼
Provider consent screen  ──grants send + read──►  redirect with ?code
  │
  ▼
Supabase Edge Function  /email/oauth/callback
  • exchange code → refresh_token (+ access_token)
  • encrypt refresh_token, write email_accounts row (tenant_id from session/JWT)
  ▼
UI shows "Connected" state (from_email, daily headroom, disconnect)
```

Disconnect = revoke at provider + soft-delete the row. Token refresh is lazy (minted per send).

---

## 8. Plan — what changes where (the build, gated)

Nothing below is built until the gate passes. This is the change-set the gate approves.

### POC UI (`poc/ui/`) — the one portable source, reskinned by tokens
- **New screen `EmailScreen.tsx`** (the mockup): connect / connected states, test-send, disconnect,
  daily-headroom line. Add to nav + route. White-label-safe (no GamersLab strings; from_email is
  data). Mirrors `SettingsScreen.tsx` card patterns.
- **New service methods** in [`leadService.ts`](../poc/ui/src/data/leadService.ts):
  `getEmailAccount()`, `startEmailConnect(provider)` (→ OAuth URL), `disconnectEmail()`,
  `sendTestEmail()`. Fixture-backed when `USE_FIXTURES`, like every other service.
- **`ProspectTrackingScreen.tsx`**: when no inbox is connected, the approve action prompts "Connect
  an inbox to send" instead of silently approving; show `sent`/`replied`/`send_failed` states.
- **Endpoint contract** ([`docs/ENDPOINTS.md`](../poc/ui/docs/ENDPOINTS.md)): correct the existing
  "Approve & send" comment (today it only approves); add the `/email/*` endpoints.

### Supabase (`gamerslab-poc/supabase/`)
- **Migration**: `email_accounts` table + RLS (tenant isolation) + Vault/pgsodium encryption.
- **New Edge Functions**: `email-oauth-start`, `email-oauth-callback`, `email-account` (GET/DELETE),
  `email-test-send`. Reuse the `_shared` mapper/auth patterns.
- **`outreach/approve`**: after marking approved, **fire the n8n Send webhook** (tenant_id + publisher
  id). This is the one behavioural change to existing code.

### n8n (shared instance, alongside v10 — **not** inside it)
- **Workflow A — Send**: Webhook trigger → Postgres fetch → token mint (HTTP) → provider send (HTTP)
  → Postgres update. Parameterised by `tenant_id`.
- **Workflow B — Reply poll**: Schedule trigger → per-account loop → mailbox query (HTTP) → match →
  Postgres update → notification.
- v10 workflow is **untouched**.

### Config / secrets
- Google + Microsoft OAuth **app** (client id/secret) — one app, tenants authorise into it.
- n8n webhook URL + a shared secret for the approve→send call.

---

## 9. Acceptance (when this is real, post-gate)

1. A user connects Gmail/Outlook in one click from the Email screen; `email_accounts` holds an
   **encrypted** token; the browser never sees it.
2. Approving a draft with a connected inbox **sends** and stamps `sent_at`; the board shows `sent`.
3. A reply stamps `replied_at`, moves the row to `replied`, and rings the bell.
4. Approving with **no** connected inbox prompts to connect — never a silent no-op.
5. Send is blocked once `sent_today >= daily_cap`, with a clear message.
6. v10 discovery/draft runs **unchanged**; one shared n8n instance serves multiple tenants.
7. Disconnect revokes at the provider and stops all sending for that tenant.

---

## 10. Open / deferred

- **Where send executes** — n8n (recommended; keeps send+poll together, scheduler for poll) vs inline
  in the Edge Function. Recommendation: **n8n**. Confirm at gate.
- **Reply detection mechanism** — polling (POC-simple) vs provider push (Gmail Pub/Sub, Graph
  subscriptions). Start with polling.
- Cold **sequencing**, CRM sync, open/click tracking — separate specs (INTEGRATIONS §10/§11).
- Exact 2026 provider endpoint/scopes — **verified at M2**, not here.
