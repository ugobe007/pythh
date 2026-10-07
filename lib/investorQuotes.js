'use strict';

/**
 * Investor quotes from text we already store.
 * A sentence is kept only when it says what they invest in, have invested in,
 * or are looking for. Nothing is written by a model.
 */

const KINDS = ['investing_in', 'looking_for', 'invested_in', 'founder_advice'];

const KIND_LABEL = {
  investing_in: 'What they fund',
  looking_for: 'Looking for',
  invested_in: 'Their investments',
  founder_advice: 'Advice to founders',
};

const JUNK = /https?:\/\/|<[a-z]|lorem ipsum|\b(n\/a|null|undefined|test investor)\b|\[inferred from news\]|founder-angel sourced|sourced via|leverage AI and SaaS|disrupt traditional industries|drive innovation and efficiency|co-founder|investment announcements/i;

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40 && part.length <= 280 && !JUNK.test(part));
}

function isAdviceLine(text) {
  return /\b(advice (?:to|for) founders|founders should|i tell founders|we tell founders|my advice|if you(?:'re| are) (?:a )?founder|founders need to)\b/i.test(text)
    || (/(?<![-/])\bfounders?\b/i.test(text) && /\b(should|must|need to|advice)\b/i.test(text));
}

function classifySpokenLine(sentence) {
  const text = String(sentence || '');
  if (!text || JUNK.test(text) || /[·|]/.test(text)) return null;
  if (/^(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(text)) return null;
  if (/\b((?:we|i) (?:led|invested in|backed)|our investment in|we were the lead)\b/i.test(text)) {
    return 'invested_in';
  }
  if (/\b(looking for (?:founders|companies|startups)|we seek|we(?:'re| are) looking|we want to (?:see|back|meet))\b/i.test(text)) {
    return 'looking_for';
  }
  if (/\b(we invest|i invest|we(?:'re| are) investing|we back|i back|we lead|we write checks|we fund|we focus|our focus is|we(?:'re| are) focused)\b/i.test(text)) {
    return 'investing_in';
  }
  if (isAdviceLine(text)) return 'founder_advice';
  return null;
}

function isDisplayableQuote(text) {
  return Boolean(classifySpokenLine(text));
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
    const kind = classifySpokenLine(sentence);
    if (!kind) continue;
    push(kind, sentence.endsWith('.') ? sentence : `${sentence}.`, 'investment_thesis');
  }

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
    source_url: row.source_url || (/^https?:\/\//i.test(String(row.source || '')) ? row.source : null),
  };
}

const CARD_KINDS = [
  ['investing_in', 'looking_for'],
  ['invested_in'],
  ['founder_advice'],
];

function quotesForCard(rows) {
  const picked = [];
  const used = new Set();
  const spoken = (rows || []).filter((row) => isDisplayableQuote(row.quote));
  for (const kinds of CARD_KINDS) {
    const hit = spoken.find((row) => kinds.includes(row.kind) && row.quote && !used.has(String(row.quote).toLowerCase()));
    if (!hit) continue;
    used.add(String(hit.quote).toLowerCase());
    picked.push(publicQuote(hit));
  }
  return picked;
}

function mixQuotes(rows) {
  const buckets = { investing_in: [], invested_in: [], looking_for: [], founder_advice: [] };
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
  const columns = [
    'id, investor_id, firm, speaker, kind, quote, source, source_url',
    'id, investor_id, firm, speaker, kind, quote, source',
  ];
  let lastError = null;
  for (const select of columns) {
    const { data, error } = await supabase
      .from('investor_quotes')
      .select(select)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error) {
      return { rows: (data || []).map(publicQuote).filter((row) => isDisplayableQuote(row.quote)), error: null };
    }
    lastError = error;
    if (!/source_url/i.test(error.message || '')) break;
  }
  return { rows: [], error: lastError };
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
  classifySpokenLine,
  isDisplayableQuote,
  quotesFromInvestor,
  publicQuote,
  quotesForCard,
  loadInvestorQuotes,
};
