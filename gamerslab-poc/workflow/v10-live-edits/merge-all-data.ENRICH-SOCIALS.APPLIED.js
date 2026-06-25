// Merge All Data — APPLIED to live v10 (MouIeDmDAAHKIpDn) 2026-06-23.
// Enrichment lift: mine canonical socials from the Exa search results we already fetch
// (SPA-proof, zero added fetches) + drop WHOIS (removed: 0% real registrants by law).
// Replaces the prior version that mined only emails from search and took socials from the
// homepage scrape alone. See how/lead_contact_enrichment_options_DRAFT.md "Empirical update".
const steam  = $('Batch for Web Search').first().json;
const serper = $('Normalise Search').first().json;
const scrW   = $('Scrape Website').first().json;
const scrC   = $('Scrape Contact Page').first().json;

const organic = serper.organic || [];
const blob  = organic.map(r => (r.link||'') + ' ' + (r.snippet||'') + ' ' + (r.title||'')).join('\n');
const links = organic.map(r => r.link || '').filter(Boolean);

const SKIP_E = ['sentry','example','steam','@2x','wixpress','noreply','no-reply'];
const sEmails = [...new Set((blob.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []))]
  .filter(e => !SKIP_E.some(x => e.toLowerCase().includes(x)) && e.length < 60);

// Mine canonical social URLs from the search result links (SPA-proof: works even when the
// studio site is client-rendered and its raw HTML carries no links). WHOIS removed: 0% by law.
const fromLinks = (re) => { for (const l of links) { const m = l.match(re); if (m) return m[0]; } return ''; };
const searchTw = fromLinks(/(?:twitter\.com|x\.com)\/[A-Za-z0-9_]{2,30}/i);
const searchLi = fromLinks(/linkedin\.com\/(?:company|in)\/[A-Za-z0-9_\-%]+/i);
const searchDc = fromLinks(/discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[A-Za-z0-9\-]+/i);

const snips = organic.slice(0, 8).map(r => '[' + r.title + '] ' + r.snippet + ' (' + r.link + ')').join('\n');

let website = steam.publisher_website || '';
if (!website && organic.length) {
  const f = (organic[0].link || '');
  if (!['steampowered','wikipedia','youtube','twitter','x.com'].some(x => f.includes(x))) website = f;
}

let contactEmail = '', contactSource = 'not_found';
if      (steam.support_email)          { contactEmail = steam.support_email;          contactSource = 'steam_api'; }
else if (scrC.contact_page_best_email) { contactEmail = scrC.contact_page_best_email; contactSource = 'contact_page_scrape'; }
else if (scrW.scraped_best_email)      { contactEmail = scrW.scraped_best_email;      contactSource = 'website_scrape'; }
else if (sEmails.length)               { contactEmail = sEmails[0];                    contactSource = 'search'; }

const allEmails = [...new Set([
  steam.support_email, scrC.contact_page_best_email,
  ...(scrW.scraped_emails || []), ...sEmails
].filter(Boolean))];

const httpsify = u => u ? ('https://' + u.replace(/^https?:\/\//, '')) : '';
const twitter  = scrW.scraped_twitter  || scrC.contact_page_twitter  || httpsify(searchTw);
const linkedin = scrW.scraped_linkedin || scrC.contact_page_linkedin || httpsify(searchLi);
const discord  = scrW.scraped_discord  || scrC.contact_page_discord  || httpsify(searchDc);

return [{ json: {
  ...steam,
  publisher_website:      website,
  contact_email:          contactEmail,
  contact_email_all:      allEmails.join(', '),
  contact_source:         contactSource,
  whois_registrant_email: '',
  whois_registrant_name:  '',
  twitter_handle:         twitter,
  linkedin_company_url:   linkedin,
  discord_url:            discord,
  search_snippets:        snips
}}];
