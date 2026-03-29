/**
 * GOVERNMENT GRANT DATA SOURCE
 *
 * Queries four free public APIs in parallel:
 *
 *   1. SBIR.gov      — Small Business Innovation Research & STTR awards
 *      https://www.sbir.gov/api
 *
 *   2. USASpending.gov — Federal contract and grant awards
 *      https://api.usaspending.gov
 *
 *   3. Grants.gov    — All federal grant opportunities and awards
 *      https://www.grants.gov/grantsws/OppSearch
 *      (XML/JSON search API, no key required)
 *
 *   4. SAM.gov       — Federal contract opportunities
 *      https://api.sam.gov/opportunities/v2/search (requires key)
 *      Falls back gracefully if SAM_GOV_API_KEY not set.
 *
 * Signals produced:
 *   SBIR_STTR             — SBIR / STTR award received
 *   DARPA_DOD             — DARPA, DoD, Air Force, Navy contract
 *   NIH_BIOTECH           — NIH / NCI / NIMH grant
 *   ENERGY_GRANT          — DOE / ARPA-E / EERE grant
 *   GOVT_CONTRACT_REVENUE — Any government contract (revenue signal)
 *   ACADEMIC_FUNDING      — NSF grant
 *   GRANTS_GOV_AWARD      — Grants.gov grant award
 *
 * Each signal carries { signal, category, strength, detectedAt, source, evidence }
 */

'use strict';

const TIMEOUT_MS = 12_000;

const SBIR_API     = 'https://www.sbir.gov/api/awards.json';
const SPENDING_API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const GRANTS_API   = 'https://apply07.grants.gov/grantsws/OppSearch';  // POST XML
const SAM_API      = 'https://api.sam.gov/opportunities/v2/search';

// Agency → signal mapping
const AGENCY_SIGNALS = [
  { keywords: ['darpa', 'defense advanced research'], signal: 'DARPA_DOD',    strength: 0.95 },
  { keywords: ['department of defense', 'dod', 'air force', 'navy', 'army', 'pentagon'], signal: 'DARPA_DOD', strength: 0.88 },
  { keywords: ['national institutes of health', 'nih', 'national cancer', 'nimh'], signal: 'NIH_BIOTECH', strength: 0.85 },
  { keywords: ['department of energy', 'doe', 'arpa-e', 'arpa-energy'],       signal: 'ENERGY_GRANT', strength: 0.85 },
  { keywords: ['nasa', 'national aeronautics'],                                signal: 'GOVT_CONTRACT_REVENUE', strength: 0.85 },
  { keywords: ['national science foundation', 'nsf'],                         signal: 'ACADEMIC_FUNDING', strength: 0.80 },
];

async function fetchJSON(url, opts = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'PythhBot/1.0' },
      signal: ctrl.signal,
      ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search SBIR.gov awards by company name.
 */
async function fetchSbirAwards(companyName) {
  const url = `${SBIR_API}?company=${encodeURIComponent(companyName)}&rows=20`;
  const data = await fetchJSON(url);
  return Array.isArray(data) ? data : (data?.results || []);
}

/**
 * Search USASpending.gov contracts/grants by company name.
 */
async function fetchUsaSpending(companyName) {
  const body = {
    filters: {
      keywords:     [companyName],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],  // contracts + grants
    },
    fields: ['Recipient Name', 'Awarding Agency', 'Award Amount', 'Description', 'Period of Performance Current End Date'],
    sort:   'Award Amount',
    order:  'desc',
    limit:  20,
    page:   1,
  };

  const data = await fetchJSON(SPENDING_API, {
    method: 'POST',
    body:   JSON.stringify(body),
  });

  return data?.results || [];
}

/**
 * Classify a funding agency/description to a signal.
 */
function classifyAgency(agencyText) {
  const lower = (agencyText || '').toLowerCase();
  for (const mapping of AGENCY_SIGNALS) {
    if (mapping.keywords.some(kw => lower.includes(kw))) {
      return { signal: mapping.signal, strength: mapping.strength };
    }
  }
  return { signal: 'GOVT_CONTRACT_REVENUE', strength: 0.75 };
}

/**
 * Detect SBIR phase from award title/description.
 */
function detectSbirPhase(award) {
  const text = `${award.program || ''} ${award.phase || ''} ${award.title || ''}`.toLowerCase();
  if (text.includes('phase ii') || text.includes('phase 2')) return { phase: 'II', strength: 0.88 };
  if (text.includes('phase i')  || text.includes('phase 1')) return { phase: 'I',  strength: 0.78 };
  return { phase: '?', strength: 0.80 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grants.gov — grants awarded or listed for a recipient name
// API: POST to grantsws/OppSearch with JSON body (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchGrantsGov(companyName) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GRANTS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'PythhBot/1.0',
      },
      body: JSON.stringify({
        keyword: companyName,
        oppStatuses: 'posted|closed|archived',
        rows: 10,
        startRecordNum: 0,
        sortBy: 'openDate|desc',
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Grants.gov HTTP ${res.status}`);
    const data = await res.json();
    return data?.oppHits || [];
  } catch (err) {
    if (process.env.DEBUG_INFERENCE === '1') {
      console.log(`[govGrantSource] Grants.gov: ${err.message}`);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAM.gov — federal contract opportunities (needs API key for entity data)
// Falls back gracefully when SAM_GOV_API_KEY is not configured.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSamGov(companyName) {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) return []; // graceful no-op without key

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      api_key:         apiKey,
      keywords:        companyName,
      limit:           '10',
      postedFrom:      new Date(Date.now() - 3 * 365 * 86_400_000).toISOString().split('T')[0],
      ptype:           'o',  // opportunities
    });
    const res = await fetch(`${SAM_API}?${params}`, {
      headers: { 'User-Agent': 'PythhBot/1.0' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`SAM.gov HTTP ${res.status}`);
    const data = await res.json();
    return data?.opportunitiesData || [];
  } catch (err) {
    if (process.env.DEBUG_INFERENCE === '1') {
      console.log(`[govGrantSource] SAM.gov: ${err.message}`);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main entry point — queries SBIR, USASpending, Grants.gov, and SAM.gov in parallel.
 *
 * @param {string} companyName
 * @returns {Promise<Array<SignalResult>>}
 */
async function fetchGovGrantSignals(companyName) {
  const now     = Date.now();
  const signals = [];

  const [sbirResult, spendingResult, grantsGovResult, samGovResult] = await Promise.allSettled([
    fetchSbirAwards(companyName),
    fetchUsaSpending(companyName),
    fetchGrantsGov(companyName),
    fetchSamGov(companyName),
  ]);

  // ── SBIR / STTR awards ────────────────────────────────────────────────────
  if (sbirResult.status === 'fulfilled' && sbirResult.value.length > 0) {
    const awards = sbirResult.value;
    const { phase, strength } = detectSbirPhase(awards[0]);

    signals.push({
      signal:     'SBIR_STTR',
      category:   'GOVT_GRANT',
      strength,
      detectedAt: now,
      source:     'sbir.gov',
      evidence:   `${awards.length} SBIR/STTR award(s). Most recent Phase ${phase}: ${awards[0].agency || 'Unknown agency'}`,
    });

    // Classify agency for potential stronger signals
    const agencySignal = classifyAgency(awards[0].agency);
    if (agencySignal.signal !== 'GOVT_CONTRACT_REVENUE') {
      signals.push({
        signal:     agencySignal.signal,
        category:   'GOVT_GRANT',
        strength:   agencySignal.strength,
        detectedAt: now,
        source:     'sbir.gov',
        evidence:   `SBIR from ${awards[0].agency}`,
      });
    }
  }

  // ── USASpending contracts ─────────────────────────────────────────────────
  if (spendingResult.status === 'fulfilled' && spendingResult.value.length > 0) {
    const contracts = spendingResult.value;
    const totalAmount = contracts.reduce((s, c) => s + (parseFloat(c['Award Amount']) || 0), 0);

    // Group by agency, pick strongest signal per agency
    const agencySet = new Set();
    for (const contract of contracts) {
      const agency = contract['Awarding Agency'] || '';
      if (agencySet.has(agency)) continue;
      agencySet.add(agency);

      const { signal, strength } = classifyAgency(agency);
      const existing = signals.find(s => s.signal === signal);

      if (!existing) {
        signals.push({
          signal,
          category:   'GOVT_GRANT',
          strength,
          detectedAt: now,
          source:     'usaspending.gov',
          evidence:   `${contracts.length} federal award(s) from ${agency}. Total: $${(totalAmount / 1_000_000).toFixed(1)}M`,
        });
      }
    }

    // General government revenue signal if contracts exist
    if (!signals.some(s => s.signal === 'GOVT_CONTRACT_REVENUE') && contracts.length > 0) {
      signals.push({
        signal:     'GOVT_CONTRACT_REVENUE',
        category:   'GOVT_GRANT',
        strength:   0.80,
        detectedAt: now,
        source:     'usaspending.gov',
        evidence:   `${contracts.length} federal contract(s) totaling $${(totalAmount / 1_000_000).toFixed(1)}M`,
      });
    }
  }

  // ── Grants.gov awards ─────────────────────────────────────────────────────
  if (grantsGovResult.status === 'fulfilled' && grantsGovResult.value.length > 0) {
    const grants = grantsGovResult.value;

    // Filter to matches that contain the company name
    const matched = grants.filter(g =>
      (g.title || '').toLowerCase().includes(companyName.toLowerCase()) ||
      (g.agencyName || '').toLowerCase().includes(companyName.toLowerCase())
    );

    if (matched.length > 0 || grants.length > 0) {
      const count = matched.length || grants.length;
      const agencyNames = [...new Set((matched.length ? matched : grants)
        .map(g => g.agencyName || g.agencyCode || 'Federal')
        .filter(Boolean)
      )].slice(0, 3).join(', ');

      signals.push({
        signal:     'GRANTS_GOV_AWARD',
        category:   'GOVT_GRANT',
        strength:   0.78,
        detectedAt: now,
        source:     'grants.gov',
        evidence:   `${count} federal grant listing(s) via Grants.gov. Agencies: ${agencyNames}`,
      });

      // Classify any DOE-EERE or DARPA agencies specifically
      for (const grant of (matched.length ? matched : grants).slice(0, 5)) {
        const agencyText = `${grant.agencyName || ''} ${grant.agencyCode || ''}`;
        const { signal: agSig, strength: agStr } = classifyAgency(agencyText);
        if (agSig !== 'GOVT_CONTRACT_REVENUE' && !signals.some(s => s.signal === agSig)) {
          signals.push({
            signal:     agSig,
            category:   'GOVT_GRANT',
            strength:   agStr,
            detectedAt: now,
            source:     'grants.gov',
            evidence:   `Grant from ${grant.agencyName || 'Federal agency'}`,
          });
        }
      }
    }
  }

  // ── SAM.gov contract opportunities ───────────────────────────────────────
  if (samGovResult.status === 'fulfilled' && samGovResult.value.length > 0) {
    const opps = samGovResult.value;
    const agencies = [...new Set(opps.map(o => o.fullParentPathName || o.departmentName || '').filter(Boolean))].slice(0, 3);

    if (!signals.some(s => s.signal === 'GOVT_CONTRACT_REVENUE')) {
      signals.push({
        signal:     'GOVT_CONTRACT_REVENUE',
        category:   'GOVT_GRANT',
        strength:   0.82,
        detectedAt: now,
        source:     'sam.gov',
        evidence:   `${opps.length} federal contract opportunity(s). Agencies: ${agencies.join(', ')}`,
      });
    }
  }

  if (process.env.DEBUG_INFERENCE === '1') {
    const counts = [
      sbirResult.status    === 'fulfilled' ? `SBIR:${sbirResult.value.length}`          : 'SBIR:err',
      spendingResult.status === 'fulfilled' ? `USASpend:${spendingResult.value.length}` : 'USASpend:err',
      grantsGovResult.status === 'fulfilled' ? `Grants.gov:${grantsGovResult.value.length}` : 'Grants.gov:err',
      samGovResult.status  === 'fulfilled' ? `SAM:${samGovResult.value.length}`         : 'SAM:err',
    ].join(' ');
    console.log(`[govGrantSource] ${companyName}: ${signals.length} signals (${counts})`);
  }

  return signals;
}

module.exports = { fetchGovGrantSignals };
