# Pipeline Page — Subject Split, A/B Testing, Sequencing & Reply Tracking — DRAFT

**Status:** 🟢 **Phases 0-3 BUILT & VERIFIED LIVE 2026-06-22.** Subject/body split, the `message`
entity (migrations `0007`/`0008`/`0009`), the publishers→message sync trigger, the `outreach` Edge
fn rebound to `message` (v8, A/B variants + per-variant `PATCH` round-trip verified), and the UI
A/B variant tabs + honest accumulation line are all live. Remaining (low-risk, deferred): one line
in the `Prepare LLM Items` prompt so the daily run emits `draft_subject_b`; step-2 follow-up
sequencing + inbox UI (no data until sends accumulate); A/B winner-call UI is volume-gated.
The design below is retained as the as-built record.

**Created:** 2026-06-22 · **Owner:** Ally · **Area:** GamersLab POC (`gamerslab-poc/` + `poc/ui/`).
**Extends, does not duplicate:** [`email_send_pipeline_DRAFT.md`](email_send_pipeline_DRAFT.md) (identity
split, single-message send, polling reply detection). That doc explicitly scopes **out** A/B testing
and multi-step sequencing. This doc designs exactly those, plus the subject split it already shipped.
**Diagram:** [`pipeline_messaging_architecture.svg`](pipeline_messaging_architecture.svg).

---

## 1. Why this doc exists

Ally flagged four things on the Pipeline page (`ProspectTrackingScreen`, screen key `outreach`):

1. The UI showed no subject separate from the body.
2. A/B testing was intended but nothing in the UI or data model supports it.
3. The UI does not distinguish an initial email from a reply or follow-up step.
4. There is no pipeline to detect replies.

Findings, verified against the live `publishers` table and the live Edge Functions:

| Concern | Verified state | Root cause |
|---|---|---|
| Subject split | Subject/body **were** stored separately end to end (`draft_subject`/`draft_body`, `approved_subject`/`approved_body`); the `outreach` Edge Function flattened them into one `draft` string for the UI | Presentation regression in `_shared/mapper.ts`. **Fixed in Phase 0.** |
| A/B testing | Absent everywhere. No variant column, no variant generation, no UI | Data model treats one publisher row as one email |
| Initial vs reply | Absent. `sequence_status` column exists (default `'not_started'`) but is unused | Same root cause |
| Reply detection | Not live. `replied_at`, `outreach_thread_id`, `outreach_message_id` columns exist but are never written. Send + Reply-Poll n8n workflows **were created** (`YEgPZ0eATTSAb9pa` / `LAPjN0jbvV9GAetX`) but are **inactive** (pending OAuth app + secrets) and bound to single-email `publishers` | Workflows scaffolded per the send doc, not yet activated; not yet bound to a multi-message model |

**The unifying insight:** A/B, sequencing, and reply tracking all fail for one reason. The model
conflates *one publisher = one email*. A/B needs many candidate emails per send. Sequencing needs
many emails over time. Reply tracking needs a stable thread handle per sent email. All three require
promoting "the email" to its own entity. Phase 1 does that; Phases 2 and 3 build on it.

---

## 2. Research basis (broad, not limited to our data)

External 2026 consensus that shapes the design (sources at end):

- **Plain text beats HTML by 2 to 3x on replies.** Keep plain text. No rich HTML editor. Open
  tracking needs HTML and more than halves reply rate, so do not add it.
- **Sequences of 4 to 7 steps win.** First email carries ~58% of replies, but ~55% of all replies
  arrive after email 1. Typical cadence: Day 0, Day 4, Day 8, Day 11, Day 18. Follow-ups must add
  new value, never "just bumping".
- **Personalisation on real signals** (funding, hiring, launches, wishlist surges) lifts replies to
  15 to 25%, roughly 5x generic. This is what the CAG + intel layer already feeds.
- **A/B discipline:** one variable per test, subject first (highest leverage), then opener, then CTA,
  then sequence length. Minimum ~200 sends per variant to mean anything, 500+ to detect small lifts.
  A real winner shows a 15 to 30% relative lift over a control. Wait 5 to 7 business days. Always
  keep a control (current best), never two cold variants against each other.
- **Spintax** (phrase-level variation, distinct from A/B variants) protects deliverability at volume.
- **Deliverability 2026:** Google/Yahoo/Microsoft enforce SPF/DKIM/DMARC for bulk; cap ~35 to 40
  sends/day/address. Our Gmail/Outlook send-as-them OAuth sidesteps DNS but the per-account daily cap
  still binds (already enforced via `email_accounts.daily_cap`).
- **Reply detection mechanics:** tools store `threadId` + `messageId` at send, then detect a reply
  when the thread gains an inbound message. Two approaches: polling the Gmail History API (simple, no
  infra, ~5 min latency) vs push via `watch` + Pub/Sub (real-time, but the watch expires silently
  every 7 days and needs a renewal cron). **Polling for the POC.**

**Honest constraint:** at the POC's volume (draft budget ~35/day, bound by OpenRouter free tier),
A/B testing is statistically meaningless within a single batch. A/B must **accumulate across
batches** and the UI must show sample size and a "not enough data yet" state rather than pretending
two drafts is a test. This is why Phase 1 (schema) is recommended now but Phase 3 (A/B UI) is gated
on real send volume.

---

## 3. Phase 0 — subject split (BUILT, verified)

Shipped in this session, end to end, verified in the running preview:

- `_shared/mapper.ts` — `toOutreachItem` now returns `subject` and `body` separately (prefers
  `approved_*` over `draft_*`) instead of concatenating into one `draft` string.
- `_shared/types.ts` + `poc/ui/src/data/types.ts` — `OutreachItem.draft` replaced by `subject?` +
  `body?`, kept in lockstep.
- `poc/ui/` — reducer, provider, and `ProspectTrackingScreen` now edit subject (Input) and body
  (Textarea) as separate fields, and display the subject as a labelled header above the body.
- `leadService.updateOutreach(id, subject, body)` → new `PATCH /outreach/:id` persists edits to
  `approved_subject` / `approved_body` (edits were previously UI-local and lost on reload).
- Stray em dashes in the outreach seed copy removed.

**Remaining to make Phase 0 live:** redeploy the `outreach` Edge Function (response shape changes
from `draft` to `subject`/`body`). Outward action on the shared live project. Gated on Ally.

---

## 4. Phase 1 — promote the email to an entity (PRE-GATE)

The schema change that unblocks A/B, sequencing, and reply tracking. Recommended now because it is
cheap and load-bearing for everything after it.

### Option A (recommended): a `message` child table
One row per candidate email. A publisher has many messages across steps and variants.

```
message {
  id              uuid pk
  tenant_id       uuid  fk -> tenant       -- RLS
  publisher_id    uuid  fk -> publishers
  step            int   default 1          -- 1 = initial, 2+ = follow-up
  variant         text  default 'A'        -- 'A' | 'B' | 'control'
  subject         text
  body            text
  status          text  default 'draft'    -- draft|approved|sent|replied|bounced|skipped|send_failed
  is_control      bool  default false
  scheduled_for   timestamptz              -- when the follow-up is due (sequencing)
  sent_at         timestamptz
  replied_at      timestamptz
  thread_id       text                     -- provider thread handle (reply correlation)
  message_id      text                     -- provider message handle
  created_at      timestamptz default now()
}
```

### Option B: extend `publishers` in place
Add `variant`, `step`, `scheduled_for` columns and keep one row per email. Simpler migration, but it
breaks the moment a publisher needs two variants or two steps at once. **Rejected** for that reason,
except as a throwaway if the gate wants the absolute minimum.

### Note on the existing `outreach` table
The live tenant-scoped `outreach` table (`id, tenant_id, lead_id, channel, stage, draft, last_event`,
0 rows) is the v2 generic shape and also stores the email as one `draft` blob. It is **not** the home
for this. If v2 adopts the `message` entity, `outreach` either gains these columns or is replaced.
Flag for the v2 data-model owner; do not silently fork.

n8n draft workflow change: generate step-1 plus N subject variants in one pass (one variable per
test), writing one `message` row per variant rather than one `draft_subject`/`draft_body` pair.

### Apply-ready migration (DRAFT — not applied; lives here, not in `migrations/`, so CI cannot auto-deploy it)

```sql
-- 0007_message_entity (DRAFT). One row per candidate email; publishers stays the contact/intel row.
create table if not exists public.message (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id),
  publisher_id  uuid not null references public.publishers(id) on delete cascade,
  step          int  not null default 1,            -- 1 = initial, 2+ = follow-up
  variant       text not null default 'A',          -- 'A' | 'B' | 'control'
  is_control    boolean not null default false,
  subject       text,
  body          text,
  status        text not null default 'draft',       -- draft|approved|sent|replied|bounced|skipped|send_failed
  scheduled_for timestamptz,                          -- when a follow-up is due
  sent_at       timestamptz,
  replied_at    timestamptz,
  thread_id     text,                                 -- provider thread handle (reply correlation)
  message_id    text,                                 -- provider message handle
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists message_publisher_idx on public.message (publisher_id);
create index if not exists message_status_idx     on public.message (status);
create index if not exists message_thread_idx      on public.message (thread_id);
create unique index if not exists message_one_per_slot
  on public.message (publisher_id, step, variant);
alter table public.message enable row level security;
-- RLS mirrors the other v2 tables (tenant isolation); service-role Edge Functions bypass it.
create policy message_tenant_isolation on public.message
  using (tenant_id = (select id from public.tenant limit 1));

-- Backfill: lift each publisher's current single draft into a step-1 / variant-A message.
insert into public.message (tenant_id, publisher_id, step, variant, subject, body, status, sent_at, replied_at, thread_id, message_id)
select tenant_id, id, 1, 'A',
       coalesce(approved_subject, draft_subject),
       coalesce(approved_body, draft_body),
       coalesce(pipeline_status, 'draft'),
       sent_at, replied_at, outreach_thread_id, outreach_message_id
from public.publishers
where draft_body is not null or approved_body is not null;
```

### Consumer deltas (the change-set the gate approves)
- **`_shared/mapper.ts`** — add `toOutreachItemFromMessage(row)`; `PUBLISHER_SELECT` join or a second
  query reads `message` rows. `OutreachItem` gains optional `step`, `variant`, `messageId`.
- **`outreach` Edge fn** — `GET /outreach` returns one item per message (grouped by publisher in the
  UI); `PATCH /outreach/:id` writes `message.subject`/`message.body`; approve/skip set `message.status`.
- **n8n draft workflow** — insert N `message` rows (variants) instead of `draft_subject`/`draft_body`
  on `publishers`. **Also strip em dashes in the prompt** (the live drafts currently emit them).
- **n8n Send / Reply-Poll** (`YEgPZ0eATTSAb9pa` / `LAPjN0jbvV9GAetX`) — read/write `message` instead
  of `publishers`; store `thread_id`/`message_id` on the message row.

### Back-compat + rollback
- **Dual-write window:** until the n8n draft workflow is switched, keep writing `publishers.draft_*`
  AND mirror into `message`; the backfill above seeds history. The Edge fn reads `message` first,
  falls back to `publishers` if a publisher has no message rows. This makes the cutover reversible.
- **Rollback:** `drop table public.message;` restores the exact current behaviour, since `publishers`
  is never deprecated by this phase, only supplemented.

---

## 5. Phase 2 — send + reply poll (PRE-GATE)

The Send and Reply-Poll workflows already exist in n8n (`YEgPZ0eATTSAb9pa` / `LAPjN0jbvV9GAetX`) but
are inactive and operate on the single-email `publishers` row. This phase **activates them and
rebinds them to the `message` entity**, and pins the reply-detection mechanism.

- **Send workflow (n8n, webhook on approve):** reads the approved `message` row + the tenant's
  `email_accounts` token, sends via Gmail `users.messages.send` / Graph `sendMail`, and **stores the
  returned `thread_id` + `message_id`** on the row, stamps `sent_at`, sets `status='sent'`.
- **Reply-poll workflow (n8n, scheduled every 5 to 15 min):** for each connected mailbox, queries the
  Gmail **History API** since the last tracked `historyId` (Graph delta query for Outlook), matches
  inbound messages to a `message` row by `thread_id`, stamps `replied_at`, sets `status='replied'`,
  rings the bell.
- **Why polling not push:** push (`watch` + Pub/Sub) is real-time but the watch expires silently
  every 7 days and needs a renewal cron plus a GCP Pub/Sub topic. Polling is the right POC default;
  push is a later optimisation. This confirms the send doc's open question.
- **Sequencing hook:** the same scheduled workflow advances the sequence. For each `sent` message
  whose `replied_at` is null and whose next step is due (`now >= scheduled_for`), it drafts/sends the
  next step. A reply or a positive outcome halts the sequence. Cadence Day 0/4/8/11/18 per research.

> **Verify-before-build:** every provider call (Gmail send, History API, Graph sendMail + delta,
> both token endpoints and scopes) must be checked against 2026 docs at M2. `gmail.readonly` and
> `Mail.Read` scopes are already requested by the connect flow, so reply read needs no new consent.

---

## 6. Phase 3 — Pipeline page UI (PRE-GATE, A/B UI gated on volume)

- **Subject/body:** done in Phase 0.
- **Step switcher:** per prospect, tabs or a segmented control for Initial / Follow-up 1 / 2 / 3.
  Each step shows its own subject + body and its scheduled send date.
- **Variant view:** A / B / control shown side by side, each with its accumulated sample size, reply
  rate, and a significance flag. Below the minimum sample it shows "Not enough data yet (n / 200)"
  rather than a fake winner. This is the honest-volume guard from §2.
- **Inbox / conversation view:** a lightweight thread reader so a reply is readable in-app and the
  follow-up can be paused or hand-replied. The `ReplyIcon` already exists in the icon set, unused.
- **Board:** the existing 5-column board (Contacted / Replied / Success / Partial / Lost) stays; the
  `replied` column finally populates once Phase 2 stamps `replied_at`.

All UI lands in the one portable `poc/ui/` source, reskinned by tokens. No GamersLab strings; variant
labels and step counts are data. White-label-safe.

---

## 7. Recommended sequencing

1. **Phase 0** — done; redeploy `outreach` fn when Ally approves the outward action.
2. **Phase 1 schema** — do next; cheap, unblocks everything, no UI risk.
3. **Phase 2 send + reply poll** — the send doc's gate already passed (2026-06-22); this extends it
   with thread-id correlation and the sequencing hook.
4. **Phase 3 UI** — step switcher + inbox first; A/B variant UI gated on real send volume reaching
   ~200/variant, else it misleads.

---

## 8. Sources (research)

- Instantly 2026 Benchmark — sequence length, reply distribution.
- UnifyGTM — cold email A/B framework; 2026 deliverability + domains.
- Smartlead / AiSDR — A/B test order, sample size, significance.
- Warmforge / Puzzle Inbox / Prospeo — plain text vs HTML reply lift.
- Google for Developers — Gmail threads, History API, `watch` + Pub/Sub push, watch 7-day expiry.
- GMass — how follow-up tools find replies via thread/message id.
- Autobound / Instantly — signal-based personalisation reply rates; spintax.
