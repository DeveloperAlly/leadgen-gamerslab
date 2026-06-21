# GamersLab v1 Integration API

The integration layer between the **n8n v10 workflow**, the **`publishers`** Supabase table,
and the **Lead Pipeline UI**. It implements the UI's `leadService` contract
(`ui-design/lead-pipeline/docs/ENDPOINTS.md`) as Supabase Edge Functions, mapping GamersLab's
single `publishers` table onto the UI's generic Lead/Outreach model.

This is **v1 (GamersLab)**. v2 (whitelabel) keeps this exact function surface and swaps the
backend underneath (Exa/OpenRouter/generic schema) — the UI never changes. See
`Gamers Lab Lead Gen Pipeline/how/architecture_spec_M2_DRAFT.md`.

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
│   ├── outreach/               GET/POST approve|skip  (live, over publishers)
│   └── insights/               GET/POST apply         (fixed; apply no-op)
└── migrations/
    └── 0001_runs.sql           discovery job-state table
```

**Live data path** (real `publishers` data): discovery → leads → outreach → approve/export.
**Fixed-config surfaces** (GamersLab is single-config; baked into the workflow): tenant,
sources, intake, venues, understanding, insights. These become real per-tenant rows in v2.

## Deploy (target project: `ccmwksmgoisijvyovgko`)

```bash
# 1. Link (one-time). Uses the supabase CLI via npx — no global install needed.
npx supabase login                       # the account that owns ccmwksmgoisijvyovgko
npx supabase link --project-ref ccmwksmgoisijvyovgko

# 2. Run the runs-table migration (or paste 0001_runs.sql into the SQL editor):
npx supabase db push

# 3. Set function secrets (fill supabase/functions/.env from .env.example first):
npx supabase secrets set --env-file supabase/functions/.env --project-ref ccmwksmgoisijvyovgko

# 4. Deploy every function with --no-verify-jwt (we use our own static bearer, not a Supabase JWT):
for fn in tenant sources intake venues understanding discovery n8n-status leads outreach insights; do
  npx supabase functions deploy "$fn" --no-verify-jwt --project-ref ccmwksmgoisijvyovgko
done

# 5. Point the UI at it (ui-design/lead-pipeline/.env.local):
#   VITE_API_BASE=https://ccmwksmgoisijvyovgko.supabase.co/functions/v1
#   VITE_API_BEARER=<same as API_BEARER secret>
#   VITE_USE_FIXTURES=false
```

## Secrets still needed from Ally

- **service-role key** is auto-injected — no action.
- **API_BEARER** — generate any long random string (UI + functions must match).
- **N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET** — set after the webhook node is added (below).
- **N8N_STATUS_SECRET** — any random string; also set on the workflow's status nodes.

## n8n v10 webhook (PENDING — not yet applied to the live workflow)

The live `GamersLab Publisher Outreach v10` (id `MouIeDmDAAHKIpDn`) has only a Schedule
Trigger → `Get Drafted IDs`. To let the UI start a run, add a parallel webhook entry. n8n has
no REST execute endpoint, so a Webhook Trigger is the entry point (architecture spec §6, §10 C1).

**Minimal change (low risk):**
1. **Discovery Webhook** node — `n8n-nodes-base.webhook`, `httpMethod: POST`,
   `path: gamerslab-discovery`, **explicit `webhookId`**, Header Auth (`N8N_WEBHOOK_SECRET`),
   `responseMode: onReceived`, `responseCode: 202`. Connect `Discovery Webhook → Get Drafted IDs`
   (converges with the Schedule path; the daily schedule run is unaffected).
   → Production URL becomes `https://n8n-j39n.sliplane.app/webhook/<webhookId>` = `N8N_WEBHOOK_URL`.

**Progress callback (so the UI poll completes):**
2. Status posts to the `n8n-status` function carry `run_id` via a cross-node reference
   `={{ $('Discovery Webhook').first().json.body.run_id }}` — immune to n8n's field-stripping.
   - **Start:** HTTP node between `Discovery Webhook` and `Get Drafted IDs` →
     `POST {n8n-status}` `{run_id, status:"running", progress:5}` (header `x-status-secret`).
   - **Done:** at the SplitInBatches "done" output, a Code node resolves `run_id` (try/catch →
     "" on schedule runs) → IF `run_id` non-empty → HTTP `POST {n8n-status}`
     `{run_id, status:"completed", progress:100, counts}`. The IF guard keeps the scheduled
     run untouched.

Apply via the n8n MCP (`update_workflow`) then `validate_workflow` before publishing — do NOT
hand-edit the live JSON. This is the only step that mutates live production, so it is gated on
explicit go.
