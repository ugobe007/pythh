/**
 * Funding timeline — timing is the primary basis for portfolio MOIC.
 *
 * Entry  = post-money of the latest verified CLOSED round on/before pick date.
 * Mark   = next verified round after entry, or acquisition/IPO exit valuation.
 * Fallback (no timed round) = stage band estimate from stageValuationBenchmarks.
 */

const { estimateEntryValuationUsd, normalizeStage, estimatePostMoneyFromRound } = require('./stageValuationBenchmarks.js');

const MAX_PLAUSIBLE_USD = 15_000_000_000;

/** Canonical stage order for timeline display. */
const ROUND_STAGE_ORDER = [
  'pre-seed',
  'seed',
  'series-a',
  'series-b',
  'mezzanine',
  'series-c',
  'series-d',
  'growth',
  'late-stage',
  'acquisition',
  'ipo',
];

const ROUND_ALIASES = {
  'pre-seed': 'pre-seed',
  preseed: 'pre-seed',
  'pre seed': 'pre-seed',
  seed: 'seed',
  'series-a': 'series-a',
  'series a': 'series-a',
  'series-a+': 'series-a',
  'series-b': 'series-b',
  'series b': 'series-b',
  'series-b+': 'series-b',
  'series b+': 'series-b',
  mezzanine: 'mezzanine',
  'mezz round': 'mezzanine',
  'series-c': 'series-c',
  'series c': 'series-c',
  'series-c+': 'series-c',
  'series-d': 'series-c',
  'series d': 'series-c',
  growth: 'growth',
  'growth round': 'growth',
  'late-stage': 'late-stage',
  'late stage': 'late-stage',
};

function normalizeRoundType(roundType) {
  const raw = String(roundType ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return null;
  if (ROUND_ALIASES[raw]) return ROUND_ALIASES[raw];
  const m = raw.match(/series-?([a-e])/);
  if (m) return `series-${m[1]}`;
  if (raw.includes('pre') && raw.includes('seed')) return 'pre-seed';
  if (raw === 'seed') return 'seed';
  if (raw.includes('mezz')) return 'mezzanine';
  return raw;
}

function stageRank(stage) {
  const s = normalizeRoundType(stage) || normalizeStage(stage);
  const idx = ROUND_STAGE_ORDER.indexOf(s);
  return idx >= 0 ? idx : ROUND_STAGE_ORDER.length;
}

function toMs(d) {
  if (!d) return null;
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function plausibleVal(n) {
  const v = Number(n);
  return v > 0 && v <= MAX_PLAUSIBLE_USD ? v : 0;
}

function resolveEventPostMoney(e) {
  const explicit = plausibleVal(e.post_money_usd);
  if (explicit && explicit !== plausibleVal(e.amount_usd)) return explicit;
  const totalMatch = (e.headline || '').match(
    /(?:bringing|total|raised)\s+(?:funding\s+)?(?:to\s+)?\$\s*(\d[\d,.]*)\s*(million|billion|M|B)/i,
  );
  let totalRaisedUsd = null;
  if (totalMatch) {
    const num = parseFloat(totalMatch[1].replace(/,/g, ''));
    const mult = totalMatch[2].toLowerCase().startsWith('b') ? 1_000_000_000 : 1_000_000;
    totalRaisedUsd = Math.round(num * mult);
  }
  const est = estimatePostMoneyFromRound({
    roundType: e.round_type,
    amountUsd: plausibleVal(e.amount_usd) || null,
    preMoneyUsd: plausibleVal(e.pre_money_usd) || null,
    postMoneyUsd: explicit || null,
    headline: e.headline,
    totalRaisedUsd,
  });
  return plausibleVal(est) || explicit || plausibleVal(e.amount_usd);
}

/**
 * Build ordered funding + liquidity timeline from portfolio_events rows.
 */
function buildFundingTimeline(events = []) {
  const rows = [];
  for (const e of events) {
    if (e.event_type === 'funding_round') {
      const post = resolveEventPostMoney(e);
      if (!post) continue;
      rows.push({
        kind: 'funding_round',
        event_date: e.event_date,
        round_type: normalizeRoundType(e.round_type),
        post_money_usd: post,
        amount_usd: plausibleVal(e.amount_usd) || null,
        verified: !!e.verified,
        headline: e.headline || null,
        lead_investor: e.lead_investor || null,
        source_url: e.source_url || null,
        id: e.id,
      });
    } else if (e.event_type === 'acquisition' || e.event_type === 'ipo') {
      const deal = plausibleVal(e.post_money_usd) || plausibleVal(e.amount_usd);
      rows.push({
        kind: e.event_type,
        event_date: e.event_date,
        round_type: e.event_type === 'ipo' ? 'ipo' : 'acquisition',
        post_money_usd: deal || null,
        amount_usd: plausibleVal(e.amount_usd) || null,
        verified: !!e.verified,
        headline: e.headline || null,
        lead_investor: e.lead_investor || null,
        source_url: e.source_url || null,
        id: e.id,
      });
    }
  }
  return rows.sort((a, b) => toMs(a.event_date) - toMs(b.event_date));
}

/**
 * Latest verified round valuation on or before asOfDate.
 */
function valuationAtDate(timeline, asOfDate, { verifiedOnly = true } = {}) {
  const cutoff = toMs(asOfDate);
  if (!cutoff) return null;
  let best = null;
  for (const row of timeline) {
    if (row.kind !== 'funding_round') continue;
    if (verifiedOnly && !row.verified) continue;
    const ms = toMs(row.event_date);
    if (ms == null || ms > cutoff) continue;
    if (!best || ms >= toMs(best.event_date)) best = row;
  }
  return best;
}

/**
 * First round at or after asOfDate (next funding after pick / after prior round).
 */
function nextRoundAfter(timeline, afterDate, { verifiedOnly = true } = {}) {
  const cutoff = toMs(afterDate);
  if (!cutoff) return null;
  for (const row of timeline) {
    if (row.kind === 'funding_round') {
      if (verifiedOnly && !row.verified) continue;
      const ms = toMs(row.event_date);
      if (ms != null && ms > cutoff) return row;
    }
    if ((row.kind === 'acquisition' || row.kind === 'ipo') && row.post_money_usd) {
      const ms = toMs(row.event_date);
      if (ms != null && ms > cutoff) return row;
    }
  }
  return null;
}

/**
 * First occurrence of each funding stage on the timeline.
 */
function firstRoundByStage(timeline) {
  const out = {};
  for (const row of timeline) {
    if (row.kind !== 'funding_round' || !row.round_type) continue;
    if (!out[row.round_type]) out[row.round_type] = row;
  }
  return out;
}

/**
 * Entry + mark basis for a portfolio position — timing first.
 */
function resolvePositionValuation({
  events = [],
  entryDate,
  exitDate = null,
  status = 'active',
  exitValuationUsd = null,
  stage = null,
  entryGodScore = 70,
}) {
  const timeline = buildFundingTimeline(events);
  const entryMs = toMs(entryDate) || Date.now();
  const exitMs = exitDate ? toMs(exitDate) : null;

  const entryRound = valuationAtDate(timeline, entryDate, { verifiedOnly: true })
    || valuationAtDate(timeline, entryDate, { verifiedOnly: false });

  let entry = entryRound?.post_money_usd || 0;
  let entryBasis = entry ? 'timed_round' : 'stage_estimate';
  let entryRoundType = entryRound?.round_type || normalizeStage(stage);

  if (!entry) {
    entry = estimateEntryValuationUsd(stage, entryGodScore);
    entryBasis = 'stage_estimate';
  }

  const isExit = ['acquired', 'ipo', 'exited'].includes(status);
  let mark = 0;
  let markBasis = 'cost';
  let markEvent = null;

  if (isExit && plausibleVal(exitValuationUsd)) {
    mark = Number(exitValuationUsd);
    markBasis = 'exit';
    markEvent = timeline.find((r) => r.kind === 'acquisition' || r.kind === 'ipo') || null;
  } else {
    const afterEntry = nextRoundAfter(timeline, entryDate, { verifiedOnly: true })
      || nextRoundAfter(timeline, entryDate, { verifiedOnly: false });
    if (afterEntry?.post_money_usd) {
      mark = afterEntry.post_money_usd;
      markBasis = afterEntry.kind === 'funding_round' ? 'next_round' : afterEntry.kind;
      markEvent = afterEntry;
    } else {
      const latest = [...timeline].reverse().find((r) => r.kind === 'funding_round' && r.post_money_usd);
      if (latest) {
        mark = latest.post_money_usd;
        markBasis = 'latest_round';
        markEvent = latest;
      } else {
        mark = entry;
        markBasis = 'cost';
      }
    }
  }

  const holdingDays = exitMs && entryMs
    ? Math.max(1, Math.round((exitMs - entryMs) / 86_400_000))
    : Math.max(1, Math.round((Date.now() - entryMs) / 86_400_000));

  const moic = entry > 0 ? Math.min(mark / entry, 50) : 1;

  return {
    timeline,
    first_by_stage: firstRoundByStage(timeline),
    entry_valuation_usd: Math.round(entry),
    entry_basis: entryBasis,
    entry_round_type: entryRoundType,
    entry_round_date: entryRound?.event_date || null,
    mark_valuation_usd: Math.round(mark),
    mark_basis: markBasis,
    mark_event_date: markEvent?.event_date || null,
    mark_round_type: markEvent?.round_type || null,
    moic: Math.round(moic * 100) / 100,
    holding_days: holdingDays,
    days_to_next_round: (() => {
      const next = nextRoundAfter(timeline, entryDate, { verifiedOnly: false });
      if (!next) return null;
      const d = Math.round((toMs(next.event_date) - entryMs) / 86_400_000);
      return d >= 0 ? d : null;
    })(),
  };
}

module.exports = {
  ROUND_STAGE_ORDER,
  normalizeRoundType,
  buildFundingTimeline,
  valuationAtDate,
  nextRoundAfter,
  firstRoundByStage,
  resolvePositionValuation,
  resolveEventPostMoney,
};
