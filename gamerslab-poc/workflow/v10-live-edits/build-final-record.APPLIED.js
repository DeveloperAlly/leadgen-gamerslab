const r   = $input.first().json;
const p   = r._parsed   || {};
const src = r._source   || {};

const steam_app_id = src.steam_app_id || '';
if (!steam_app_id) throw new Error('steam_app_id missing from _source');

const fullBody = ((p.draft_body || '') + (p.draft_ps ? '\n\n' + p.draft_ps : '')).trim();

let intel_quality = p.intel_quality || 'no_signal';
if (!p.intel_quality) {
  if      (p.founder_quote && p.founder_quote.length > 20) intel_quality = 'gold';
  else if (p.pain_signal   && p.pain_signal.length   > 10) intel_quality = 'silver';
  else if (src.contact_email)                               intel_quality = 'bronze';
}

const pre_score     = r._pre_score     !== undefined ? r._pre_score     : (src.pre_score     || 0);
const outreach_tier = r._outreach_tier                                   || (src.outreach_tier || 'skip');
const pitch_angle   = r._pitch_angle                                     || (src.pitch_angle   || '');
const best_ugc_app  = r._best_ugc_app                                    || (src.best_ugc_app  || '');


// D1/N5/N9 - evidence rubric, anti-fit flags, recency decay.
// Prefer LLM-emitted fields; fall back to heuristics from existing intel when absent.
const HALFLIFE_DAYS = 180;
let evidence_strength = ['explicit','inferred','none'].includes(p.evidence_strength) ? p.evidence_strength : null;
let evidence_quote    = p.evidence_quote || '';
let evidence_sources  = Array.isArray(p.evidence_sources) ? p.evidence_sources.filter(Boolean) : [];
let evidence_as_of    = (typeof p.evidence_as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.evidence_as_of)) ? p.evidence_as_of : null;
if (!evidence_strength) {
  if      (p.founder_quote && p.founder_quote.length > 20 && p.founder_quote_source) evidence_strength = 'explicit';
  else if (p.pain_signal   && p.pain_signal.length   > 10)                            evidence_strength = 'inferred';
  else                                                                                evidence_strength = 'none';
}
if (!evidence_quote)                          evidence_quote   = p.founder_quote || p.pain_signal || '';
if (!evidence_sources.length && p.founder_quote_source) evidence_sources = [p.founder_quote_source];
let evidence_decay_weight = null; // N9: exp(-age_days/halflife); null when undated
if (evidence_as_of) {
  const ageDays = Math.max(0, (Date.now() - new Date(evidence_as_of).getTime()) / 86400000);
  evidence_decay_weight = Math.round(Math.exp(-ageDays / HALFLIFE_DAYS) * 1000) / 1000;
}
let risk_flags = Array.isArray(p.risk_flags) ? p.risk_flags.filter(f => f && f.flag) : []; // N5: flag, never suppress
if (!risk_flags.length && (src.game_phase === 'sunset' || (src.avg_playtime_2weeks === 0 && src.total_reviews > 0))) {
  risk_flags.push({ flag: 'inactive', evidence: 'sunset / zero recent playtime', source: '' });
}

return [{ json: {
  steam_app_id,
  game_name:              src.game_name              || '',
  publisher_name:         src.publisher_name         || '',
  developer_name:         src.developer_name         || '',
  primary_genre:          src.primary_genre          || '',
  steam_tags:             src.steam_tags             || '',
  steam_description:      src.steam_description      || '',
  review_score:           src.review_score           || 0,
  total_reviews:          src.total_reviews          || 0,
  owners_estimate:        src.owners_estimate        || '',
  avg_playtime_2weeks:    src.avg_playtime_2weeks     || 0,
  release_date:           src.release_date           || '',
  coming_soon:            src.coming_soon            || false,
  game_phase:             src.game_phase             || '',
  is_free:                src.is_free                || false,
  price_usd:              src.price_usd              || 0,
  has_multi_player:       src.has_multi_player       || false,
  has_online_pvp:         src.has_online_pvp         || false,
  has_steam_leaderboards: src.has_steam_leaderboards || false,
  has_steam_workshop:     src.has_steam_workshop     || false,
  has_online_coop:        src.has_online_coop        || false,
  publisher_website:      p.publisher_website        || src.publisher_website    || '',
  support_email:          src.support_email          || '',
  contact_email:          src.contact_email          || '',
  contact_email_all:      src.contact_email_all      || '',
  contact_source:         src.contact_source         || '',
  contact_name:           p.contact_name             || src.contact_name         || '',
  contact_role:           p.contact_role             || src.contact_role         || '',
  whois_registrant_email: src.whois_registrant_email || '',
  whois_registrant_name:  src.whois_registrant_name  || '',
  twitter_handle:         p.twitter_handle           || src.twitter_handle       || '',
  linkedin_company_url:   p.linkedin_company_url     || src.linkedin_company_url || '',
  discord_url:            src.discord_url            || '',
  founder_name:           p.founder_name             || '',
  founder_quote:          p.founder_quote            || '',
  founder_quote_source:   p.founder_quote_source     || '',
  pain_signal:            p.pain_signal              || '',
  intel_summary:          p.intel_summary            || '',
  intel_quality,
  evidence_strength,
  evidence_quote,
  evidence_sources:      JSON.stringify(evidence_sources),
  evidence_as_of,
  evidence_decay_weight,
  risk_flags:            JSON.stringify(risk_flags),
  pre_score,
  outreach_tier,
  fit_score:              typeof p.fit_score === 'number' ? p.fit_score : 0,
  score_rationale:        p.score_rationale          || '',
  pitch_angle,
  best_ugc_app,
  gamerslab_hook:         p.gamerslab_hook           || '',
  ugc_app_pitch:          p.ugc_app_pitch            || '',
  peer_publisher_ref:     p.peer_publisher_ref       || '',
  draft_subject:          p.draft_subject            || '',
  draft_body:             fullBody,
  recommended_action:     p.recommended_action       || 'archive',
  model_used:             r._model_used              || '',
  email_valid:            src.email_valid || false,
  email_status:           src.email_status || 'no_email',
  pipeline_status:        outreach_tier === 'skip' ? 'skip' : 'draft'
}}];
