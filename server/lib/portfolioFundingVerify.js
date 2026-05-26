/**
 * Shared funding detection + verification for Oracle portfolio monitoring.
 */

const FUNDING_RE = /\b(raises?|raised|secures?|closed|announces?\s+\$|seed\s+round|series\s+[a-e]|pre[- ]?seed|funding\s+round|venture\s+capital|vc\s+backed|unicorn|billion|million.*round|round.*investment)\b/i;
const AMOUNT_RE = /\$\s*(\d[\d,.]*)\s*(million|billion|M|B)\b/gi;
const ROUND_RE = /\b(pre[- ]?seed|seed|series\s+[a-e]\+?|growth\s+round|late\s+stage)\b/i;
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
  const primary = escapeRegExp(tokens[0]);
  return new RegExp(`\\b${primary}\\b`, 'i').test(text);
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
    return { title: title.trim(), desc: desc.trim(), link: link.trim() };
  });
}

function assessVerifiedNewsHit(companyName, newsItems) {
  for (const item of newsItems) {
    const text = `${item.title} ${item.desc}`.trim();
    if (!text || !FUNDING_RE.test(text)) continue;
    if (!companyMentioned(text, companyName)) continue;
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

function assessFundingSignal(companyName, { homeText = '', newsItems = [] } = {}) {
  const newsText = newsItems.map((n) => `${n.title} ${n.desc}`).join(' ');
  const combined = `${homeText} ${newsText}`.trim();
  if (!FUNDING_RE.test(combined)) return null;

  const verifiedHit = assessVerifiedNewsHit(companyName, newsItems);
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
  companyMentioned,
};
