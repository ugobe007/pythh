/**
 * Shared funding detection + verification for Oracle portfolio monitoring.
 */

const FUNDING_RE = /\b(raises?|raised|secures?|closed|announces?\s+\$|seed\s+round|series\s+[a-e]|pre[- ]?seed|funding\s+round|venture\s+capital|vc\s+backed|unicorn|billion|million.*round|round.*investment)\b/i;
const AMOUNT_RE = /\$\s*(\d[\d,.]*)\s*(million|billion|M|B)\b/gi;
const ROUND_RE = /\b(pre[- ]?seed|seed|series\s+[a-e]\+?|mezzanine|mezz(?:anine)?\s+round|growth\s+round|late\s+stage)\b/i;
const INVESTOR_RE = /\b(led\s+by|co[- ]?led\s+by|backed\s+by)\s+([A-Z][A-Za-z\s,&]+?)(?:\s+and\s+|\.|,|\n)/;

function extractAmountUsd(text) {
  let match;
  let amount = null;
  const re = new RegExp(AMOUNT_RE.source, 'gi');
  while ((match = re.exec(text)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    const mult = match[2].toLowerCase().startsWith('b') ? 1_000_000_000 : 1_000_000;
    amount = Math.round(num * mult);
    break;
  }
  return amount;
}

function extractRoundType(text) {
  const m = text.match(ROUND_RE);
  if (!m) return null;
  return m[1].toLowerCase().replace(/\s+/g, '-').replace(/\+/, 'plus');
}

function extractLeadInvestor(text) {
  const m = text.match(INVESTOR_RE);
  return m ? m[2].trim().slice(0, 80) : null;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function companyMentioned(text, companyName) {
  if (!companyName) return false;
  const tokens = companyName.split(/\s+/).filter((t) => t.length > 2);
  if (!tokens.length) return false;
  if (tokens.length >= 2) {
    return tokens.every((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i').test(text));
  }
  const primary = escapeRegExp(tokens[0]);
  return new RegExp(`\\b${primary}\\b`, 'i').test(text);
}

const NON_FUNDING_HEADLINE_RE = /\b(acquires?|acquired|acquisition|merger|merged|ipo|in talks|talks to raise|reportedly|could raise|seeking funding|considering raise|to cover .+ exploit|relief effort)\b/i;
const COMPANY_LED_RE = /^[\w\s.-]+-led\b/i;

function isInvalidFundingHeadline(text, companyName) {
  if (!text) return true;
  if (NON_FUNDING_HEADLINE_RE.test(text)) return true;
  const name = (companyName || '').trim();
  if (name && COMPANY_LED_RE.test(text)) {
    const lead = text.match(/^([\w\s.-]+)-led\b/i)?.[1]?.trim().toLowerCase();
    if (lead && name.toLowerCase().startsWith(lead)) return true;
  }
  return false;
}

function passesFundingVerification(text, company) {
  const name = typeof company === 'string' ? company : company?.name;
  const website = typeof company === 'string' ? null : company?.website;
  if (!text || !FUNDING_RE.test(text)) return false;
  if (!companyMentioned(text, name)) return false;
  if (isInvalidFundingHeadline(text, name)) return false;
  if (isLikelyWrongEntity(text, name, website)) return false;
  return true;
}

function parseGoogleNewsRss(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.slice(0, 8).map((item) => {
    const title =
      (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [])[1] ||
      (item.match(/<title>(.*?)<\/title>/) || [])[1] ||
      '';
    const desc =
      (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || [])[1] ||
      (item.match(/<description>(.*?)<\/description>/) || [])[1] ||
      '';
    const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    return { title: title.trim(), desc: desc.trim(), link: link.trim(), pubDate: pubDate.trim() };
  });
}

function isLikelyWrongEntity(headline, companyName, website) {
  const text = headline.toLowerCase();
  const name = (companyName || '').trim();
  if (!name) return false;

  const nameTokens = name.split(/\s+/).filter((t) => t.length > 2);
  if (nameTokens.length >= 2) return false;

  // Single-token names: reject headlines that attach a distinct product suffix (e.g. "Pluto Mobility" vs Pluto fintech).
  const suffixMatch = text.match(new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\s+([a-z]{4,})`, 'i'));
  if (!suffixMatch) return false;
  const suffix = suffixMatch[1].toLowerCase();
  const generic = new Set(['raises', 'raised', 'secures', 'secured', 'closes', 'closed', 'announces', 'announced', 'startup', 'company', 'platform', 'funding', 'round', 'series', 'seed']);
  if (generic.has(suffix)) return false;

  let host = '';
  try {
    host = new URL(website?.startsWith('http') ? website : `https://${website || ''}`).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }
  const brand = host.split('.')[0];
  if (brand && brand.length > 3 && text.includes(brand.toLowerCase())) return false;

  return true;
}

function verifyStoredFundingEvent(event, company) {
  const name = typeof company === 'string' ? company : company?.name;
  const website = typeof company === 'string' ? null : company?.website;
  const headline = (event?.headline || '').trim();
  const text = headline;
  if (!event?.source_url || !/^https?:\/\//i.test(event.source_url)) return null;
  if (!passesFundingVerification(text, company)) return null;

  const amount = event.amount_usd || extractAmountUsd(text);
  const roundType = extractRoundType(text);
  if (!amount && !roundType) return null;

  return {
    verified: true,
    event_type: 'funding_round',
    amount_usd: amount,
    round_type: roundType,
    lead_investor: event.lead_investor || extractLeadInvestor(text),
    headline: headline.slice(0, 240),
    source_url: event.source_url,
    source_name: event.source_name || 'Press',
  };
}

function assessVerifiedNewsHit(company, newsItems) {
  for (const item of newsItems) {
    const text = `${item.title} ${item.desc}`.trim();
    if (!passesFundingVerification(text, company)) continue;
    const amount = extractAmountUsd(text);
    const roundType = extractRoundType(text);
    if (!item.link) continue;
    if (!amount && !roundType) continue;
    return {
      verified: true,
      event_type: 'funding_round',
      amount_usd: amount,
      round_type: roundType,
      lead_investor: extractLeadInvestor(text),
      headline: item.title.slice(0, 240),
      source_url: item.link,
      source_name: 'Google News',
    };
  }
  return null;
}

function assessFundingSignal(companyName, { homeText = '', newsItems = [], website = null } = {}) {
  const newsText = newsItems.map((n) => `${n.title} ${n.desc}`).join(' ');
  const combined = `${homeText} ${newsText}`.trim();
  if (!FUNDING_RE.test(combined)) return null;

  const company = { name: companyName, website };
  const verifiedHit = assessVerifiedNewsHit(company, newsItems);
  if (verifiedHit) return verifiedHit;

  return {
    verified: false,
    event_type: 'funding_round',
    round_type: extractRoundType(combined),
    amount_usd: extractAmountUsd(combined),
    lead_investor: extractLeadInvestor(combined),
    headline: `${companyName} funding signal detected`,
    source_url: null,
    source_name: null,
  };
}

module.exports = {
  FUNDING_RE,
  extractAmountUsd,
  extractRoundType,
  extractLeadInvestor,
  parseGoogleNewsRss,
  assessFundingSignal,
  assessVerifiedNewsHit,
  verifyStoredFundingEvent,
  passesFundingVerification,
  companyMentioned,
};
