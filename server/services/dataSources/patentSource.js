/**
 * PATENT DATA SOURCE
 *
 * Queries multiple free patent databases in parallel:
 *
 *   1. USPTO PatentsView  — US patents, free API, no key required
 *      https://patentsview.org/apis/api-endpoints/patents
 *
 *   2. EPO Open Patent Services — European patents, free API (no key for search)
 *      https://ops.epo.org/3.2/rest-services/
 *
 *   3. WIPO PatentScope    — International (PCT) patents, free public search
 *      https://patentscope.wipo.int/search/en/search.jsf (via RSS)
 *
 * Signals produced:
 *   PATENT_FILED       — company has filed/received patents
 *   PATENT_DEEP_TECH   — patents in AI, robotics, energy, biotech, semiconductors
 *   PATENT_MOMENTUM    — growing patent count (recent filings)
 *
 * Each signal carries { signal, category, strength, detectedAt, source, evidence }
 */

'use strict';

const API_BASE    = 'https://api.patentsview.org/patents/query';
const EPO_BASE    = 'https://ops.epo.org/3.2/rest-services';
const WIPO_BASE   = 'https://patentscope.wipo.int/search/en/search.jsf';
const TIMEOUT_MS  = 12_000;

// Technology domain classification by CPC/USPTO class codes and keyword matching
const DEEP_TECH_KEYWORDS = [
  'artificial intelligence', 'machine learning', 'neural network', 'deep learning',
  'robotics', 'autonomous', 'battery', 'energy storage', 'semiconductor', 'photonics',
  'quantum', 'crispr', 'genomic', 'biotech', 'medical device', 'drug delivery',
  'materials science', 'nanotechnology', 'lidar', 'radar', 'satellite',
];

const Parser = require('rss-parser');
const rssParser = new Parser({ timeout: TIMEOUT_MS, headers: { 'User-Agent': 'PythhBot/1.0' } });

async function fetchJSON(url, body) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:  body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'PythhBot/1.0' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PythhBot/1.0', 'Accept': 'application/xml,text/xml,*/*' },
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USPTO PatentsView
// ─────────────────────────────────────────────────────────────────────────────

async function searchUSPTO(companyName) {
  const query = {
    q: { _contains: { assignee_organization: companyName } },
    f: [
      'patent_id', 'patent_title', 'patent_date', 'patent_abstract',
      'assignee_organization', 'cpc_subgroup_id',
    ],
    o: { per_page: 25, sort: [{ patent_date: 'desc' }] },
  };
  const data = await fetchJSON(API_BASE, query);
  return (data?.patents || []).map(p => ({
    id:       p.patent_id,
    title:    p.patent_title,
    date:     p.patent_date,
    abstract: p.patent_abstract,
    cpc:      p.cpc_subgroup_id,
    source:   'uspto',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EPO Open Patent Services (OPS)
// Free, no API key for basic reads. Throttle: 25 calls/min.
// https://ops.epo.org/3.2/rest-services/
// ─────────────────────────────────────────────────────────────────────────────

async function searchEPO(companyName) {
  // PA= (patent assignee) full-text search
  const encoded = encodeURIComponent(`pa="${companyName}"`);
  const url     = `${EPO_BASE}/published-data/search?q=${encoded}&Range=1-10`;

  const xml = await fetchText(url);

  // Parse publication numbers from OPS XML response
  const ids = [...xml.matchAll(/<ops:publication-reference[^>]*>[\s\S]*?<doc-number>(\d+)<\/doc-number>/g)]
    .map(m => m[1]);

  // Parse titles if present
  const titles = [...xml.matchAll(/<invention-title[^>]*>([^<]+)<\/invention-title>/g)]
    .map(m => m[1].trim());

  // Count is sufficient — we just need to know EPO has patents for this assignee
  return ids.map((id, i) => ({
    id:     `EP${id}`,
    title:  titles[i] || `EP Patent ${id}`,
    date:   null,
    source: 'epo',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// WIPO PatentScope — International (PCT) patents via RSS
// https://patentscope.wipo.int/search/en/search.jsf
// ─────────────────────────────────────────────────────────────────────────────

async function searchWIPO(companyName) {
  const q   = encodeURIComponent(`PA:"${companyName}"`);
  const url = `https://patentscope.wipo.int/search/en/rss.jsf?query=${q}&office=&sortby=PD+DESC&start=0`;

  const feed = await rssParser.parseURL(url);
  return (feed.items || []).slice(0, 10).map(item => ({
    id:     item.guid || item.link,
    title:  item.title || '',
    date:   item.pubDate || null,
    source: 'wipo',
  }));
}

/**
 * Detect deep tech domains from patent titles and abstracts.
 */
function detectDomains(patents) {
  const domains = new Set();
  for (const patent of patents) {
    const text = `${patent.patent_title || ''} ${patent.patent_abstract || ''}`.toLowerCase();
    for (const kw of DEEP_TECH_KEYWORDS) {
      if (text.includes(kw)) {
        domains.add(kw.split(' ')[0]); // e.g. "artificial" → "artificial"
      }
    }
    // CPC code prefixes for tech domains
    const cpc = (patent.cpc_subgroup_id || '');
    if (cpc.startsWith('G06N'))  domains.add('AI/ML');
    if (cpc.startsWith('B25J'))  domains.add('robotics');
    if (cpc.startsWith('H01M'))  domains.add('battery');
    if (cpc.startsWith('H01L'))  domains.add('semiconductor');
    if (cpc.startsWith('C12N'))  domains.add('biotech');
    if (cpc.startsWith('A61'))   domains.add('medtech');
  }
  return [...domains].slice(0, 5);
}

/**
 * Count patents filed in the last N months.
 */
function countRecent(patents, months = 24) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return patents.filter(p => p.patent_date && new Date(p.patent_date) >= cutoff).length;
}

/**
 * Main entry point — queries USPTO, EPO, and WIPO in parallel.
 *
 * @param {string} companyName
 * @returns {Promise<Array<SignalResult>>}
 */
async function fetchPatentSignals(companyName) {
  const now     = Date.now();
  const signals = [];
  const DEBUG   = process.env.DEBUG_INFERENCE === '1';

  // Run all three patent databases in parallel
  const [usptoResult, epoResult, wipoResult] = await Promise.allSettled([
    searchUSPTO(companyName),
    searchEPO(companyName),
    searchWIPO(companyName),
  ]);

  if (DEBUG) {
    const usptoCount = usptoResult.status === 'fulfilled' ? usptoResult.value.length : `ERR: ${usptoResult.reason?.message}`;
    const epoCount   = epoResult.status === 'fulfilled'   ? epoResult.value.length   : `ERR: ${epoResult.reason?.message}`;
    const wipoCount  = wipoResult.status === 'fulfilled'  ? wipoResult.value.length  : `ERR: ${wipoResult.reason?.message}`;
    console.log(`[patentSource] ${companyName} → USPTO:${usptoCount} EPO:${epoCount} WIPO:${wipoCount}`);
  }

  // Merge results from all sources
  const uspatents = usptoResult.status === 'fulfilled' ? usptoResult.value : [];
  const epatents  = epoResult.status  === 'fulfilled'  ? epoResult.value  : [];
  const wpatents  = wipoResult.status === 'fulfilled'  ? wipoResult.value : [];

  // Determine source labels for evidence strings
  const sourceSummary = [
    uspatents.length ? `USPTO:${uspatents.length}` : null,
    epatents.length  ? `EPO:${epatents.length}`    : null,
    wpatents.length  ? `WIPO:${wpatents.length}`   : null,
  ].filter(Boolean).join(' ');

  const allPatents = [...uspatents, ...epatents, ...wpatents];
  if (allPatents.length === 0) return signals;

  const total       = allPatents.length;
  const recentCount = countRecent(uspatents, 24); // date data only from USPTO
  const domains     = detectDomains(uspatents);   // CPC codes only from USPTO
  const isDeepTech  = domains.length > 0;
  const latestDate  = uspatents[0]?.date || wpatents[0]?.date;

  // PATENT_FILED — company has patents across any jurisdiction
  const filedStrength = total >= 15 ? 0.92
                      : total >= 8  ? 0.88
                      : total >= 3  ? 0.82
                      : total >= 1  ? 0.72
                      : 0.65;
  signals.push({
    signal:     'PATENT_FILED',
    category:   'PATENT',
    strength:   filedStrength,
    detectedAt: now,
    source:     sourceSummary || 'patents',
    evidence:   `${total} patents found (${sourceSummary}). Latest: ${latestDate || 'unknown'}`,
  });

  // PATENT_DEEP_TECH — domains detected via CPC codes and keyword analysis
  if (isDeepTech) {
    signals.push({
      signal:     'PATENT_DEEP_TECH',
      category:   'PATENT',
      strength:   0.87,
      detectedAt: now,
      source:     'uspto',
      evidence:   `Deep tech domains: ${domains.join(', ')}`,
    });
  }

  // PATENT_MOMENTUM — accelerating IP activity in last 24 months
  if (recentCount >= 3) {
    signals.push({
      signal:     'PATENT_MOMENTUM',
      category:   'PATENT',
      strength:   recentCount >= 8 ? 0.92 : 0.80,
      detectedAt: now,
      source:     'uspto',
      evidence:   `${recentCount} USPTO patents filed in the last 24 months`,
    });
  }

  // PATENT_GLOBAL — presence across multiple jurisdictions signals serious IP strategy
  const jurisdictionCount = [uspatents.length > 0, epatents.length > 0, wpatents.length > 0]
    .filter(Boolean).length;
  if (jurisdictionCount >= 2) {
    signals.push({
      signal:     'PATENT_GLOBAL',
      category:   'PATENT',
      strength:   0.82,
      detectedAt: now,
      source:     sourceSummary,
      evidence:   `Patents found in ${jurisdictionCount} jurisdictions (${sourceSummary})`,
    });
  }

  return signals;
}

module.exports = { fetchPatentSignals };
