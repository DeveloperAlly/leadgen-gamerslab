# Ingestion — Future Features / Backlog (DRAFT)

Parked source types that need their own pipeline. Out of scope for the current build
(documents + websites). Captured so they're not lost.

## F1. Client-installed Discord bot (community ingestion)  ⭐ requested

**Idea:** instead of scraping (impossible — bots can't read servers from a link), the **client
adds our bot to their own server** and grants the Message-Content privileged intent. The bot then
reads their community to extract **pain signals, trigger events, voice, FAQ/objections, feature
requests** — high-value intelligence for the CAG/RAG.

**Why it's a separate pipeline:**
- Needs an always-on **gateway service** (a hosted bot process holding a Discord WebSocket), not a
  request/response Edge Function or a cron n8n run.
- **Per-server install flow** (OAuth2 invite + intent), and Discord **bot verification** once it's in
  >100 servers.
- Consent/privacy: reading community messages — store only what's needed, summarise, don't quote
  individuals without care.

**Shape:** Discord bot (hosted) → message stream → summarise/extract (LLM) → `source_extract` +
`intake_suggestion` (same INFORM/ADD model) + `document` chunks for RAG. Same downstream as docs.

## F2. X / Twitter via the client's own API key

X reading is **paid** (no free tier since Feb 2026) but **owned-account reads are ~$0.001**. So:
the **client connects their own X developer key**, and we read *their* posts → voice few-shots,
traction numbers, announcements/triggers. Cheap because it's their own account. BYO-credential, not
a platform cost to us.

## F3. LinkedIn via user-authenticated session

No clean/free path (API partner-only; scraping is ToS-barred and litigated). The only legitimate
route is **user-authenticated session** services (Unipile-style) that act on behalf of the logged-in
user — **paid**, future. Until then, LinkedIn is not a source.

---

**Pattern these share:** "client-connected sources" (BYO credential / installed bot) vs the current
"open sources" (documents, public websites). The ingestion data model (`source`, `source_extract`,
`intake_suggestion`, `document`) already supports them — only the *fetch* differs. Add as separate
fetch front-ends feeding the same pipeline.
