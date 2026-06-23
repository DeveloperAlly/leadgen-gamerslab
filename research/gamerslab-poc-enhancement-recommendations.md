# Upgrading the GamersLab POC — for *intelligent personalised outreach generation*

> **Purpose this serves.** The POC is the first instance of a **context-grounded, evidence-backed
> outreach *generation* product** — human, catalogue-relevant, relationship-led (see
> `what/product_value_proposition.md`). It is **not** a mass-email sender. So these recommendations are
> about **making each generated email the one a sharp human BD researcher would write after doing the
> homework** — by feeding the generator better intelligence and giving it relationship memory.
>
> **Rule for this doc:** every item states **HOW it changes the generated email and why that converts.**
> No deliverability-ops busywork (that was the wrong playbook — corrected in
> `research/cold-outreach-gold-standard.md §9`). **Verified against the live v10 graph + schema on
> 2026-06-23** (`gamerslab-poc/ARCHITECTURE.md`, `SPEC.md`, `workflow/`). Free-tier only (doctrine #8).
>
> Priority: 🔴 build first · 🟠 high · 🟡 next · ✅ already strong (leave alone).

---

## 0. What's already strong — do NOT rebuild

- The **`Prepare LLM Items` CAG generation prompt** already encodes the copy evidence: ≤130 words, one
  stat, **interest-led CTA**, banned phrases, objection pre-dissolve, peer reference, no fabrication. It
  writes like a sharp human. **The problem is never how it writes — it's that it writes with almost
  nothing in front of it.** Every upgrade below feeds it better inputs.
- The **evidence rubric** (`evidence_strength`/`quote`/`sources`/`as_of` + `evidence_decay_weight`) and
  **risk-flags "flag-never-suppress"** are ahead of most commercial tools. Keep.

**The through-line:** give the generator the **homework a human would do** (reviews, timing, dossier,
exact peer match) and the **relationship memory a human would hold** (touch log, reply intent). That's the
entire return.

---

## 1. 🔴 Mine Steam reviews as demand signal — the standout, and uniquely yours

**Verified state:** `Get Steam App Details` / `Extract Steam Data` capture `review_score` and
`total_reviews` but **discard the review text.** The enrich Exa query hunts contacts, not demand.

**Engine change:** add a node hitting Steam's free `appreviews` endpoint for recent reviews; an
LLM/keyword pass extracts players explicitly asking for trackers / leaderboards / stats / companion apps;
write the strongest dated quote to `evidence_quote` with `evidence_strength = explicit`,
`evidence_as_of = review date`.

**HOW it changes the email:** the opener becomes the prospect's *own players' words* —
*"Two reviews on [game] this month ask for a way to track rivals between matches — Grudge Goblin does
exactly that, free."*

**Why it converts:** this is the highest-converting personalisation class (recent, specific, dated, about
*them*) **and it isn't a pitch** — you're reflecting their players' stated demand and handing them the
finished, free solution. It kills the two reasons publishers bin outreach: *"is this relevant to me?"*
(their reviews prove it) and *"this is a sales pitch"* (it's their players talking). It also fills the
`explicit` evidence tier the rubric usually can't. Free, undeniable, and impossible for a generic tool to
copy because it's specific to this product's value prop.

---

## 2. 🔴 A real "why-now" trigger stage — relevance × timing, the #1 lever

**Verified state:** `Pre-Score` ranks on static Steam attributes (pvp, workshop, reviews). `game_phase`,
`coming_soon`, `release_date` are computed but **not weighted as triggers**; there is no recency signal.

**Engine change:** promote phase/launch-window to primary scoring weight; add a node reading Steam's free
`GetNewsForApp` + review-velocity deltas between runs; emit a `why_now` field.

**HOW it changes the email:** a time-anchored first line —
*"Saw [game] hits 1.0 next month — perfect window to hand players a tournament page on day one."*

**Why it converts:** a launching / just-patched / surging studio is **in the decision window** for
community tooling (the CAG's own "strong fit" profile). The same message converts far better landing in
that moment than hitting a dormant studio, and it reads as hand-timed by someone paying attention — not a
blast. Trigger targeting is what separates 15–25% reply lists from 2–5% ones.

---

## 3. 🟠 Split enrichment: "find the address" vs "understand the human + the moment"

**Verified state:** one Exa query (`<studio> contact email founder press`) does both, optimised for
contact-hunting. Socials (`twitter_handle`/`linkedin_company_url`/`discord_url`) are captured and **never
read**.

**Engine change:** keep a cheap contact-find pass; add a **research-dossier** pass that mines recent
reviews (#1), recent news (#2), and a couple of the developer's actual recent social posts (from the
handles already captured). Assemble a dossier the generator drafts from.

**HOW it changes the email:** a genuine specific detail no template could fake — a line from their devlog,
a roadmap promise, the founder's own phrasing mirrored back.

**Why it converts:** "one genuinely specific detail beats many generic ones by **+34%**"; job-title-only
personalisation *lowers* replies. The dossier **is** the "human" promise of the product — it's what lets
the generator write something only a person who did the homework could write. That proof-of-research is
the trust signal that earns the reply. Same Exa budget, re-pointed from contacts to understanding.

---

## 4. 🟠 Deterministic catalogue/peer matcher — guarantee the line that earns the read

**Verified state:** `bestUgcApp` is a hardcoded ternary; `peer_publisher_ref` is LLM free-choice — so the
"a studio just like you uses this" line is fuzzy and can be wrong.

**Engine change:** a deterministic map from prospect genre + signals → the exact most-similar GamersLab
catalogue game + the exact relevant UGC app (the CAG already tags all 6 peers: Maelstrom→PvP,
NightSpawn→survival, Dark Table→card…).

**HOW it changes the email:** a precise, *true* catalogue tie every time —
*"Maelstrom (naval battle royale, like yours) runs Grudge Goblin for exactly this."*

**Why it converts:** catalogue-relevant proof is the one thing publishers **don't** auto-reject — a real
peer already doing it is social proof + risk-removal in one line ("if it works for a studio like me…").
Making it deterministic removes the failure mode where the model invents a weak/false comparison and kills
credibility on the most important sentence in the email.

---

## 5. 🟠 Publisher-entity relationship record + touch log — the spine for follow-ups

**Verified state:** the live path reasons in `publishers` rows keyed on `steam_app_id` — one draft per
game. Only a **step-1** draft is generated (`STATE.md`: step-2 sequencing "remaining"). The generic
`lead`/`outreach`/`outcome` tables are provisioned and empty; the send already carries `threadId` and
`message.step`/`variant` exist.

**Engine change:** move the live path onto a **publisher entity** with a **touch log** (channel, step,
sent, reply, sentiment, `journey_stage`). Generate a **3–4 touch sequence** (new angle per touch),
threaded via the existing `threadId`, scheduled +2–3d / +4–5d / +7d, **halting on reply**.

**HOW it changes the email:** follow-ups that reference the real prior touch and *advance* —
*"Following up on the rival-tracker idea for [game] — here's how Maelstrom's community used it"* — instead
of a generic nudge; and you **stop emailing one studio three times** because it has three games.

**Why it converts:** follow-ups are **+65.8%** and most positive replies land on touches 2–4 — but only
the ones that **add value** convert. Relationship memory is what lets the generator write a *progressing*
conversation, and dedup-on-entity removes the credibility-killer of uncoordinated repeat emails. This is
the single highest-ROI *missing* capability, and the plumbing already supports it.

---

## 6. 🟡 Coordinated multichannel play — turn cold into semi-warm before the email lands

**Verified state:** social handles mined, **unused**; outreach is email-only.

**Engine change:** emit a per-publisher **play** from the captured handles — a LinkedIn connect note + a
reply to their most recent post + the email — surfaced in the UI for the human to fire (draft-and-surface,
not auto-send).

**HOW it changes the email:** it stops being cold — it lands as *"the person who connected on LinkedIn /
replied to your launch tweet,"* not a stranger.

**Why it converts:** a warmed name lifts open and reply materially (channel mix ≈ 4–6 pts), and for
publisher BD the evidence is blunt that email *alone* rarely closes — the coordinated human sequence is
the motion. You already hold the data to warm every name; today it dies in the row.

---

## 7. 🟡 Reply intelligence → journey stage → next action

**Verified state:** Reply Poll flips a **binary** `replied`; the "Learn" dashboard is baked/echo (no
outcome data).

**Engine change:** classify each reply's sentiment + intent (`interested-bad-timing` / `wrong-person` /
`not-now` / `positive`) on the thread already fetched; write `journey_stage`; suggest the next touch.
Strip auto-replies from the positive-reply metric.

**HOW it changes the email:** the *next* generated message is correct for where they actually are — ask
for the right contact, soft future-date the timing, or **switch to a concrete "Thursday 2pm with Ryan?"
the moment they show interest**.

**Why it converts:** the CTA that converts **changes** once engaged — a specific-time ask doubles booking
at that stage but kills a cold one. A binary flag can't route that; intent classification means you stop
fumbling the warm replies the rest of the engine worked to earn. It also finally gives the learn loop real
data: feed which genres/triggers/peers actually got *positive* replies back into scoring weights.

---

## 8. Build order (return-first)

1. **🔴 #1 Steam-reviews demand mining** — biggest, cheapest, most uniquely yours; transforms the opener.
2. **🔴 #2 Why-now triggers** — relevance × timing, the #1 reply lever; reuses fields you already compute.
3. **🟠 #5 Publisher entity + touch log + follow-up sequence** — unlocks the +65.8% follow-up motion.
4. **🟠 #3 Research dossier** + **🟠 #4 deterministic peer match** — the "human" and "catalogue-relevant"
   promises, made reliable.
5. **🟡 #6 multichannel play** + **🟡 #7 reply intent → learn loop** — relationship motion + compounding.

Each step independently makes a *better generated email*; together they turn a one-shot drafter into a
researcher-with-memory.

---

## 9. Caveats / honesty

- Benchmarks are vendor studies — directional, not gospel (see research doc §10).
- Architecture verified live 2026-06-23; the free Steam `appreviews` / `GetNewsForApp` endpoints are
  long-standing but **confirm current shape when speccing** node #1/#2.
- Any live-workflow edit follows the repo's permission-first rule + `ARCHITECTURE.md §10` update checklist.

### Source docs
`research/cold-outreach-gold-standard.md` · `what/product_value_proposition.md` ·
`gamerslab-poc/ARCHITECTURE.md` · `gamerslab-poc/SPEC.md` ·
`gamerslab-poc/workflow/email-send.workflow.ts` ·
`gamerslab-poc/workflow/v10-live-edits/prepare-llm-items.PROMPT-UPGRADE.js` ·
`gamerslab-poc/workflow/v10-live-edits/build-final-record.APPLIED.js`.
