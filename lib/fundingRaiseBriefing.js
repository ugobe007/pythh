/**
 * Read canonical raise briefings and fold syndicate / problem into the
 * startup profile the match shortlist already uses. Data completeness only —
 * does not retune GOD or fit weights, and does not rematch.
 */
'use strict';

const { isValidStartupName } = require('./startupNameValidator.js');

const FUNDING_HEADLINE_RE =
  /\b(raises?|raised|secures?|secured|closes?|closed|bags?|bagged|lands?|landed)\b|\bfunding\s+(round|news|announcement)\b/i;
const HEADLINE_VERB_NAME_RE = /\b(introduces|announces|unveils|launches|presents)\b/i;
const FORMER_ORG_STAFFERS_RE = /\bformer\s+([A-Za-z0-9&.\-']+)\s+staffers?\b/i;

function eventLooksResearchable(event = {}) {
  const name = String(event.startup_name_raw || '').trim();
  const title = String(event.source_title || '');
  if (!name || HEADLINE_VERB_NAME_RE.test(name)) return false;
  if (title && !FUNDING_HEADLINE_RE.test(title)) return false;
  const former = title.match(FORMER_ORG_STAFFERS_RE);
  if (former && name.toLowerCase() === former[1].toLowerCase()) return false;
  return isValidStartupName(name).isValid !== false;
}

function sanitizeBriefing(briefing = {}) {
  const round = briefing.round && typeof briefing.round === 'object' ? { ...briefing.round } : {};
  if (round.amount_usd && round.valuation_usd && Number(round.amount_usd) >= Number(round.valuation_usd)) {
    round.amount_usd = null;
    round.amount_raw = null;
    round.currency = round.currency || null;
  }
  return { ...briefing, round };
}

function briefingWhyRank(briefing = {}) {
  if (briefing.why?.primary && briefing.why.primary !== 'unspecified') return 2;
  if (briefing.round?.valuation_usd) return 1;
  return 0;
}

function syndicateLabelsFromBriefings(briefings = []) {
  const names = [];
  for (const briefing of briefings) {
    const lead = briefing?.syndicate?.lead?.name;
    if (lead) names.push(String(lead).trim());
    for (const row of briefing?.syndicate?.participants || []) {
      if (row?.name) names.push(String(row.name).trim());
    }
    for (const row of briefing?.syndicate?.check_mentions || []) {
      if (row?.investor_name) names.push(String(row.investor_name).trim());
    }
  }
  return [...new Set(names.filter(Boolean))];
}

function pickCanonicalBriefings(events = []) {
  const stamped = [];
  const fallback = new Map();
  for (const event of events || []) {
    if (!eventLooksResearchable(event)) continue;
    const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    const briefing = meta.funding_intelligence ? sanitizeBriefing(meta.funding_intelligence) : null;
    if (!briefing) continue;
    if (meta.raise_cluster?.role === 'canonical') {
      stamped.push({ event, briefing, cluster: meta.raise_cluster });
      continue;
    }
    if (meta.raise_cluster?.role === 'sibling') continue;
    const name = String(event.startup_name_raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const amount = Number(event.amount_usd) || 0;
    const key = `${name}|${amount || ''}`;
    const current = fallback.get(key);
    if (!current || briefingWhyRank(briefing) > briefingWhyRank(current.briefing)) {
      fallback.set(key, { event, briefing, cluster: null });
    }
  }
  if (stamped.length) return stamped;
  return [...fallback.values()];
}

async function loadCanonicalRaiseBriefings(supabase, { startupId } = {}) {
  if (!supabase || !startupId) return [];
  const events = [];
  const page = 200;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('funding_evidence_events')
      .select('id,startup_id,startup_name_raw,amount_usd,announced_at,occurred_at,source_title,source_url,verification_status,metadata')
      .eq('startup_id', startupId)
      .in('verification_status', ['verified', 'corroborated'])
      .range(offset, offset + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    events.push(...data);
    if (data.length < page) break;
    offset += page;
  }
  return pickCanonicalBriefings(events);
}

function mergeRaiseBriefingsIntoStartup(startup, rows = []) {
  if (!startup || !rows.length) return startup;
  const briefings = rows.map((row) => row.briefing || row).filter(Boolean);
  if (!briefings.length) return startup;
  const extracted = startup.extracted_data && typeof startup.extracted_data === 'object'
    ? { ...startup.extracted_data }
    : {};
  const labels = syndicateLabelsFromBriefings(briefings);
  const existingInvestors = Array.isArray(extracted.investors) ? extracted.investors : [];
  const investors = [...new Set([...existingInvestors, ...labels].map((name) => String(name).trim()).filter(Boolean))];
  const problem = extracted.problem
    || briefings.find((row) => row.startup?.problem)?.startup.problem
    || null;
  const founders = (Array.isArray(extracted.founders) && extracted.founders.length)
    ? extracted.founders
    : (briefings.find((row) => row.startup?.founders?.length)?.startup.founders || []);
  const hasTechnical = Boolean(
    startup.has_technical_cofounder
    || extracted.has_technical_cofounder
    || briefings.some((row) => row.startup?.has_technical_cofounder),
  );
  return {
    ...startup,
    has_technical_cofounder: hasTechnical,
    extracted_data: {
      ...extracted,
      investors,
      funding_raise_syndicate: labels,
      funding_raise_clusters: briefings.map((briefing) => ({
        version: briefing.version || null,
        amount_usd: briefing.round?.amount_usd || null,
        valuation_usd: briefing.round?.valuation_usd || null,
        why: briefing.why?.primary || null,
        problem: briefing.startup?.problem || null,
        source_url: briefing.source_url || null,
      })),
      ...(problem && !extracted.problem ? { problem } : {}),
      ...(founders.length && !(extracted.founders || []).length ? { founders } : {}),
    },
  };
}

async function attachCanonicalRaiseBriefings(supabase, startup) {
  if (!startup?.id) return startup;
  const rows = await loadCanonicalRaiseBriefings(supabase, { startupId: startup.id });
  return mergeRaiseBriefingsIntoStartup(startup, rows);
}

module.exports = {
  syndicateLabelsFromBriefings,
  eventLooksResearchable,
  sanitizeBriefing,
  pickCanonicalBriefings,
  loadCanonicalRaiseBriefings,
  mergeRaiseBriefingsIntoStartup,
  attachCanonicalRaiseBriefings,
};
