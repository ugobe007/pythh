'use strict';

/**
 * Pull spoken VC lines from text we fetched or already stored.
 * A line is kept only when it is in their voice and says what they fund,
 * an investment they name, or advice to founders. Nothing is written by a model.
 */

const { quotesFromInvestor, classifySpokenLine } = require('./investorQuotes');

const INNER_PATH = /\/(about|manifesto|how-we-work|how-we-invest|thesis|perspectives|insights|what-we-look-for)(\/|$|\?)/i;

const SPOKEN = /\b(we|i|our|my|we're|we’re|we've|we’ve|i'm|i’m)\b/i;
const VERB = /\b(is|are|was|were|invest\w*|back\w*|lead|led|fund\w*|seek|look\w*|tell|should|need|build\w*|write|focus\w*|help|partner)\b/i;
const BOILERPLATE = /copyright|all rights reserved|no offer to sell|past performance|cookie|privacy policy|terms of use|sign in to|apply here|portfolio careers/i;

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#x27;|&#39;|&apos;|&#8217;/gi, "'")
    .replace(/&quot;|&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 0 && n < 65536 ? String.fromCharCode(n) : ' ';
    });
}

function visibleText(html) {
  const stripped = decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/"[^"]{20,320}"\s+[A-Z][^."]{0,60}·\s*[A-Z][^.]{0,40}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped;
}

function isAdviceLine(text) {
  return /\b(advice (?:to|for) founders|founders should|i tell founders|we tell founders|my advice|if you(?:'re| are) (?:a )?founder|founders need to)\b/i.test(text)
    || (/(?<![-/])\bfounders?\b/i.test(text) && /\b(should|must|need to|advice)\b/i.test(text));
}

function sentencesFrom(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 28 && part.length <= 320)
    .filter((part) => !/[·|]/.test(part))
    .filter((part) => !/^(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(part))
    .filter((part) => (SPOKEN.test(part) || isAdviceLine(part)) && VERB.test(part) && !BOILERPLATE.test(part))
    .filter((part) => (part.match(/,/g) || []).length <= 4);
}

function firmHost(investor) {
  const raw = investor?.url || investor?.blog_url || investor?.website || '';
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function sameFirmHost(pageUrl, investor) {
  const host = firmHost(investor);
  if (!host) return false;
  try {
    const page = new URL(pageUrl).hostname.replace(/^www\./, '').toLowerCase();
    return page === host || page.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

function quotesFromText(text, { investor, source, sourceUrl }) {
  const firm = String(investor?.firm || investor?.name || '').replace(/\s+/g, ' ').trim();
  if (!firm || !investor?.id) return [];
  const speakerName = String(investor?.name || '').trim();
  const speaker = speakerName && speakerName.toLowerCase() !== firm.toLowerCase() && speakerName.split(/\s+/).length <= 4
    ? speakerName
    : firm;
  const out = [];
  const seen = new Set();
  for (const sentence of sentencesFrom(text)) {
    const kind = classifySpokenLine(sentence);
    if (!kind) continue;
    const quote = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    const key = `${kind}:${quote.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      investor_id: investor.id,
      firm,
      speaker,
      kind,
      quote,
      source: source || 'firm_site',
      source_url: sourceUrl || null,
    });
  }
  return out;
}

function quotesFromHtml(html, pageUrl, investor) {
  if (!sameFirmHost(pageUrl, investor)) return [];
  return quotesFromText(visibleText(html), { investor, source: 'firm_site', sourceUrl: pageUrl });
}

function innerPageUrls(html, pageUrl, investor) {
  if (!sameFirmHost(pageUrl, investor)) return [];
  let origin = '';
  try { origin = new URL(pageUrl).origin; } catch { return []; }
  const found = [];
  const seen = new Set();
  for (const match of String(html || '').matchAll(/href="([^"]+)"/gi)) {
    let next = match[1];
    if (next.startsWith('/')) next = origin + next;
    if (!INNER_PATH.test(next) || !sameFirmHost(next, investor) || seen.has(next)) continue;
    seen.add(next);
    found.push(next.split('#')[0]);
    if (found.length >= 3) break;
  }
  return found;
}

function spokenQuotesFromInvestor(row) {
  return quotesFromInvestor(row);
}

module.exports = {
  visibleText,
  classifySpokenLine,
  quotesFromText,
  quotesFromHtml,
  innerPageUrls,
  spokenQuotesFromInvestor,
  sameFirmHost,
};
