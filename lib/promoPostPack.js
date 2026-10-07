'use strict';

/**
 * Daily post pack for the owner: spoken VC quotes, funding snippets, trending theses.
 * Copy is taken from stored rows. Nothing is rewritten into a new claim.
 */

const { isDisplayableQuote, KIND_LABEL, publicQuote } = require('./investorQuotes');

const PROMO_TO = 'ugobe07@gmail.com';
const HOME_URL = 'https://pythh.ai/';
const MATCHES_URL = 'https://pythh.ai/matches';

const JUNK_TITLE = /class action|lawsuit|bankruptcy|credit facility|grant funding|alleges|investigation|hearing/i;
const FUNDING_TITLE = /\b(?:raises|raised|secures|secured|closes|closed|bags|lands|nabs)\b/i;
const GENERIC_TAGLINE = /revolutionizing digital|cutting-edge technology|innovative solutions|next-generation platform/i;
const NAME_STOP = /^(?:the|a|an|exclusive|indian|dallas|mexico|startup|new|us|uk)$/i;
const KIND_ORDER = ['investing_in', 'invested_in', 'looking_for', 'founder_advice'];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function pickQuotes(rows, limit = 10) {
  const spoken = [];
  const seenQuote = new Set();
  const seenFirm = new Set();
  for (const row of rows || []) {
    const quote = publicQuote(row);
    const text = clean(quote.quote);
    const firm = clean(quote.firm);
    if (!text || !firm || !isDisplayableQuote(text)) continue;
    const quoteKey = text.toLowerCase();
    const firmKey = firm.toLowerCase();
    if (seenQuote.has(quoteKey) || seenFirm.has(firmKey)) continue;
    seenQuote.add(quoteKey);
    seenFirm.add(firmKey);
    spoken.push({ ...quote, quote: text, firm });
  }

  const picked = [];
  const used = new Set();
  const take = (kind) => spoken.find((row) => row.kind === kind && !used.has(row.quote));
  while (picked.length < limit) {
    let added = false;
    for (const kind of KIND_ORDER) {
      const hit = take(kind);
      if (!hit) continue;
      used.add(hit.quote);
      picked.push(hit);
      added = true;
      if (picked.length >= limit) break;
    }
    if (added) continue;
    const rest = spoken.find((row) => !used.has(row.quote));
    if (!rest) break;
    used.add(rest.quote);
    picked.push(rest);
  }
  return picked.slice(0, limit);
}

function formatAmount(value) {
  const raw = clean(value);
  if (!raw) return null;
  if (/[$€£]|million|billion/i.test(raw)) return raw;
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 100000) return raw;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n % 1e9 ? 1 : 0).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '')}M`;
  return raw;
}

function companyFromTitle(title, fallback) {
  const beforeVerb = title.match(/(?:^|[\s:—–-])([A-Z][\w.&']{1,40})\s+(?:raises|raised|secures|secured|closes|closed|bags|lands|nabs)\b/);
  if (beforeVerb && !NAME_STOP.test(beforeVerb[1])) return beforeVerb[1];
  const lead = title.match(/^([A-Z][\w.&']{1,40})\b/);
  if (lead && !NAME_STOP.test(lead[1]) && FUNDING_TITLE.test(title)) return lead[1];
  const stored = clean(fallback);
  if (stored && stored.split(' ').length <= 3 && title.toLowerCase().includes(stored.toLowerCase())) return stored;
  return null;
}

function pickFundingNews(rows, { min = 3, max = 5 } = {}) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const title = clean(row.article_title || row.title);
    const url = clean(row.article_url || row.url);
    if (!title || !url) continue;
    if (JUNK_TITLE.test(title) || !FUNDING_TITLE.test(title)) continue;
    const company = companyFromTitle(title, row.name || row.company);
    if (!company) continue;
    const key = company.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      company,
      title,
      amount: formatAmount(row.funding_amount || row.amount),
      stage: clean(row.funding_stage || row.stage) || null,
      url,
      source: clean(row.rss_source || row.source) || null,
    });
    if (out.length >= max) break;
  }
  return out.length >= min ? out.slice(0, max) : out;
}

function rankTrending(startups, signals) {
  const sig = new Map((signals || []).map((row) => [String(row.startup_id), row]));
  return (startups || [])
    .filter((row) => clean(row?.name) && clean(row?.website))
    .filter((row) => !GENERIC_TAGLINE.test(clean(row.tagline)))
    .map((row) => {
      const signal = sig.get(String(row.id)) || {};
      const website = clean(row.website);
      return {
        ...row,
        website: /^https?:\/\//i.test(website) ? website : `https://${website}`,
        signals_total: Number(signal.signals_total) || 0,
      };
    })
    .sort((a, b) => b.signals_total - a.signals_total || (Number(b.total_god_score) || 0) - (Number(a.total_god_score) || 0));
}

function pickTrending(startups, limit = 5) {
  const rows = (startups || []).filter((row) => clean(row?.name));
  const counts = {};
  for (const row of rows) {
    const sectors = Array.isArray(row.sectors) ? row.sectors : [];
    for (const sector of sectors) {
      const label = clean(sector);
      if (!label) continue;
      counts[label] = (counts[label] || 0) + 1;
    }
  }
  const thesis = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([sector, count]) => ({ sector, count }));
  return {
    thesis,
    startups: rows.slice(0, limit).map((row) => ({
      name: clean(row.name),
      tagline: clean(row.tagline) || null,
      website: clean(row.website) || null,
      sectors: (Array.isArray(row.sectors) ? row.sectors : []).map(clean).filter(Boolean).slice(0, 3),
      score: row.total_god_score == null ? null : Number(row.total_god_score),
    })),
  };
}

function credit(quote) {
  const speaker = clean(quote.speaker);
  const firm = clean(quote.firm);
  if (speaker && speaker.toLowerCase() !== firm.toLowerCase()) return `${speaker}, ${firm}`;
  return firm;
}

function pasteLine(quote) {
  return `“${quote.quote}” — ${credit(quote)}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPromoText(pack) {
  const lines = [
    `Pythh post pack — ${pack.date}`,
    '',
    'Quotes on the site: the homepage rotates one line (https://pythh.ai/). Open a match card for “In their words” (https://pythh.ai/matches).',
    'These are their words. Paste them with the name and the source link.',
    '',
    `1. Investor quotes (${pack.quotes.length})`,
  ];
  pack.quotes.forEach((quote, index) => {
    lines.push('');
    lines.push(`${index + 1}. ${quote.kind_label || KIND_LABEL[quote.kind] || 'Quote'} — ${credit(quote)}`);
    lines.push(pasteLine(quote));
    if (quote.source_url) lines.push(quote.source_url);
  });
  lines.push('');
  lines.push(`2. Funding news (${pack.funding.length})`);
  if (!pack.funding.length) lines.push('No fresh funding headlines in the last two weeks.');
  pack.funding.forEach((item, index) => {
    const money = [item.amount, item.stage].filter(Boolean).join(' ');
    lines.push('');
    lines.push(`${index + 1}. ${item.company}${money ? ` — ${money}` : ''}`);
    lines.push(item.title);
    lines.push(item.url);
  });
  lines.push('');
  lines.push('3. Trending startups and thesis focus');
  if (pack.trending.thesis.length) {
    lines.push(`Thesis focus among the hottest: ${pack.trending.thesis.map((item) => `${item.sector} (${item.count})`).join(', ')}`);
  }
  pack.trending.startups.forEach((startup, index) => {
    const sectors = startup.sectors.join(', ');
    lines.push('');
    lines.push(`${index + 1}. ${startup.name}${startup.score != null ? ` — score ${startup.score}` : ''}${sectors ? ` — ${sectors}` : ''}`);
    if (startup.tagline) lines.push(startup.tagline);
    if (startup.website) lines.push(startup.website);
  });
  return lines.join('\n');
}

function buildPromoHtml(pack) {
  const quoteBlocks = pack.quotes.map((quote, index) => `
    <li style="margin:0 0 16px;">
      <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#a78bfa;">${escapeHtml(quote.kind_label || '')}</div>
      <p style="margin:6px 0;font-size:16px;line-height:1.45;color:#f4f4f5;">“${escapeHtml(quote.quote)}”</p>
      <div style="color:#a1a1aa;">${escapeHtml(credit(quote))}</div>
      ${quote.source_url ? `<a href="${escapeHtml(quote.source_url)}" style="color:#34d399;">Source</a>` : ''}
      <div style="margin-top:6px;color:#d4d4d8;">Paste: ${escapeHtml(pasteLine(quote))}</div>
      <div style="color:#71717a;font-size:12px;">${index + 1} of ${pack.quotes.length}</div>
    </li>`).join('');
  const fundingBlocks = pack.funding.map((item) => `
    <li style="margin:0 0 14px;">
      <div style="color:#f4f4f5;font-weight:600;">${escapeHtml(item.company)}${item.amount || item.stage ? ` — ${escapeHtml([item.amount, item.stage].filter(Boolean).join(' '))}` : ''}</div>
      <div style="color:#d4d4d8;margin-top:4px;">${escapeHtml(item.title)}</div>
      <a href="${escapeHtml(item.url)}" style="color:#34d399;">${escapeHtml(item.source || 'Story')}</a>
    </li>`).join('');
  const thesis = pack.trending.thesis.length
    ? `<p style="color:#f4f4f5;">Thesis focus among the hottest: ${escapeHtml(pack.trending.thesis.map((item) => `${item.sector} (${item.count})`).join(', '))}</p>`
    : '';
  const startups = pack.trending.startups.map((startup) => `
    <li style="margin:0 0 12px;color:#d4d4d8;">
      <span style="color:#f4f4f5;font-weight:600;">${escapeHtml(startup.name)}</span>
      ${startup.score != null ? ` · score ${escapeHtml(startup.score)}` : ''}
      ${startup.sectors.length ? ` · ${escapeHtml(startup.sectors.join(', '))}` : ''}
      ${startup.tagline ? `<div style="margin-top:4px;">${escapeHtml(startup.tagline)}</div>` : ''}
      ${startup.website ? `<a href="${escapeHtml(startup.website)}" style="color:#34d399;">${escapeHtml(startup.website)}</a>` : ''}
    </li>`).join('');
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0c;color:#e7e7ea;font-family:-apple-system,Segoe UI,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:28px 20px 48px;">
      <p style="color:#34d399;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Pythh post pack</p>
      <h1 style="color:#fff;font-size:24px;margin:8px 0 12px;">${escapeHtml(pack.date)}</h1>
      <p style="color:#a1a1aa;line-height:1.5;">Quotes rotate on <a href="${HOME_URL}" style="color:#34d399;">pythh.ai</a>. Open a match card for “In their words” at <a href="${MATCHES_URL}" style="color:#34d399;">pythh.ai/matches</a>. Paste their words with the name and the source.</p>
      <h2 style="color:#fff;font-size:18px;">1. Investor quotes</h2>
      <ol style="padding-left:18px;">${quoteBlocks || '<li>No spoken quotes yet.</li>'}</ol>
      <h2 style="color:#fff;font-size:18px;">2. Funding news</h2>
      <ul style="padding-left:18px;">${fundingBlocks || '<li>No fresh funding headlines.</li>'}</ul>
      <h2 style="color:#fff;font-size:18px;">3. Trending startups and thesis focus</h2>
      ${thesis}
      <ol style="padding-left:18px;">${startups || '<li>No trending startups.</li>'}</ol>
    </div>
  </body></html>`;
}

async function selectRows(supabase, table, columnsList, build) {
  let lastError = null;
  for (const columns of columnsList) {
    const query = build(supabase.from(table).select(columns));
    const { data, error } = await query;
    if (!error) return data || [];
    lastError = error;
    if (!/source_url|column/i.test(error.message || '')) break;
  }
  if (lastError) throw lastError;
  return [];
}

async function loadPromoPack(supabase, { date = null } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [quoteRows, fundingRows, startupRows] = await Promise.all([
    selectRows(
      supabase,
      'investor_quotes',
      [
        'firm, speaker, kind, quote, source, source_url, created_at',
        'firm, speaker, kind, quote, source, created_at',
      ],
      (query) => query.eq('active', true).order('created_at', { ascending: false }).limit(200),
    ),
    selectRows(
      supabase,
      'discovered_startups',
      ['name, article_title, funding_amount, funding_stage, article_url, rss_source, created_at'],
      (query) => query.gte('created_at', since).not('article_title', 'is', null).order('created_at', { ascending: false }).limit(80),
    ),
    selectRows(
      supabase,
      'startup_uploads',
      ['id, name, tagline, website, sectors, total_god_score, status'],
      (query) => query.eq('status', 'approved').gte('total_god_score', 70).not('website', 'is', null).order('total_god_score', { ascending: false }).limit(40),
    ),
  ]);
  const ids = startupRows.map((row) => row.id).filter(Boolean);
  let signals = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from('startup_signal_scores')
      .select('startup_id, signals_total')
      .in('startup_id', ids);
    if (error) throw error;
    signals = data || [];
  }
  const trendingPool = rankTrending(startupRows, signals);
  return {
    date: day,
    quotes: pickQuotes(quoteRows, 10),
    funding: pickFundingNews(fundingRows),
    trending: pickTrending(trendingPool, 5),
  };
}

module.exports = {
  PROMO_TO,
  HOME_URL,
  MATCHES_URL,
  pickQuotes,
  pickFundingNews,
  companyFromTitle,
  formatAmount,
  rankTrending,
  pickTrending,
  pasteLine,
  buildPromoText,
  buildPromoHtml,
  loadPromoPack,
};
