# Required Endpoints — Lead Pipeline

This document is the API contract for the Lead Pipeline UI. The frontend talks to the
backend through a single seam, `src/data/leadService.ts`. Today every method resolves
from local fixtures; to go live, replace each method body with a `fetch` to the endpoint
below. The TypeScript return types (defined in `src/data/types.ts`) are the response
schemas — keep them stable and no UI code changes.

## Conventions

- Base URL: `/api` (configurable). All requests/responses are JSON (`application/json`).
- Auth: bearer token in `Authorization: Bearer <token>`; multi-tenant scope is resolved
  server-side from the token. Never trust a tenant id from the client.
- IDs are opaque strings.
- Money/counts are integers; scores are integers `0–100`.
- Errors: standard HTTP status + `{ "error": { "code": string, "message": string } }`.

## Shared types

See `src/data/types.ts` for the authoritative definitions. Summary:

| Type | Key fields |
|---|---|
| `Source` | `id, type('file'|'url'|'social'), label, parsing, done` |
| `Intake` | `offer, icp, outcome, leadsToday, goodLead` |
| `GateField` | `text, conf('high'|'medium'|'low'), why?` |
| `Venue` | `id, name, platform, strength('strong'|'medium'|'weak'), note, on` |
| `Lead` | `id, name, initials, score, valueScore, matchScore, verified, reason, source, meta[], venue, evidence[], status('pending'|'approved'|'rejected')` |
| `EvidenceItem` | `q, src, date` |
| `OutreachItem` | `id, name, initials, channel, stage('awaiting'|'contacted'|'replied'|'success'|'partial'|'lost'), draft?, last?` |
| `DashboardInsights` | `converting[{label,pct}], refinement, channelRecommendation{title,body}` |

---

## 1. Tenant & bootstrap

### `GET /api/tenant`
Tenant config + usage meter. Drives the sidebar logo/name and the usage bar.
- **Service:** `getTenant()`  **Consumed by:** `Sidebar`, `TopBar`
- **200:**
  ```json
  { "tenant": { "name": "Gamers Lab", "defaultTheme": "gamerslab" },
    "usage": { "used": 320, "total": 1000 } }
  ```

---

## 2. Context sources (onboarding step 1 + Sources screen)

### `GET /api/sources`
- **Service:** `getSources()`  **Consumed by:** `ContextDropScreen`, `SourcesScreen`
- **200:** `Source[]`

### `POST /api/sources`
Register a context source. The server starts an async parse/index job and returns the
source in `parsing: true`. The UI polls (or subscribes) until `done: true`.
- **Service:** `addSource(type, label)`  **Consumed by:** `ContextDropScreen`, `SourcesScreen`
- **Body:** `{ "type": "file"|"url"|"social", "label": string }`
  (file uploads use `multipart/form-data` with the binary + `type=file`)
- **201:** `Source` (`parsing: true, done: false`)

### `GET /api/sources/:id`
Poll parse/index status (alternative: a websocket/SSE channel pushing `MARK_SOURCE_DONE`).
- **200:** `Source`

### `DELETE /api/sources/:id`
- **Service:** `removeSource(id)`  **Consumed by:** `ContextDropScreen`, `SourcesScreen`
- **204:** no content

---

## 3. Guided intake (onboarding step 2)

### `GET /api/intake`
- **Service:** `getIntake()`  **Consumed by:** `GuidedIntakeScreen`
- **200:** `Intake`

### `PUT /api/intake`
Persist intake answers (called on "Save & continue", or debounced per field).
- **Service:** `saveIntake(intake)`  **Consumed by:** `GuidedIntakeScreen`
- **Body:** `Intake`  **200:** `Intake`

> Note: the Customers ⇄ Investors `mode` is a client view-state that swaps question
> copy. Persist it alongside intake if you want it to survive reloads
> (add `mode` to the `Intake` payload).

---

## 4. Venue map (onboarding step 3)

### `GET /api/venues`
Suggested venues derived from context, plus any the user has added. `on` marks which
venues discovery will search.
- **Service:** `getVenues()`  **Consumed by:** `VenueMapScreen`
- **200:** `Venue[]`

### `PATCH /api/venues`
Persist the enabled set + custom venues (idempotent upsert of the whole list).
- **Service:** `saveVenues(venues)`  **Consumed by:** `VenueMapScreen`
- **Body:** `Venue[]`  **200:** `Venue[]`

---

## 5. Understanding — Gate A (onboarding step 4)

### `GET /api/understanding`
The AI's editable understanding of the business (summary, ICP, pains, where, channel),
each with a confidence level.
- **Service:** `getGateFields()`  **Consumed by:** `GateAScreen`
- **200:** `Record<'summary'|'icp'|'pains'|'where'|'channel', GateField>`

### `PUT /api/understanding`
Persist edited fields (called on each Save).
- **Service:** `saveGateFields(fields)`  **Consumed by:** `GateAScreen`
- **Body:** the same map  **200:** the same map

---

## 6. Discovery — Gate B

### `POST /api/discovery/run`
Start the long-running discovery + verification job. Searches only enabled venues and
scores against the (possibly edited) understanding. **This is asynchronous and can take
minutes.** Recommended: return a job id, then stream progress.
- **Service:** `runDiscovery(mode)`  **Consumed by:** `GateAScreen` ("find leads"), `DashboardScreen` ("re-run")
- **Body:** `{ "mode": "customers"|"investors" }`
- **202:** `{ "jobId": string }`

### `GET /api/discovery/:jobId` (or `GET /api/discovery/:jobId/stream` SSE)
Progress for the loading screen (`0–100`) and, on completion, the result.
- **Consumed by:** `DiscoveryScreen`
- **200 (in progress):** `{ "status": "running", "pct": number, "stage": string }`
- **200 (done):** `{ "status": "done", "pct": 100, "result": { "leads": Lead[], "foundCount": number } }`

### `GET /api/leads`
Fetch discovered leads (with evidence + two-sided scores). Supports query params that
mirror the UI controls: `?verified=true&sort=desc`.
- **Service:** `getLeads()`  **Consumed by:** `GateBScreen`
- **200:** `Lead[]` + a `foundCount` header or envelope (`{ "leads": Lead[], "foundCount": 18 }`)

### `PATCH /api/leads/:id`
Approve / reject / reset a lead.
- **Service:** `setLeadStatus(id, status, reasonCode?, reason?)`  **Consumed by:** `GateBScreen`
- **Body:** `{ "status": "approved"|"rejected"|"pending", "reasonCode"?: RejectReasonCode, "reason"?: string }`
- On `rejected`, the N1 `reasonCode` (`bad_fit|wrong_contact|weak_evidence|bad_timing|already_customer|other`)
  and optional free-text `reason` persist to `reject_reason_code` / `reject_reason` (+ `reviewed_at`). **200:** `Lead`
- `Lead` now includes optional `evidenceStrength` (D1: `explicit|inferred|none`) and `riskFlags[]` (N5).

### `POST /api/leads/export`
Export approved leads (returns a file URL / signed download in production).
- **Service:** `exportApproved(ids)`  **Consumed by:** `GateBScreen`
- **Body:** `{ "ids": string[] }`  **200:** `{ "url": string }`

### `POST /api/crm/sync`
Push approved leads to the connected CRM.
- **Service:** `sendToCrm(ids)`  **Consumed by:** `GateBScreen`
- **Body:** `{ "ids": string[] }`  **200:** `{ "synced": number }`

---

## 7. Outreach — Gate C

### `GET /api/outreach`
All prospects across the board + drafts awaiting approval.
- **Service:** `getOutreach()`  **Consumed by:** `ProspectTrackingScreen`, `TopBar` (bell count)
- **200:** `OutreachItem[]`

### `POST /api/outreach/:id/approve`
Approve & send a drafted message. Moves the prospect to `contacted`.
- **Service:** `approveOutreach(id)`  **Consumed by:** `ProspectTrackingScreen`
- **Body (optional):** `{ "draft": string }` if the user edited the message
- **200:** `OutreachItem`

### `POST /api/outreach/:id/skip`
Skip a draft; moves the prospect to `lost`.
- **Service:** `skipOutreach(id)`  **Consumed by:** `ProspectTrackingScreen`
- **200:** `OutreachItem`

> Reply/outcome transitions (`replied`, `success`, `partial`) are driven by inbound
> tracking on the backend (email/CRM webhooks), not the UI. The board reflects whatever
> `GET /api/outreach` returns; consider a websocket/SSE push so the board updates live.

---

## 8. Learn & iterate (dashboard)

### `GET /api/insights`
Conversion factors ("what's converting"), the suggested refinement copy, and the channel
recommendation.
- **Service:** `getDashboardInsights()`  **Consumed by:** `DashboardScreen`
- **200:** `DashboardInsights`

### `POST /api/insights/refinement/apply`
Apply the suggested scoring refinement to future runs.
- **Service:** `applyRefinement()`  **Consumed by:** `DashboardScreen`
- **200:** `{ "applied": true }`

---

## 9. Auth (sign-in)

The prototype's sign-in is a stub (email regex + simulated delay). For production:

### `POST /api/auth/email`
- **Body:** `{ "email": string }`  **200:** `{ "challenge": "magic-link"|"otp" }` (or session)

### `GET /api/auth/google` / `POST /api/auth/google/callback`
OAuth handshake for "Continue with Google".

### `GET /api/settings/keys` · `PUT /api/settings/keys`
Bring-your-own model keys (Settings screen). Store encrypted, per workspace; never return
the raw key — return a masked suffix only.

---

## 10. Business intake — the structured answer bank

The questions whose answers compose the CAG. Stored in Supabase (`intake_answer`, keyed by
question). On save, the `intake-bank` function pings the n8n **Context Builder** webhook,
which recomposes the CAG from the answers and writes `cag_context`.

### `GET /intake-bank`
- **Service:** `getIntakeBank()`  **Consumed by:** `Business intake` screen
- **200:** `{ "answers": { "[key]": string }, "updatedAt": string | null }`

### `PUT /intake-bank`
Upsert answers; triggers a CAG recompose. Takes effect on the next discovery run.
- **Service:** `saveIntakeBank(answers)`  **Consumed by:** `Business intake` screen
- **Body:** `{ "answers": { "[key]": string } }`
- **200:** `{ "answers": { "[key]": string }, "updatedAt": string }`

---

## 11. Business context — the editable CAG block

The live business brief the outreach pipeline reads on every run to score publishers and
draft emails. Stored in Supabase (`cag_context`); the n8n v10 workflow reads it via the
`Get Drafted IDs` query and injects it in the `Apply CAG from DB` node. The block is
**composed** by the Context Builder from the intake bank (§10) — it is generated, not
hand-authored, though it remains directly editable here as an override.

### `GET /context`
- **Service:** `getContext()`  **Consumed by:** `Business context` screen
- **200:** `{ "cagBlock": string, "updatedAt": string | null }`

### `PUT /context`
Replace the context block. Takes effect on the next discovery run.
- **Service:** `saveContext(cagBlock)`  **Consumed by:** `Business context` screen
- **Body:** `{ "cagBlock": string }`  (rejected `422` if empty/blank)
- **200:** `{ "cagBlock": string, "updatedAt": string }`

---

## Endpoint → screen matrix

| Endpoint | Screen(s) |
|---|---|
| `GET /tenant` | Sidebar, TopBar |
| `GET/POST/DELETE /sources` | Context drop, Sources |
| `GET/PUT /intake` | Guided intake |
| `GET/PATCH /venues` | Venue map |
| `GET/PUT /understanding` | Gate A |
| `POST /discovery/run`, `GET /discovery/:id` | Gate A, Discovery, Dashboard |
| `GET /leads`, `PATCH /leads/:id` | Gate B |
| `POST /leads/export`, `POST /crm/sync` | Gate B |
| `GET /outreach`, `POST /outreach/:id/{approve,skip}` | Prospect tracking, TopBar |
| `GET /insights`, `POST /insights/refinement/apply` | Dashboard |
| `POST /auth/*`, `GET/PUT /settings/keys` | Sign in, Settings |

## Realtime (recommended)

Two flows are inherently long-running and benefit from push over poll:
1. **Discovery** — progress `0–100` + completion (`SSE /discovery/:jobId/stream` or WS).
2. **Outreach outcomes** — inbound replies move prospects across the board (WS channel
   per workspace, or poll `GET /outreach` on an interval).
