# Integrations & API Surface — Lead Pipeline

Everything the UI touches, grouped by capability. For each: what it's for, the screen(s) that
need it, and the integration options. "Build" = your own service/endpoint; "3rd-party" = external
API you'd integrate.

---

## 1. Authentication & Identity
- **Purpose:** sign in, multi-tenant accounts, per-tenant theming.
- **Screens:** Sign in; whole app (tenant + user context).
- **Needs:**
  - Email auth + **Google OAuth** ("Continue with Google").
  - Multi-tenant model (tenant → users; tenant carries theme token-set + logo).
  - Session/JWT, RBAC (owner/member).
- **Options:** Auth0, Clerk, WorkOS (good for white-label + SSO), Supabase Auth, Firebase Auth.

## 2. File Upload & Storage
- **Purpose:** ingest the client's documents (PDFs, decks, docs).
- **Screens:** Context drop; Sources.
- **Needs:** direct-to-storage upload, virus scan, signed URLs, per-tenant isolation.
- **Options:** S3 / Cloudflare R2 / GCS (+ presigned uploads); Uppy/Tus for resumable client upload.

## 3. Document Parsing & Extraction
- **Purpose:** turn uploaded files into text/structured context.
- **Screens:** Context drop / Sources ("parsing → indexed" chip state).
- **Needs:** PDF/PPTX/DOCX → text + metadata; async job with status callback.
- **Options:** Unstructured.io, LlamaParse, AWS Textract, Google Document AI, Azure Document Intelligence.

## 4. Website & Social Ingestion
- **Purpose:** pull context from a URL and social handles.
- **Screens:** Context drop; Sources.
- **Needs:** web page fetch + readability extraction; social profile fetch.
- **Options:**
  - Web: Firecrawl, Diffbot, ScrapingBee, Browserless.
  - Social: official APIs (X/Twitter, LinkedIn, Instagram) — note strict ToS/rate limits; or Phantombuster / Apify actors.

## 5. Vector Store / Context Index (RAG)
- **Purpose:** store parsed context as embeddings so discovery + Gate-A summary can reason over it.
- **Screens:** powers Gate A summary, discovery scoring, learn & iterate.
- **Needs:** embeddings + similarity search, per-tenant namespaces.
- **Options:** Pinecone, Weaviate, Qdrant, pgvector (Postgres), Chroma. Embeddings via OpenAI, Cohere, or Voyage.

## 6. LLM / AI Reasoning (bring-your-own keys)
- **Purpose:** generate the Gate-A understanding, write match reasons, draft outreach, suggest refinements.
- **Screens:** Gate A (summary + confidence), Gate B (match reason, two-sided score rationale),
  Prospect tracking (outreach drafts), Dashboard (learn & iterate suggestions).
- **Needs:** chat/completion, structured output (JSON), function-calling; **BYO model keys** per tenant
  (Settings exposes this).
- **Options:** Anthropic Claude, OpenAI, Google Gemini, Azure OpenAI; an abstraction layer (LiteLLM,
  OpenRouter) if you want provider-agnostic BYO keys.
- ⚠️ The prototype simulates AI output with fixtures — no live model is wired. This is the biggest build.

## 7. Lead Discovery & Company Data
- **Purpose:** find prospects across the chosen venues; enrich them (size, location, funding, location).
- **Screens:** Venue map (which sources to search), Discovery loading, Gate B (leads + meta).
- **Needs:** search by ICP/keywords across venues; company/people enrichment; firmographics.
- **Options:**
  - Company/people enrichment: Clearbit, Apollo.io, People Data Labs, Crunchbase (funding), LinkedIn (via partner).
  - Web/news search: Bing/Brave/Google Programmable Search, SerpAPI, Exa, Tavily.
  - Domain-specific (the Gamers Lab example): SteamDB/Steam APIs, Reddit API, itch.io, event/showcase listings.
  - Investor data (Investors mode): Crunchbase, PitchBook, Tracxn.

## 8. Verification / Evidence Sourcing
- **Purpose:** the "Verified" badge + the per-lead **evidence dossier** (quotes + source link + date).
- **Screens:** Gate B (verified pill, dossier).
- **Needs:** capture supporting quotes with source URL + timestamp; cross-check a signal exists.
- **Options:** same search/enrichment APIs as #7, plus a citation/snippet store. Exa & Tavily return
  source-attributed snippets that map well to the dossier model.

## 9. Two-Sided Scoring Engine
- **Purpose:** compute **Value-to-you** × **Prospect-match** (and the composite 0–100).
- **Screens:** Gate B (score badge + two meters), sort/filter.
- **Needs:** scoring service combining ICP fit, enrichment signals, and learned weights (#11).
- **Options:** Build (rules + LLM scoring + the learned weights). No off-the-shelf product; this is core IP.

## 10. Outreach / Messaging & CRM
- **Purpose:** send approved messages (Gate C), track replies, "Send to CRM" / "Export approved".
- **Screens:** Prospect tracking (Gate C, prospect board), Gate B footer (Export / Send to CRM).
- **Needs:** email send + reply tracking; warm-intro tracking; CRM sync; CSV export.
- **Options:**
  - Email send + sequencing: SendGrid, Postmark, Resend, or Instantly/Smartlead for cold sequencing.
  - Reply/open tracking: provider webhooks.
  - CRM: HubSpot, Salesforce, Pipedrive, Attio (OAuth + object sync).
  - Calendar (the "Demo booked" state): Google Calendar / Calendly.

## 11. Learning / Analytics Loop
- **Purpose:** "What's converting" + "Suggested refinement"; re-weight scoring from outcomes.
- **Screens:** Dashboard → Learn & iterate.
- **Needs:** event capture (approvals, replies, outcomes), aggregation, a feedback loop into #9.
- **Options:** Build on your warehouse (Postgres/BigQuery/Snowflake); event capture via Segment/PostHog;
  the re-weighting is custom logic feeding the scoring engine.

## 12. Usage Metering & Billing
- **Purpose:** the **Usage meter** (credits/cost), bring-your-own-key cost transparency.
- **Screens:** sidebar usage meter, Settings.
- **Needs:** per-tenant usage counting (LLM tokens, discovery runs, enrichment calls), limits, billing.
- **Options:** Stripe (metered billing), Orb, Metronome, Lago.

## 13. Background Jobs & Realtime
- **Purpose:** discovery is long-running with live progress; parsing is async; outreach sends queue.
- **Screens:** Discovery loading (progress %), Sources (parsing), Prospect tracking.
- **Needs:** job queue + worker, status polling or push (the progress bar should reflect real job state).
- **Options:** Queue — Inngest, Temporal, BullMQ, Cloud Tasks. Realtime — WebSocket/SSE, Pusher, Ably,
  or Supabase Realtime.

## 14. Notifications
- **Purpose:** the top-bar **bell** (Gate-C approvals pending) + "X messages need approval".
- **Screens:** all shell screens (bell), Prospect tracking.
- **Needs:** in-app notification feed; optional email/Slack alerts for pending approvals.
- **Options:** Build (notifications table + realtime), Knock, Novu, Courier.

## 15. Theming / White-Label Config
- **Purpose:** per-tenant token set + logo (the portability requirement).
- **Screens:** all (Settings exposes theme).
- **Needs:** store the token sets + logo per tenant; serve at load; no layout changes on swap.
- **Options:** Build (config table → CSS variables / theme provider). No external API needed.

---

## Minimum data model (entities the UI reads/writes)
`Tenant` (theme tokens, logo, model keys) · `User` · `Source` (type, status) ·
`IntakeAnswers` · `Venue` (platform, strength, enabled) · `BusinessProfile` (Gate-A fields + confidence) ·
`Lead` (scores: value/match/composite, verified, reason, meta, venue) · `Evidence` (quote, sourceUrl, date) ·
`OutreachMessage` (channel, stage, draft, lastEvent) · `Run` (discovery job, status, counts) ·
`UsageRecord` · `Notification`.

## Endpoint sketch (see README "State Management" for shapes)
- `POST /sources` (upload/url/social) · `GET /sources` · `DELETE /sources/:id`
- `POST /intake` · `GET /venues` · `PATCH /venues/:id` · `POST /venues`
- `GET /profile` (Gate A) · `PATCH /profile/:field`
- `POST /runs` (start discovery) · `GET /runs/:id` (poll progress) · streaming/SSE for status
- `GET /leads?sort=&verifiedOnly=` · `GET /leads/:id/evidence` · `PATCH /leads/:id` (approve/reject)
- `POST /leads/export` · `POST /leads/crm-sync`
- `GET /outreach` · `PATCH /outreach/:id` (approve/skip/send) · webhook `POST /outreach/events` (replies)
- `GET /dashboard/insights` (learn & iterate) · `POST /scoring/refine`
- `GET /usage` · `GET/PUT /settings` (model keys, theme)
- `GET /notifications`

## What's NOT wired in the prototype (all data is fixtures)
Auth, uploads, parsing, discovery, enrichment, verification, scoring, LLM calls, outreach send,
CRM, billing, notifications — every one of the above is simulated with seed data and timers.
This list is the work to make it real.
