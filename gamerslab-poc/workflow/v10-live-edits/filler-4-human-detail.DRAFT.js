// Filler 4 - Human detail (Lane A5)  -  DRAFT, PRE-GATE. NOT APPLIED to live v10.
// ---------------------------------------------------------------------------------------------
// Spec:  how/prospect_dossier_build_spec_DRAFT.md  §4.5 (authoritative)  +  §1 provenance quad,
//        §2 (new column founder_quote_as_of),  §6 Wave 1 (build order: human detail is item 5),
//        §7 modularity ledger row "4 human" (Exa = venue adapter; sources-to-mine = config).
// Why:   how/prospect_dossier_research_DRAFT.md  §2.3 (ONE specific, sourced, recent researched
//        line is the proof-of-homework personalization; an INCORRECT/ungrounded line is worse
//        than generic, 0.84%), §2.6 lever 5 (a human detail to mirror), §3 slot 4.
//
// SLOT ROLE (spec §1, §3, decision D-f):  Human detail is OPTIONAL. It LIFTS draft quality but is
//   NEVER in the coverage gate. This node never routes a lead to hold and never blocks a draft.
//   When it finds nothing sourced + dated it writes the slot EMPTY (no fabrication, §4.5 "empty
//   if no sourced line found") and the lead proceeds on its trigger/demand slots as normal.
//
// Placement (spec §4 preamble, §4.5):  an n8n Code node added to the live v10 engine
//   MouIeDmDAAHKIpDn between "Merge All Data" and "Build Final Record" (alongside the other
//   per-slot fillers). It reads the merged item (which already carries publisher_website,
//   twitter_handle, linkedin_company_url, publisher_name, game_name), fires ONE Exa search+contents
//   query over the studio's own surfaces, extracts at most ONE mirrorable line with a resolvable
//   source URL and a date, and writes the human-detail provenance quad back onto the item so
//   "Build Final Record" persists it to public.publishers.
//
// Node name (suggested):  "Filler 4 - Human Detail"
// Node type:  n8n-nodes-base.code  (Run Once for Each Item).  Self-contained: the Exa call is done
//   in-node via this.helpers.httpRequest so the filler is ONE swappable venue adapter, not a
//   separate HTTP node wired into the canvas (matches "a node or small node cluster", §4 preamble).
//
// PROVENANCE CONTRACT (spec §1):  every slot value is {value, source_url, date, evidence_strength}.
//   A value with NO source_url OR NO date is EMPTY by definition. So a candidate line is only
//   written when BOTH a resolvable result URL AND a date are present. The date must come from the
//   source itself (Exa publishedDate). We DO NOT stamp "today" on a quote: a quote's date is when
//   the studio SAID it, not when we fetched it (contrast Filler 1, where contact_as_of = observation
//   date is legitimate; a mirrorable line is a dated public statement, research §2.2/§2.3 "last ~14
//   days" freshness only means anything if the date is the statement's own date). No publishedDate
//   => slot stays EMPTY rather than write an undated, therefore unverifiable, line.
//
// COLUMN NAMES are REAL public.publishers columns, verified live 2026-06-24 (project
//   ccmwksmgoisijvyovgko):
//     founder_quote        (text)  - EXISTS
//     founder_quote_source (text)  - EXISTS
//     founder_name         (text)  - EXISTS (read-through only; we never invent a name here)
//     founder_quote_as_of  (date)  - NEW in spec §2 (the date half of this slot's quad)
//   Build Final Record already reads p.founder_quote / p.founder_quote_source / p.founder_name and
//   passes them through, and treats (founder_quote.length>20 && founder_quote_source) as
//   evidence_strength='explicit' + intel_quality='gold'. So writing these three onto the item is the
//   correct hand-off; this filler does NOT touch evidence_* (that is Filler 3's slot). No invented
//   columns. founder_quote_as_of must be ADDED to the "Build Final Record" passthrough + the Supabase
//   upsert column list at build time (see DEPLOY NOTES).
//
// EXA CALL verified live against the existing "Exa: Combined Search" node in MouIeDmDAAHKIpDn
//   (read 2026-06-24):  POST https://api.exa.ai/search  with httpHeaderAuth credential
//   ("EXA_API_KEY" header), body { query, numResults, type:'auto', contents:{ text:{ maxCharacters }}}.
//   Exa's /search returns results[] each with { title, url, publishedDate (ISO, may be null/absent),
//   author, text } when `contents.text` is requested (search + contents in ONE request = spec §4.5
//   "Exa search + contents", and ONE Exa query = the §4.5 free-tier budget). Confirm the exact
//   contents response shape with WebFetch against https://docs.exa.ai if the build run sees a
//   different field name for the snippet/date; the extraction below is defensive about both.
//
// FREE-TIER (rule #8, spec §4.5):  exactly ONE Exa query per lead, reusing the existing Exa
//   credential + budget freed by re-pointing the contact query (spec §4.5: "reusing the budget
//   freed by re-pointing the contact query"). No paid API, no second call, no spend.
//
// MODULARITY (mandate #7, spec §7):  the Exa search+contents call = venue adapter (swappable);
//   SOURCES_TO_MINE + the include/exclude domain shaping = TENANT CONFIG (which of the studio's own
//   surfaces we trust as a mirrorable source); the windowing + pick-ONE-line + quad assembly =
//   engine-generic. To onboard a different client you swap the config block, not this code. Do NOT
//   bake a GamersLab or Steam noun into the logic below the config block.
// ---------------------------------------------------------------------------------------------

// ===== TENANT CONFIG (sources-to-mine list) - the ONLY client-specific block ===================
// Spec §4.5: "Exa search + contents over the studio site / devblog / roadmap / recent interview or
// post; extract one mirrorable line (a roadmap promise, a devlog phrase, the founder's own
// wording)." The phrases below shape the Exa query toward the studio's OWN voice surfaces. Engine-
// generic code treats this purely as data.
const SOURCES_TO_MINE = [
  'devlog', 'dev blog', 'roadmap', 'development update', 'interview',
  'announcement', 'our vision', 'why we made', 'behind the scenes'
];
// Domains that are NOT a studio's own mirrorable voice (aggregators / stores / wikis). A line lifted
// from these is not "proof we read THEIR words", so they are down-ranked, not used as a source.
// Tenant-agnostic shaping; engine reads it as data.
const NON_VOICE_HOST_HINTS = [
  'store.steampowered.com', 'steamcommunity.com', 'wikipedia.org', 'fandom.com',
  'reddit.com', 'youtube.com', 'metacritic.com', 'igdb.com', 'mobygames.com',
  'crunchbase.com', 'linkedin.com', 'twitter.com', 'x.com', 'facebook.com'
];
// =============================================================================================

const FRESH_DAYS    = 540;          // a "human detail" line ages slower than a trigger; we accept a
                                    //   roadmap/devlog up to ~18 months old, but PREFER recent. The
                                    //   gate does not read this slot, so freshness only sorts, it
                                    //   does not exclude (research §2.3 applies the 14-day rule to the
                                    //   TRIGGER slot, not to a proof-of-homework mirror line).
const NUM_RESULTS   = 6;            // single Exa query; a handful of results to pick ONE line from
const MAX_CHARS     = 800;          // contents.text budget per result (matches the existing node's
                                    //   500-char shape, slightly larger to capture one full sentence)
const NOW_MS        = Date.now();

const item = $input.item.json;                 // merged record from "Merge All Data"

// Helper: a quad is only real if it has BOTH a source_url and a date (spec §1).
// For this slot the date MUST be the source's own publishedDate (see header note), never "today".
const isHttpUrl = u => typeof u === 'string' && /^https?:\/\//i.test(u);
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const isVoiceHost = u => {
  const h = hostOf(u);
  if (!h) return false;
  return !NON_VOICE_HOST_HINTS.some(bad => h.endsWith(bad) || h.includes(bad));
};
// Parse Exa publishedDate (ISO) -> YYYY-MM-DD, or null if absent/unparseable. No date => EMPTY slot.
const toIsoDate = d => {
  if (!d) return null;
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
};

// Build the studio identifiers we have. publisher_website is the strongest anchor; socials help Exa
// resolve the right studio. We never read a social handle as a "fact" - it only steers the query.
const website   = (item.publisher_website || '').trim();
const siteHost  = isHttpUrl(website) ? hostOf(website) : (website ? hostOf('https://' + website) : '');
const studio    = (item.publisher_name || item.publisher || item.developer || '').trim();
const game      = (item.game_name || item.name || '').trim();
const twitter   = (item.twitter_handle || '').replace(/^@/, '').trim();
const linkedin  = (item.linkedin_company_url || '').trim();

// Default = EMPTY slot (provenance contract): no source_url/date => nothing written, no fabrication.
let human = {
  founder_quote:        '',
  founder_quote_source: '',
  founder_quote_as_of:  null,   // YYYY-MM-DD from Exa publishedDate; null => slot empty
  evidence_strength:    'none', // not persisted by THIS slot, but carried for the namespaced trace
};

// Only fire Exa when we have something to anchor the studio on (a site or a name). Otherwise there
// is no defensible "their own words" target and we leave the slot empty (no blind query, saves the
// one free call for leads where it can land).
const haveAnchor = !!(siteHost || studio);

if (haveAnchor) {
  // ONE Exa query (spec §4.5). Bias toward the studio's own voice surfaces via SOURCES_TO_MINE, and
  // prefer the studio domain when we have it (Exa includeDomains scopes to their site/devblog).
  const queryParts = [
    studio, game,
    siteHost ? `site:${siteHost}` : '',
    SOURCES_TO_MINE.join(' OR ')
  ].filter(Boolean);
  const query = queryParts.join(' ');

  const body = {
    query,
    numResults: NUM_RESULTS,
    type: 'auto',
    contents: { text: { maxCharacters: MAX_CHARS } },
  };
  // Scope to the studio's own domain when known (their site + subdomains like blog./dev.). This is
  // the single biggest precision lever for "their own wording". Engine-generic: derived from data.
  if (siteHost) body.includeDomains = [siteHost];

  let resp = null;
  try {
    // Self-contained call through the SAME Exa credential the canvas already uses ("Exa: Combined
    // Search" -> httpHeaderAuth). nodeCredentialType binds the stored header-auth credential so the
    // key is NEVER inline (free-for-Ally + secret-hygiene). neverError keeps an Exa hiccup from
    // killing the per-item run; we just leave the slot empty on failure.
    resp = await this.helpers.httpRequestWithAuthentication.call(
      this,
      'httpHeaderAuth',                      // same generic header-auth credential type as the live node
      {
        method: 'POST',
        url: 'https://api.exa.ai/search',
        body,
        json: true,
        timeout: 20000,
      }
    );
  } catch (e) {
    // Network/endpoint/credential failure => leave slot EMPTY (no fabrication). Surface for debugging.
    resp = null;
    human._human_fetch_error = String(e && e.message ? e.message : e);
  }

  const results = (resp && Array.isArray(resp.results)) ? resp.results
                : (resp && Array.isArray(resp.data?.results)) ? resp.data.results
                : [];
  const cutoffMs = NOW_MS - FRESH_DAYS * 86400000;

  // Build grounded candidates: each needs a resolvable URL on a VOICE host AND a parseable date.
  // (Quad rule: value + source_url + date, or it is EMPTY. We never keep a line without both.)
  const candidates = [];
  for (const r of results) {
    const url = r && r.url;
    if (!isHttpUrl(url) || !isVoiceHost(url)) continue;     // not the studio's own voice => skip

    const dateIso = toIsoDate(r.publishedDate);
    if (!dateIso) continue;                                  // no source date => EMPTY by definition

    // The mirrorable text: prefer the contents snippet (their own words), fall back to title.
    const raw = (typeof r.text === 'string' && r.text.trim()) ? r.text
              : (typeof r.title === 'string' ? r.title : '');
    if (!raw || !raw.trim()) continue;

    // Extract ONE line (spec §4.5 "Strictly one line"). Take the first sentence that reads like a
    // claim/promise/wording, normalised to a single line. Engine-generic, no client nouns.
    const oneLine = firstMirrorableLine(raw);
    if (!oneLine) continue;

    const onOwnSite = !!(siteHost && hostOf(url) === siteHost);   // their own domain = strongest
    const ageMs = NOW_MS - (Date.parse(r.publishedDate) || NOW_MS);
    const inWindow = (NOW_MS - (Date.parse(r.publishedDate) || 0)) >= 0 &&
                     (Date.parse(r.publishedDate) || 0) >= cutoffMs;

    candidates.push({
      line: oneLine,
      url,
      date: dateIso,
      onOwnSite,
      ageMs,
      inWindow,
      tweetable: oneLine.length <= 200,    // a mirrorable line is short; long ones rank lower
    });
  }

  if (candidates.length) {
    // Pick the SINGLE best line (spec §4.5 "extract ONE mirrorable line"):
    //   own-domain first (their literal words) -> in fresh window -> recency -> shorter line.
    candidates.sort((a, b) => {
      if (a.onOwnSite !== b.onOwnSite) return a.onOwnSite ? -1 : 1;
      if (a.inWindow  !== b.inWindow)  return a.inWindow  ? -1 : 1;
      if (a.ageMs     !== b.ageMs)     return a.ageMs - b.ageMs;          // newer first
      return (a.line.length - b.line.length);                            // shorter first
    });
    const best = candidates[0];

    // evidence_strength = 'explicit' ONLY when the line is from the studio's OWN domain (their literal
    // public wording with a source + date). A line from another voice host (an interview elsewhere) is
    // 'inferred'. This mirrors Build Final Record's own bar and the §1 rubric. The slot is NOT in the
    // gate, so this label only flavours intel_quality, it never blocks.
    const strength = best.onOwnSite ? 'explicit' : 'inferred';

    human = {
      // founder_quote here is a GENERIC mirrorable research line (spec §4.5: "founder_quote (or a
      // generic research line)"). We do NOT claim it is the founder's quote unless the source clearly
      // is the founder; founder_name is left to whatever the merge already holds (we never invent it).
      founder_quote:        best.line,
      founder_quote_source: best.url,          // resolvable URL = the source half of the quad
      founder_quote_as_of:  best.date,         // source's OWN publishedDate = the date half of the quad
      evidence_strength:    strength,
    };
  }
  // else: no grounded line (no result on a voice host WITH a date) => slot stays EMPTY (spec §4.5
  // "empty if no sourced line found"). No fabrication, no blind write.
}

// Extract one mirrorable line from a block of contents text. Engine-generic:
//   - collapse whitespace, split into sentences, drop boilerplate/cookie/nav noise,
//   - return the first sentence that looks like a real statement (has letters + reasonable length),
//   - hard-cap length so the draft keeps to 1-2 specifics (research §2.3).
function firstMirrorableLine(text) {
  const cleaned = String(text)
    .replace(/\s+/g, ' ')
    .replace(/\b(cookie|cookies|privacy policy|all rights reserved|sign up|subscribe|newsletter)\b/gi, '')
    .trim();
  if (!cleaned) return '';
  // Split on sentence boundaries; keep the first that has >= 5 words and >= 20 chars of letters.
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  for (let s of sentences) {
    s = s.trim();
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    const words = s.split(/\s+/).filter(Boolean).length;
    if (letters >= 20 && words >= 5) {
      if (s.length > 240) s = s.slice(0, 237).trimEnd() + '...';   // one line, capped
      return s;
    }
  }
  // Fallback: the whole cleaned blob trimmed to one capped line (still one line, still sourced+dated).
  return cleaned.length > 240 ? cleaned.slice(0, 237).trimEnd() + '...' : cleaned;
}

// Write the human-detail quad back onto the item. We hand "Build Final Record" the three real
// columns (it already passes founder_quote / founder_quote_source / founder_name through and uses
// founder_quote_source as an evidence source). founder_quote_as_of is NEW (spec §2) and must be
// added to Build Final Record's passthrough + the Supabase upsert list at build time. We do NOT
// overwrite founder_name (never invented here) and do NOT touch evidence_* (Filler 3's slot).
return [{
  json: {
    ...item,
    // Direct slot fields (real publishers columns) - what persistence reads:
    founder_quote:        human.founder_quote,
    founder_quote_source: human.founder_quote_source,
    founder_quote_as_of:  human.founder_quote_as_of,   // NEW column (spec §2); null => slot empty
    // founder_name passes through untouched (we never fabricate a name in this filler):
    founder_name:         item.founder_name || '',
    // Namespaced copy for traceability + any fetch error surfaced (mirrors Filler 3's _demand):
    _human: human,
  }
}];

// =============================================================================================
// DEPLOY NOTES (build gate, when approved - per spec §6 Wave 1, item 4.5):
//  1. Add the new column once (spec §2 - NOT applied here):
//        ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS founder_quote_as_of date;
//  2. Wire this Code node between "Merge All Data" and "Build Final Record" (in the filler lane,
//     after the contact query has been re-pointed so its Exa budget is the one this node spends).
//  3. Bind this node to the SAME Exa header-auth credential the live "Exa: Combined Search" node
//     uses (httpHeaderAuth) so the key is never inline. Confirm the credential name in n8n.
//  4. In "Build Final Record": add founder_quote_as_of to the passthrough object (it already passes
//     founder_quote / founder_quote_source). In the "Upsert to Supabase" node: add founder_quote_as_of
//     to the column list so the date persists.
//  5. Verify the Exa contents response field names with WebFetch against https://docs.exa.ai before
//     the first live run (the extraction is defensive about results[].text and results[].publishedDate,
//     but confirm 2026 field names; if Exa returns `highlights` or a different date key, adjust the
//     two reads marked r.text / r.publishedDate only).
//  6. Acceptance (spec §4.5): when populated, the line carries a resolvable founder_quote_source AND a
//     founder_quote_as_of; EMPTY otherwise (no fabrication). Spot-check 20 fresh rows: every non-empty
//     line opens its source_url and the dated statement is actually on that page.
//  7. Draft-time guard (decision D-f, research §2.3): the draft prompt must keep TOTAL specifics to
//     1-2; this slot contributes at most ONE line, so the human detail + one trigger/demand line is
//     the cap. This filler enforces "one line"; the drafter enforces "1-2 total".
// =============================================================================================
