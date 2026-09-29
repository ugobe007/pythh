'use strict';

/**
 * Investor quotes from text we already store.
 * A sentence is kept only when it says what they invest in, have invested in,
 * or are looking for. Nothing is written by a model.
 */

const KINDS = ['investing_in', 'invested_in', 'looking_for'];

const KIND_LABEL = {
  investing_in: 'Investing in',
  invested_in: 'Invested in',
  looking_for: 'Looking for',
};

const JUNK = /https?:\/\/|<[a-z]|lorem ipsum|\b(n\/a|null|undefined|test investor)\b|\[inferred from news\]|founder-angel sourced|sourced via/i;

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40 && part.length <= 280 && !JUNK.test(part));
}

function kindFor(sentence) {
  if (/\b(looking for|we seek|we(?:'re| are) looking|we want to (?:see|back|meet)|open to)\b/i.test(sentence)) {
    return 'looking_for';
  }
  if (/\b(invested in|we(?:'ve| have) (?:backed|invested)|portfolio includes|previously backed)\b/i.test(sentence)) {
    return 'invested_in';
  }
  if (/\b(we invest|invests in|investing in|we back|our focus|focus(?:es|ed)? on|we write|we lead)\b/i.test(sentence)) {
    return 'investing_in';
  }
  return null;
}

const GENERIC_FIRM = /^(angel investors?|self[-\s]?employed|independent|unknown|private investors?|individual investors?|investors?|n\/a)$/i;

function cleanFirm(row) {
  const firm = String(row?.firm || row?.name || '').replace(/\s+/g, ' ').trim();
  if (firm.length < 2 || firm.length > 80) return null;
  if (/\bpersonal$/i.test(firm) || /\bview\s*all\b/i.test(firm)) return null;
  if (GENERIC_FIRM.test(firm)) return null;
  return firm;
}

function speakerName(row, firm) {
  const name = String(row?.name || '').replace(/\s+/g, ' ').trim();
  if (!name || name.toLowerCase() === firm.toLowerCase()) return firm;
  if (name.split(/\s+/).length > 4) return firm;
  return name;
}

function portfolioNames(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,;|]/)
      : [];
  const names = [];
  for (const item of raw) {
    const label = String(typeof item === 'string' ? item : item?.name || item?.company || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (label.length < 2 || label.length > 40 || JUNK.test(label)) continue;
    if (/\b(innovators?|solutions?|startups?|platforms?|companies|analytics|robotics|ventures|services|growth|revolution)\b/i.test(label)) continue;
    if (/(tech|corp|pro)$/i.test(label) || /^(health|green|edu|fin|cloud|future|smart)/i.test(label)) continue;
    if (!names.includes(label)) names.push(label);
    if (names.length >= 4) break;
  }
  return names;
}

function investedSentence(names) {
  if (names.length < 2) return null;
  if (names.length === 2) return `Invested in ${names[0]} and ${names[1]}.`;
  return `Invested in ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}.`;
}

function quotesFromInvestor(row) {
  const firm = cleanFirm(row);
  if (!firm || !row?.id) return [];
  const speaker = speakerName(row, firm);
  const out = [];
  const seen = new Set();

  function push(kind, quote, source) {
    const text = String(quote || '').trim();
    const key = `${kind}:${text.toLowerCase()}`;
    if (!KINDS.includes(kind) || seen.has(key) || text.length < 24) return;
    seen.add(key);
    out.push({
      investor_id: row.id,
      firm,
      speaker,
      kind,
      kind_label: KIND_LABEL[kind],
      quote: text,
      source,
    });
  }

  for (const sentence of sentences(row.investment_thesis)) {
    const kind = kindFor(sentence);
    if (kind) push(kind, sentence.endsWith('.') ? sentence : `${sentence}.`, 'investment_thesis');
  }

  const invested = investedSentence(portfolioNames(row.notable_investments));
  if (invested) push('invested_in', invested, 'notable_investments');

  return out;
}

function publicQuote(row) {
  const kind = KINDS.includes(row.kind) ? row.kind : 'investing_in';
  return {
    id: row.id || null,
    investor_id: row.investor_id || null,
    firm: row.firm,
    speaker: row.speaker || row.firm,
    kind,
    kind_label: KIND_LABEL[kind],
    quote: row.quote,
    source: row.source || null,
  };
}

function mixQuotes(rows) {
  const buckets = { investing_in: [], invested_in: [], looking_for: [] };
  const seen = new Set();
  for (const row of rows) {
    const key = String(row.quote || '').toLowerCase();
    if (!key || seen.has(key) || !buckets[row.kind]) continue;
    seen.add(key);
    buckets[row.kind].push(row);
  }
  const mixed = [];
  let index = 0;
  while (mixed.length < rows.length) {
    let added = false;
    for (const kind of KINDS) {
      const item = buckets[kind][index];
      if (!item) continue;
      mixed.push(item);
      added = true;
    }
    if (!added) break;
    index += 1;
  }
  return mixed;
}

async function loadStoredQuotes(supabase, limit) {
  const { data, error } = await supabase
    .from('investor_quotes')
    .select('id, investor_id, firm, speaker, kind, quote, source')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error };
  return { rows: (data || []).map(publicQuote), error: null };
}

async function loadDerivedQuotes(supabase, limit) {
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, firm, investment_thesis, notable_investments')
    .not('investment_thesis', 'is', null)
    .limit(400);
  if (error) return { rows: [], error };
  const quotes = [];
  for (const row of data || []) {
    for (const quote of quotesFromInvestor(row)) {
      quotes.push(publicQuote(quote));
      if (quotes.length >= limit) return { rows: quotes, error: null };
    }
  }
  return { rows: quotes, error: null };
}

async function loadInvestorQuotes(supabase, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 24, 1), 60);
  const stored = await loadStoredQuotes(supabase, 80);
  if (!stored.error && stored.rows.length) return mixQuotes(stored.rows).slice(0, limit);
  const derived = await loadDerivedQuotes(supabase, 80);
  return mixQuotes(derived.rows).slice(0, limit);
}

module.exports = {
  KINDS,
  KIND_LABEL,
  quotesFromInvestor,
  publicQuote,
  loadInvestorQuotes,
};
