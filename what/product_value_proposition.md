# Product Value Proposition — Intelligent Personalised Outreach (the WHAT & WHY)

**Status:** 🟢 Value-proposition statement · **Owner:** Ally · **Area:** aDNA campaign context (the WHAT).
**Created:** 2026-06-23 · **Companion to:** `what/campaign_master.md`, `what/business_process_model_DRAFT.md`,
`what/research/competitor_analysis.md`, `research/cold-outreach-gold-standard.md`.

> The product is currently unnamed. This document defines **what it is, why it is valuable, and why it
> wins** — the purpose every build decision serves. The GamersLab POC is its first live instance.

---

## 1. What it is — in one sentence

A **context-grounded, evidence-backed outreach *generation* product**: drop in a business's context, and
it intelligently mines real signal to find the right prospects, **proves a specific reason each prospect
should care about this specific business**, and generates a **genuinely personalised, catalogue-relevant,
relationship-led message** for a human to review and send — getting smarter about *that* business with
every cycle.

## 2. What it is *not* (the line that defines the product)

It is **not mass cold email.** No spray-and-pray, no burner domains, no token-merge `{firstName}`
templates, no automated volume blasting, no unsubscribe-footer newsletters. Those tactics sit on the
**losing** side of the market split (see §6). The product is the opposite motion: **few messages, each
one earned** — the message a sharp human BD researcher would write *after doing the homework*, produced at
machine scale and consistency.

| Mass cold email (what everyone else automates) | This product |
|---|---|
| Volume → a few replies | Each message earns a reply / opens a relationship |
| `{firstName}` merge fields | A real, fresh, evidence-backed reason — per prospect |
| Generic template, any prospect | Catalogue-relevant proof tied to *this* business's reference customers |
| "Ask for the meeting" | Sell the conversation; escalate the ask only when engaged |
| One blast, automated sequence | Relationship-led, multichannel, persistent-with-context |
| Burns sending domains | Reputationally safe — the real domain *is* the credibility |
| Optimises open rate | Optimises **positive replies → conversations → conversions** |

## 3. The core insight (why it works)

Cold outreach has **bifurcated**. Across studies of 65M+ emails, the median reply rate has collapsed to
~**0.5%** while the top few percent climb to **16%+** — a ~34× spread. The gap is *controllable* and is
driven by exactly five things: **right prospect, a real reason now, genuine fresh personalisation,
catalogue-relevant proof, and relationship persistence** (`research/cold-outreach-gold-standard.md`).

Mass-automation tools optimise the wrong half — they make it cheaper to send *more average* messages.
**This product manufactures the inputs that put each message in the top few percent** — and keeps a human
in the loop so the output stays genuinely personal. That is the whole thesis: **don't send more; send
ones that get answered.**

## 4. The unit of value

Not "a list of contacts." Not "emails sent." The unit of value is:

> **A verified, evidence-backed reason this specific prospect should care about this specific business —
> rendered into a message a human is happy to send under their own name.**

Everything the engine does (signal mining, painpoint verification, catalogue matching, scoring, drafting,
relationship memory) exists to produce that one thing at quality and scale.

## 5. Who it's for & the jobs it does

**For** any business whose customers (or investors) congregate somewhere findable and who needs warm,
credible, relationship-led outreach — but can't afford a team of senior BD researchers to hand-craft every
message. **The POC proves it for GamersLab (Steam → game publishers); every other business inherits it.**

The jobs it does that a human BD rep does — but consistently, and at scale:
1. **Understand the business** deeply enough to know who its prospects are and where they gather (venues).
2. **Find the right prospects** in those venues and exclude anyone already known.
3. **Do the homework** — mine real, fresh signal about each prospect (their stated needs, recent moves).
4. **Prove the reason** — a cited, dated painpoint this business genuinely solves.
5. **Match the catalogue** — the most similar reference customer + the exact relevant offering.
6. **Write the message** — specific, true, human, one soft ask — grounded only in the evidence.
7. **Run the relationship** — persistent, multichannel, context-aware follow-up that halts on reply.
8. **Learn** — feed outcomes back into *this* business's prompts, scoring, and venue map.

## 6. Why it's valuable — the market wedge

From `what/research/competitor_analysis.md` and `what/campaign_master.md`, the market is hot but
**fragmented**, and everyone sits in one of two camps the product deliberately avoids:

- **Data owners** (Clay, Apollo, ZoomInfo) sell *contacts and enrichment* — raw inputs. They don't prove
  *why this prospect cares about your business*, and they don't generate the message.
- **Autonomous senders** (11x, Artisan) sell *volume* — AI-SDRs that blast. They optimise the losing half
  of the market split and put the client's reputation at risk.
- **White-label resellers** (GoHighLevel, Vendasta, SalesMind) repackage *generic CRM + LinkedIn
  automation* — not business-specific, not evidence-grounded.

**The white space — and our moat — is the middle nobody owns:** a **context-grounded, business-specific,
evidence-backed outreach pipeline** that is genuinely re-templatable, runs on the **client's own model
keys and domain**, and **doesn't require owning a data set or burning sending infrastructure.**
Build-once, sell-many.

**The compounding moat:** because the product learns *per business* — its venues, its winning angles, its
scoring weights, its prompts — each cycle makes that client's pipeline better and harder to replace. The
asset isn't the software; it's the **per-client intelligence that compounds**, and the switching cost it
creates.

## 7. Why it converts better (the proof, condensed)

Each design choice maps to a measured lever (full sourcing in `research/cold-outreach-gold-standard.md`):

- **Evidence-backed targeting** → signal/trigger prospects reply at **15–25%** vs **2–5%** for broad lists.
- **Fresh, specific personalisation** → recent-trigger personalisation ≈ **+47%**; personalised
  subject+body ≈ **+142%**; one specific detail beats many generic by **+34%**.
- **Catalogue-relevant proof** → the thing that stops a pitch being auto-rejected; peer reference moves it
  up the queue.
- **Interest-led ask** → **68% vs 41%** positive replies vs a meeting-request CTA.
- **Relationship persistence with memory** → one follow-up **+65.8%**; most positive replies on touches 2–4.
- **Human + low-volume + real domain** → reputationally safe; credibility is the asset, not a liability.

## 8. Guardrails (what we will not become)

- **We generate; the human sends.** No autonomous sending at volume — owning sending means owning the risk
  of burning the client's domain and reputation.
- **No fabrication.** Every claim in a message traces to cited evidence in the discovery pack; if there's
  no real reason, there's no message.
- **No mass-email tells.** No unsubscribe footers, no spintax, no generic templates — these signal
  automation and lose. (See `research/cold-outreach-gold-standard.md §9`.)
- **Client owns the keys and the domain.** Free for the operator first; the client's own model keys and
  sending identity.
- **Human-in-the-loop at the gates.** A person approves the prospects and approves the message.

## 9. One-line pitch

> **Most tools help you send more outreach. This one helps you send the *right* one — a genuinely personal,
> evidence-backed, catalogue-relevant message that a real person is glad to receive — and gets smarter about
> your business every time you use it.**

---

*Recorded to the aDNA brain under tags `lead-gen`, `gamers-lab`, `whitelabel`. Keep in sync with
`what/campaign_master.md` and the competitor analysis.*
