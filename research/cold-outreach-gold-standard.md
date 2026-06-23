# What Actually Drives Replies — Evidence, Read for *This* Product

> **What this product is.** A **context-grounded, evidence-backed, human-reviewed outreach *generation*
> pipeline**. It does **not** send mass cold email. It mines real signal about a specific prospect, proves
> a specific reason that prospect should care about a specific client, and **generates one genuinely
> personalised, catalogue-relevant, relationship-led message** for a human to review and send. The unit of
> value is *"a verified, evidence-backed reason this prospect should care about this client"* — not "a
> list" and not "volume."
>
> **Why this doc was reframed.** The first version read the cold-email literature as a *mass-sending ops
> manual* (burner domains, inbox rotation, spintax, unsubscribe footers). That is the wrong playbook for
> this product and, on the evidence, the *losing* one. This version keeps the same sourced evidence but
> **reweights every lever for a low-volume, high-personalisation, relationship motion** and states, for
> each, **how it changes the generated email and the odds of a reply.**
>
> Research date: **June 2026**. Benchmarks cite study + sample size; treat exact percentages as
> directional (see §10 caveats). The GamersLab POC is the first instance of the product; examples use it.

---

## 0. The thesis in five lines

The data shows cold outreach has **bifurcated**: medians are collapsing (~0.5% reply) while the top few
percent climb (16%+). The gap is driven almost entirely by the things *this product is built to do*:
**relevance (right prospect + real reason), genuine personalisation from fresh signal, catalogue-relevant
proof, an interest-led ask, and relationship persistence.** Mass-sending tactics (volume, automation
tells, generic templates) sit on the *losing* side of that split. So the product's entire job is to
manufacture, at the quality a sharp human researcher would, the exact inputs that put each message in the
top few percent — for messages a human still approves and sends.

---

## 1. Two motions — and which one we are

| | **Mass cold email (NOT us)** | **Intelligent personalised outreach (THIS product)** |
|---|---|---|
| Goal | volume → a few replies | *each* message earns a reply / opens a relationship |
| Personalisation | token-merge `{firstName}` | a real, fresh, evidence-backed reason, per prospect |
| Domain/sending | burner domains, inbox rotation, warmup farms | client's real domain, low volume, human-sent |
| Tells | spintax, unsubscribe footer, "quick question" | reads like a person who did the homework |
| Cadence | automated blast sequences | relationship-led, multichannel, persistent-with-context |
| Volume/day | hundreds–thousands | tens, hand-reviewed |
| Metric | open rate, raw reply | **positive reply / conversation opened**, then meetings |
| Risk | burns domains, trains spam filters | reputationally safe; *credibility is the asset* |

Everything below is read for the **right column**. Where a finding only matters to the left column, it's
marked **[mass-only — not our model]** so it isn't mistaken for a recommendation.

---

## 2. Benchmarks — why quality, not volume, is the only game

| Metric | Median / average | Top performers | Source (sample) |
|---|---|---|---|
| Reply rate | ~3–5% | 10%+; top 5% **16.3%** | QuickMail 65M; Saleshandy 53M |
| Median vs top | median **0.48%** | top 5% **16.3%** | QuickMail 65M |
| **Positive** (interested) reply | ~14% *of* replies; ~0.64% of contacts | far higher on tight niche | Sales.co 2M |
| Meetings booked | baseline | top 10% book **8.1×** | Gong + 30MPC, 85M |
| Emails per meeting (avg rep) | **344** | far fewer for top reps | Gong, 28M |

**Read for the product:** the spread between median and top is ~**34×**, and it's controllable. A product
that reliably produces *top-decile* messages — specific, true, well-timed, catalogue-relevant — is worth
orders of magnitude more than one that sends more average ones. **Optimise the positive-reply rate** (only
~14% of replies are real interest; ~45% are auto-replies) — that is the number the generation engine
exists to move.

---

## 3. The #1 lever — relevance: the right prospect *and a real reason, now*

The most consistent finding across every large study: **who you contact and why-now beats how you write.**
Signal/trigger-based targeting replies at **15–25%** vs **2–5%** for broad lists; tightly-targeted
micro-segments (<200) roughly double large-list reply rates (Saleshandy, FoxReach, Belkins).

**How the product wins this (and the engine's job):**
- **Evidence-backed reason, not a list.** The pipeline's painpoint-verification + discovery-pack steps
  exist precisely to produce a *cited reason this prospect should care* before a word is drafted. That
  reason is what lifts a message from 2% to 15%.
- **"Why now" timing.** A prospect in an active moment (just launched, hiring, recently complained,
  shipped a patch) is in the decision window. The generated email should **open on that moment** — the
  single highest-converting personalisation class (recent-trigger personalisation ≈ **+47%**, Mailpool).
  *→ POC: mine Steam launch windows, patch/news, review-velocity; see the recommendations doc.*
- **One genuinely specific detail > many generic ones (+34%).** Job-title-only personalisation actually
  *lowers* replies (−2%, Mailpool). The product must feed the generator a real detail a human would find,
  not merge-fields.

**How it shows up in the email:** the opener stops being *"I came across your game"* and becomes
*"two of your reviews this month ask for a rival tracker — here's one, free."* That line is the product.

---

## 4. Catalogue-relevant proof — the thing that earns the read

In the closest analogue to this product (game-publisher BD), publishers **routinely auto-reject visibly
mass-sent or off-catalogue pitches**, and a recommendation/peer reference reliably moves a pitch up the
queue (IndieGameBusiness; GameDesignSkills; Lobanov). Generic personalisation lifts little; **proof that
"a company just like you already does this"** is what converts.

**How the product wins it:** a deterministic match from the prospect's profile to the *client's own
catalogue* — the most similar reference customer + the exact relevant offering — so every message can
truthfully say *"Maelstrom (naval battle royale, like yours) runs Grudge Goblin for exactly this."*

**How it shows up / why it converts:** the email carries social proof + risk-removal in one true line
("if it works for my peer, it works for me"). Making the match deterministic also removes the failure mode
where a model invents a weak/false comparison and kills credibility on the most important sentence.

---

## 5. The message itself — what the generator should produce

The copy evidence is strong and the POC's CAG generation prompt already encodes most of it. Keep it; these
are the targets it should keep hitting.

- **Length: ~50–125 words, 3–4 sentences.** Gong (85M): best replies at 3–4 sentences/≤100 words; Lemlist:
  120-word emails booked **52%** vs 20% at 300. *Relationship/BD note:* later, warmer touches can carry
  more context (longer follow-ups outperform once a thread exists, Gong).
- **Stop pitching; "you" not "we."** Pitching cuts replies **up to 57%** (Gong). The message is about the
  prospect's world and stated problem, not the product.
- **Write like a human.** Informal/personal tone had **+78%** positive rate vs formal (Sales.co). This is
  the product's whole promise — it must read like a person who did the homework, not a brand.
- **One specific, fresh observation → relevance/proof → one value point → one ask.** The four-line shape
  that recurs across every study.
- **Personalised subject *and* body lifts replies 142%** (Woodpecker, 1M+). Push the specific hook into
  the **subject**, not just the body. Subject 3–6 words / ≤50 chars.

**How it converts:** each of these is a reason a human keeps reading and a reason a spam filter doesn't
flag. The generator hitting them every time is what makes a *machine-made* email read as *hand-made*.

---

## 6. The ask — sell the conversation, not the meeting

Gong's 304,174-email study: an **interest-based CTA** ("worth a look?", "is this on your radar?") beats a
meeting/time ask — **68% vs 41% positive replies**. Asking for time triggers loss aversion; asking for
interest doesn't. **Then** switch to a specific-time ask once they're engaged (booking jumps 15%→37%).

**How the product wins it:** touch-1 generation defaults to **one soft interest question**; the
reply-intelligence step detects engagement and only *then* generates a concrete-time ask. The CTA that
converts literally changes by relationship stage — so the engine must know the stage (see relationship
memory in the recommendations).

---

## 7. Relationship persistence — most positive replies come *after* touch 1

The most replicated finding in the literature: **one follow-up lifts replies +65.8%** (Backlinko 12M);
3–4 touches roughly double total replies; most *positive* replies land on touches 2–4. In publisher BD
specifically, deals take **months and multiple touches** — cold email is the *top of a relationship
funnel*, never a closer.

**How the product wins it — and why memory matters:**
- Follow-ups only convert when they **add new value**, not "just bumping." That requires the engine to
  remember the prior touch and advance the angle: touch-1 hook → touch-2 peer proof → touch-3 soft
  breakup. *→ POC: a publisher-entity relationship record + touch log; see recommendations §5.*
- **Halt on reply.** Don't follow up someone who answered. (The POC already detects replies; it must gate
  the sequence on them.)
- **Don't double-hit.** One prospect contacted three times because they have three games is a credibility
  killer — dedup on the prospect entity, not the artifact.

**How it converts:** persistence-with-context is how BD relationships actually close; the research says the
second and "breakup" touches carry the biggest jumps. A generator with relationship memory writes a
*progressing* conversation instead of repeating itself.

---

## 8. Multichannel — turn cold into semi-warm before the email lands

Channel mix is a **4–6 point** reply lever (ReachIQ), and for publisher BD the evidence is blunt that
email *alone* rarely closes — the coordinated human sequence (a LinkedIn touch, a reply to their post,
then the email) is the motion. The POC already mines `twitter_handle` / `linkedin_company_url` /
`discord_url` and **never uses them**.

**How the product wins it:** generate a per-prospect *play* — a LinkedIn connect note + a reply to their
recent post + the email — surfaced for the human. **How it converts:** the email then lands as *"the person
who connected on LinkedIn,"* not a stranger; a warmed name lifts both open and reply materially.

---

## 9. Deliverability & compliance — *right-sized for this motion* (Ally's correction folded in)

This is where the first version over-applied the mass-sending playbook. Corrected stance for a
**low-volume, human, client's-own-domain** product:

- **[mass-only — not our model]** Burner domains, inbox rotation, warmup farms, spintax. These exist to
  spray thousands/day from throwaway infrastructure. At tens of hand-reviewed sends from the client's real
  domain, they are unnecessary and the brand domain is a **credibility asset**, not a liability.
- **No unsubscribe footer, no `List-Unsubscribe` header.** This is **1:1 relationship outreach, not a
  newsletter.** A footer makes a hand-written email look mass-sent — the exact tell that gets BD pitches
  binned. If someone wants out, the human honors a plain "no thanks." (This corrects the earlier doc.)
- **What *does* universally matter, because it's invisible to the recipient and protects the real domain:**
  - **SPF/DKIM/DMARC** on the sending domain — table stakes since the 2024–25 provider rules; pure upside.
  - **Clean, verified addresses** — bounces are the one thing that can hurt a real domain even at low
    volume, so verification matters *more* precisely because you're on the brand domain.
  - **Plain text, genuine personalisation, low volume** — which is the product's design anyway.
- **Send timing** (Tue–Thu, recipient morning) is real but the **smallest** lever — a human picking a
  sensible time is enough; don't engineer it before the levers above.

**Net:** the product's reputational safety comes from *being genuinely personal and low-volume*, not from
mass-sending hygiene. Verify addresses, set auth records, stay human.

---

## 10. How to read these numbers

1. Most figures are **vendor studies** with differing metric definitions (replies ÷ delivered vs ÷
   contacts; auto-replies stripped or not). Trust the **repeated patterns**, not any single percentage.
2. **Open-rate is unreliable** post-Apple Mail Privacy Protection — weight reply / positive-reply data.
3. Effects **interact** — a weak link (wrong prospect, stale signal, false peer match) caps everything
   downstream, which is why the product invests in *input quality* over send mechanics.
4. The publisher-BD specifics are practitioner consensus (~3–5% cold response is "normal"), not controlled
   studies — but they point the same way as the large datasets: relevance and relationship win.

---

## Sources

**Large-scale studies:** [Gong 28M](https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says) ·
[30MPC+Gong 85M](https://tactics.30mpc.com/hubfs/The%20Ultimate%20Cold%20Email%20Data%20Report-1.pdf) ·
[Saleshandy 53M](https://www.saleshandy.com/blog/cold-email-statistics/) ·
[Sales.co 2M](https://sales.co/research/cold-email-statistics) ·
[Belkins 16.5M](https://belkins.io/blog/cold-email-response-rates) ·
[CopyCrest / QuickMail 65M](https://copycrest.com/research/state-of-cold-email) ·
[Backlinko 12M](https://backlinko.com/email-outreach-study) ·
[Mailpool 1M](https://www.mailpool.ai/blog/we-analyzed-1-million-cold-emails-heres-what-actually-works)

**CTA / copy:** [Gong CTA 304K](https://www.gong.io/blog/this-surprising-cold-email-cta-will-help-you-book-a-lot-more-meetings) ·
[Gong how-to-write](https://www.gong.io/blog/how-to-write-a-sales-email) ·
[GrowLeads CTA study](https://growleads.io/blog/interest-based-ctas-vs-meeting-requests-study/)

**Follow-ups / timing / channel:** [UnifyGTM](https://www.unifygtm.com/explore/how-many-follow-ups-cold-email) ·
[Datalane](https://www.datalane.com/post/cold-email-follow-ups) ·
[ReachIQ send-time](https://reachiq.ai/resources/blog/send-time-optimization-when-do-execs-actually-reply/)

**Targeting / data quality:** [FoxReach list building](https://www.foxreach.io/academy/b2b-cold-email-list-building) ·
[Reachly Clay vs Apollo](https://www.reachly.co/blogs/clay-vs-apollo-for-prospecting)

**Authentication (the bit that does apply):** [Proofpoint Nov-2025 enforcement](https://www.proofpoint.com/us/blog/email-and-cloud-threats/clock-ticking-stricter-email-authentication-enforcements-google-start) ·
[Gmail sender guidelines](https://support.google.com/a/answer/81126?hl=en)

**Game-publisher BD:** [Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-guides/how-to-pitch-your-game-to-a-publisher-a-first-time-devs-guide) ·
[IndieGameBusiness](https://indiegamebusiness.com/state-of-pitching-in-2025/) ·
[GameDesignSkills](https://gamedesignskills.com/game-development/game-pitch/) ·
[Lobanov — guide to publishers](https://medium.com/@banovg/an-indie-developers-guide-to-publishers-eb896a05353)

> Companion docs: `research/gamerslab-poc-enhancement-recommendations.md` (how to upgrade the POC for
> this) · `what/product_value_proposition.md` (why the product is valuable) · `what/business_process_model_DRAFT.md`.
