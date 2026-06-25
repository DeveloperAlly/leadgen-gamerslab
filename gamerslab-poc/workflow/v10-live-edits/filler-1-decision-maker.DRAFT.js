// =============================================================================
// Filler 1 - Decision-maker waterfall   (DRAFT, PRE-GATE - NOT applied to live)
// =============================================================================
// Spec:    how/prospect_dossier_build_spec_DRAFT.md  §4.3 (this node), §1 (slot 1),
//          §3 (gate: contact is NON-BLOCKING), §7 (modularity ledger row "1 contact").
// Why:     how/prospect_dossier_research_DRAFT.md     §2.4 (decision-maker = biggest
//          single win-rate lever), §2.5 (enrichment = per-field waterfall).
// Target:  live v10 engine MouIeDmDAAHKIpDn, as a Code node placed in the contact
//          lane between "Merge All Data" and "Verify Email" (so its email selection
//          feeds the existing MX check), OR folded into "Merge All Data" itself.
//          This draft is written to run AS-IF it sits right after "Merge All Data":
//          it reads that node's output and the same upstream search nodes.
//
// HARD RULES honoured (CLAUDE.md non-negotiables):
//   #1  PRE-GATE. This file is a DRAFT target. Do NOT update_workflow / publish.
//   #8  FREE TIERS ONLY. Steam support field, site scrape, Exa (existing key/budget),
//       SerpAPI fallback (existing), pattern-guess + dns.google MX = all free.
//       The PAID people-data tier (Hunter/Apollo) is a DARK, opt-in config stub only
//       (spec D-e: "Paid people-data is out of scope (D-e)"). See PAID_TIER below.
//   #7  MODULAR. The call surfaces (Steam / scrape / Exa / SerpAPI / MX) are venue
//       adapters; the role-rank rubric + the dark paid tier are tenant config; the
//       waterfall + role-rank + provenance writing are engine-generic. No "GamersLab"
//       or "Steam" noun is baked into the ranking logic.
//
// PROVENANCE QUAD (spec §1): every slot value is {value, source_url, date,
//   evidence_strength}. For the contact slot the persisted shape is the existing
//   columns PLUS contact_as_of (new in spec §2). A contact value with NO source_url
//   or NO date is EMPTY by definition -> we DO NOT write a name/email we cannot source
//   and date. contact_source carries the source identity; contact_as_of carries the date.
//
// GATE ROLE (spec §3 / D-b): contact is SCORED + PREFERRED, NEVER BLOCKING.
//   This node never routes a lead to hold. A named BD/dev-rel/founder lifts the Slot 6
//   priority score and sets the send target; a bare role inbox is an acceptable send
//   target when that is all we have. The coverage gate (separate node, spec §3) reads
//   Slot 2/3, not this slot. We emit `contact_is_named` (bool) purely as a score input
//   for Filler 6, not as a gate.
//
// n8n mode: Run Once for All Items is fine (this node is per-candidate in the v10
//   per-publisher loop, so first() on upstream nodes is the current candidate).
// =============================================================================

// ---- tenant config (would live in the CAG-derived config, not engine code) ----
// Role taxonomy + rank. Higher rank = more preferred send target (spec §4.3
// "prefer a named BD/dev-relations/founder over a shared inbox"). Engine reads this
// table; swapping clients swaps the table, not the matcher below.
const ROLE_RANK = [
  // pattern (tested against name/role text or email local-part), label, rank, is_named
  { re: /\b(business development|biz ?dev|bd|partnerships?|publishing)\b/i, role: 'business_development', rank: 5, named: true },
  { re: /\b(dev(eloper)? relations|devrel|community|evangelis)/i,          role: 'dev_relations',        rank: 4, named: true },
  { re: /\b(founder|co-?founder|ceo|owner|director|head of)\b/i,           role: 'founder_exec',         rank: 4, named: true },
  { re: /\b(marketing|pr|press|comms?)\b/i,                                role: 'marketing_pr',         rank: 3, named: true },
];
// Email local-parts that are shared inboxes (NOT a named person). Ranked below any
// named contact. Order = preference among inboxes (bizdev/publishing beat info/support).
const INBOX_RANK = [
  { re: /^(bizdev|partnerships?|publishing|business)@/i, role: 'bd_inbox',      rank: 2 },
  { re: /^(pr|press|marketing)@/i,                       role: 'pr_inbox',      rank: 2 },
  { re: /^(hello|hi|contact|team|office|hq|mail)@/i,     role: 'general_inbox', rank: 1 },
  { re: /^(info|support|admin|help|sales|noreply)@/i,    role: 'support_inbox', rank: 0 },
];

// PAID TIER STUB - DARK BY DEFAULT (spec §4.3 / D-e: opt-in, out of scope for v1).
// Engine-generic adapter seam. When (and only when) a tenant supplies their OWN key,
// a later build wires Hunter/Apollo as waterfall step 5 between SerpAPI and pattern-guess.
// Leaving the seam here makes that a config flip, not a re-architecture. NO network
// call is made while enabled === false (free-for-Ally rule #8).
const PAID_TIER = {
  enabled: false,            // <- DO NOT flip in v1. Build gate + tenant key required.
  provider: null,            // 'hunter' | 'apollo'
  // key:    via n8n credential, NEVER inline (see contact_enrichment_waterfall_DRAFT §9.4)
  // endpoint, parse(): defined at build time when enabled.
};

// ----------------------------------------------------------------------------
// Inputs: read the same upstream nodes "Merge All Data" already reads, so this
// node is order-independent of whether it sits before or inside that merge.
// All node names verified against live v10 MouIeDmDAAHKIpDn on 2026-06-24.
// ----------------------------------------------------------------------------
const merged = $('Merge All Data').first().json;            // current candidate, post-merge
const steam  = $('Batch for Web Search').first().json;      // Steam app facts (support_info.email)
const serper = $('Normalise Search').first().json;          // Exa/SerpAPI normalised results
const scrC   = $('Scrape Contact Page').first().json;       // contact-page scrape (emails + names?)
const scrW   = $('Scrape Website').first().json;            // homepage scrape

const today = new Date().toISOString().slice(0, 10);        // YYYY-MM-DD, the date half of the quad

// Helper: a quad is only real if it has BOTH a source_url and a date (spec §1).
const ground = (value, source_url, date) =>
  (value && source_url && date) ? { value, source_url, date } : null;

// Helper: classify an email/name+role into {role, rank, named} via the config tables.
function classifyContact(name, roleText, email) {
  const hay = [name, roleText].filter(Boolean).join(' ');
  for (const r of ROLE_RANK) {
    if ((hay && r.re.test(hay)) || (email && r.re.test(email.split('@')[0]))) {
      return { role: r.role, rank: r.rank, named: r.named };
    }
  }
  if (email) {
    for (const ib of INBOX_RANK) if (ib.re.test(email)) return { role: ib.role, rank: ib.rank, named: false };
  }
  // Unknown email shape that is not obviously an inbox: treat as low-rank inbox, unnamed.
  return { role: email ? 'unknown_inbox' : 'unknown', rank: email ? 1 : -1, named: false };
}

// ----------------------------------------------------------------------------
// The waterfall. Each step is a candidate-producer. We DO NOT stop at the first
// non-empty value; spec §4.3 says "stop at first VERIFIED" but also "prefer a named
// person over a shared inbox". So: collect every grounded candidate from the free
// tiers, then pick by (named first, then rank, then source priority). This satisfies
// both "first verified wins" (a verified named BD short-circuits nothing cheaper) and
// the role-rank preference, without ever blocking.
// Source priority is a tiebreak only: closer-to-the-studio sources are more trustworthy.
// ----------------------------------------------------------------------------
const SOURCE_PRIORITY = {                  // higher = more trusted as a contact origin
  steam_api: 5, contact_page_scrape: 4, website_scrape: 3, exa_search: 2, serpapi_search: 2, pattern_guess: 1,
};
const candidates = [];

// --- Step 1: Steam support_info.email (keyless, already fetched) -------------
// Source url = the Steam app page; date = today (the day we observed the field).
// support_info.email is a shared inbox by nature -> unnamed, but a valid send target.
if (steam.support_email) {
  const c = classifyContact('', '', steam.support_email);
  const appUrl = steam.steam_app_id ? `https://store.steampowered.com/app/${steam.steam_app_id}` : (steam.publisher_website || '');
  const q = ground(steam.support_email, appUrl, today);
  if (q) candidates.push({ name: '', role: c.role, email: q.value, source: 'steam_api',
                            source_url: q.source_url, date: q.date, rank: c.rank, named: c.named });
}

// --- Step 2: publisher site contact-page scrape (free) -----------------------
// "Scrape Contact Page" already extracts emails; it does NOT yet extract a person
// name (a build-time lift: a "mailto: Name <local@>" or a byline near the address).
// Until it does, scraped emails are inbox-classified. source_url = the contact page.
if (scrC.contact_page_best_email) {
  const c = classifyContact(scrC.contact_page_name || '', scrC.contact_page_role || '', scrC.contact_page_best_email);
  const srcUrl = scrC.contact_page_url || merged.publisher_website || scrW.scraped_from_url || '';
  const q = ground(scrC.contact_page_best_email, srcUrl, today);
  if (q) candidates.push({ name: scrC.contact_page_name || '', role: c.role, email: q.value,
                            source: 'contact_page_scrape', source_url: q.source_url, date: q.date,
                            rank: c.rank, named: c.named });
}
if (scrW.scraped_best_email) {
  const c = classifyContact('', '', scrW.scraped_best_email);
  const q = ground(scrW.scraped_best_email, merged.publisher_website || '', today);
  if (q) candidates.push({ name: '', role: c.role, email: q.value, source: 'website_scrape',
                            source_url: q.source_url, date: q.date, rank: c.rank, named: c.named });
}

// --- Step 3 + 4: Exa search -> SerpAPI fallback (free; already wired) ---------
// Spec query intent: "<studio> publishing OR business development OR dev relations
// contact". The live "Exa: Combined Search" already fires a contact-intent query and
// "Normalise Search" hands us `organic[]` (Exa first, SerpAPI on Exa-empty via the
// existing "Exa Has Results?" IF). We mine BOTH a named-person + role AND an email
// from those results, each carrying its own result link as source_url.
const organic = serper.organic || [];
const usedSerp = serper.source === 'serpapi' || serper.provider === 'serpapi'; // best-effort source tag
const SKIP_E = ['sentry','example','steam','@2x','wixpress','noreply','no-reply','donotreply'];

for (const r of organic.slice(0, 8)) {
  const link = r.link || '';
  const text = [(r.title || ''), (r.snippet || '')].join(' ');
  if (!link) continue;

  // 3a. Named person + BD/dev-rel/founder role mined from the result text.
  //     Pattern: a TitleCase name sitting next to a role keyword we rank as "named".
  const roleHit = ROLE_RANK.find(rr => rr.named && rr.re.test(text));
  if (roleHit) {
    const nm = (text.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/) || [])[0] || '';
    if (nm) {
      candidates.push({ name: nm, role: roleHit.role, email: '', source: usedSerp ? 'serpapi_search' : 'exa_search',
                        source_url: link, date: today, rank: roleHit.rank, named: true });
    }
  }

  // 3b. Email mined from the result text, source_url = the result link.
  const em = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
    .find(e => !SKIP_E.some(x => e.toLowerCase().includes(x)) && e.length < 60);
  if (em) {
    const c = classifyContact('', '', em);
    candidates.push({ name: '', role: c.role, email: em, source: usedSerp ? 'serpapi_search' : 'exa_search',
                      source_url: link, date: today, rank: c.rank, named: c.named });
  }
}

// --- Step 5 (PAID, DARK): Hunter/Apollo people-data ---------------------------
// Out of scope for v1 (spec D-e). No call made while PAID_TIER.enabled === false.
// When a build enables it (tenant's own key), it slots HERE: a named person + verified
// email with the provider page as source_url and the lookup date as `date`. Left dark.
if (PAID_TIER.enabled) {
  // intentionally unreachable in v1. Build-time: push a {name, role, email, source:
  //   PAID_TIER.provider+'_api', source_url, date, rank, named:true} candidate here.
}

// --- Step 6: pattern-guess + MX verify (free, last resort) -------------------
// Spec: "email pattern-guess + MX/email_valid verify". We only GUESS when we already
// have a NAMED person (from step 3a) but no email, AND we have a domain. A bare guessed
// inbox with no name is NOT written (it would be an ungrounded value: no real source_url).
// The actual MX check is the existing downstream "Verify Email" -> "Classify Email"
// nodes (dns.google MX lookup). We set the chosen email; they set email_valid/email_status.
function domainOf(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\./, ''); }
  catch (e) { return ''; }
}
const namedNoEmail = candidates.find(c => c.named && c.name && !c.email);
const domain = domainOf(merged.publisher_website || '');
if (namedNoEmail && domain) {
  const parts = namedNoEmail.name.toLowerCase().split(/\s+/);
  if (parts.length >= 2) {
    const guess = `${parts[0]}.${parts[parts.length - 1]}@${domain}`;  // first.last@domain
    // provenance: the GUESS is a derivation, source_url = the page that named the person,
    // not a directory listing. It is a candidate ONLY; if MX fails downstream it is dropped.
    candidates.push({ name: namedNoEmail.name, role: namedNoEmail.role, email: guess,
                      source: 'pattern_guess', source_url: namedNoEmail.source_url, date: today,
                      rank: namedNoEmail.rank, named: true, is_guess: true });
  }
}

// ----------------------------------------------------------------------------
// PICK: role-rank waterfall. Order by (named desc, rank desc, source-trust desc,
// non-guess before guess). This is where "prefer a named BD/dev-rel/founder over a
// shared inbox" is enforced. Never blocks: if `candidates` is empty we simply write
// an empty slot and the lead still drafts (gate ignores Slot 1).
// ----------------------------------------------------------------------------
candidates.sort((a, b) =>
  (Number(b.named) - Number(a.named)) ||
  (b.rank - a.rank) ||
  ((SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0)) ||
  (Number(!!a.is_guess) - Number(!!b.is_guess))
);

const best = candidates[0] || null;

// Collect every distinct grounded email for contact_email_all (audit trail), preserving
// the existing column's "comma-joined" shape (see merge-all-data.ENRICH-SOCIALS.APPLIED.js).
const allEmails = [...new Set(candidates.map(c => c.email).filter(Boolean))];

// ----------------------------------------------------------------------------
// WRITE the slot. Quad-aware: we only write name/email/role when there is a
// source_url + date behind them (best is null-or-grounded by construction).
// contact_source = the source identity; contact_as_of = the date half of the quad.
// We pass the chosen email into contact_email so the existing "Verify Email" ->
// "Classify Email" nodes run MX on it and set email_valid / email_status (we do NOT
// duplicate that logic here - single source of truth, spec §4.3 "MX/email_valid verify").
// ----------------------------------------------------------------------------
const out = {
  ...merged,

  // Slot 1 provenance quad (persisted across these columns, all verified live 2026-06-24):
  contact_name:   best && best.named ? best.name : '',     // empty unless a real named person
  contact_role:   best ? best.role : '',
  contact_email:  best ? best.email : (merged.contact_email || ''), // keep prior if waterfall found none
  contact_email_all: allEmails.length ? allEmails.join(', ') : (merged.contact_email_all || ''),
  contact_source: best ? best.source : (merged.contact_source || 'not_found'),
  contact_as_of:  best ? best.date : null,                 // NEW column (spec §2). null => slot empty.

  // email_valid / email_status are intentionally LEFT for "Classify Email" downstream.
  // We pre-seed them empty so a stale prior value never leaks if the candidate changed.
  // (If this node is wired AFTER Classify Email instead, delete these two lines.)
  email_valid:  false,
  email_status: best && best.email ? 'pending_mx' : 'no_email',

  // Non-gating score input for Filler 6 (spec §3: contact is scored, never blocks).
  // A named verified contact raises Slot 6 priority + sets the human send target.
  contact_is_named: !!(best && best.named),
  contact_rank:     best ? best.rank : -1,
};

return [{ json: out }];

// =============================================================================
// DEPLOY NOTES (build gate, when approved - per spec §6 Wave 1, item 4.3):
//  1. Add column once (spec §2): ALTER TABLE public.publishers
//        ADD COLUMN IF NOT EXISTS contact_as_of date;   -- NOT applied here.
//  2. Wire this Code node between "Merge All Data" and "Verify Email" (so the chosen
//     contact_email flows into the existing dns.google MX check + "Classify Email").
//  3. Map contact_as_of (and contact_is_named/contact_rank if surfaced) into the
//     "Upsert to Supabase" node column list and into "Build Final Record".
//  4. Lift "Scrape Contact Page" to also capture a person NAME near the address, so the
//     named-person branch (step 2 / 3a) fires more than the search path alone. Until then
//     named coverage rides Exa/SerpAPI text mining.
//  5. Acceptance (spec §4.3): named-contact real-rate on new A/B rows rises from ~3%
//     toward an agreed target (open question §9.1); every written contact carries a
//     contact_source AND a contact_as_of (no quad => no write).
//  6. PAID_TIER stays enabled:false. Flipping it is a SEPARATE gated decision (spec §9.4)
//     and requires a tenant-supplied key via n8n credential, never inline.
// =============================================================================
