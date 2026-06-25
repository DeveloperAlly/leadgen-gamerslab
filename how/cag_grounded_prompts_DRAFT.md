# CAG-Grounded Prompts (DRAFT, pre-gate)

Status: DRAFT for Ally's approval. Nothing deployed. Supersedes the fabricated content
currently baked into the n8n "Prepare LLM Items" node and the partial `cag_context` brief.

Sources of truth (the ONLY facts the pipeline may assert):
- `gamerslab-poc/resources/Gamers Lab Developer Pitch.pdf` (11pp pitch guide)
- https://www.gamerslab.gg/ (live site)

---

## 0. The structural change

Today: the CAG is a half-used email brief with invented facts; lead scoring is a separate
hardcoded `Pre-Score` node and a code-level `bestUgcApp`/`pitchAngle` if/else. The brief does
not drive scoring, and most of its content is unsourced.

Target: ONE source-of-truth brief (the CAG, edited from the Business Context page) that drives
BOTH stages of the pipeline:

  CAG brief (value prop + persona + offer + voice)
        |
        +--> PROMPT 1: Lead qualification / fit scoring   (what is a good lead, DERIVED)
        |
        +--> PROMPT 2: Email draft                        (the pitch, grounded in the ladder)

"Good lead" is not invented. It is, by definition, a studio the value proposition converts.
The pitch guide names that studio (the Studio persona) and the two game subtypes. The fit
rubric is derived from those, not hand-authored.

---

## 1. THE CAG BRIEF (source-grounded business context)

This block replaces the entire `=== GAMERSLAB PRODUCT BRIEF ===` content. Every line traces
to the PDF or the site. It is the editable single source of truth.

```
=== GAMERSLAB BRIEF ===

--- WHAT IT IS ---
GamersLab is the permissioned data layer that turns a game into a universal, official
game API. Studios integrate once and expose chosen game data OUT, on their own terms, to
independent builders who make leaderboards, stat trackers, tournament tools and companion
apps. Nothing flows back in. Read-only. No code runs inside the game.

One-liner (site): "The permissioned data layer linking your game and the UGC apps your
community wants to build."

--- THE OFFER TO A STUDIO ---
- Free for games and game studios. Costs are borne by the app-builder side.
- One SDK, any engine (Unity, Unreal, consoles, web3). Plain REST, key/value events
  (e.g. "kill / player name"). Most studios already expose this data somewhere.
- Integration: typically 2-3 afternoons.
- Control: per-field, per-audience permissions, with delays and redaction. Nothing is
  public unless the studio makes it public. Access can be revoked at any time (run it like
  your own Twitter/X API program).
- Safe by design: data only flows out from the studio's server. No new attack surface. If
  GamersLab goes down, the game keeps running.
- Early partners FOUND the ecosystem for their game and get influence over the roadmap;
  GamersLab actively helps seed apps and find builders.

--- THE ONLY APPROVED STATS (2025 mod.io / GameDiscoverCo study) ---
Games with official UGC support showed:
- +8% revenue after Year 1
- +31% revenue after Year 5
- +75% CCU after Year 2
- +115% CCU after Year 5
- ~75% longer player retention
Use AT MOST ONE stat per email. Cite no number not on this list.

--- THE BUYER (Studio persona) ---
Mid-level decision-maker: CTO, technical director, head of platform, or senior producer.
Can greenlight an integration but answers upward if it breaks. Deep, protective relationship
to the game. Skeptical, risk-averse, slow. Has been pitched many platforms; most died.
Their two questions: (1) Is my data/game safe? (2) What technical debt does this create?
Converts on: concrete reassurance, specific permission models, honest time estimates,
evidence the team will still exist in two years. Persuaded by the ABSENCE of red flags, not
by upside. Loses on: buzzwords, hype, too-good claims, pushy CTAs.

--- TWO GAME SUBTYPES (decides the core angle) ---
ESTABLISHED (released, past peak CCU, loyal but declining base, lean live-ops):
  Core pitch: REVITALIZATION. Give the community tools to pull lapsed players back and
  extend commercial life, with no significant engineering from the studio.
  Fear: irreversible decline. Desire: extend the game's life.
  Hook: "Your best players haven't left. Give them a reason to come back."

NEW / UPCOMING (in dev, early access, pre-launch):
  Core pitch: LAUNCH AMPLIFICATION. Launch with official data infrastructure already in
  place so builders make companion apps from day one.
  Fear: bad launch / early churn. Desire: build momentum from day one.
  Hook: "Launch with an ecosystem, not just a game."

--- FIVE POSITIONING ANGLES (pick ONE by signal) ---
1. UGC App Layer    -> live-ops / community managers; established games in visible decline.
2. Ecosystem        -> marketing / community leads; games with active Discord / creators.
3. Data API         -> engineers / technical leads; studios who considered their own API.
4. Trust Layer      -> competitive / ranked / prize / real-money / esports; web3-adjacent;
                       legal/auditability. (Verified, dispute-proof match results.)
5. Two-sided market -> investors / VCs / accelerators. (Rarely for cold studio outreach.)

--- OBJECTION MAP (pre-dissolve the ONE most relevant) ---
- "Don't want to share private/competitive data" -> per-field, per-audience control, delays,
  redaction; nothing public unless you choose; we co-author the data policy.
- "Don't want another dependency" -> data writes OUT from your server; if we go down your
  game runs; plain REST.
- "We'd have to build an integration" -> key/value pairs over REST; you likely already
  expose this; 2-3 afternoons.
- "There's no ecosystem yet" -> you don't join one, you found one for your game; first-mover
  influence; we help seed apps and find builders.
- "UGC = mods / security risk" -> this is data OUT, no code inside the game, no new attack
  surface.
- "IP misuse" -> like your own X API program: you set terms, approve access, revoke anytime;
  data as-is, no IP transfer, no warranty.
- "We're declining, builders won't care" -> builders build where players already exist; an
  established game with 50k monthly actives beats a promising new one with 500.

--- VOICE ---
Headline is control, safety, and zero lift relative to value. Lead with what they KEEP,
not what they get. Specific, technical language. Acknowledge tradeoffs. Treat them as the
smartest person in the room. AI is at most a subtle proof point ("tools built faster, by
more people, without your team"), never a headline. No hype, no buzzwords, no too-good claims.

--- CONTACT & CTA ---
Free integration, free analytics value. One soft CTA, a single question, never a link dump,
never "let me know if interested." The CTA is about GAMERSLAB (a short conversation, the
integration), never about a specific named app. Apps are illustrations of what the community
could build, not the product being sold.

--- BANNED ---
Never name a specific UGC app as a live product (apps are "coming soon"). Never use a number
not in the approved-stats list. Never use: synergy, circle back, touch base, game-changing,
seamless, at scale, revolutionize, disrupt, paradigm, "I hope this email finds you well",
"I came across your game", "I wanted to reach out", "I'd love to connect". No em dashes.
No exclamation marks in subjects. Body <= 130 words. One stat max. One CTA question.

=== END GAMERSLAB BRIEF ===
```

---

## 2. LEAD-FIT RUBRIC (derived from the brief above)

Derivation (so it is traceable, not invented): the value prop creates value when a game has
or could have a community that wants companion tools, the studio is lean enough to want a
low-lift solution and can't build tooling itself, the game is either declining-but-loved
(revitalization) or pre-launch (amplification), and ideally has competitive/prize play
(trust-layer demand). The guide also states builders go where players already exist.

GOOD LEAD signals (score higher):
- Community demand: active Discord, content creators, volume + recency of reviews, Steam
  Workshop, public leaderboards.
- UGC data surface: multiplayer, PvP, kill/stat tracking, ranked, tournaments (is there data
  worth exposing).
- Competitive / prize / real-money play -> strong Trust Layer fit (bonus).
- Studio agility: indie to mid-size, lean team (roughly 1-15), can greenlight fast.
- Phase fit: established past-peak BUT still active (revitalization), OR pre-launch / early
  access (amplification).

POOR FIT (score lower / archive):
- Single-player narrative, no replayability, no community.
- Fully sunset: no recent activity, dead community (builders won't care).
- Major publisher (Valve/EA/Ubisoft/Activision): too slow, decision buried.
- Tiny AND no community AND not pre-launch.

ANTI-FIT FLAGS (surface for the human, do NOT auto-penalise): bought a competitor, layoffs,
explicitly not our market, churned. Human decides at review.

Scoring must be EXPLAINED per signal with cited evidence, and must state which subtype
(established / upcoming) and which of the five angles the lead maps to.

---

## 3. PROMPT 1 — LEAD QUALIFICATION / FIT SCORING

```
{CAG BRIEF}

You are qualifying a game studio as an outreach lead for GamersLab. Use ONLY the brief above
plus the data below. Score the lead by how well it matches who the value proposition converts.

PUBLISHER: {publisher_name}
DEVELOPER: {developer_name}
GAME: {game_name}
GENRE: {primary_genre}   TAGS: {steam_tags}
DESCRIPTION: {steam_description}
RELEASE: {release_date} (coming_soon={coming_soon})
REVIEWS: {review_score}% from {total_reviews}
OWNERS / ACTIVES: {owners_estimate}, 2-week avg playtime {avg_playtime_2weeks}
PRICE: {price}
SIGNALS: pvp={has_online_pvp} leaderboards={has_steam_leaderboards}
         workshop={has_steam_workshop} multiplayer={has_multi_player}
WEB SEARCH RESULTS: {search_snippets}

Return ONLY valid JSON, no markdown:
{
  "subtype": "established | upcoming | neither",
  "phase_evidence": "what in the data places it in that subtype",
  "community_demand": "none | weak | moderate | strong, with evidence",
  "ugc_data_surface": "none | weak | moderate | strong, with evidence",
  "studio_agility": "major | mid | indie | unknown, with evidence",
  "best_angle": "ugc_app_layer | ecosystem | data_api | trust_layer | two_sided",
  "angle_rationale": "1 sentence tying signals to that angle",
  "fit_score": <0-100, derived from the rubric>,
  "score_rationale": "2 sentences citing the strongest 2-3 signals",
  "evidence_strength": "explicit | inferred | none",
  "evidence_quote": "strongest DATED public statement/review/job post, verbatim, or empty",
  "evidence_sources": ["url"],
  "evidence_as_of": "YYYY-MM-DD or empty",
  "risk_flags": [{"flag":"competitor_locked|layoffs|churned|not_our_market|inactive",
                  "evidence":"short phrase","source":"url"}],
  "recommended_action": "advance | warm_queue | archive"
}
```

---

## 4. PROMPT 2 — EMAIL DRAFT

Runs only for advanced leads. Receives the qualification output so the draft is consistent
with the chosen subtype and angle.

```
{CAG BRIEF}

Draft a cold email to the studio below. Follow the studio pitch ladder in order: what it does
(your game data as an official API, on your terms) -> why it matters (attract builders) ->
why it's safe (data out only) -> you control every permission -> 2-3 afternoons, free. Lead
with what they KEEP. Use the chosen subtype's hook and the chosen angle. Pre-dissolve the ONE
most relevant objection. At most one approved stat. End with one soft question about GamersLab
(a short conversation or the integration), never about a named app.

GAME: {game_name}   STUDIO: {publisher_name}
SUBTYPE: {subtype}   ANGLE: {best_angle}
CONTACT: {contact_name} ({contact_role}) <{contact_email}>
QUALIFICATION: {score_rationale}; pain: {evidence_quote}

Return ONLY valid JSON, no markdown:
{
  "draft_subject":   "<= 10 words, game + concrete claim, no exclamation marks, no app name",
  "draft_body":      "100-130 words, ladder order, lead with control/safety, one objection
                      dissolved, <=1 approved stat, one CTA question about GamersLab",
  "draft_ps":        "PS: optional, integration link only, no deck attached",
  "draft_subject_b": "a second SUBJECT only (the B variant tests subject framing)"
}
```

Note: variant B currently tests subject only (bodies are identical via the DB trigger). If a
real body-level A/B is wanted, add `draft_body_b` here and a matching `approved_body_b` column
+ trigger branch. Separate decision.

---

## 5. WHAT TO DELETE / CHANGE IN THE PIPELINE

- Delete the hardcoded `bestUgcApp` if/else in "Prepare LLM Items". Apps are not the pitch and
  must not be named as live products.
- Keep `pitchAngle` ONLY as a hint, but rename to subtype and let the qualification step set it
  from evidence (the established/upcoming split is legitimate and comes straight from the PDF).
- Replace the baked brief with the source-grounded brief in section 1, stored in `cag_context`
  (single source of truth, editable from the Business Context page) and injected by the
  existing "Apply CAG from DB" node.
- Reconcile scoring: the `Pre-Score` node and the LLM `fit_score` must use the same rubric
  (section 2). Either drive scoring from the brief, or make Pre-Score a cheap pre-filter whose
  thresholds come from the same value-prop signals.
- Purge every unsourced number from the live `cag_context` row.
```
