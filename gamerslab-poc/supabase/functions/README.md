# GamersLab v1 Integration API

The integration layer between the **n8n v10 workflow**, the **`publishers`** Supabase table,
and the **Lead Pipeline UI**. It implements the UI's `leadService` contract
(`poc/ui/docs/ENDPOINTS.md`) as Supabase Edge Functions, mapping GamersLab's
single `publishers` table onto the UI's generic Lead/Outreach model.

This is **v1 (GamersLab)**. v2 (whitelabel) keeps this exact function surface and swaps the
backend underneath (Exa/OpenRouter/generic schema) — the UI never changes. See
`how/architecture_spec_M2_DRAFT.md`.

## Layout

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── types.ts            UI contract (mirrors the app's types.ts)
│   │   ├── mapper.ts           publishers -> Lead / OutreachItem (the adapter)
│   │   ├── http.ts             CORS, JSON, bearer auth, service-role client
│   │   └── gamerslab-config.ts fixed onboarding config (Sources/Intake/Venues/Gate-A/Insights)
│   ├── tenant/                 GET /tenant            (live usage count)
│   ├── sources/                GET/POST/DELETE        (fixed config; add/remove no-op)
│   ├── intake/                 GET/PUT                (fixed config; echo)
│   ├── venues/                 GET/PATCH              (fixed config; echo)
│   ├── understanding/          GET/PUT                (fixed Gate-A; echo)
│   ├── discovery/              POST /run, GET /:jobId (triggers n8n, polls runs)
│   ├── n8n-status/             POST                   (n8n -> run progress callback)
│   ├── leads/                  GET/PATCH/POST export  (live, over publishers)
│   ├── outreach/               GET/POST approve|skip  (live; approve fires n8n Send)
│   ├── insights/               GET/POST apply         (fixed; apply no-op)
│   ├── email-oauth/            POST /start, GET /callback (connect Gmail/Outlook)
│   ├── email-account/          GET/DELETE             (read / disconnect the inbox)
│   ├── email-test-send/        POST                   (test send from the inbox)
│   └── _shared/email.ts        token crypto + Gmail/Graph OAuth + send helpers
└── migrations/
    ├── 0001_runs.sql           discovery job-state table
    └── 0005_email_accounts.sql connected sending inbox (encrypted token)
```

**Live data path** (real `publishers` data): discovery → leads → outreach → approve/export.
**Fixed-config surfaces** (GamersLab is single-config; baked into the workflow): tenant,
sources, intake, venues, understanding, insights. These become real per-tenant rows in v2.

## Deploy (target project: `ccmwksmgoisijvyovgko`)

```bash
# 0. Run all supabase commands from the gamerslab-poc/ dir (the CLI resolves ./supabase):
cd gamerslab-poc

# 1. Link (one-time). Uses the supabase CLI via npx — no global install needed.
npx supabase login                       # the account that owns ccmwksmgoisijvyovgko
npx supabase link --project-ref ccmwksmgoisijvyovgko

# 2. Run the runs-table migration (or paste 0001_runs.sql into the SQL editor):
npx supabase db push

# 3. Set function secrets (fill supabase/functions/.env from .env.example first):
npx supabase secrets set --env-file supabase/functions/.env --project-ref ccmwksmgoisijvyovgko

# 4. Deploy every function with --no-verify-jwt (we use our own static bearer, not a Supabase JWT):
for fn in tenant sources intake venues understanding discovery n8n-status leads outreach insights \
          email-oauth email-account email-test-send; do
  npx supabase functions deploy "$fn" --no-verify-jwt --project-ref ccmwksmgoisijvyovgko
done
# (email-oauth/-account/-test-send were deployed live 2026-06-22 via MCP; email-account verified.
#  Re-run `outreach` after setting N8N_SEND_WEBHOOK_URL so approve fires the Send workflow.)

# 5. Point the UI at it (poc/ui/.env.local):
#   VITE_API_BASE=https://ccmwksmgoisijvyovgko.supabase.co/functions/v1
#   VITE_API_BEARER=<same as API_BEARER secret>
#   VITE_USE_FIXTURES=false
```

## Secrets still needed from Ally

- **service-role key** is auto-injected — no action.
- **API_BEARER** — generate any long random string (UI + functions must match).
- **N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET** — set after the webhook node is added (below).
- **N8N_STATUS_SECRET** — any random string; also set on the workflow's status nodes.

### Email send pipeline (the only Ally-only step is provisioning the OAuth apps)

The code is built + deployed; it needs these secrets to function (see `.env.example`):
- **EMAIL_TOKEN_KEY** — `openssl rand -base64 32` (encrypts stored refresh tokens).
- **EMAIL_REDIRECT_BASE** — `https://ccmwksmgoisijvyovgko.supabase.co/functions/v1`.
- **EMAIL_APP_URL** — the deployed UI origin (callback bounces back here).
- **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** — a Google Cloud OAuth "Web" client; enable the
  Gmail API; consent-screen scopes `gmail.send` + `gmail.readonly`; redirect URI =
  `EMAIL_REDIRECT_BASE/email-oauth/callback`.
- **MS_CLIENT_ID / MS_CLIENT_SECRET** — an Entra ID app registration ("Web" redirect =
  same callback); delegated `Mail.Send` + `Mail.Read` + `offline_access`. Confidential/web
  app type (durable refresh tokens — SPA type expires them in 24h).
- **N8N_SEND_WEBHOOK_URL** — the n8n Send workflow's webhook (then re-deploy `outreach`).

Until the OAuth apps exist, `email-oauth/start` returns `config_error` and the UI Connect
buttons surface that — by design.

## n8n v10 webhook (APPLIED — live on `GamersLab Publisher Outreach v10`, id `MouIeDmDAAHKIpDn`)

Four nodes were added (32 → 36) alongside the existing Schedule Trigger; the daily schedule
path is untouched. n8n has no REST execute endpoint, so a Webhook Trigger is the entry point
(architecture spec §6, §10 C1).

- **Discovery Webhook** (`n8n-nodes-base.webhook`, POST, `path: gamerslab-discovery`,
  `authentication: none`, `responseMode: onReceived`, responseCode **202**)
  → connects to `Get Drafted IDs` (converges with the schedule path).
  **Production URL = `https://n8n-j39n.sliplane.app/webhook/gamerslab-discovery`** → set this as
  `N8N_WEBHOOK_URL` on the Edge Functions.
- **Status: Running** — parallel off the webhook → `POST {n8n-status}` `{run_id, status:"running",
  progress:5}`, header `x-status-secret: {{ $env.N8N_STATUS_SECRET }}`.
- **Resolve Run Context** (Code) + **Status: Completed** — hang off `Batch for Web Search`'s
  "done" output; the Code node resolves `run_id` via `$('Discovery Webhook').first().json.body.run_id`
  (try/catch → returns `[]` on scheduled runs, so the post is skipped). On a webhook run it posts
  `{run_id, status:"completed", progress:100}`.

**Set `N8N_STATUS_SECRET` in the n8n instance env** (same pattern as `SERPER_API_KEY`) — the status
nodes read it via `{{ $env.N8N_STATUS_SECRET }}`. Use the SAME value as the `N8N_STATUS_SECRET`
Edge Function secret.

**Webhook security:** path-based (`authentication: none`, per n8n's default guidance — the path is
the shared secret). Optional hardening: create an `httpHeaderAuth` credential in the n8n UI and
switch the webhook to Header Auth.

**If the webhook 404s on first call:** toggle the workflow active off→on in n8n once to register
the new webhook node.

**Edge case:** completion is posted from the enrich path's "done" output. A run where every
candidate routes to backlog (no enrich items) won't post `completed`; the UI poll then relies on
its timeout. Normal runs (draft budget 35) always hit the enrich path. Harden later if needed by
also posting completion from the `Upsert Backlog` terminal.
