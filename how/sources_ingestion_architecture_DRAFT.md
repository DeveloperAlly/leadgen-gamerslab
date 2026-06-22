# Sources Ingestion Architecture — DRAFT (for gate, VERIFIED)

**What it is:** the infra that turns a client-added **source** (document / website) into structured
intelligence that **INFORMS the Intake form**, which feeds the **existing** Context Builder to compose
the CAG. RAG-ready. No new CAG logic — it reuses the n8n Context Builder already built
(`G5Mkf1KUmr6LHJdV`).

**The rule:** a source INFORMS the Intake answers — empty question **→ ADD**; already-answered
**→ SUGGEST** (client accepts/edits, never silently overwritten). The Intake form stays the
human-judged source of truth; only a client **Save** recomposes the CAG.

**Connects to what's already built:** ingestion writes `intake_answer` (ADD) / `intake_suggestion`
(INFORM), then pings the **same** `context-build` webhook the Intake page uses → Context Builder
composes `cag_context` → outreach v10 reads it. One CAG path, fed two ways (form + sources).

---

## 1. Verified components (against 2026 docs — proof, not claims)

| Concern | Decision | Verified |
|---|---|---|
| PDF / text / HTML extraction | **n8n `Extract from File`** (pdf/text/html ops) + `HTML Extract` | Native n8n nodes confirmed present. **NOT** a Supabase Edge Function — `unpdf`/PDF.js is documented as failing in Edge ("PDF.js is not available"). |
| Document upload | **Supabase signed upload URL** (`createSignedUploadUrl`): Edge fn issues URL → client uploads direct to Storage bucket `sources` | Confirmed current API; avoids piping bytes through the function. |
| RAG embeddings | **Supabase Edge native `gte-small`** (384-dim, no external API, ~free) | Confirmed: runs natively in Edge Runtime ≥ v1.36.0; "automatic embeddings" via DB webhook. |
| LLM extract → map | **OpenRouter free models** (as the outreach workflow uses) | Proven live in v10. Free for Ally. |
| Async engine | **n8n** (same instance, new "Source Ingestion" workflow) | webhook/postgres/code/httpRequest/extractFromFile all confirmed. |

---

## 2. Which socials we can actually ingest (verified 2026) — answer to "is there a way?"

| Network | Reality in 2026 | Decision |
|---|---|---|
| **X / Twitter** | No free tier for new devs since Feb 2026. Pay-per-use: ~$0.005/post read, $0.001 owned-account read. Reading is possible but **paid**. | **Keep, but behind the client's own X API key** (owned-account reads are cheap). Until connected, the handle is a stored **reference**, not ingested. Not built for the POC (no free path = violates "free for Ally"). |
| **LinkedIn** | Official API is partner-only (mostly your own profile). Third-party scraping is ToS-prohibited and litigated (Proxycurl sued → shut down 2025). No clean/free path. | **Remove** as an ingestion source. |
| **Discord** | Bot must be **invited** to a server + Message-Content privileged intent. Cannot read arbitrary public servers from a link. | **Remove** as a generic source. (Revisit later as a client-owned-server bot.) |

**Net:** the reliable, free ingestion sources are **documents + websites**. On the Sources page:
remove the generic "social handle" field; keep an **X (connect your key)** option as a reference for
later. LinkedIn/Discord come out. This is the honest set — no fields that pretend to ingest.

---

## 3. Data model

```
source (extend)   id, tenant_id, type(file|url|x_ref), label, storage_path, mime, bytes,
                  status(queued|processing|indexed|error|unsupported), error, indexed_at
source_extract    id, tenant_id, source_id, raw_text, char_count, model, extracted_json, created_at
document (pgvector) id, tenant_id, source_id, chunk_index, body, embedding     -- RAG
intake_suggestion id, tenant_id, question_key, suggested_answer, source_id,
                  confidence, quote, status(pending|accepted|dismissed)         -- the INFORM layer
intake_answer     (exists) the curated answers — the ADD target
cag_context       (exists) composed by the Context Builder
```

---

## 4. The flow (extraction in n8n; feeds intake → existing Context Builder)

```
 client adds source ─► sources fn: signed upload URL (doc) / insert row (queued) ─► ping ingestion webhook
                                                                                         │
 n8n "Source Ingestion" (webhook + scheduled sweep of queued, for safety)                ▼
   1. claim source → processing
   2. fetch:  document → download binary from Storage   |   website → HTTP GET
   3. extract: Extract from File (pdf/text)  |  HTML Extract (web)  → clean text
   4. chunk → document rows (RAG; embed later via gte-small)
   5. LLM map (OpenRouter free): "fill these intake questions {catalog} from this text;
        JSON keyed by question_key, ONLY where supported, each with confidence + quote"
   6. per key:  intake_answer EMPTY → write intake_answer (ADD)
                intake_answer FILLED → write intake_suggestion(pending) (INFORM)
   7. source_extract + status=indexed
   8. if any ADDs → POST the EXISTING context-build webhook → Context Builder recomposes cag_context
```

LLM guardrail: extract **only what the text supports**, with the quote + confidence (the evidence bar
from the intake design doc). No invented answers.

---

## 5. Sync API (Edge Functions)

- `sources` — `POST` (doc → return signed upload URL + create row; url → create row) / `GET` list+status / `DELETE`; pings ingestion. (No `extract` function — n8n extracts.)
- `intake-bank` — `GET` returns `{ answers, suggestions[] }`; `PUT` saves answers (recompose); `POST /accept {suggestion_id}` → copy into `intake_answer` + recompose; `POST /dismiss`.

---

## 6. UI

- **Sources** — real document upload (signed URL); website add; lifecycle pill (Queued → Processing → Indexed/Error); "contributed N answers". Social field reduced to **X (connect key)** reference; LinkedIn/Discord removed.
- **Intake** — empty fields **auto-filled**, tagged *"from `<source>`"*; answered fields with a pending suggestion show **"Suggested from `<source>`: …"** (+ quote) → **Accept / Dismiss**. Save → Context Builder (existing).

---

## 7. RAG-readiness

Same ingestion writes `document` chunks now; the RAG phase adds `gte-small` embeddings (pgvector ready,
on-platform, ~free) + retrieval at draft-time. CAG = curated hot context; RAG = cold corpus. Hybrid,
no re-architecture.

---

## 8. Build order (NOT started — gate first)

1. Schema: `source` (status/mime/bytes), `source_extract`, `intake_suggestion`.
2. `sources`: signed upload URL + status lifecycle.
3. n8n **Source Ingestion** (download → Extract from File → LLM map → ADD/SUGGEST → trigger Context Builder).
4. `intake-bank` suggestions + UI Accept/Dismiss chips.
5. UI: upload + status; Sources social field → X-only reference (remove LinkedIn/Discord).
6. RAG phase (later): `gte-small` embeddings into `document` + retrieval.
