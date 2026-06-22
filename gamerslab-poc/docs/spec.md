# GamersLab — Publisher Outreach Automation Pipeline
**Version 1.0 · May 2026**

> Specification for a gold-class outreach pipeline to find, research, score, and contact Steam publishers on behalf of GamersLab. The goal is not volume — it is precision. Every outreach should feel like it was written by someone who spent an hour on the publisher before sending.

> **Status note (as-built):** This is the original aspirational design spec. The **built**
> pipeline is **v9** — see `README.md` and `docs/requirements.md` for what actually ships.
> Notably, the build implements stages through **human review** and deliberately **does not send**
> (Stage 07 "Automated send and tracking" below is future scope). Use this doc for design intent;
> use the README/requirements for the current implementation.

---

## Contents

1. [Pipeline overview](#1-pipeline-overview)
2. [Stage 01 — Steam discovery](#2-stage-01--steam-discovery)
3. [Stage 02 — Contact mining](#3-stage-02--contact-mining)
4. [Stage 03 — Gold intel harvest](#4-stage-03--gold-intel-harvest)
5. [Stage 04 — Relevance scoring](#5-stage-04--relevance-scoring)
6. [Stage 05 — Message generation](#6-stage-05--message-generation)
7. [Stage 06 — Human-in-loop review](#7-stage-06--human-in-loop-review)
8. [Stage 07 — Automated send and tracking](#8-stage-07--automated-send-and-tracking)
9. [Core data object schema](#9-core-data-object-schema)
10. [Self-learning and supercharge points](#10-self-learning-and-supercharge-points)
11. [Tooling stacks — base vs supercharged](#11-tooling-stacks--base-vs-supercharged)
12. [Creative differentiation principles](#12-creative-differentiation-principles)

---

## 1. Pipeline overview

```
Steam Discovery → Contact Mining → Gold Intel Harvest → Relevance Scoring
→ Message Generation → Human Review → Automated Send + Track → Feedback Loop
```

Each publisher passes through stages sequentially. Score gates at Stage 04 prevent low-fit records from consuming message-generation budget. Human review at Stage 06 prevents anything unvetted from being sent. The feedback loop at Stage 07 closes back into Stage 04 to improve scoring accuracy over time.

The pipeline runs on a nightly batch schedule (GitHub Actions or n8n cron) for discovery and enrichment. Message generation and review are event-driven — a new enriched record triggers generation, which triggers a review notification.

---

## 2. Stage 01 — Steam discovery

### Goal

Produce a list of publishers with active games on Steam, filtered and ranked by freshness and relevance signals.

### Data sources

- **ISteamApps** (`api.steampowered.com/ISteamApps/GetAppList/v2/`) — full game catalogue, no auth required
- **SteamSpy** (`steamspy.com/api.php?request=appdetails&appid=N`) — per-app publisher, genre tags, player counts, estimated revenue band, review score
- **SteamDB** — recent release dates, historical pricing, DLC activity signals

### Process

1. Pull full app list from ISteamApps (cached daily, ~140k records).
2. Filter: `type=game`, `release_date` within last 18 months (freshness signal).
3. Enrich with SteamSpy per-app data (batch, rate-limited to 1 req/sec).
4. Group by `publisher` field — one publisher record, many associated games.
5. Rank publishers by: recency of latest release, estimated revenue band, review score average across catalogue.
6. Deduplicate against previously contacted records (check Postgres `publisher_contacts` table).

### Output per record

| Field | Source |
|---|---|
| `steam_app_id` | ISteamApps |
| `game_name` | ISteamApps |
| `publisher_name` | SteamSpy |
| `primary_genre` | SteamSpy tags |
| `review_score` | SteamSpy |
| `estimated_revenue_band` | SteamSpy |
| `release_date` | SteamSpy |
| `player_count_peak` | SteamSpy |
| `publisher_website` | Steam store page scrape |

---

## 3. Stage 02 — Contact mining

### Goal

Find a verified or high-confidence email address for a decision-maker at each publisher. Do not send to generic info@ addresses.

### Source priority (attempt in order, stop at first verified hit)

1. **Steam store page** — scrape the publisher's linked website URL from the app page
2. **Publisher website** — scan for contact page, press page, or team page with named individuals
3. **WHOIS on publisher domain** — registrant email, especially useful for indie studios that used their personal email to register
4. **Hunter.io API** — domain → verified email addresses (`api.hunter.io/v2/domain-search?domain=X`)
5. **Apollo.io API** — domain → enriched contact records including LinkedIn profiles
6. **Proxycurl (LinkedIn scraper)** — company page → founder/CEO/head of BD
7. **Twitter/X search** — `"[publisher name] founder"` or check linked accounts on their Steam page
8. **itch.io publisher page** — many indie publishers list a direct contact here
9. **presskit() / dopresskit.com pages** — standard press kit format, often includes a direct email

### Contact confidence tiers

| Tier | Definition | Action |
|---|---|---|
| `verified` | Hunter.io/Apollo confirmed deliverable | Proceed to scoring |
| `inferred` | Found via scraping, not deliverability-checked | Proceed to scoring, flag for human check |
| `domain_only` | Only `contact@domain` or `info@domain` found | Hold for human review, do not auto-send |
| `not_found` | No contact found after all sources exhausted | Archive, retry in 30 days |

### Output per record

| Field | Value |
|---|---|
| `contact_email` | Best email found |
| `contact_name` | Named individual if found |
| `contact_role` | Founder / CEO / BD / unknown |
| `contact_confidence` | verified / inferred / domain_only / not_found |
| `contact_source` | Which source yielded the contact |
| `linkedin_url` | If found |
| `twitter_handle` | If found |

---

## 4. Stage 03 — Gold intel harvest

### Goal

Find at least one unique, specific, first-party signal about this publisher that cannot appear in generic outreach. A founder quote, a recent announcement, a stated pain point, a player request. This is what separates the email from spam.

### Sources to mine

**Founder/team audio and video**
- YouTube: search `"[publisher name]" OR "[game name]"` — filter for interviews, GDC-style talks, postmortems
- GDC Vault: search by studio name — GDC talks are high signal, founders speak candidly about monetisation and distribution struggles
- Podcast search via Listen Notes API: `listennotes.com/api/v2/search/?q=[publisher]&type=episode`

**Written content**
- Publisher's own dev diary / blog (often on Steam or their site) — latest post, summarised
- Medium or Substack if they have one
- Game Jolt or itch.io dev logs

**Social content (last 60 days)**
- Twitter/X: recent posts via Nitter mirror or Twitter API v2
- LinkedIn: recent posts if accessible
- Reddit: search `r/gamedev`, `r/indiegaming`, `r/[game name]` for publisher participation

**Player signals (proxy for publisher pain)**
- Top-rated Steam reviews for their game — what are players asking for?
- Negative reviews at 3-star range — these are the most useful, they're from players who like the game but are frustrated by something specific
- Steam discussions / forum posts from the publisher themselves

### Processing

For video sources: download transcript via `yt-dlp --write-auto-sub`, chunk at 500 tokens, embed into vector DB (Qdrant) per publisher namespace, retrieve top-3 chunks at message generation time.

For text sources: scrape, summarise with LLM call (haiku-class model, cheap), store summary + source URL.

### Intel object schema

```json
{
  "publisher_id": "...",
  "founder_quote": "exact verbatim quote if found, otherwise null",
  "quote_source_url": "url to source",
  "quote_source_type": "video | blog | podcast | social",
  "current_pain_signal": "one sentence describing an inferred pain point",
  "pain_signal_evidence": "the raw text or paraphrase that led to this inference",
  "recent_announcement": "any announcement in last 90 days",
  "game_phase": "pre-launch | just-launched | growth | mature | sunset",
  "team_size_signal": "solo | micro (2-5) | small (6-15) | mid (16-50) | unknown",
  "player_ask": "top player request from reviews that maps to a GamersLab capability",
  "relevant_hook": "one sentence connecting this publisher's situation to GamersLab — LLM-generated"
}
```

The `relevant_hook` is generated by an LLM call: *"Given GamersLab's value proposition [X], and this publisher's signals [summary of intel object], write exactly one sentence that would open a cold email and feel specific to this publisher. Do not use their game name as the only hook. Reference a real signal."*

### Intel quality rating

| Rating | Criteria |
|---|---|
| `gold` | Founder quote found with source URL |
| `silver` | Pain signal with evidence, no direct quote |
| `bronze` | Only player signals or general genre inference |
| `no_signal` | Nothing found — hold record, do not generate message |

Records with `no_signal` are held and retried weekly for up to 4 weeks. If still no signal after 4 retries, archive.

---

## 5. Stage 04 — Relevance scoring

### Goal

Score each publisher 0–100 on fit to GamersLab. Only records scoring ≥60 advance to message generation.

### Scoring axes

| Axis | Weight | Signals used |
|---|---|---|
| Genre fit | 25% | Does GamersLab serve this genre? Check against known target genre list. |
| Stage fit | 25% | Game phase — `just-launched` and `growth` score highest, `sunset` scores 0 |
| Team size fit | 20% | Small enough to benefit, big enough to act. `micro` and `small` score highest. |
| Pain alignment | 20% | Does intel object pain signal map to a GamersLab capability? LLM-judged. |
| Contact quality | 10% | `verified` = 10 pts, `inferred` = 7, `domain_only` = 3, `not_found` = 0 |

### Score gate behaviour

| Score band | Action |
|---|---|
| 80–100 | Advance immediately, flag as `priority` |
| 60–79 | Advance to message generation |
| 40–59 | Enter `warm_queue` — slower 30-day sequence, different template |
| 0–39 | Archive with reason code |

### LLM scoring prompt structure

The prompt receives the full publisher profile + intel object + GamersLab value prop brief (static context, CAG pattern). It returns structured JSON:

```json
{
  "total_score": 74,
  "genre_score": 20,
  "stage_score": 22,
  "team_size_score": 14,
  "pain_alignment_score": 13,
  "contact_score": 5,
  "scoring_rationale": "one sentence per axis",
  "recommended_action": "advance | warm_queue | archive"
}
```

---

## 6. Stage 05 — Message generation

### Goal

Generate a personalised cold email that opens with the publisher's own signal, names their specific game, makes one concrete GamersLab claim, and ends with a single question as the CTA.

### Hard constraints baked into the generation prompt

- Body: 100–130 words maximum
- Subject line: must include the game name and a specific number or claim
- Opening line: must reference `founder_quote`, `recent_announcement`, or `player_ask` from intel object — never a generic opener
- Must name the specific game at least once
- Must make one GamersLab claim that maps directly to `current_pain_signal`
- Banned phrases: "I hope this email finds you well", "synergies", "circle back", "touch base", "at scale", "game-changing", "seamless"
- CTA: one question only, no link in the body
- Deck link: goes in a PS line after the signature — not in the body

### Subject line formula

`[Game name] + [specific metric or claim]` — specificity lifts open rates.

Examples:
- "Hollow Knight — one UA channel your size is missing"
- "Celeste's retention curve: what we'd add at month 3"
- "Stardew-style studios averaging 23% more wishlists with this"

### Email structure

```
Subject: [formula above]

[Opening line — publisher's own signal, 1 sentence]
[Bridge — what GamersLab does, tied to their pain signal, 1–2 sentences]
[Social proof — peer publisher in same genre already on platform, 1 sentence]
[CTA — single question, not a statement]

[Signature]

PS — [deck link + one-line description of what's in it]
```

### Context window (CAG pattern)

Every generation call includes the following as static system context:
- GamersLab value proposition brief (1–2 paragraphs)
- List of existing publisher case studies / outcomes (as few-shot anchors)
- List of banned phrases and structural constraints
- The full intel object for this publisher

The deck and pitch materials do not go in the prompt body — they are referenced only by link in the PS.

---

## 7. Stage 06 — Human-in-loop review

### Goal

A human approver spends 60–90 seconds per record: reviewing the draft, verifying the contact, and approving or editing before anything is sent.

### Review board setup (Airtable)

Kanban view with columns: `Pending Review → Approved → Sent → Replied → Converted → Archived`

Each record card shows:
- Publisher name + game name + Steam link
- Intel summary (3–4 bullet points from intel object)
- Fit score with per-axis breakdown
- Contact name, email, confidence tier
- Draft email (editable inline in the record)
- Intel quality rating (`gold` / `silver` / `bronze`)
- One-click: **Approve**, **Edit + Approve**, **Reject**

Approving triggers a webhook to n8n, which pushes the record to the send queue with a timestamp.

Rejecting prompts a single-field reason code (wrong_fit / bad_contact / wrong_tone / other) — this feeds the feedback loop.

### Fallback handling

If `contact_confidence = domain_only` and approver cannot find a better address, the record moves to a LinkedIn outreach variant instead of email. A LinkedIn connection request draft is generated using the same intel object but a shorter (50-word) format.

---

## 8. Stage 07 — Automated send and tracking

### Goal

Send approved emails at safe volume, track engagement, route replies to humans, run follow-up sequences for non-replies.

### Sending configuration

- Tool: Instantly.ai or Lemlist (not raw SMTP)
- Sending domain: subdomain of main domain (e.g. `outreach.gamerslab.io`) — never the root domain
- Daily cap: 30 sends per sending domain per day during warm-up phase, scaling to 80/day after 30-day warm-up
- Send time: Tuesday–Thursday, 9–11am publisher's local timezone (infer from LinkedIn location or Steam store region)
- Avoid: Monday morning, Friday afternoon, local public holidays

### Follow-up sequence

| Day | Action |
|---|---|
| 0 | Initial email sent |
| 4 | Follow-up 1: one-line bump, no new content |
| 11 | Follow-up 2: short new angle — lead with player signal quote |
| 18 | Final follow-up: explicit close — "I'll leave it here, but happy to reconnect anytime" |

Sequence stops immediately on reply or out-of-office detection.

### Reply routing

Reply received → webhook fires → n8n flags record as `replied` in Airtable → Slack notification to human → human takes over within 24 hours.

Auto-reply / out-of-office detected → pause sequence for 7 days, then resume at next step.

Bounce → flag contact as `invalid`, retry contact mining for alternative address, re-queue if found.

### Tracking events stored per record

`sent_at`, `opened_at` (first open), `open_count`, `clicked_at`, `replied_at`, `bounced`, `unsubscribed`, `follow_up_1_sent_at`, `follow_up_2_sent_at`, `follow_up_3_sent_at`, `sequence_status`

---

## 9. Core data object schema

Every publisher in the pipeline is a single Postgres row in `publisher_outreach` with the following fields. Sub-objects (intel, scoring, message) are stored as JSONB columns.

```sql
CREATE TABLE publisher_outreach (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  -- Stage 01: Discovery
  steam_app_id          TEXT,
  game_name             TEXT NOT NULL,
  publisher_name        TEXT NOT NULL,
  primary_genre         TEXT,
  review_score          NUMERIC,
  revenue_band          TEXT,
  release_date          DATE,
  peak_players          INT,
  publisher_website     TEXT,

  -- Stage 02: Contact
  contact_email         TEXT,
  contact_name          TEXT,
  contact_role          TEXT,
  contact_confidence    TEXT CHECK (contact_confidence IN ('verified','inferred','domain_only','not_found')),
  contact_source        TEXT,
  linkedin_url          TEXT,
  twitter_handle        TEXT,

  -- Stage 03: Intel
  intel                 JSONB,   -- intel object schema from Stage 03
  intel_quality         TEXT CHECK (intel_quality IN ('gold','silver','bronze','no_signal')),
  intel_retry_count     INT DEFAULT 0,

  -- Stage 04: Scoring
  score                 INT,
  score_detail          JSONB,   -- per-axis scores + rationale
  score_band            TEXT CHECK (score_band IN ('priority','advance','warm_queue','archive')),

  -- Stage 05: Message
  draft_subject         TEXT,
  draft_body            TEXT,
  draft_version         INT DEFAULT 1,

  -- Stage 06: Review
  review_status         TEXT CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  reject_reason         TEXT,

  -- Stage 07: Send + Track
  sequence_status       TEXT,
  sent_at               TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ,
  open_count            INT DEFAULT 0,
  replied_at            TIMESTAMPTZ,
  bounced               BOOLEAN DEFAULT FALSE,
  unsubscribed          BOOLEAN DEFAULT FALSE,

  -- Pipeline state
  pipeline_stage        TEXT NOT NULL DEFAULT 'discovery',
  pipeline_status       TEXT NOT NULL DEFAULT 'active'
);
```

---

## 10. Self-learning and supercharge points

### Score model retraining

Store every outcome in the `publisher_outreach` table. Once 100+ records have `replied_at` or `sequence_status = exhausted`, extract features (genre, game_phase, intel_quality, score) and outcomes (replied = 1, no reply = 0). Fine-tune the scoring prompt using few-shot examples: top-10 replied records as positive examples, top-10 exhausted-no-reply as negative examples. Run this monthly.

### Subject line A/B testing

Instantly.ai and Lemlist both support subject line variants per campaign. Run three subject line formulas per batch of 90 sends. After 30 days, retire the lowest open-rate formula. The winner becomes the new default. Variants rotate every quarter.

### Draft edit tracking

Log every edit a human approver makes in Stage 06 (diff the draft vs the approved version). If approvers consistently change the same structural element — e.g. always rewriting the opening line — that is a prompt engineering signal. Feed accumulated edits as new few-shot examples into the generation prompt monthly.

### Intel quality → reply rate correlation

After 200+ records, analyse the relationship between `intel_quality` and reply rate. If `gold` records significantly outperform `bronze`, automatically deprioritise publishers where Stage 03 found no usable quote. Lower their score by a penalty and hold them for a second intel pass before generating a message.

### CAG (Cache-Augmented Generation)

The GamersLab pitch deck, value props, case studies, and existing publisher outcomes are static documents. Load them once into the system prompt / context window as static context on every LLM call. This is faster and more consistent than RAG retrieval for fixed reference documents. The static context window handles "what is GamersLab" — RAG handles "what did this specific publisher say in a 2024 GDC talk."

### RAG for publisher intel

Run Qdrant (self-hosted via Docker) as the vector store. Each publisher gets a namespace. Chunked transcripts, blog posts, and social content are embedded and stored at intel harvest time. At message generation, retrieve top-3 most relevant chunks by cosine similarity to the GamersLab value prop summary. Inject as context. This is more accurate than stuffing full documents into the prompt.

### Scoring drift detection

Track score distribution over time. If average scores are inflating (the LLM is getting more generous), recalibrate with a batch of known-negative records as anchors. If most scores cluster at 70–75, the scoring prompt lacks discrimination — add more differentiating examples at the extremes.

---

## 11. Tooling stacks — base vs supercharged

### Base stack — operational in one week

| Layer | Tool | Notes |
|---|---|---|
| Orchestration | n8n (self-hosted or cloud) | Visual workflow, HTTP nodes, Airtable + Postgres integrations built in |
| LLM calls | OpenRouter | Single API key, model-agnostic. Use `claude-sonnet-4-5` for scoring and generation; `claude-haiku-4-5` for cheap classification and summarisation |
| Steam data | SteamSpy API + ISteamApps | Free, no auth required |
| Contact enrichment | Hunter.io (free tier: 25/mo) | Domain → verified email |
| Review board | Airtable | Kanban view, webhook triggers, usable by non-technical approver |
| Sending | Instantly.ai | Warm-up handling, throttling, follow-up sequences, API |
| Data store | Supabase (Postgres, free tier) | Canonical record store, query by score and status |
| Vector store | None at base level | Skip until intel volume justifies it |

**Estimated monthly cost at base level:** ~$50–80 USD (n8n cloud or small VPS + Instantly starter + Hunter.io free tier)

### Supercharged stack

| Layer | Tool | Upgrade reason |
|---|---|---|
| Orchestration | n8n + GitHub Actions | GHA handles scheduled batch jobs (nightly Steam crawl); n8n handles event-driven flows. Split by concern. |
| Scraping / intel | Apify actors | Pre-built, maintained scrapers for YouTube, LinkedIn, SteamDB, Reddit. No browser automation to maintain. |
| Vector store | Qdrant (Docker, self-hosted) | Publisher intel chunks → semantic retrieval at generation time |
| LLM routing | LiteLLM proxy | Rate limit handling, cost tracking, model fallback (OpenAI → Anthropic → local), treat LLM calls as an internal API |
| Founder video intel | yt-dlp + Whisper via Modal.com | Pull GDC / YouTube transcripts on demand serverlessly, chunk into Qdrant |
| Score optimisation | DSPy + Weave (W&B) evals | Log every score + outcome, build an eval set, auto-tune scoring prompt |
| Review board | Notion + Zapier (or Linear) | If team already lives there, reduce context switching |
| Sending | Lemlist | More template flexibility, built-in LinkedIn outreach sequence option |
| Analytics | PostHog (self-hosted, free) | Funnel: contacted → opened → replied → called → joined. Cohort analysis by genre, intel quality, score band |
| Data store | Supabase + pgvector | Consolidate relational and vector storage in one system if Qdrant overhead is unwanted |

**Estimated monthly cost at supercharged level:** ~$200–400 USD depending on Apify actor usage and Modal.com GPU time for Whisper

---

## 12. Creative differentiation principles

These principles should be encoded into the message generation prompt and the intel harvest search logic — not just used as inspiration.

### The "I watched your talk" hook

If Stage 03 finds a GDC Vault appearance, YouTube interview, or podcast episode by the publisher founder, the email opens with a one-sentence reference to something specific from it. Publishers can tell immediately this is not scraped — no spam bot watches a 45-minute postmortem and quotes a specific moment. This creates immediate credibility and signals genuine research.

Implementation: store `quote_source_type = video`, include timestamp or topic reference in `founder_quote`.

### The "your players are asking for this" hook

Pull the top-rated 3-star Steam reviews for their game — the frustrated-but-still-recommend tier. These often contain specific feature requests. If any player request maps to a GamersLab capability, quote the player (anonymised) in the email. Third-party social proof from their own playerbase is harder to dismiss than claims about the platform.

Example: *"Three of your top reviews mention wanting cross-save support. That's something GamersLab publishers have shipped in under a week."*

### The "your peer is already here" signal

If GamersLab has any existing publishers, identify the one most similar in genre or size to the target. Name them in the email. Peer validation outperforms platform claims. Even one named example transforms the email from a pitch into a referral.

### The "one number" rule

Every email must contain exactly one specific number tied to an outcome. Not "publishers see growth" — "publishers in your genre averaged 23% more wishlists in the first 60 days." Invented numbers destroy trust permanently. Real numbers from a small sample, presented honestly, are more compelling than vague claims.

### Timing

Send on Tuesday or Wednesday, 9–11am publisher's local time. Infer timezone from LinkedIn location field or Steam store regional data. Avoid Monday morning (inbox chaos) and Friday afternoon (checked out). First and last weeks of the month are lower priority — studio heads are often in review cycles.

### Sequence design

Follow-up 1 (Day 4): one-line bump, no new content. The goal is a simple "did this land?" not a second pitch.

Follow-up 2 (Day 11): new angle — lead with a player signal quote or a recent development in their game (new DLC, review milestone). Signal that you are still paying attention.

Follow-up 3 (Day 18): explicit close. "I'll leave it here, but happy to reconnect when the timing is better." This performs better than silence — it gives the publisher a clean off-ramp and often generates a reply acknowledging the outreach even if they're not ready.

### What not to do

- Do not attach the deck to the email — put it in the PS as a link. Attachments trigger spam filters and reduce deliverability.
- Do not open with "I came across your game" — this is the most common opener in publisher cold outreach and signals no research.
- Do not use a no-reply sending address — make it easy to reply.
- Do not send more than one email per day to the same domain — it signals automation and gets flagged.
- Do not send to `info@` or `press@` addresses without a named individual to address — it reads as bulk mail and usually goes unread.

---

*Specification end. Next document: competitive research and inspiration landscape.*