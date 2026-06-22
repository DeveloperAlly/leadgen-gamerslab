# Lead Contact Enrichment — Architecture & Options (DRAFT)

> Status: **DRAFT, pre-gate** for the paid/Tier-4 options. The free socials lift + WHOIS
> removal were **shipped 2026-06-23** (see "Empirical update" below).
> Date: 2026-06-23. Scope: lifting founder / contact-name / socials / LinkedIn coverage on
> GamersLab leads. UI surfacing of the data we already have is **done** (separate change:
> `Lead.contact`, `leads` Edge Function v7). This doc is about the *data* lever, not the UI.

> ## Empirical update (2026-06-23) — data.xml premise refuted; shipped a different free lift
> The research below proposed press-kit `data.xml` parsing + per-site /about scraping as the
> biggest free lift. **Live testing against 8 real studios from our DB refuted this:** 0/8 had
> a parseable `data.xml` (modern sites are SPAs that return an HTML shell at any path, or use
> static press kits that never upload the XML), and raw-HTML /about scraping resolved a field
> on only 2/8 while adding 3-7s of timeout latency per site. So that path was **not** shipped.
> **What shipped instead (live on v10):** (1) **WHOIS removed** entirely (0% by law, confirmed).
> (2) The pipeline already runs an Exa search per lead (`<studio> contact email founder press`,
> 10 results with links+text) but only mined *emails* from it — now it also **mines canonical
> twitter / linkedin / discord URLs from the search-result links**, which is SPA-proof (Exa
> surfaces the studio's real social URLs regardless of how their site renders) and adds zero
> fetches. (3) The already-fetched contact/about page now also yields socials, not just emails.
> The Tier-4 paid/BYO-key provider options below remain the open, pre-gate decision.

---

## 1. The problem, in numbers

The lead card can now show website, email, contact name, X, LinkedIn, Discord. But most of
those fields are empty because the pipeline does not resolve them. Real coverage on the live
236-row `publishers` table (sentinels `""`/`"unknown"` excluded):

| Field | Real values | % | Verdict |
|---|---|---|---|
| publisher_website | 145 | 61% | OK (Steam gives it) |
| contact_email (any) | 97 | 41% | OK-ish |
| email_valid (deliverable) | 74 | 31% | OK-ish |
| twitter_handle | 41 | 17% | thin |
| discord_url | 15 | 6% | thin |
| founder_name | 13 | 6% | **thin** |
| linkedin_company_url | 12 | 5% | **thin** |
| contact_name | 4 | 2% | **thin** |
| whois_registrant_name | 0 | 0% | **dead** |

The website and a role email come through. The *human* (who to address, their LinkedIn) does
not. That is the gap worth closing.

## 2. Current enrichment, as built (verified against the live workflow + DB)

Enrichment runs inside the n8n **v10** workflow (the `Mining contacts` stage). The nodes:

```
Steam appdetails ─▶ WHOIS Lookup ─▶ Serper: Combined Search ─▶ Scrape Website / Contact Page ─▶ Verify Email
   (primary)          (dead)            (SERP, barely used)        (barely used)                 (MX/SMTP)
```

What the `contact_source` mix actually shows (236 rows):

| contact_source | rows | email_valid | founder | twitter | linkedin | discord |
|---|---|---|---|---|---|---|
| steam_api | 119 | 101 | 16 | 45 | 11 | 19 |
| (empty / unprocessed) | 113 | 0 | 0 | 0 | 0 | 0 |
| not_found | 22 | 0 | 5 | 5 | 1 | 2 |
| serper_search | 9 | 6 | 2 | 5 | 3 | 2 |
| website_scrape | 2 | 0 | 1 | 2 | 0 | 1 |

Three facts fall out of this:

1. **Steam carries the whole load.** Steam `appdetails` gives `website` + `support_info.email`
   + org names, and that is where almost all current signal comes from. Confirmed hard limit:
   **Steam exposes no person** — `developers[]`/`publishers[]` are company-name strings, never
   individuals, and there is no Steam endpoint for a founder name or personal email.
2. **WHOIS is a dead node.** 0 of 236 real registrant names. This is structural, not a bug:
   ICANN's permanent **Registration Data Policy** (in force for registrars since 21 Aug 2025,
   GDPR-driven) redacts registrant name/email by default. Identifiable registrants fell from
   ~76% (2018) to ~13% (2021) industry-wide, and indie studios mostly registered *after* the
   2018 cutoff, so even paid WHOIS-history recovers nothing. **Drop it.**
3. **The two highest-yield free paths are barely wired.** Serper (9 rows) and website scrape
   (2 rows) are fallbacks that almost never fire, and **113 rows were never enriched at all**.

## 3. Options researched (2026-verified)

### 3a. Paid / BYO-key people-data providers (resolve name + role + LinkedIn + email)

Constraint: must run on **free tiers or the client's own API keys** — no spend by Ally. That
disqualifies a lot of the market.

| Provider | Free API tier (2026) | Returns | Cheapest BYO paid | Verdict |
|---|---|---|---|---|
| **People Data Labs** | **100 lookups/mo, perpetual, self-serve key** | name, title, LinkedIn, work+personal email | Pro $98/mo | **Best free standing path.** 2-call (Search then Enrich) |
| **Anymail Finder** | **100 credits, API-enabled, pay-only-for-verified** | decision-maker name+role+LinkedIn (2 cr), MX-verified | $29/400, $49/1k | **Best pure free-API pick.** Maps to "find the founder at this domain" |
| **Hunter.io** | 50 credits/mo (API-on-free is ambiguous — test a key) | domain→people name+role+verified email | $49/2k | Strong, but verify free-API works first |
| Snov.io | none (API is paid-only) | name+position (email = 2nd call) | $39/1k | Skip for free path |
| Apollo.io | none (no API on free/Basic) | name, title, LinkedIn, email | ~$59-149/mo | Skip for free path |
| RocketReach | none (API behind ~$2,099/yr) | richest rosters | Ultimate only | Skip (violates no-spend) |
| Clearbit | **DEAD** — now HubSpot "Breeze," no standalone API | — | — | **Do not design against** |
| Dropcontact | 50-credit trial only | enrichment of *known* contacts, GDPR-bulletproof | EUR 79/mo | Reserve as a verify step, not discovery |
| Coresignal / Findymail | 7-day / 10-credit trials | names+LinkedIn / domain→people | $49 / $99 | Too small to run a pipeline |

### 3b. Scrape + LLM extraction (read the studio's own site)

- **Firecrawl** — 1,000 credits/mo free forever; `/extract` returns LLM-structured JSON
  (founder, email, socials) from a URL. Best single-vendor scrape→structured. Hobby $16/mo.
- **Jina AI Reader** (`r.jina.ai`) — free at 20 RPM with no key, 500 RPM + 10M tokens with a
  free key. Cheapest "clean text, bring your own LLM" path.
- **Legality:** reading a studio's *own public* About/Press page while logged-out is defensible
  (Meta v Bright Data, Jan 2024). EU/GDPR is the binding constraint: a founder name+email is
  personal data even when public, so do a legitimate-interest assessment, respect robots.txt,
  prefer role addresses, disclose source + offer opt-out, cap retention. (The 2024 CNIL KASPR
  fine was for scraping LinkedIn's *gated* data — a different, riskier act.)
- **Hallucination guard (mandatory):** LLMs invent `firstname@domain`. Mitigate with strict
  "return null if not literally on the page" prompting + **verbatim substring-validate every
  extracted email against the raw page text** + MX-check. This kills most fabrication.
- **Reality check:** hit-rate is uneven. ~5+ person studios often list a named founder + email;
  the solo long-tail routes contact through Discord/X/contact-forms and has no named founder
  online. No amount of tooling fixes that — for those, a social handle is the honest ceiling.

### 3c. First-party free signal we are leaving on the table

- **presskit() / dopresskit** (Rami Ismail's indie press-kit standard) is the single biggest
  unlock. Widely adopted by indies, it serves a structured **`data.xml`** at `/press` or
  `/presskit` exposing exactly what we want:
  ```xml
  <contacts><contact><name>Inquiries</name><mail>contact@studio.com</mail></contact></contacts>
  <socials><social><name>twitter.com/studio</name><link>https://twitter.com/studio/</link></social></socials>
  ```
  Machine-structured contact email + every social in one fetch. **The pipeline does not parse
  this today.** Detect the press path, fetch `data.xml`, parse `<contacts>`/`<socials>`; fall
  back to scraping the rendered press page for `mailto:` + social `href`s.
- **Website footer + `mailto:` sweep** across crawled pages — cheap catch-all for role emails +
  social icons. **Discord invites** validate free via `GET discord.com/api/v10/invites/{code}`.
- **Serper.dev** for social gaps — 2,500 free credits, then ~$0.30-1.00/1k. Query
  `"<studio>" site:linkedin.com/company` to resolve a missing LinkedIn *company* page.
- **Why not call X / LinkedIn directly:** X API has **no free tier** in 2026 (pay-per-use,
  ~$0.01/read). LinkedIn has **no public people-search API** at all. So resolve handles by
  parsing the site/SERP, never by calling those platforms.
- **itch.io** (many indies cross-list): profile **link block** (X, Bluesky, site) is scrapable;
  useful second site when Steam's `website` is thin. No contact API.

## 4. Recommended architecture — a free-first enrichment waterfall

The principle: **exhaust free first-party signal before spending a credit, and never call a
structurally-blind source.** Replace the current flat `Route Enrich` branch with an explicit,
ordered, short-circuiting waterfall. Each tier only runs for fields still missing after the
previous one.

| Tier | Source | Cost | Resolves | Status today |
|---|---|---|---|---|
| 0 | Steam `appdetails` | free | website, support email, org names | built |
| 1 | **presskit() `data.xml`** | free | press email, all socials (structured) | **NEW — biggest win** |
| 2 | Website /about /team /contact + footer + `mailto:` + Discord-invite API, via Firecrawl/Jina + LLM extract | free tier | founder name, role email, socials | improve existing scrape |
| 3 | Serper SERP (by name) | free tier | missing LinkedIn-company / X handle | underused today |
| 4 | People-data (PDL free 100/mo or Anymail Finder), **client BYO key to scale** | free / client key | founder name + role + LinkedIn + verified email | **NEW — the paid lever, last** |
| — | ~~WHOIS~~ | — | nothing (0% by law) | **DELETE** |
| all | MX-verify every email; role-address fallback; **never invent** | free | deliverability | keep |

Tiers 0-3 are free. Tier 4 runs on free tiers or the client's own key, satisfying "free for
Ally." Most leads should be resolved by Tier 1-2 before Tier 4 is ever touched.

### Placement & mechanics

- **Keep it in n8n** (where enrichment already lives), but restructure `Route Enrich` into the
  waterfall above, adding a **presskit parser** node and an **LLM-extract** node (Firecrawl or
  Jina + a cheap model with the null-on-absence + verbatim-email guard).
- **Make it idempotent and re-runnable.** Key on `steam_app_id`; only fill empty fields; stamp
  `contact_source` per field. This lets us run a **backfill pass over the 113 unenriched + the
  thin rows** without re-discovering, which is the fastest visible coverage lift.
- **Record provenance.** Per-field source + `evidence_as_of` so the UI can show where a contact
  came from and so we can re-verify decayed data later.

### Honest expected outcome

- **Socials + press/role email: large lift.** presskit + footer parsing should move twitter/
  discord/contact-email from teens-percent toward the majority of studios that have any web
  presence.
- **Founder name + LinkedIn: moderate lift, with a ceiling.** Tier 2 + Tier 4 will resolve named
  founders for established studios; the solo long-tail has no named founder online and will top
  out at "here's their X/Discord." We should set that expectation, not promise 100%.

## 5. Phasing (if approved)

1. **Backfill + presskit (free, highest ROI):** add the presskit parser + improve the website
   scrape/footer sweep, make enrichment idempotent, re-run over existing rows. No new spend.
2. **SERP gap-fill (free tier):** wire Serper for missing LinkedIn-company / X handle by name.
3. **Tier-4 people-data (free / BYO key):** add PDL or Anymail Finder behind a flag, only for
   leads still missing a named contact after Tiers 0-3.

## 6. Open decisions for Ally (the gate)

- **Tier-4 provider:** People Data Labs (perpetual 100/mo free, 2-call) vs Anymail Finder (100
  free credits, pay-per-verified, decision-maker call). Recommend starting with **Anymail Finder**
  for the cleaner "founder at this domain" call, PDL as the richer alternative. Test Hunter's
  free-API claim if we want a third.
- **GDPR posture:** confirm we will do an LIA, prefer role addresses, and expose an opt-out
  before caching personal names/emails. Confirm PDL/provider retention clause before we store
  enriched people data in the client DB.
- **Backfill scope:** re-enrich all 236, or only the 113 unprocessed + thin rows first.

---

### Sources (2026-verified)

Steam appdetails + Steamworks limits; dopresskit.com + pixelnest/presskit.html; People Data
Labs / Hunter / Anymail Finder / Snov / Apollo / Dropcontact / RocketReach pricing + API +
GDPR pages; Firecrawl + Jina Reader pricing; ICANN Registration Data Policy (21 Aug 2025) +
RDRS; Meta v Bright Data (2024) + CNIL KASPR (2024); Serper.dev + SerpApi pricing; X API
pricing 2026; LinkedIn Partner Program restrictions; Discord invite API. (Full URL list in the
session research transcript.)
