// Scrape Contact Page — APPLIED to live v10 (MouIeDmDAAHKIpDn) 2026-06-23.
// The contact/about page is already fetched; now also extract socials from it (was emails
// only). Feeds Merge All Data's social fallback chain. See merge-all-data.ENRICH-SOCIALS.APPLIED.js.
let html = '';
try {
  const r = $input.first().json;
  html = (typeof r === 'string') ? r : (r.data || r.body || r.text || '');
  if (typeof html !== 'string') html = '';
} catch(e) { html = ''; }
const SKIP = ['sentry','example','noreply','no-reply','@2x','steam','donotreply'];
const raw  = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
const emails = [...new Set(raw)].filter(e =>
  !SKIP.some(x => e.toLowerCase().includes(x)) && e.length < 60
);
const after = (src, prefix) => {
  const i = src.indexOf(prefix);
  if (i === -1) return '';
  const stops = ['"', "'", ' ', '\n', '\r', '<', '>', '?', '&', '#'];
  let e = i + prefix.length;
  while (e < src.length && !stops.includes(src[e])) e++;
  const val = src.substring(i + prefix.length, e);
  return val.length > 1 && val.length < 50 ? val : '';
};
const tw = after(html, 'twitter.com/') || after(html, 'x.com/');
const li = after(html, 'linkedin.com/company/');
const dc = after(html, 'discord.gg/');
return [{ json: {
  contact_page_best_email: emails[0] || '',
  contact_page_emails: emails,
  contact_page_twitter:  tw ? '@' + tw : '',
  contact_page_linkedin: li ? 'https://linkedin.com/company/' + li : '',
  contact_page_discord:  dc ? 'https://discord.gg/' + dc : ''
}}];
