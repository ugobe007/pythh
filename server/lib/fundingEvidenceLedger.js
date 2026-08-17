'use strict';

const HORIZONS = Object.freeze([30, 90, 180, 365]);
const DAY_MS = 86_400_000;
const GENERIC_INVESTOR_NAMES = new Set([
  'seed', 'pre seed', 'series a', 'series b', 'series c', 'series d', 'venture',
  'ventures', 'capital', 'fund', 'investor', 'investors', 'angel', 'angels',
  'syndicate', 'investment', 'investing', 'backing', 'undisclosed', 'confidential', 'unknown',
]);

function normalizeEntityName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/(?<=[a-z0-9])(?:Ventures?|Capital|Partners?|Management|Fund|Holdings?)$/, ' ')
    .replace(/&/g, ' and ')
    .replace(/\b(?:ventures?|capital|partners?|management|fund|holdings?)\b/gi, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
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
    && !/\b(?:funding round|financing round|led by|participation from)\b/i.test(raw);
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
  const raw = String(rawName || '').trim();
  if (!raw) return { row: null, status: 'unresolved', confidence: 0, matchKind: null };
  const exact = rows.filter(row => [row.name, row.firm, ...aliasesForRow(row)]
    .some(value => String(value || '').trim().toLowerCase() === raw.toLowerCase()));
  if (exact.length === 1) return { row: exact[0], status: 'resolved', confidence: 1, matchKind: 'exact' };
  if (exact.length > 1) return { row: null, status: 'ambiguous', confidence: 0, matchKind: 'exact_collision' };
  const normalized = normalizeEntityName(raw);
  const candidates = rows.filter(row => [row.name, row.firm, ...aliasesForRow(row)]
    .some(value => normalizeEntityName(value) === normalized));
  if (candidates.length === 1) return { row: candidates[0], status: 'resolved', confidence: 0.92, matchKind: 'normalized' };
  if (candidates.length > 1) return { row: null, status: 'ambiguous', confidence: 0, matchKind: 'normalized_collision' };
  return { row: null, status: 'not_in_universe', confidence: 0, matchKind: null };
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
  if (/\b(?:startup|company)\b/i.test(name)) return false;
  if (/^(?:edtech|fintech|healthtech|biotech|climatetech|proptech|defen[cs]e tech|ai)\s+(?:platform|startup|company)$/i.test(name)) return false;
  return true;
}

function startupNameCandidates(event, inferredName) {
  const title = String(event.source_title || '');
  const base = [
    startupNameFromFundingEvent(event),
    inferredName,
    event.subject,
    ...(Array.isArray(event.entities) ? event.entities.filter(e => e?.role === 'SUBJECT').map(e => e.name) : []),
  ];
  const stripped = base.flatMap(name => {
    if (!name) return [];
    const cleaned = String(name).replace(/^(?:[A-Z][A-Za-z0-9.& -]+-backed|defen[cs]e tech|vibe coding startup|[A-Z][A-Za-z]+(?:['’]s))\s+/i, '').trim();
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
  const directionalPrefix = String(event.source_title || '').match(/^(.{2,160}?)\s+invests?\s+in\s+/i)?.[1] || '';
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
  if (/\b(?:orders?|contract|recognitions?|award winner|political betting|ceasefire|capital rules? raise cost)\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:raises?|raised|raising|increases?|increased)\b.{0,50}\b(?:prices?|rates?|fees?|wages?|salar(?:y|ies))\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:in talks|said to|reportedly considering|reportedly seeking|may invest|could invest|eyes? an? investment|mulls? an? investment|plans? to raise|seeks? to raise|targets? (?:a )?raise)\b/i.test(text)) {
    return { eligible: false, reason: 'unconfirmed_transaction', financingType: 'unknown' };
  }
  if (/\b(?:raises?|raised|increases?|increased|boosts?)\b.{0,45}\b(?:guidance|forecast|outlook|target|dividend|stake|ownership)\b/i.test(text)
    || /\b(?:acquires?|acquired|acquisition|merger|takeover|buyout)\b/i.test(text)) {
    return { eligible: false, reason: 'non_financing_headline', financingType: 'unknown' };
  }
  if (/\b(?:qip|qualified institutional placement|fund\s+[ivxlcdm]+|fund final close|final close|ipo|pre-ipo)\b/i.test(text)
    || /\b(?:raises?|raised|closes?|closed)\b.{0,90}\b(?:new|inaugural|venture|credit|secondaries|buyout|growth)\s+(?:fund|investment vehicle)\b/i.test(text)
    || /\b(?:raises?|raised|closes?|closed)\b.{0,90}\b(?:early[ -]stage|late[ -]stage)\s+fund\b/i.test(text)
    || /\b(?:raises?|raised)\b.{0,50}\bfor\b.{0,60}\bfund\b/i.test(text)
    || /\b(?:investment vehicle|credit secondaries|related strategies)\b/i.test(text)) {
    return { eligible: false, reason: 'outside_venture_outcome_scope', financingType: 'unknown' };
  }
  if (!/\b(?:raises?|raised|secures?|secured|closes?|closed|announces?|funding|financing|investment|invests?|backed)\b/i.test(text)) {
    return { eligible: false, reason: 'missing_financing_action', financingType: 'unknown' };
  }
  const hasDebt = /\b(?:debt|loan|credit facility|debt facility|borrowing|notes offering|bond)\b/i.test(text);
  const hasEquity = /\b(?:seed|series [a-h]|venture round|equity|funding round|led by|participation from)\b/i.test(text);
  const hasGrant = /\b(?:grant|sbir|sttr)\b/i.test(text);
  const financingType = hasDebt && hasEquity ? 'mixed' : hasDebt ? 'debt' : hasGrant ? 'grant' : 'equity';
  return { eligible: true, reason: null, financingType };
}

function startupNameFromFundingEvent(event) {
  const title = String(event.source_title || '');
  const directional = title.match(/^.{2,100}?\s+invests?\s+in\s+(.+?)(?:\s+as\b|\s+to\b|[,;]|$)/i)?.[1]?.trim();
  if (directional) return directional;
  const raises = title.match(/^(.+?)\s+(?:raises?|raised|closes?|closed)\b/i)?.[1]?.trim();
  if (raises && !/^(?:rs|usd|eur|gbp|rmb)$/i.test(raises)) return raises;
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
  normalizeEntityName,
  normalizeStartupName,
  startupAliases,
  resolveCanonicalStartup,
  isPlausibleInvestorEntityName,
  normalizeRoundType,
  canonicalRoundKey,
  resolveCanonicalEntity,
  isPlausibleStartupName,
  isPromotionSafeStartupName,
  startupNameCandidates,
  participantNamesFromEvent,
  classifyFundingEvidence,
  startupNameFromFundingEvent,
  eventTimestamp,
  daysBetween,
  evaluateRecommendationSet,
  metricsForEvaluations,
};
