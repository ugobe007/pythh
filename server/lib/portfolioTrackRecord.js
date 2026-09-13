/**
 * Oracle portfolio track record — verified vs signal-inferred metrics + GOD tier breakdown.
 */

const GOD_TIERS = [
  { label: '70–74', min: 70, max: 74 },
  { label: '75–79', min: 75, max: 79 },
  { label: '80–89', min: 80, max: 89 },
  { label: '90+', min: 90, max: 100 },
];

/** LP narrative pick — press-verified Addi (Dec 2025 Oracle entry, Citi $89M). */
const FEATURED_PICK_ID = '23dad51a-54e7-4f72-b91e-f43bf13eed08';

const PERFORMER_SELECT = `
  id, moic, irr_annualized, entry_god_score, entry_date, status, exit_acquirer,
  startup_uploads ( name, tagline, sectors, extracted_data )
`;

function roundPct(num, den) {
  if (!den) return 0;
  return Math.round((1000 * num) / den) / 10;
}

function applyCleanPortfolioMetrics(metrics, positions = [], outcomeEvents = []) {
  const clean = positions.filter((p) => !p.entity_quarantined);
  const cleanIds = new Set(clean.map((p) => p.id).filter(Boolean));
  const entryMsById = new Map(
    clean.map((p) => [p.id, p.entry_date ? new Date(p.entry_date).getTime() : NaN])
  );
  const fundedIds = new Set();
  const verifiedFundedIds = new Set();

  const firstVerifiedExitById = new Map();
  for (const event of outcomeEvents) {
    if (!event.portfolio_id || !cleanIds.has(event.portfolio_id)) continue;
    const eventMs = event.event_date ? new Date(event.event_date).getTime() : NaN;
    const entryMs = entryMsById.get(event.portfolio_id);
    if (!Number.isFinite(eventMs) || !Number.isFinite(entryMs)) continue;
    if (event.event_type === 'funding_round' && eventMs >= entryMs) {
      fundedIds.add(event.portfolio_id);
      if (event.verified) verifiedFundedIds.add(event.portfolio_id);
    }
    if (event.verified && ['acquisition', 'ipo'].includes(event.event_type)) {
      const prior = firstVerifiedExitById.get(event.portfolio_id);
      if (!prior || eventMs < prior.eventMs) {
        firstVerifiedExitById.set(event.portfolio_id, { eventMs, eventType: event.event_type });
      }
    }
  }

  const exits = clean.filter((p) => {
    const event = firstVerifiedExitById.get(p.id);
    return (
      ['exited', 'acquired', 'ipo'].includes(p.status) &&
      event &&
      event.eventMs >= entryMsById.get(p.id)
    );
  });
  const wins = new Set([...fundedIds, ...exits.map((p) => p.id)]);
  const total = clean.length;

  return {
    ...metrics,
    all_picks: positions.length,
    total_picks: total,
    excluded_picks: positions.length - total,
    quarantined_picks: positions.filter((p) => p.entity_quarantined).length,
    entered_late_picks: positions.filter((p) => p.entered_late).length,
    active_picks: clean.filter((p) => p.status === 'active').length,
    successful_exits: exits.length,
    acquisitions: exits.filter((p) => firstVerifiedExitById.get(p.id)?.eventType === 'acquisition').length,
    ipos: exits.filter((p) => firstVerifiedExitById.get(p.id)?.eventType === 'ipo').length,
    funded_picks: fundedIds.size,
    funded_rate_pct: roundPct(fundedIds.size, total),
    verified_funded_picks: verifiedFundedIds.size,
    verified_funded_rate_pct: roundPct(verifiedFundedIds.size, total),
    win_rate_pct: roundPct(wins.size, total),
    total_virtual_deployed_usd: clean.reduce(
      (sum, p) => sum + (Number(p.virtual_check_usd) || 0),
      0
    ),
  };
}

function postEntryFundingSets(picks = [], fundingEvents = []) {
  const pickById = new Map((picks || []).map((p) => [p.id, p]));
  const fundedIds = new Set();
  const verifiedFundedIds = new Set();
  for (const ev of fundingEvents || []) {
    if (!ev.portfolio_id) continue;
    if (ev.event_type && ev.event_type !== 'funding_round') continue;
    const pick = pickById.get(ev.portfolio_id);
    if (!pick?.entry_date || !ev.event_date) continue;
    const eventMs = new Date(ev.event_date).getTime();
    const entryMs = new Date(pick.entry_date).getTime();
    if (!Number.isFinite(eventMs) || !Number.isFinite(entryMs) || eventMs < entryMs) continue;
    fundedIds.add(ev.portfolio_id);
    if (ev.verified) verifiedFundedIds.add(ev.portfolio_id);
  }
  return { fundedIds, verifiedFundedIds, pickById };
}

/** Mean MOIC on clean early picks with a press-verified raise after Oracle entry. */
function averageVerifiedMoic(picks, verifiedFundedIds) {
  const moics = (picks || [])
    .filter((p) => !p.entity_quarantined && !p.entered_late)
    .filter((p) => verifiedFundedIds.has(p.id) && p.moic != null)
    .map((p) => Number(p.moic))
    .filter((n) => Number.isFinite(n));
  if (!moics.length) return null;
  return Math.round((moics.reduce((a, b) => a + b, 0) / moics.length) * 100) / 100;
}

function enrichPortfolioMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return metrics || {};
  const total = Number(metrics.total_picks) || 0;
  const exits = Number(metrics.successful_exits) || 0;

  if (metrics.funded_picks == null && total > 0) {
    const winHits = Math.round(total * (Number(metrics.win_rate_pct) || 0) / 100);
    metrics.funded_picks = Math.max(0, winHits - exits);
    metrics.funded_rate_pct = roundPct(metrics.funded_picks, total);
  }

  const funded = Number(metrics.funded_picks) || 0;
  const verified = Number(metrics.verified_funded_picks) || 0;
  metrics.signal_funded_picks = Math.max(0, funded - verified);

  if (metrics.verified_funded_rate_pct == null && total > 0 && metrics.verified_funded_picks != null) {
    metrics.verified_funded_rate_pct = roundPct(metrics.verified_funded_picks, total);
  }

  return metrics;
}

function mapPerformerRow(row, verifiedFundedIds, fundingEvents) {
  const su = row.startup_uploads;
  const startup = Array.isArray(su) ? su[0] : su;
  const sector =
    (Array.isArray(startup?.sectors) && startup.sectors[0]) ||
    startup?.extracted_data?.primary_sector ||
    null;

  const verifiedEvents = (fundingEvents || [])
    .filter((e) => e.portfolio_id === row.id && e.verified)
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  const latestFunding = verifiedEvents[0] || null;

  return {
    name: startup?.name || 'Unknown',
    tagline: startup?.tagline || null,
    sector,
    entry_god_score: row.entry_god_score,
    entry_date: row.entry_date,
    moic: row.moic != null ? Number(row.moic) : null,
    irr_annualized: row.irr_annualized != null ? Number(row.irr_annualized) : null,
    status: row.status,
    exit_acquirer: row.exit_acquirer || null,
    verified: verifiedFundedIds.has(row.id),
    latest_funding: latestFunding
      ? {
          amount_usd: latestFunding.amount_usd,
          headline: latestFunding.headline || null,
          lead_investor: latestFunding.lead_investor || null,
          event_date: latestFunding.event_date,
        }
      : null,
  };
}

async function computeTrackRecord(supabase, { fundKey } = {}) {
  const { filterByFund, PYTHH_1, resolveFundKey } = require('./portfolioFunds');
  const wanted = resolveFundKey(fundKey || PYTHH_1);

  const { data: metricsRow, error: metricsErr } = await supabase
    .from('portfolio_metrics')
    .select('*')
    .maybeSingle();
  if (metricsErr) throw new Error(metricsErr.message);

  const { data: picksRaw, error: picksErr } = await supabase
    .from('virtual_portfolio')
    .select('id, entry_god_score, entry_date, moic, status, entity_quarantined, entered_late, virtual_check_usd, fund_key');
  if (picksErr) throw new Error(picksErr.message);
  const picks = filterByFund(picksRaw || [], wanted);

  const { data: outcomeEvents, error: evErr } = await supabase
    .from('portfolio_events')
    .select(
      'portfolio_id, event_type, event_date, verified, amount_usd, source_url, headline, lead_investor'
    )
    .in('event_type', ['funding_round', 'acquisition', 'ipo']);
  if (evErr) throw new Error(evErr.message);

  const fundingEvents = (outcomeEvents || []).filter((e) => e.event_type === 'funding_round');
  const baseMetrics = wanted === PYTHH_1 ? enrichPortfolioMetrics(metricsRow || {}) : {};
  const metrics = applyCleanPortfolioMetrics(
    baseMetrics,
    picks || [],
    outcomeEvents || []
  );
  // Recompute avg_moic from fund-filtered positions
  const early = (picks || []).filter((p) => !p.entity_quarantined && !p.entered_late && p.moic != null);
  const moics = early.map((p) => Number(p.moic)).filter((n) => Number.isFinite(n));
  metrics.avg_moic = moics.length
    ? Math.round((moics.reduce((a, b) => a + b, 0) / moics.length) * 100) / 100
    : null;
  const { fundedIds, verifiedFundedIds, pickById } = postEntryFundingSets(picks || [], fundingEvents);
  const firstFundingDays = [];


  for (const id of fundedIds) {
    const pick = pickById.get(id);
    if (!pick?.entry_date) continue;
    const entryMs = new Date(pick.entry_date).getTime();
    const first = (fundingEvents || [])
      .filter((e) => e.portfolio_id === id && e.event_date)
      .map((e) => ({ e, ms: new Date(e.event_date).getTime() }))
      .filter((row) => Number.isFinite(row.ms) && row.ms >= entryMs)
      .sort((a, b) => a.ms - b.ms)[0];
    if (first) {
      firstFundingDays.push(Math.round((first.ms - entryMs) / 86_400_000));
    }
  }

  firstFundingDays.sort((a, b) => a - b);
  const medianDaysToFunding =
    firstFundingDays.length === 0
      ? null
      : firstFundingDays[Math.floor(firstFundingDays.length / 2)];

  const verifiedAvgMoic = averageVerifiedMoic(picks || [], verifiedFundedIds);

  const byGodTier = GOD_TIERS.map(({ label, min, max }) => {
    const tierPicks = (picks || []).filter(
      (p) => p.entry_god_score >= min && p.entry_god_score <= max
    );
    const funded = tierPicks.filter((p) => fundedIds.has(p.id)).length;
    const verified = tierPicks.filter((p) => verifiedFundedIds.has(p.id)).length;
    return {
      tier: label,
      picks: tierPicks.length,
      funded,
      verified_funded: verified,
      funded_rate_pct: roundPct(funded, tierPicks.length),
      verified_funded_rate_pct: roundPct(verified, tierPicks.length),
    };
  }).filter((t) => t.picks > 0);

  const entryThreshold = 70;
  const oraclePicks = (picks || []).filter((p) => p.entry_god_score >= entryThreshold);

  const { data: topRows, error: topErr } = await supabase
    .from('virtual_portfolio')
    .select(PERFORMER_SELECT)
    .eq('fund_key', wanted)
    .eq('entity_quarantined', false)
    .eq('entered_late', false)
    .not('moic', 'is', null)
    .gt('moic', 1)
    .lte('moic', 50)
    .order('moic', { ascending: false })
    .limit(5);
  if (topErr) throw new Error(topErr.message);

  const topPerformers = (topRows || []).map((row) =>
    mapPerformerRow(row, verifiedFundedIds, fundingEvents)
  );

  const { data: featuredRow, error: featuredErr } = await supabase
    .from('virtual_portfolio')
    .select(PERFORMER_SELECT)
    .eq('id', FEATURED_PICK_ID)
    .maybeSingle();
  if (featuredErr) throw new Error(featuredErr.message);

  const featuredPick = featuredRow && picks.some((p) => p.id === featuredRow.id)
    ? mapPerformerRow(featuredRow, verifiedFundedIds, fundingEvents)
    : null;

  return {
    oracle: {
      ...metrics,
      entry_god_threshold: entryThreshold,
      oracle_picks_at_threshold: oraclePicks.length,
      median_days_to_funding: medianDaysToFunding,
      verified_avg_moic: verifiedAvgMoic,
      moic_note:
        'Verified avg MOIC is the mean mark on clean early picks with a press-confirmed raise after Oracle entry.',
    },
    by_god_tier: byGodTier,
    featured_pick: featuredPick,
    top_performers: topPerformers,
    methodology: {
      funded: 'Pick logged at least one funding_round portfolio event after Oracle entry.',
      verified_funded:
        'Press-verified funding_round on or after Oracle entry (source URL + classifier-safe headline).',
      exited: 'Pick status is exited, acquired, or IPO.',
      entry_bar: `GOD ≥ ${entryThreshold} at virtual check-in.`,
    },
    computed_at: new Date().toISOString(),
  };
}

module.exports = {
  GOD_TIERS,
  enrichPortfolioMetrics,
  applyCleanPortfolioMetrics,
  postEntryFundingSets,
  averageVerifiedMoic,
  computeTrackRecord,
};
