/**
 * Market-movement classifier and showcase catalog.
 *
 * The hot-startup RSS agent used to keep only "raised a round / launched" headlines.
 * Revenue breakouts, acquisitions, and new fund structures never qualified, so the
 * homepage could not show them. This module classifies those headlines and holds
 * the sourced movements we already know the feeds missed.
 */

const MOVEMENT_KINDS = ['revenue_breakout', 'acquisition', 'new_fund', 'growth', 'funding_round'];

const KIND_LABEL = {
  revenue_breakout: 'Revenue',
  acquisition: 'Acquisition',
  new_fund: 'Investor',
  growth: 'Growth',
  funding_round: 'Round',
};

const NAME_STOP = new Set([
  'the', 'a', 'an', 'ai', 'video', 'platform', 'series', 'its', 'how', 'why', 'new', 'top',
]);

const CURATED = [
  {
    id: 'higgsfield',
    kind: 'revenue_breakout',
    label: 'Revenue',
    name: 'Higgsfield',
    sector: 'AI video',
    headline: 'Reported $1B annualized revenue in 18 months',
    detail: 'Higgsfield says it climbed from about $1 million to a $1 billion annualized run rate in 18 months, and that this pace is ahead of the one it cites for Anthropic. The figure is management\'s run-rate math, not audited annual revenue.',
    caveat: 'Company-reported run rate, not audited revenue.',
    sourceName: 'Company claim, September 2026',
    sourceUrl: 'https://officechai.com/ai/ai-video-platform-higgsfield-says-it-has-gone-from-1-million-arr-to-1-billion-arr-faster-than-anthropic-or-openai/',
    companyUrl: 'https://higgsfield.ai',
    asOf: '2026-09-25',
    heat: 98,
    investors: [],
  },
  {
    id: 'parallax',
    kind: 'growth',
    label: 'Growth',
    name: 'Parallax',
    sector: 'Energy for AI',
    headline: '$117M to build power for AI data centers',
    detail: 'Parallax is building about 10 MW 3D-printed gas turbines so data centers can get power without waiting on the grid. It emerged from stealth in 2026 with $117 million: a $42 million seed co-led by Eclipse and Lux Capital, with Founders Fund and Valor, and a $75 million Series A led by Greylock and General Catalyst.',
    caveat: 'Funding disclosed by Eclipse at the stealth launch.',
    sourceName: 'Eclipse, 2026',
    sourceUrl: 'https://eclipse.capital/blog/building-turbines-on-ai-timelines',
    companyUrl: null,
    asOf: '2026-09-01',
    heat: 93,
    investors: ['eclipse', 'lux_capital', 'founders_fund', 'valor', 'greylock', 'general_catalyst'],
  },
  {
    id: 'cursor',
    kind: 'acquisition',
    label: 'Acquisition',
    name: 'Cursor',
    sector: 'AI coding',
    headline: 'SpaceX closed a $60B acquisition',
    detail: 'SpaceX completed its all-stock acquisition of Anysphere, the company behind Cursor, on August 14, 2026. The merger agreement priced Cursor at $60 billion.',
    caveat: 'All-stock deal. Closed August 14, 2026.',
    sourceName: 'Cursor, August 14, 2026',
    sourceUrl: 'https://cursor.com/blog/joining-spacex',
    companyUrl: 'https://cursor.com',
    asOf: '2026-08-14',
    heat: 99,
    investors: [],
  },
  {
    id: 'ark-venture',
    kind: 'new_fund',
    label: 'Investor',
    name: 'ARK Venture',
    sector: 'Crossover fund',
    headline: 'A venture fund investors can hold through the IPO',
    detail: 'ARK Venture Fund (ARKVX) buys private and public disruptive-innovation companies in one interval fund and stays in after listing. Assets rose from $711 million to $1.3 billion in the second quarter of 2026. The fund is also writing venture checks, including $20 million into Cellares\' Series D.',
    caveat: 'AUM as of June 30, 2026, reported by ARK.',
    sourceName: 'ARK Venture Fund Q2 2026',
    sourceUrl: 'https://www.ark-funds.com/articles/venture-fund/ark-venture-2nd-quarter-2026-update',
    companyUrl: 'https://www.ark-funds.com/funds/arkvx',
    asOf: '2026-06-30',
    heat: 90,
    investors: ['ark'],
  },
];

function cleanName(value) {
  const name = String(value || '').replace(/['’]s$/, '').replace(/[.,:;]+$/, '').trim();
  if (!name || NAME_STOP.has(name.toLowerCase())) return null;
  if (name.length < 2 || name.length > 48) return null;
  return name;
}

function amountMillions(text) {
  const matches = String(text || '').matchAll(/\$\s*(\d+(?:\.\d+)?)\s*(billion|million|b|m)\b/gi);
  let largest = null;
  for (const match of matches) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const millions = match[2].toLowerCase().startsWith('b') ? value * 1000 : value;
    if (largest == null || millions > largest) largest = millions;
  }
  return largest;
}

function isRevenueBreakout(text) {
  return /(?:\$\s*\d+(?:\.\d+)?\s*(?:billion|b)\b|\b\d+(?:\.\d+)?\s*billion\b)[^.]{0,48}\b(?:arr|annualized|annual recurring|run rate|revenue)\b|\b(?:arr|annualized revenue|revenue run rate)\b[^.]{0,48}(?:\$\s*\d|\b\d+(?:\.\d+)?\s*billion\b)/i.test(text);
}

function isAcquisition(text) {
  return /\bacquires?\b|\bacquired by\b|\bacquisition of\b|\bcloses\b[^.]{0,48}\bacquisition\b|\bnow a part of\b/i.test(text);
}

function isNewFund(text) {
  return /\b(?:venture fund|interval fund|new fund)\b|\blaunch(?:es|ed)?\b[^.]{0,40}\bfund\b/i.test(text);
}

function isGrowth(text) {
  return /\b(?:emerging from stealth|out of stealth|fastest[- ]growing)\b/i.test(text);
}

function isFundingRound(text) {
  return /\$\s*\d+(?:\.\d+)?\s*(?:billion|million|b|m)\b|\b(?:seed round|series\s+[a-e]|raised|raises|funding)\b/i.test(text);
}

function sectorFor(text, kind) {
  if (kind === 'new_fund') return 'Crossover fund';
  if (/\b(?:turbines?|gas generators?|energy)\b/i.test(text)) return 'Energy for AI';
  if (/\b(?:video|generative)\b/i.test(text)) return 'AI video';
  if (/\b(?:coding|developer tool|code editor)\b/i.test(text)) return 'AI coding';
  if (/\b(?:ai|machine learning|llm)\b/i.test(text)) return 'AI/ML';
  return null;
}

function acquisitionParties(text) {
  const patterns = [
    {
      re: /\b([A-Z][\w.&'-]+) (?:officially |has |will )?closes (?:its )?([A-Z][\w.&'-]+) acquisition\b/,
      company: 2,
      counterparty: 1,
    },
    {
      re: /\b([A-Z][\w.&'-]+) is now (?:a )?part of ([A-Z][\w.&'-]+)\b/,
      company: 1,
      counterparty: 2,
    },
    {
      re: /\b([A-Z][\w.&'-]+) acquired by ([A-Z][\w.&'-]+)\b/,
      company: 1,
      counterparty: 2,
    },
    {
      re: /\b([A-Z][\w.&'-]+) (?:to |will )?acquire[sd]? ([A-Z][\w.&'-]+)\b/,
      company: 2,
      counterparty: 1,
    },
    {
      re: /\bacquisition of ([A-Z][\w.&'-]+)\b/,
      company: 1,
      counterparty: null,
    },
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern.re);
    if (!match) continue;
    const companyName = cleanName(match[pattern.company]);
    if (!companyName) continue;
    return {
      companyName,
      counterparty: pattern.counterparty ? cleanName(match[pattern.counterparty]) : null,
    };
  }
  return { companyName: null, counterparty: null };
}

function companyBefore(text, verbRe) {
  const match = text.match(new RegExp(`\\b([A-Z][\\w.&'-]+) (?:${verbRe.source})\\b`, 'i'));
  return match ? cleanName(match[1]) : null;
}

function leadingCompany(text) {
  const match = text.match(/^\s*(?:the\s+)?([A-Z][\w.&'-]+(?:\s+[A-Z][\w.&'-]+){0,3})/);
  if (!match) return null;
  const parts = match[1].split(/\s+/).filter((part) => !NAME_STOP.has(part.toLowerCase()));
  return cleanName(parts[0]);
}

function fundName(text) {
  const named = text.match(/\b(ARK Venture(?: Fund)?|ARKVX)\b/);
  if (named) return named[1] === 'ARKVX' || named[1] === 'ARK Venture Fund' ? 'ARK Venture' : named[1];
  const generic = text.match(/\b([A-Z][\w.&'-]+(?:\s+[A-Z][\w.&'-]+){0,2}\s+Fund)\b/);
  return generic ? cleanName(generic[1]) : leadingCompany(text);
}

function companyFor(text, kind) {
  if (kind === 'acquisition') return acquisitionParties(text);
  if (kind === 'new_fund') return { companyName: fundName(text), counterparty: null };
  if (kind === 'revenue_breakout') {
    return {
      companyName: companyBefore(text, /says|hits|crossed|crosses|reached|reaches|surpasses/i) || leadingCompany(text),
      counterparty: null,
    };
  }
  const joined = text.match(/\bjoins ([A-Z][\w.&'-]+)/);
  return {
    companyName: companyBefore(text, /raises|raised|secures|lands|emerges|is emerging/i)
      || (joined ? cleanName(joined[1]) : null)
      || leadingCompany(text),
    counterparty: null,
  };
}

function heatFor(kind, millions) {
  if (kind === 'acquisition') {
    if (millions >= 10000) return 99;
    if (millions >= 1000) return 94;
    return 85;
  }
  if (kind === 'revenue_breakout') return millions >= 1000 ? 98 : 90;
  if (kind === 'growth') return millions >= 100 ? 93 : 84;
  if (kind === 'new_fund') return 88;
  if (kind === 'funding_round') {
    if (millions >= 100) return 86;
    if (millions >= 10) return 78;
    return 70;
  }
  return 60;
}

function classifyMarketMovement(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  let kind = null;
  if (isAcquisition(raw)) kind = 'acquisition';
  else if (isRevenueBreakout(raw)) kind = 'revenue_breakout';
  else if (isNewFund(raw)) kind = 'new_fund';
  else if (isGrowth(raw)) kind = 'growth';
  else if (isFundingRound(raw)) kind = 'funding_round';
  if (!kind) return null;

  const parties = companyFor(raw, kind);
  if (!parties.companyName) return null;

  const millions = amountMillions(raw);
  const signals = [kind];
  if (kind !== 'funding_round' && isFundingRound(raw)) signals.push('funding');
  if (kind !== 'growth' && isGrowth(raw)) signals.push('growth');

  return {
    kind,
    label: KIND_LABEL[kind],
    companyName: parties.companyName,
    counterparty: parties.counterparty,
    amountMillions: millions,
    sector: sectorFor(raw, kind),
    heat: heatFor(kind, millions),
    signals,
  };
}

function curatedMarketMovements() {
  return CURATED.map((row) => ({ ...row, investors: [...row.investors] }));
}

function curatedDiscoveryRows() {
  return curatedMarketMovements().map((row) => ({
    source: 'market_movement',
    source_url: row.sourceUrl,
    company_name: row.name,
    company_url: row.companyUrl,
    headline: row.headline,
    summary: row.detail,
    signals: [row.kind],
    sector_guess: row.sector,
    heat_score: row.heat,
    vc_mentioned: row.investors,
    status: 'queued',
    notes: row.caveat,
  }));
}

function showcaseFromDiscovery(row) {
  const signals = Array.isArray(row.signals) ? row.signals : [];
  const kind = MOVEMENT_KINDS.find((item) => signals.includes(item));
  const name = String(row.company_name || '').trim();
  if (!kind || !name) return null;
  return {
    id: `live-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind,
    label: KIND_LABEL[kind],
    name,
    sector: row.sector_guess || 'Market',
    headline: row.headline || name,
    detail: row.summary || '',
    caveat: null,
    sourceName: 'Pythh discovery',
    sourceUrl: row.source_url || row.company_url || '',
    companyUrl: row.company_url || null,
    asOf: row.discovered_at ? String(row.discovered_at).slice(0, 10) : null,
    heat: Number(row.heat_score) || 0,
    investors: [],
  };
}

function mergeShowcase(curated, liveRows) {
  const base = Array.isArray(curated) && curated.length ? curated : curatedMarketMovements();
  const seen = new Set(base.map((row) => row.name.toLowerCase()));
  const extra = [];
  for (const row of liveRows || []) {
    const card = showcaseFromDiscovery(row);
    if (!card || seen.has(card.name.toLowerCase())) continue;
    seen.add(card.name.toLowerCase());
    extra.push(card);
  }
  return [...base, ...extra];
}

export {
  MOVEMENT_KINDS,
  classifyMarketMovement,
  curatedMarketMovements,
  curatedDiscoveryRows,
  mergeShowcase,
};
