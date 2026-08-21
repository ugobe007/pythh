'use strict';

const HORIZONS = Object.freeze([30, 90, 180, 365]);
const DAY_MS = 86_400_000;
const GENERIC_INVESTOR_NAMES = new Set([
  'seed', 'pre seed', 'series a', 'series b', 'series c', 'series d', 'venture',
  'ventures', 'capital', 'fund', 'investor', 'investors', 'angel', 'angels',
  'syndicate', 'investment', 'investing', 'backing', 'undisclosed', 'confidential', 'unknown',
  'plug', 'play', 'australia', 'netherlands',
]);

/** Tokens that must not stand alone after stripping Fund/Capital/Partners (e.g. Founders Fund). */
const WEAK_NORMALIZED_TOKENS = new Set([
  'founders', 'general', 'first', 'index', 'light', 'soft', 'hard', 'open', 'true',
  'new', 'next', 'red', 'blue', 'bond', 'spark', 'prime', 'core', 'edge', 'peak',
  'ridge', 'grove', 'union', 'social', 'global', 'national', 'united', 'american',
]);

/**
 * Strip RSS/headline noise glued onto investor names:
 * - unicode whitespace (NBSP / narrow NBSP) → ASCII space
 * - publisher suffixes: "General Catalyst - Entrackr", "Accel - Capital Brief"
 * - possessive person prefixes: "Peter Thiel’s Founders Fund"
 * - program / sub-vehicle suffixes: "Andreessen Horowitz Speedrun", "SoftBank Vision Fund 2"
 * Only strips spaced dashes so "F-Prime" / "Long-Z Investments" stay intact.
 */
function stripInvestorHeadlineNoise(value) {
  let s = String(value || '')
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  // Leading conjunction debris from roster lists: "And a16z Scout Fund"
  s = s.replace(/^(?:and|plus|also)\s+/i, '').trim();

  // "Firm - Publisher" / "Firm — Outlet"
  s = s.replace(/\s+[-–—]\s+[^-–—\n]{2,80}$/u, '').trim();

  // "Person’s Firm Name" → Firm Name (only when remainder looks firm-like)
  const possessive = s.match(/^(.+?)['’]s\s+(.+)$/u);
  if (possessive) {
    const remainder = possessive[2].trim();
    const firmToken = /\b(?:capital|ventures?|partners?|fund|management|llc|lp|group)\b/i.test(remainder);
    const genericRemainder = /^(?:venture firm|vc firm|investment firm|firm|ceo|cto|cfo|founder|co-?founder|partner|partners|investor|investors)$/i.test(remainder);
    // Require an explicit firm token — do not treat bare titles ("CEO") as firms.
    if (firmToken && !genericRemainder && remainder.length >= 3) s = remainder;
  }

  // Numbered Vision Fund vehicles → parent Vision Fund ("SoftBank Vision Fund 2")
  s = s.replace(/\b(Vision Fund)\s+\d+\b/i, '$1').trim();

  // Accelerator / scout / specialty-desk suffixes that collapse to the parent firm.
  // Keep hyphenated tokens intact; only strip trailing spaced program labels.
  s = s.replace(/\s+(?:Speedrun|Crypto|Builders?|Fellowship|Accelerator|Scout(?:\s+(?:Fund|Programme|Program))?)$/i, '').trim();

  return s.trim();
}

function normalizeEntityName(value) {
  const raw = String(value || '')
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
  if (!raw) return '';

  // Strip corporate suffixes, but keep them when the remainder is a weak/generic token
  // (e.g. "Founders Fund" must not collapse to "founders").
  const stripped = raw
    .replace(/(?<=[a-z0-9])(?:ventures?|capital|partners?|management|fund|holdings?)$/i, ' ')
    .replace(/\b(?:ventures?|capital|partners?|management|fund|holdings?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    stripped
    && stripped.length >= 3
    && !WEAK_NORMALIZED_TOKENS.has(stripped)
    && !GENERIC_INVESTOR_NAMES.has(stripped)
  ) {
    return stripped;
  }
  return raw;
}

/** Prefer a firm profile over partner/person rows that share the same firm field. */
function preferFirmEntity(candidates, rawName) {
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0];
  const raw = String(rawName || '').trim().toLowerCase();

  const looksLikePersonName = (name) => {
    const trimmed = String(name || '').trim();
    if (/\([^)]+\)\s*$/.test(trimmed)) return true;
    if (/\b(?:ventures?|capital|partners?|fund|management|llc|lp|holdings?|group|vc)\b/i.test(trimmed)) {
      return false;
    }
    // Title-case person names ("Peter Thiel", "Zach DeWitt") — not "Peak XV" / "Z47".
    const token = String.raw`[A-Z][a-z]+(?:[A-Z][a-z]+)*(?:'[a-z]+)?`;
    return new RegExp(`^(?:${token}|[A-Z]\\.)(?:\\s+(?:${token}|[A-Z]\\.)){1,3}$`).test(trimmed);
  };

  const isPersonLike = (row) => {
    if (row?.is_individual === true) return true;
    const name = String(row?.name || '').trim();
    const firm = String(row?.firm || '').trim().toLowerCase();
    const nameLc = name.toLowerCase();
    // Canonical org signals beat title-case person heuristics
    // ("General Catalyst" looks title-case but is the firm itself).
    if (nameLc === raw) return false;
    if (nameLc.startsWith(`${raw} `)) return false;
    if (firm && nameLc === firm) return false;
    if (looksLikePersonName(name)) return true;
    return false;
  };

  const firmProfiles = candidates.filter((row) => !isPersonLike(row));
  if (!firmProfiles.length) return null;

  const byExactName = firmProfiles.filter(
    (row) => String(row?.name || '').trim().toLowerCase() === raw,
  );
  if (byExactName.length === 1) return byExactName[0];

  const nameEqualsFirm = firmProfiles.filter((row) => {
    const name = String(row?.name || '').trim().toLowerCase();
    const firm = String(row?.firm || '').trim().toLowerCase();
    return name && firm && name === firm && (name === raw || firm === raw || name.startsWith(`${raw} `));
  });
  if (nameEqualsFirm.length === 1) return nameEqualsFirm[0];

  const expanded = firmProfiles.filter((row) => {
    const name = String(row?.name || '').trim().toLowerCase();
    return name === raw || name.startsWith(`${raw} `);
  });
  if (expanded.length === 1) return expanded[0];

  if (firmProfiles.length === 1) return firmProfiles[0];
  return null;
}

function normalizeStartupName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/\b(?:incorporated|corporation|company|limited|inc|llc|ltd|plc)\b/gi, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function startupAliases(row) {
  const extractedAliases = Array.isArray(row?.extracted_data?.aliases) ? row.extracted_data.aliases : [];
  const explicitAliases = Array.isArray(row?.aliases) ? row.aliases : [];
  return [...new Set([row?.name, ...explicitAliases, ...extractedAliases]
    .map(value => String(value || '').trim())
    .filter(Boolean))];
}

function resolveCanonicalStartup(rows, rawName) {
  const raw = String(rawName || '').trim();
  if (!isPromotionSafeStartupName(raw)) {
    return { row: null, status: 'unresolved', confidence: 0, matchKind: null };
  }
  const exact = rows.filter(row => startupAliases(row)
    .some(value => value.toLowerCase() === raw.toLowerCase()));
  if (exact.length === 1) {
    const primaryNameHit = String(exact[0].name || '').trim().toLowerCase() === raw.toLowerCase();
    return {
      row: exact[0], status: 'resolved', confidence: primaryNameHit ? 1 : 0.98,
      matchKind: primaryNameHit ? 'exact_name' : 'exact_alias',
    };
  }
  if (exact.length > 1) return { row: null, status: 'ambiguous', confidence: 0, matchKind: 'exact_collision' };
  const normalized = normalizeStartupName(raw);
  const candidates = rows.filter(row => startupAliases(row)
    .some(value => normalizeStartupName(value) === normalized));
  if (candidates.length === 1) {
    return { row: candidates[0], status: 'resolved', confidence: 0.94, matchKind: 'normalized_name_or_alias' };
  }
  if (candidates.length > 1) return { row: null, status: 'ambiguous', confidence: 0, matchKind: 'normalized_collision' };
  return { row: null, status: 'not_in_universe', confidence: 0, matchKind: null };
}

function isPlausibleInvestorEntityName(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return raw.length >= 3 && raw.length <= 100 && !GENERIC_INVESTOR_NAMES.has(normalized)
    && raw.split(/\s+/).length <= 8
    && !/\b(?:funding round|financing round|led by|participation from|reports?|in-person service economy|into ai|in japan)\b/i.test(raw)
    // Extraction debris / sentence fragments, not investor names.
    && !/\b(?:techcrunch has|exclusively learned|has exclusively|according to|co-founders?\b.+\b[A-Z][a-z]+)\b/i.test(raw)
    && !/^(?:statistics|big tech|q\.?e\.?d\.? for)\b/i.test(raw)
    && !/\b(?:for ai assistant|indexbox|venture firm)$/i.test(normalized)
    && !/^(?:king co[- ]founders?)\b/i.test(raw);
}

function normalizeRoundType(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return 'unknown';
  const series = normalized.match(/\bseries\s+([a-h])\b/);
  if (series) return `series-${series[1]}`;
  if (/\bpre[ -]?seed\b/.test(normalized)) return 'pre-seed';
  if (/\bseed\b/.test(normalized)) return 'seed';
  if (/\bbridge\b/.test(normalized)) return 'bridge';
  if (/\b(?:extension|extended)\b/.test(normalized)) return 'extension';
  if (/\bconvertible(?: note)?\b/.test(normalized)) return 'convertible';
  return normalized.replace(/\b(?:round|funding|financing)\b/g, '').trim() || 'unknown';
}

function canonicalRoundKey({ startupId, startupName, roundType, amountUsd, announcedAt }) {
  const startup = startupId ? `id:${startupId}` : `name:${normalizeStartupName(startupName)}`;
  const round = normalizeRoundType(roundType);
  const amount = Number.isFinite(Number(amountUsd)) && Number(amountUsd) > 0 ? Math.round(Number(amountUsd)) : 'unknown';
  const date = new Date(announcedAt);
  const month = Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 7);
  return `${startup}|${round}|${amount}|${month}`;
}

function resolveCanonicalEntity(rows, rawName, aliasesForRow = () => []) {
  const attempt = (name) => {
    const raw = String(name || '').trim();
    if (!raw) return { row: null, status: 'unresolved', confidence: 0, matchKind: null };
    const exact = rows.filter(row => [row.name, row.firm, ...aliasesForRow(row)]
      .some(value => String(value || '').trim().toLowerCase() === raw.toLowerCase()));
    if (exact.length === 1) return { row: exact[0], status: 'resolved', confidence: 1, matchKind: 'exact' };
    if (exact.length > 1) {
      const preferred = preferFirmEntity(exact, raw);
      if (preferred) {
        return { row: preferred, status: 'resolved', confidence: 1, matchKind: 'exact_firm_preferred' };
      }
      return { row: null, status: 'ambiguous', confidence: 0, matchKind: 'exact_collision' };
    }
    const normalized = normalizeEntityName(raw);
    if (!normalized) return { row: null, status: 'not_in_universe', confidence: 0, matchKind: null };
    const candidates = rows.filter(row => [row.name, row.firm, ...aliasesForRow(row)]
      .some(value => normalizeEntityName(value) === normalized));
    if (candidates.length === 1) return { row: candidates[0], status: 'resolved', confidence: 0.92, matchKind: 'normalized' };
    if (candidates.length > 1) {
      const preferred = preferFirmEntity(candidates, raw);
      if (preferred) {
        return { row: preferred, status: 'resolved', confidence: 0.9, matchKind: 'normalized_firm_preferred' };
      }
      return { row: null, status: 'ambiguous', confidence: 0, matchKind: 'normalized_collision' };
    }
    return { row: null, status: 'not_in_universe', confidence: 0, matchKind: null };
  };

  const raw = String(rawName || '').trim();
  if (!raw) return { row: null, status: 'unresolved', confidence: 0, matchKind: null };

  // Prefer headline-cleaned form first so "Firm - Publisher" does not normalize-match
  // a junk investor row named like the full glued string.
  const cleaned = stripInvestorHeadlineNoise(raw);
  if (cleaned && cleaned.toLowerCase() !== raw.toLowerCase()) {
    const cleanedResult = attempt(cleaned);
    if (cleanedResult.status === 'resolved') {
      return {
        ...cleanedResult,
        matchKind: `headline_cleaned_${cleanedResult.matchKind}`,
        confidence: Math.min(cleanedResult.confidence, 0.9),
      };
    }
  }

  return attempt(raw);
}

function isPlausibleStartupName(value) {
  const name = String(value || '').trim();
  const normalized = normalizeStartupName(name);
  const words = name.split(/\s+/).filter(Boolean);
  if (name.length < 2 || name.length > 100 || words.length > 8) return false;
  if (new Set(['startup', 'company', 'firm', 'business', 'technology company']).has(normalized)) return false;
  if (/[$€£¥₹]|\b(?:million|billion|valuation|funding|round|raises?|raised|secures?|invests?|pitch decks?|according to|used to|wants to|companies that|new study|final close)\b/i.test(name)) return false;
  if (/^(?:rs|usd|eur|gbp|rmb|this|read|transportation|impact)$/i.test(name)) return false;
  return /[a-z]/i.test(name);
}

function isPromotionSafeStartupName(value) {
  const name = String(value || '').trim();
  if (!isPlausibleStartupName(name)) return false;
  if (/\b(?:startup|company|firm|founder|staffers?)\b/i.test(name)) return false;
  if (/^(?:ex-|former\s+).{2,60}\b(?:researchers?|duo|executives?|engineers?|leaders?|staff)\b/i.test(name)) return false;
  if (/\b(?:co-founded by|creative lead)\b/i.test(name)) return false;
  if (/\b(?:reportedly|said to)\b|\bbacked\b|\b[a-z]+-based\b/i.test(name)) return false;
  if (/^(?:exclusive|sources?|breaking|stat\+|morning minute|new unicorn|female-founded)\s*[:!-]?/i.test(name)) return false;
  if (/^(?:edtech|fintech|healthtech|biotech|climatetech|proptech|defen[cs]e tech|ai)\s+(?:platform|startup|company)$/i.test(name)) return false;
  return true;
}

function cleanStartupHeadlineLabel(value) {
  let name = String(value || '').trim();
  name = name.replace(/^(?:(?:exclusive|sources?|breaking|stat\+|morning minute)\s*:|new unicorn\s*!?)\s*/i, '');
  name = name.replace(/^([A-Z][A-Za-z0-9.&+ -]{1,80}),\s+(?:an?|the)\s+.+$/i, '$1');
  name = name.replace(/^.{2,80}?-backed\s+/i, '');
  name = name.replace(/^(?:female-founded\s+)?(?:edtech|fintech|healthtech|medtech|biotech|climatetech|proptech|insurtech|defen[cs]e tech|vibe coding)\s+/i, '');
  const describedCompany = name.match(/^(?:\S+\s+){0,6}(?:startup|company|firm|maker|provider|developer)\s+(.+)$/i);
  if (describedCompany) name = describedCompany[1];
  name = name.replace(/^[\p{L}.-]+(?:['’]s|-based)\s+/iu, '');
  name = name.replace(/\s+reportedly$/i, '');
  return name.trim();
}

function isPredictionGradeStartupIdentity(row = {}) {
  const name = String(row.name || '').trim();
  if (!isPromotionSafeStartupName(name) || row.source_type !== 'url') return false;
  if (/\b(?:vc|venture capital|ventures?|capital partners?|investment management|fund)\b$/i.test(name)) return false;

  const identityUrl = row.company_domain || row.website;
  if (!identityUrl) return false;
  let hostname = '';
  try {
    hostname = new URL(/^https?:\/\//i.test(identityUrl) ? identityUrl : `https://${identityUrl}`).hostname
      .toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (/\b(?:techcrunch|ventureburn|businessinsider|finsmes|globenewswire|saastr|medium|substack|youtube)\./i.test(hostname)) return false;
  const domainKey = hostname.split('.')[0].replace(/[^a-z0-9]/g, '');
  const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (domainKey.length < 4 || nameKey.length < 4 || (!domainKey.includes(nameKey) && !nameKey.includes(domainKey))) return false;

  const description = String(row.description || '').replace(/\s+/g, ' ').trim();
  if (!description) return false;
  if (/\b(?:nasdaq|nyse|publicly traded|stock exchange|ticker symbol|full-year \d{4} outlook|record (?:second-|third-|fourth-)?quarter(?:ly)? (?:results|revenue))\b/i.test(description)) return false;
  if (/\b(?:definitive agreement to acquire|has acquired|was acquired|acquisition of|to buy)\b/i.test(description)) return false;
  if (/\b(?:permanent capital company|private equity firm|investment firm|asset manager)\b/i.test(description)) return false;
  const ventureFundingEvidence = /\b(?:funding round|pre[- ]seed funding|seed (?:funding|round)|series [a-f] (?:funding|financing|round)|venture (?:funding|financing|round)|equity (?:funding|financing|round))\b/i.test(description)
    || /\brais(?:ed|ing)\s+[$€£]\s?\d/i.test(description)
    || /\b(?:closed|secured)\b.{0,50}\b(?:funding|financing|round)\b/i.test(description);
  if (!ventureFundingEvidence) return false;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const personRole = new RegExp(`\\b${escapedName}\\s+(?:is|was)\\s+(?:the\\s+|an?\\s+)?(?:owner|founder|co-founder|ceo|president|partner)\\b`, 'i');
  if (personRole.test(description)) return false;
  const optionalCompanySuffix = '(?:\\s+(?:health|technologies|technology|labs|ai|group|systems|security|bio))?';
  const companyAction = new RegExp(`(?:^|[.!?]\\s+)${escapedName}${optionalCompanySuffix}\\s+(?:announced|has raised|secured|closed|raised\\s+(?:[$€£]|\\d|an?\\s+(?:seed|series|funding|financing)))`, 'i');
  const companyAppositive = new RegExp(`\\b${escapedName}${optionalCompanySuffix}\\s*,\\s*(?:a|an|the)\\s+(?:company|startup|platform|business|provider|developer|maker|network|pharmacy|fintech|biotech|healthtech|insurtech|marketplace)\\b(?!['’]s)`, 'i');
  const personFullName = new RegExp(`\\b[A-Z][a-z]{2,20}\\s+${escapedName}\\b`);
  if (personFullName.test(description) && !companyAppositive.test(description)) return false;
  return companyAction.test(description) || companyAppositive.test(description);
}

/**
 * Serve-time identity for freezing Hit@5 predictions.
 * Requires URL↔name alignment but does NOT require prior funding language in the
 * description — otherwise we only snapshot companies that already raised.
 */
function isServeGradeStartupIdentity(row = {}) {
  const name = String(row.name || '').trim();
  if (!isPromotionSafeStartupName(name) || row.source_type !== 'url') return false;
  if (/\b(?:vc|venture capital|ventures?|capital partners?|investment management|fund)\b$/i.test(name)) return false;

  const identityUrl = row.company_domain || row.website;
  if (!identityUrl) return false;
  let hostname = '';
  try {
    hostname = new URL(/^https?:\/\//i.test(identityUrl) ? identityUrl : `https://${identityUrl}`).hostname
      .toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (/\b(?:techcrunch|ventureburn|businessinsider|finsmes|globenewswire|saastr|medium|substack|youtube)\./i.test(hostname)) return false;
  const domainKey = hostname.split('.')[0].replace(/[^a-z0-9]/g, '');
  const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (domainKey.length < 3 || nameKey.length < 3) return false;
  if (!domainKey.includes(nameKey) && !nameKey.includes(domainKey)) return false;

  const description = String(row.description || '').replace(/\s+/g, ' ').trim();
  if (description.length < 40) return false;
  if (/\b(?:nasdaq|nyse|publicly traded|stock exchange|ticker symbol)\b/i.test(description)) return false;
  if (/\b(?:permanent capital company|private equity firm|investment firm|asset manager)\b/i.test(description)) return false;
  return true;
}

function startupNameCandidates(event, inferredName) {
  const title = String(event.source_title || '');
  const directionalTarget = startupNameFromFundingEvent(event);
  if (/\binvest(?:s|ed)?\b.{0,40}\bin\b/i.test(title) && directionalTarget) return [directionalTarget].filter(isPromotionSafeStartupName);
  const base = [
    directionalTarget,
    inferredName,
    event.subject,
    ...(Array.isArray(event.entities) ? event.entities.filter(e => e?.role === 'SUBJECT').map(e => e.name) : []),
  ];
  const stripped = base.flatMap(name => {
    if (!name) return [];
    const cleaned = cleanStartupHeadlineLabel(name);
    return cleaned !== name ? [cleaned, name] : [name];
  });
  const seen = new Set();
  return stripped.filter(name => {
    const key = normalizeStartupName(name);
    if (!isPlausibleStartupName(name) || key.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueNames(values) {
  const seen = new Set();
  return values.filter(Boolean).filter(value => {
    const key = normalizeEntityName(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function participantNamesFromEvent(event) {
  const entities = Array.isArray(event.entities) ? event.entities : [];
  const entityInvestors = entities
    .filter(entity => /investor|lead|participant|funder|counterparty/i.test(String(entity?.role || '')))
    .map(entity => entity?.name);
  const resolver = event.semantic_context?.resolver || event.extraction_meta?.resolver || {};
  const resolved = [resolver.lead_investor, ...(resolver.investors || [])];
  const inferred = event.inferred_funding || {};
  const directionalPrefix = String(event.source_title || '').match(/^(.{2,160}?)\s+invest(?:s|ed)?\b.{0,40}?\s+in\s+/i)?.[1] || '';
  const directionalInvestor = directionalPrefix.split(/\bas\b/i).at(-1)?.replace(/^.*[;:]/, '').trim();
  const backedInvestor = String(event.source_title || '').match(/^([A-Z][A-Za-z0-9.& -]{1,80})-backed\s+/)?.[1];
  const direct = [
    event.lead_investor,
    inferred.lead_investor,
    directionalInvestor,
    backedInvestor,
    ...(event.investors_mentioned || []),
    ...(inferred.investors_mentioned || []),
  ];
  return uniqueNames([...resolved, ...direct, ...entityInvestors]);
}

function classifyFundingEvidence(event) {
  const text = `${event.source_title || ''} ${event.source_summary || ''}`;
  const extraction = event.extraction_meta || {};
  if (!['FUNDING', 'INVESTMENT'].includes(event.event_type)) return { eligible: false, reason: 'not_funding', financingType: 'unknown' };
  if (extraction.decision === 'REJECT' || extraction.graph_safe === false) return { eligible: false, reason: 'parser_not_graph_safe', financingType: 'unknown' };
  if (Number(event.frame_confidence || 0) < 0.6) return { eligible: false, reason: 'low_confidence', financingType: 'unknown' };
  if (/\b(?:orders?|contract|recognitions?|award winner|certificat(?:e|ion)|political betting|ceasefire|capital rules? raise cost)\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:raises? the stakes|boiler room|hidden fees?|sec claims?|token sale|initial coin offering|ico|preferred stock offering)\b/i.test(text)
    || /\bwhich (?:has|had) raised\b.{0,160}\b(?:releases?|launches?|announces?|unveils?)\b/i.test(text)
    || /^inside\b.{0,160}\bhas raised\b/i.test(text)
    || /\brais(?:es|ed)\b.{0,50}\b(?:safety|security|ethical|legal) concerns?\b/i.test(text)
    || /\bsecures?\b.{0,40}\blicen[cs]e\b/i.test(text)
    || /\binvest(?:s|ed)?\b.{0,70}\b(?:in|into)\b.{0,70}\b(?:operations?|factor(?:y|ies)|facilit(?:y|ies)|plant|fulfillment hub|data centers?|subsidiar(?:y|ies))\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/^(?:(?:exclusive|sources?|breaking|stat\+|morning minute)\s*:\s*)?(?:[a-z0-9-]+\s+){0,4}(?:giants|companies|startups|firms)\s+(?:just\s+)?rais(?:e|es|ed|ing)\b/i.test(text)
    || /^(?:[a-z0-9.&+-]+(?:\s+[a-z0-9.&+-]+){0,3},\s+){1,3}(?:and\s+)?[a-z0-9.&+-]+(?:\s+[a-z0-9.&+-]+){0,3}\s+rais(?:e|es|ed|ing)\b/i.test(text)
    || /^[a-z0-9.&+-]+(?:\s+[a-z0-9.&+-]+){0,3}\s+and\s+[a-z0-9.&+-]+(?:\s+[a-z0-9.&+-]+){0,3}\s+rais(?:e|es|ed|ing)\b/i.test(text)
    || /\b(?:a\s+)?(?:founder|son|daughter)\b.{0,80}\brais(?:e|es|ed|ing)\b/i.test(text)
    || /\bfunding goes to\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:raises?|raised|raising|increases?|increased)\b.{0,50}\b(?:prices?|rates?|fees?|wages?|salar(?:y|ies))\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:in (?:active )?talks|said to|reportedly considering|reportedly seeking|reportedly raising|may invest|could invest|could secure|to invest|expected to raise|is raising|eyes? an? investment|mulls? an? investment|plans? to raise|seeks? to raise|seeks? (?:funding|financing|investment))\b/i.test(text)
    || /\btarget(?:s|ed|ing)?\b.{0,80}\b(?:raise|funding|valuation)\b/i.test(text)) {
    return { eligible: false, reason: 'unconfirmed_transaction', financingType: 'unknown' };
  }
  if (/\b(?:raises?|raised|increases?|increased|boosts?)\b.{0,45}\b(?:guidance|forecast|outlook|target|dividend|stake|ownership)\b/i.test(text)
    || /\b(?:acquires?|acquired|acquisition|merger|takeover|buyout)\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:qip|qualified institutional placement|fund\s+[ivxlcdm]+|fund final close|final close|ipo|pre-ipo)\b/i.test(text)
    || /\braises?\b.{0,40}\b(?:million|billion)\s+fund\b/i.test(text)
    || /\b(?:raises?|raised|closes?|closed)\b.{0,90}\b(?:new|inaugural|venture|credit|secondaries|buyout|growth)\s+(?:fund|investment vehicle)\b/i.test(text)
    || /\b(?:raises?|raised|closes?|closed)\b.{0,90}\b(?:early[ -]stage|late[ -]stage)\s+fund\b/i.test(text)
    || /\b(?:raises?|raised)\b.{0,50}\bfor\b.{0,60}\bfund\b/i.test(text)
    || /\braises?\s+[$€£¥₹]\s?[\d.,]+\s*[mkb]?\s+(?:[a-z0-9-]+\s+){0,3}fund\s+for\b/i.test(text)
    || /\b(?:investment vehicle|credit secondaries|related strategies)\b/i.test(text)) {
    return { eligible: false, reason: 'outside_venture_outcome_scope', financingType: 'unknown' };
  }
  const hasFundingAction = /\b(?:raises?|raised|secures?|secured|closes?|closed|funding|financing|investment|backed)\b/i.test(text)
    || /\binvest(?:s|ed)?\b.{0,40}\bin\b/i.test(text)
    || /\bannounces?\b.{0,80}\b(?:funding|financing|investment|series [a-h]|round|raise)\b/i.test(text);
  if (!hasFundingAction) {
    return { eligible: false, reason: 'missing_financing_action', financingType: 'unknown' };
  }
  const hasDebt = /\b(?:debt|loan|credit facility|debt facility|borrowing|notes?|bond)\b/i.test(text);
  const hasEquity = /\b(?:seed|series [a-h]|venture round|equity|funding round|led by|participation from)\b/i.test(text);
  const hasGrant = /\b(?:grant|sbir|sttr|chips award|government award)\b/i.test(text);
  const financingType = hasDebt && hasEquity ? 'mixed' : hasDebt ? 'debt' : hasGrant ? 'grant' : 'equity';
  return { eligible: true, reason: null, financingType };
}

function startupNameFromFundingEvent(event) {
  const title = String(event.source_title || '').replace(/^(?:exclusive|sources?|breaking|stat\+|morning minute)\s*:\s*/i, '');
  const beforeAction = title.match(/\bstartup\s+(.{2,80}?)\s+(?:(?:has|have|had)\s+(?:now\s+)?)?(?:raises?|raised|secures?|secured|closes?|closed)\b/i);
  const explicitlyNamedStartup = (beforeAction?.index ?? 999) < 70
    ? beforeAction?.[1]?.replace(/[,;:]$/, '').trim()
    : title.match(/\bstartup\s+([A-Z][A-Za-z0-9.&+-]*(?:\s+[A-Z][A-Za-z0-9.&+-]*){0,3})(?=\s*[,;])/i)?.[1]?.trim()
      || title.match(/\bstartup\s+([A-Za-z][A-Za-z0-9.&+-]*(?:\s+[A-Za-z][A-Za-z0-9.&+-]*){0,3})\s*$/)?.[1]?.trim();
  const cleanedExplicitStartup = cleanStartupHeadlineLabel(explicitlyNamedStartup);
  if (cleanedExplicitStartup && !/\b(?:that|which|co-founded|founded|behind|targeting|just|raises?|raised)\b/i.test(cleanedExplicitStartup)) return cleanedExplicitStartup;
  const directionalMatch = title.match(/^(.{2,100}?)\s+invest(?:s|ed)?\b.{0,40}?\s+in\s+(.+?)(?:\s+as\b|\s+to\b|\s+at\b|[,;]|$)/i);
  const directional = directionalMatch && !/\b(?:raises?|raised|secures?|secured|closes?|closed)\b/i.test(directionalMatch[1])
    ? directionalMatch[2]?.trim() : null;
  if (directional) return cleanStartupHeadlineLabel(directional);
  const raises = title.match(/^(.+?)\s+(?:raises?|raised|secures?|secured|closes?|closed)\b/i)?.[1]?.trim();
  if (raises && !/^(?:rs|usd|eur|gbp|rmb)$/i.test(raises)) return cleanStartupHeadlineLabel(raises);
  const entities = Array.isArray(event.entities) ? event.entities : [];
  const subject = entities.find(entity => entity?.role === 'SUBJECT')?.name || event.subject || null;
  return /^(?:rs|usd|eur|gbp|rmb)$/i.test(String(subject || '')) ? null : subject;
}

function eventTimestamp(event) {
  return event.occurred_at || event.source_published_at || event.created_at || null;
}

function daysBetween(earlier, later) {
  const delta = new Date(later).getTime() - new Date(earlier).getTime();
  return Math.floor(delta / DAY_MS);
}

function evaluateRecommendationSet({ impressions, participants, eventAt, topK = 5 }) {
  const participantByInvestor = new Map(
    participants.filter(p => p.investor_id).map(p => [String(p.investor_id), p])
  );
  const recommendations = impressions
    .filter(i => i.rank_position <= topK)
    .filter(i => daysBetween(i.shown_at, eventAt) >= 0)
    .map(impression => {
      const daysToEvent = daysBetween(impression.shown_at, eventAt);
      const participant = participantByInvestor.get(String(impression.investor_id));
      return {
        ...impression,
        days_to_event: daysToEvent,
        invested: Boolean(participant),
        participant_id: participant?.id || null,
        predicted_probability: impression.context?.predicted_probability ?? null,
        predicted_horizon_days: impression.context?.predicted_horizon_days ?? null,
        attribution_kind: participant ? 'predicted_participant' : 'recommended_non_participant',
        horizons: HORIZONS.filter(days => daysToEvent <= days),
      };
    });
  const recommendedIds = new Set(recommendations.map(row => String(row.investor_id)));
  const misses = participants.filter(p => !p.investor_id || !recommendedIds.has(String(p.investor_id)));
  return { recommendations, misses };
}

function metricsForEvaluations(rows, topK = 5) {
  const eligible = rows.filter(row => row.rank_position <= topK);
  const hits = eligible.filter(row => row.invested);
  return {
    recommendations: eligible.length,
    hits: hits.length,
    precision_at_k: eligible.length ? hits.length / eligible.length : null,
    median_days_to_investment: hits.length
      ? hits.map(row => row.days_to_event).sort((a, b) => a - b)[Math.floor(hits.length / 2)]
      : null,
  };
}

module.exports = {
  HORIZONS,
  stripInvestorHeadlineNoise,
  normalizeEntityName,
  preferFirmEntity,
  normalizeStartupName,
  startupAliases,
  resolveCanonicalStartup,
  isPlausibleInvestorEntityName,
  normalizeRoundType,
  canonicalRoundKey,
  resolveCanonicalEntity,
  isPlausibleStartupName,
  isPromotionSafeStartupName,
  isPredictionGradeStartupIdentity,
  isServeGradeStartupIdentity,
  startupNameCandidates,
  participantNamesFromEvent,
  classifyFundingEvidence,
  startupNameFromFundingEvent,
  eventTimestamp,
  daysBetween,
  evaluateRecommendationSet,
  metricsForEvaluations,
};
