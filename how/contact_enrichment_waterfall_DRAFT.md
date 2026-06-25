# Contact Enrichment Waterfall — design + live run

> **Status: steps 1–3 BUILT as a runner and executed live once (2026-06-23).** Productizing
> into the n8n pipeline is the remaining work. Design + measured spike below; actual run
> results in §9. Decision points in §7. Date: 2026-06-22, run 2026-06-23.

## 1. Problem

Discovery finds plenty of publishers; almost none are *reachable*. Contact discovery is
**single-source** — only the Steam publisher-email field runs. The web-search and
website-scrape fallbacks are scaffolded but effectively never fire.

Measured funnel (live `publishers`, 2026-06-22):

| Stage | Count | % of discovered |
|-------|-------|-----------------|
| Publishers discovered | 236 | 100% |
| Have **any** email | 97 | 41% |
| Have a **verified** (MX-valid) email | 74 | 31% |
| Have an email but **unverified** (role/no-MX/placeholder) | 23 | 10% |
| **No email at all** | 139 | 59% |

Where the 97 emails came from (`contact_source`): `steam_api` ≈ 87, `serper_search` 7
(4 valid), `website_scrape` 2. So one source (Steam) does ~90% of the work and the
fallbacks barely ran. Of the 139 with no email, **64 already have a `publisher_website`
saved that was never opened.**

## 2. Spike — does scraping the 64 known sites actually work?

Ran a naive static scrape (homepage + `/contact`, `/about`, `/press`, `/imprint`, …;
`mailto:` + email regex; junk-filtered) over the 64 no-email-with-website publishers.

**Result: 20/64 ≈ 31% yielded a usable email from the dumbest possible scrape.**
(21 raw; one false positive — JS module names matched the email regex — so the filter
needs to drop `.js`/version-like locals. Clean figure: 20.)

- **Role inboxes** (info@, support@, contact@, hi@): 12
- **Personal / BD inboxes** (the valuable ones): 8 — e.g. Alawar `pr@`/`bizdev@`/
  `publishing@`, Smartly Dressed `nelson@`, PLAYISM `nate@`, Mattrified `gigs@`,
  Fast Travel `hello@trebuchet.fun`.

**Why the other ~44 missed — and why the real ceiling is higher than 31%:**

1. **The saved URL often isn't the studio site.** Many `publisher_website` values are a
   *game* page, a YouTube/Instagram/Kickstarter/Linktr.ee/Steam-dev/bilibili link, or a
   support-ticket form (e.g. One Hamsa → `underdogsgame.com`, Sloclap → `sifugame.com`,
   Margarite → a Freshdesk form). The studio's real domain was never resolved.
2. **JS-rendered / obfuscated contact.** Static `curl` misses emails injected by JS or
   written as `name [at] domain`.
3. **Contact-form-only** sites have no address to scrape (a different capture path).

So **31% is the floor of the cheapest possible version.** Resolving to the real studio
domain, rendering JS, following the "Contact"/"Press" link, and detecting contact forms
all lift it further. This is enough signal to justify building step 1.

## 3. Root cause (one line)

Contact discovery is single-source and email-only. We stop at Steam's field, never run a
real enrichment waterfall, and treat "no email" as "dead" instead of "try another channel".

## 4. Design — a score-gated enrichment waterfall

Run as an n8n **Contact Enrichment** workflow over publishers where `contact_email` is
empty (or `email_valid = false`), **highest `fit_score` / `outreach_tier` first** so effort
and any paid spend land on leads worth contacting. Each step writes back to columns that
already exist (`contact_email`, `contact_email_all`, `contact_name`, `contact_role`,
`contact_source`, `email_valid`, `email_status`, plus the social columns). Stop as soon as
a verified address is found.

| # | Step | Source | Cost | Measured / projected yield |
|---|------|--------|------|----------------------------|
| 1 | **Scrape the website we already have** — resolve to the real studio domain first, then homepage + `/contact`,`/press`,`/about`, footer, `mailto:` | own | **free** | **measured 31% → ~20 of 64**; higher with domain-resolve + JS render |
| 2 | **Web-search fallback** — `"{studio} press/contact email"`, parse top results | Serper free tier | **free** | est. +15–30 |
| 3 | **Pattern-guess + verify** — `first.last@domain`, role patterns, then **MX/SMTP probe before any send** | own | **free** | est. +10–20; also fixes the 23 unverified |
| 4 | **Paid domain search** — high-fit rows only, client's own key | Hunter / Apollo | **paid, opt-in** | est. +10–20 |
| 5 | **Capture a non-email channel** — Discord / X / Steam "contact developer" when no email exists | own | **free** | reframes the remainder as reachable, not dead |

**Projected:** 74 verified → ~130–150 reachable by email (steps 1–4), plus an alternative
channel for most of the rest (step 5). Steps 1–3 are free and do most of the lift; step 4
is an optional top-up.

## 5. Two reframes that matter more than any single step

- **Stop measuring "emails found"; measure "reachable rate by tier."** Track
  verified-email / any-email / alt-channel / unreachable, **segmented by `outreach_tier`**.
  That shows whether enrichment is working and whether the *high-value* leads are reachable
  (a Tier-A lead with no contact matters; a Tier-C one doesn't).
- **No email ≠ dead lead.** ~59% have no email. Some are only reachable on Discord / X /
  Steam. The data model already supports this — `LeadContact` carries
  `website/email/name/role/twitter/linkedin/discord`, and `publishers` has
  `discord_url`/`twitter_handle`/`linkedin_company_url`. The pipeline just doesn't *use*
  them yet. (Caveat: those social columns are currently near-empty — 1 discord, 4 twitter
  across the 139 — so step 5 needs its own light enrichment to populate them.)

## 6. How it slots in (modular, free-first)

- **New:** one n8n **Contact Enrichment** workflow (steps 1–3 free; 4 behind a tenant key
  flag; 5 writes social columns). No new tables — the columns exist.
- **Verification gate ties to send:** step 3's MX/SMTP probe sets `email_valid` /
  `email_status`, which the outreach approve-guard (just shipped) already enforces — so
  enrichment and the "no recipient, can't send" guard reinforce each other.
- **Front end:** the Pipeline "To:" line + verified/unverified badge already render
  `toEmail`/`emailValid`. Step 5 would add an alt-channel chip (Discord/X) — generic,
  white-label-safe.

## 7. Decisions for the gate

1. **Scope of the first build** — ship step 1 only (free, measured 31%), or steps 1–3
   together (all free)? Recommend **1–3 as one free workflow**; they share the fetch/verify
   plumbing and 1 alone leaves the verified-bounce problem unfixed.
2. **Paid enrichment (step 4)** — in or out for v1? If in, which provider and whose key?
   (Keeps to the "free for Ally / client's keys" rule either way.)
3. **Score gate threshold** — enrich which tiers? Recommend Tier A/B only to start.
4. **Alt-channel outreach (step 5)** — is non-email outreach in scope for the POC, or just
   *capture* the channel now and outreach later?

## 8. Next step

Productize the runner into the n8n **Contact Enrichment** workflow (the Serper key already
lives there), schedule it after discovery, and gate paid step 4 behind a tenant flag.

## 9. Run results — live, 2026-06-23 (steps 1–3, score-gated)

Built the waterfall as a runner (website scrape → Serper search → `dig` MX-verify →
pattern-guess candidates) and ran it once over the **45 actionable leads** (of 153 scored)
that had no email or an unverified one. Conservative write policy: only **domain-matched**
addresses auto-write; free-provider / wrong-department / unrelated-domain finds are **held
for human review**, and pattern guesses are never written.

**Outcome on the scored set: leads needing enrichment 45 → 20; verified-deliverable
133 / 153 (87%).** Breakdown of the 25 resolved:

- **5 new, high-confidence emails written** — Smartly Dressed (`nelson@…`), TaleWorlds
  (`pr@…`), Idea Factory (`support@…`), PikPok (`support@…`), PLAYISM (`nate@…`).
- **20 existing "unverified" emails re-verified as valid** (MX present) — these were being
  shown as shaky but are deliverable. Biggest single chunk of the lift.

Held / flagged (not written):
- **6 review candidates** — free-provider or wrong-department hits the search surfaced,
  e.g. `onestepfromeden@gmail.com` (likely fine), `privacy@wargaming.net`,
  `eurepresentative.cygames@twobirds.com` (legal rep), `info@devuego.pt` (wrong entity?).
- **2 existing emails failed MX** (Kurki.games, Silver Lining) — flagged `no_mx`; will bounce.
- **8 pattern-guess-only** (domain has MX but no address found) and **4 no-contact**.

**Lessons that shape productization:**
1. Web-search (Serper) needs a **relevance/confidence gate** — it readily returns legal/
   privacy reps and placeholder addresses (`first.last@…`). The domain-match classifier
   built here is the minimum bar; keep it in the n8n version.
2. **Re-verification alone is high-yield** — 20 "unverified" leads were actually fine. A
   cheap MX pass over the existing email column recovers a lot with zero discovery.
3. The send-guard blocks only *empty* recipients; `no_mx` addresses are still technically
   sendable. Consider tightening the approve-guard to also block `email_valid = false`.
4. The runner is local + holds secrets (Edge bearer, Serper key) inline — **not committed**.
   The n8n workflow is the home for it (keys already configured there).
