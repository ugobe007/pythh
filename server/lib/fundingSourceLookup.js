/**
 * Ontology-driven funding-event lookup (docs/FUNDING_SOURCE_ONTOLOGY.md §6).
 *
 * Public channels wired here (no commercial DB required):
 *   - SEC EDGAR Form D          → equity raise evidence (T0 filing)
 *   - NSF awards API            → SBIR/STTR + agency awards (non-dilutive)
 *   - USASpending.gov           → federal contracts / grants (non-dilutive)
 *   - SBIR.gov awards API       → when reachable (often egress-blocked)
 *
 * Commercial connectors (Dealroom / Crunchbase / PitchBook / OpenVC) are stubs
 * that activate only when licensed env keys are present — never the SoT.
 *
 * Output shape is normalized for search_results + funding_evidence_events.
 */

'use strict';

const TIMEOUT_MS = 15_000;
const SEC_UA =
  process.env.SEC_USER_AGENT ||
  'PythhFundingLookup/1.0 (https://pythh.ai; research@pythh.ai)';
const SBIR_AWARDS = 'https://api.www.sbir.gov/public/api/awards';
const NSF_AWARDS = 'https://api.nsf.gov/services/v1/awards.json';
const USA_SPENDING = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const SEC_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

function normName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|co|company|technologies|technology|labs|lab|ai)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripDisplayCik(displayName) {
  return String(displayName || '')
    .replace(/\s*\(CIK\s*\d+\)\s*$/i, '')
    .trim();
}

const GENERIC_NAME_TOKENS = new Set([
  'innovations',
  'innovation',
  'technologies',
  'technology',
  'systems',
  'solutions',
  'labs',
  'lab',
  'group',
  'partners',
  'ventures',
  'capital',
  'industries',
  'industrial',
  'sciences',
  'science',
  'therapeutics',
  'biosciences',
  'digital',
  'software',
  'hardware',
  'global',
  'international',
  'america',
  'american',
  'united',
  'research',
  'corp',
  'company',
]);

function distinctiveTokens(name) {
  return normName(name)
    .split(' ')
    .filter((t) => t.length >= 3 && !GENERIC_NAME_TOKENS.has(t));
}

/** True when awardee/issuer string is a plausible match for the startup name. */
function namesAlign(candidate, companyName) {
  const cn = normName(companyName);
  const cand = normName(stripDisplayCik(candidate));
  if (!cn || !cand) return false;
  if (cand === cn || cand.startsWith(`${cn} `) || cn.startsWith(`${cand} `)) return true;
  const need = distinctiveTokens(companyName);
  if (!need.length) {
    // Fall back: whole normalized name must appear.
    return cand.includes(cn);
  }
  const have = new Set(cand.split(' ').filter(Boolean));
  return need.every((t) => have.has(t));
}

/** SPV / fund wrappers that mention a startup but are not the issuer raise. */
function isSpvOrFundWrapper(displayName, companyName) {
  const raw = String(displayName || '');
  const dn = normName(stripDisplayCik(raw));
  const cn = normName(companyName);
  if (!cn || !dn) return true;
  if (
    /\b(a series of|series of|opportunity fund|opp fund|tender fund|select[, ]|partners select|master fund|alternate investments|holdings?\s+spv|\bspv\b)\b/i.test(
      raw,
    )
  ) {
    return true;
  }
  // "Anduril Fund, LLC" / "Anduril Investors II LLC" — fund vehicles, not operating issuers.
  if (
    /\b(fund|funds|holdings|investors)\b/i.test(raw) &&
    !/\b(inc|incorporated|corp|corporation|ltd)\b/i.test(raw)
  ) {
    const withoutLegal = stripDisplayCik(raw);
    if (/\b(fund|funds|holdings|investors)\b/i.test(withoutLegal)) return true;
  }
  // Issuer filings usually start with the company name (optionally + legal suffix).
  if (!namesAlign(raw, companyName)) return true;
  if (dn === cn || dn.startsWith(`${cn} `)) return false;
  return true;
}

function isIssuerFormD(displayNames, companyName) {
  const names = Array.isArray(displayNames) ? displayNames : [displayNames];
  return names.some((n) => !isSpvOrFundWrapper(n, companyName));
}

function primaryIssuerLabel(displayNames, companyName) {
  const names = (Array.isArray(displayNames) ? displayNames : [displayNames]).map(stripDisplayCik);
  const match = names.find((n) => !isSpvOrFundWrapper(n, companyName));
  return match || names[0] || companyName;
}

function formDArchiveUrl(cik, accession) {
  const cikNum = String(cik || '').replace(/\D/g, '');
  const adsh = String(accession || '').replace(/-/g, '');
  if (!cikNum || !adsh) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(cikNum)}/${adsh}/primary_doc.xml`;
}

function afterCutoff(isoDate, afterDate) {
  if (!afterDate) return true;
  const t = Date.parse(isoDate);
  const cut = Date.parse(afterDate);
  if (!Number.isFinite(t) || !Number.isFinite(cut)) return true;
  return t > cut;
}

function parseAmountUsd(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': opts.userAgent || 'PythhFundingLookup/1.0 (+https://pythh.ai)',
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url}`);
      err.status = res.status;
      err.body = text.slice(0, 200);
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch (cause) {
      const err = new Error(`Invalid JSON from ${url}`);
      err.cause = cause;
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * SEC Form D issuer filings for a startup (equity raise evidence).
 * @returns {Promise<Array<object>>}
 */
async function lookupSecFormD({ name, afterDate, limit = 12 } = {}) {
  if (!name || String(name).trim().length < 2) return [];
  const q = `"${String(name).trim()}"`;
  const url = `${SEC_SEARCH}?${new URLSearchParams({
    q,
    forms: 'D',
    from: '0',
    size: String(Math.min(Math.max(limit * 3, 10), 40)),
  })}`;
  const data = await fetchJson(url, { userAgent: SEC_UA });
  const hits = data?.hits?.hits || [];
  const out = [];
  const seen = new Set();

  for (const hit of hits) {
    const src = hit?._source || {};
    const displayNames = src.display_names || [];
    if (!isIssuerFormD(displayNames, name)) continue;
    const fileDate = src.file_date;
    if (!fileDate || !afterCutoff(fileDate, afterDate)) continue;
    const cik = (src.ciks || [])[0];
    const adsh = src.adsh;
    const sourceUrl = formDArchiveUrl(cik, adsh);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const issuer = primaryIssuerLabel(displayNames, name);
    out.push({
      channel: 'transaction',
      evidence_type: 'sec_filing',
      financing_type: 'equity',
      event_date: fileDate,
      amount_raw: null,
      amount_usd: null,
      round_type: 'Form D',
      source_url: sourceUrl,
      source_title: `${issuer} files Form D (${fileDate})`,
      source_provider: 'sec_edgar_form_d',
      source_publisher: 'SEC EDGAR',
      investor_name_raw: 'SEC Form D (investors not listed in index)',
      provider_type: null,
      ontology_channel: 2,
      trust_hint: 'T0',
      raw: {
        cik,
        adsh,
        form: src.form || src.file_type,
        items: src.items || [],
        display_names: displayNames,
      },
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * NSF awards (includes SBIR/STTR titles) by awardee name.
 */
async function lookupNsfAwards({ name, afterDate, limit = 20 } = {}) {
  if (!name || String(name).trim().length < 2) return [];
  const queries = [String(name).trim()];
  const brand = distinctiveTokens(name)[0];
  if (brand && brand.length >= 3 && !queries.some((q) => normName(q) === brand)) {
    queries.push(brand);
  }

  const byId = new Map();
  for (const query of queries) {
    const url = `${NSF_AWARDS}?${new URLSearchParams({
      awardeeName: query,
      printFields: 'id,title,startDate,fundsObligatedAmt,awardeeName,agency',
      rpp: String(Math.min(Math.max(limit, 5), 25)),
    })}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch {
      continue;
    }
    for (const award of data?.response?.award || []) {
      if (award?.id) byId.set(String(award.id), award);
    }
  }

  const out = [];
  for (const award of byId.values()) {
    const awardee = award.awardeeName || '';
    if (!namesAlign(awardee, name)) continue;
    const start = award.startDate;
    // NSF dates are often MM/DD/YYYY
    let iso = null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(start || ''))) {
      const [mm, dd, yyyy] = String(start).split('/');
      iso = `${yyyy}-${mm}-${dd}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(String(start || ''))) {
      iso = String(start).slice(0, 10);
    }
    if (!iso || !afterCutoff(iso, afterDate)) continue;
    const amount = parseAmountUsd(award.fundsObligatedAmt);
    const title = String(award.title || 'NSF award').replace(/\s+/g, ' ').trim();
    const isSbir = /\b(sbir|sttr)\b/i.test(title);
    const id = award.id;
    const sourceUrl = id
      ? `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${encodeURIComponent(id)}`
      : `https://www.nsf.gov/awardsearch/simpleSearchResult?queryText=${encodeURIComponent(name)}`;
    out.push({
      channel: 'non_dilutive',
      evidence_type: 'grant_award',
      financing_type: 'grant',
      event_date: iso,
      amount_raw: amount != null ? String(amount) : null,
      amount_usd: amount,
      round_type: isSbir ? (/\bsttr\b/i.test(title) ? 'STTR' : 'SBIR') : 'NSF Award',
      source_url: sourceUrl,
      source_title: `${awardee || name} — ${title.slice(0, 160)}`,
      source_provider: isSbir ? 'nsf_sbir_sttr' : 'nsf_awards',
      source_publisher: 'NSF',
      investor_name_raw: award.agency || 'National Science Foundation',
      provider_type: 'government_grant',
      ontology_channel: 3,
      trust_hint: 'T0',
      raw: award,
    });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));
}

/**
 * SBIR.gov awards API (may 403 from some cloud egress IPs — fail soft).
 */
async function lookupSbirAwards({ name, afterDate, limit = 20 } = {}) {
  if (!name || String(name).trim().length < 2) return [];
  const url = `${SBIR_AWARDS}?${new URLSearchParams({
    firm: String(name).trim(),
    rows: String(Math.min(Math.max(limit, 5), 50)),
  })}`;
  let data;
  try {
    data = await fetchJson(url, {
      headers: { Referer: 'https://www.sbir.gov/', Origin: 'https://www.sbir.gov' },
    });
  } catch (err) {
    if (err.status === 403 || err.status === 404 || err.name === 'AbortError') return [];
    throw err;
  }
  const rows = Array.isArray(data) ? data : data?.results || data?.awards || [];
  const out = [];
  for (const award of rows) {
    const year = award.award_year || award.solicitation_year;
    const propDate = award.proposal_award_date;
    let iso = null;
    if (propDate && Date.parse(propDate)) iso = new Date(propDate).toISOString().slice(0, 10);
    else if (year && /^\d{4}$/.test(String(year))) iso = `${year}-06-30`;
    if (!iso || !afterCutoff(iso, afterDate)) continue;
    const amount = parseAmountUsd(award.award_amount);
    const link =
      award.award_link ||
      (award.agency_tracking_number
        ? `https://www.sbir.gov/sbirsearch/detail/${encodeURIComponent(award.agency_tracking_number)}`
        : `https://www.sbir.gov/sbirsearch/award/all?firm=${encodeURIComponent(name)}`);
    const program = String(award.program || 'SBIR').toUpperCase();
    const phase = award.phase ? ` Phase ${award.phase}` : '';
    out.push({
      channel: 'non_dilutive',
      evidence_type: 'grant_award',
      financing_type: 'grant',
      event_date: iso,
      amount_raw: amount != null ? String(amount) : null,
      amount_usd: amount,
      round_type: `${program}${phase}`.trim(),
      source_url: link,
      source_title: `${award.firm || name} — ${award.award_title || 'SBIR/STTR award'}`,
      source_provider: 'sbir_gov',
      source_publisher: award.agency || 'SBIR.gov',
      investor_name_raw: award.agency || 'SBIR/STTR',
      provider_type: 'government_grant',
      ontology_channel: 3,
      trust_hint: 'T0',
      raw: award,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * USASpending federal awards (contracts + grants) for a recipient name.
 */
async function lookupUsaSpendingAwards({ name, afterDate, limit = 10 } = {}) {
  if (!name || String(name).trim().length < 2) return [];
  const groups = [
    { codes: ['A', 'B', 'C', 'D'], kind: 'contract' },
    { codes: ['02', '03', '04', '05'], kind: 'grant' },
  ];
  const out = [];
  const seen = new Set();

  for (const group of groups) {
    let data;
    try {
      data = await fetchJson(USA_SPENDING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            recipient_search_text: [String(name).trim()],
            award_type_codes: group.codes,
          },
          fields: [
            'Recipient Name',
            'Awarding Agency',
            'Award Amount',
            'Description',
            'Start Date',
            'Award ID',
            'generated_internal_id',
          ],
          sort: 'Award Amount',
          order: 'desc',
          limit: Math.min(limit, 15),
          page: 1,
        }),
      });
    } catch {
      continue;
    }
    for (const row of data?.results || []) {
      const recipient = row['Recipient Name'] || '';
      if (!namesAlign(recipient, name)) continue;
      const start = row['Start Date'];
      if (!start || !afterCutoff(start, afterDate)) continue;
      const awardId = row['Award ID'] || row.generated_internal_id || row['Description'];
      const key = `${awardId}|${start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const amount = parseAmountUsd(row['Award Amount']);
      const agency = row['Awarding Agency'] || 'US Federal';
      const sourceUrl = awardId
        ? `https://www.usaspending.gov/award/${encodeURIComponent(String(awardId))}`
        : `https://www.usaspending.gov/search/?hash=false&keyword=${encodeURIComponent(name)}`;
      out.push({
        channel: 'non_dilutive',
        evidence_type: 'grant_award',
        financing_type: group.kind === 'grant' ? 'grant' : 'grant',
        event_date: String(start).slice(0, 10),
        amount_raw: amount != null ? String(amount) : null,
        amount_usd: amount,
        round_type: group.kind === 'grant' ? 'Federal Grant' : 'Federal Contract',
        source_url: sourceUrl,
        source_title: `${recipient || name} — ${agency} ${group.kind} ${amount != null ? `$${amount.toLocaleString('en-US')}` : ''}`.trim(),
        source_provider: 'usaspending',
        source_publisher: agency,
        investor_name_raw: agency,
        provider_type: 'government_grant',
        ontology_channel: 3,
        trust_hint: 'T1',
        raw: row,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Optional commercial enrichment — empty without license keys. */
async function lookupCommercialEnrichment({ name } = {}) {
  const out = [];
  if (process.env.DEALROOM_API_KEY) {
    out.push({
      channel: 'transaction',
      evidence_type: 'database_record',
      financing_type: 'unknown',
      event_date: null,
      source_provider: 'dealroom',
      skipped: true,
      reason: 'connector_not_implemented',
      raw: { name },
    });
  }
  if (process.env.CRUNCHBASE_API_KEY) {
    out.push({
      channel: 'transaction',
      evidence_type: 'database_record',
      financing_type: 'unknown',
      event_date: null,
      source_provider: 'crunchbase',
      skipped: true,
      reason: 'connector_not_implemented',
      raw: { name },
    });
  }
  return out.filter((r) => !r.skipped);
}

/**
 * Multi-source lookup for one startup.
 *
 * @param {{ name: string, website?: string|null, afterDate?: string|null, sources?: string[] }} opts
 * @returns {Promise<{ events: object[], errors: object[], sources_queried: string[] }>}
 */
async function lookupStartupFundingEvents(opts = {}) {
  const name = String(opts.name || '').trim();
  const afterDate = opts.afterDate || null;
  const wanted = new Set(
    (opts.sources || ['sec', 'nsf', 'sbir', 'usaspending'])
      .map((s) => String(s).toLowerCase().trim())
      .filter(Boolean),
  );

  const tasks = [];
  const sourcesQueried = [];

  if (wanted.has('sec') || wanted.has('form_d') || wanted.has('edgar')) {
    sourcesQueried.push('sec_edgar_form_d');
    tasks.push(
      lookupSecFormD({ name, afterDate }).then((events) => ({ source: 'sec', events })),
    );
  }
  if (wanted.has('nsf')) {
    sourcesQueried.push('nsf_awards');
    tasks.push(lookupNsfAwards({ name, afterDate }).then((events) => ({ source: 'nsf', events })));
  }
  if (wanted.has('sbir')) {
    sourcesQueried.push('sbir_gov');
    tasks.push(lookupSbirAwards({ name, afterDate }).then((events) => ({ source: 'sbir', events })));
  }
  if (wanted.has('usaspending') || wanted.has('usa')) {
    sourcesQueried.push('usaspending');
    tasks.push(
      lookupUsaSpendingAwards({ name, afterDate }).then((events) => ({ source: 'usaspending', events })),
    );
  }
  if (wanted.has('commercial')) {
    sourcesQueried.push('commercial');
    tasks.push(
      lookupCommercialEnrichment({ name }).then((events) => ({ source: 'commercial', events })),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const events = [];
  const errors = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      events.push(...(result.value.events || []));
    } else {
      errors.push({ message: String(result.reason?.message || result.reason).slice(0, 240) });
    }
  }

  // Dedupe by source_url + event_date + financing_type
  const deduped = [
    ...new Map(
      events
        .filter((e) => e.source_url && e.event_date)
        .map((e) => [`${e.source_provider}|${e.source_url}|${e.event_date}|${e.financing_type}`, e]),
    ).values(),
  ].sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));

  return { events: deduped, errors, sources_queried: sourcesQueried };
}

/**
 * Map a lookup event → funding_evidence_events upsert row.
 */
function toLedgerEventRow(event, { startupId, startupName }) {
  const amount = event.amount_usd != null ? event.amount_usd : parseAmountUsd(event.amount_raw);
  const announcedAt = `${event.event_date}T12:00:00.000Z`;
  const sourceKey = `ontology:${event.source_provider}:${startupId || normName(startupName)}:${event.event_date}:${Buffer.from(event.source_url).toString('base64url').slice(0, 48)}`;
  return {
    source_event_key: sourceKey,
    startup_id: startupId || null,
    startup_name_raw: startupName,
    financing_type: event.financing_type || 'unknown',
    round_type: event.round_type || null,
    amount_usd: amount,
    announced_at: announcedAt,
    occurred_at: announcedAt,
    occurred_at_precision: 'day',
    source_url: event.source_url,
    source_publisher: event.source_publisher || event.source_provider,
    source_title: event.source_title,
    evidence_confidence: event.evidence_type === 'sec_filing' ? 0.92 : 0.85,
    verification_status: 'observed',
    extraction_version: 'funding-source-lookup-v1',
    metadata: {
      ontology_channel: event.ontology_channel,
      evidence_type: event.evidence_type,
      source_provider: event.source_provider,
      provider_type: event.provider_type,
      participant_list_complete: false,
      trust_hint: event.trust_hint,
      discovery_method: 'funding_source_ontology_lookup',
      raw: event.raw || null,
    },
    updated_at: new Date().toISOString(),
  };
}

/**
 * Map a lookup event → funding_evidence_search_results upsert row.
 * Grants use agency as investor_name_raw; Form D uses a sentinel label.
 */
function toSearchResultRow(event, { startupId }) {
  return {
    startup_id: startupId,
    investor_id: null,
    investor_name_raw: event.investor_name_raw || event.source_publisher || event.source_provider,
    event_date: event.event_date,
    event_type: event.financing_type === 'grant' ? 'grant' : 'funding',
    round_type: event.round_type || null,
    amount_raw: event.amount_raw || (event.amount_usd != null ? String(event.amount_usd) : null),
    source_url: event.source_url,
    source_title: event.source_title,
    source_provider: event.source_provider,
    resolution_status: 'pending',
    resolution_method: null,
    raw_payload: {
      discovery_method: 'funding_source_ontology_lookup',
      channel: event.channel,
      evidence_type: event.evidence_type,
      financing_type: event.financing_type,
      provider_type: event.provider_type,
      ontology_channel: event.ontology_channel,
      trust_hint: event.trust_hint,
      raw: event.raw || null,
    },
  };
}

module.exports = {
  normName,
  namesAlign,
  distinctiveTokens,
  isSpvOrFundWrapper,
  isIssuerFormD,
  formDArchiveUrl,
  lookupSecFormD,
  lookupNsfAwards,
  lookupSbirAwards,
  lookupUsaSpendingAwards,
  lookupStartupFundingEvents,
  toLedgerEventRow,
  toSearchResultRow,
};
