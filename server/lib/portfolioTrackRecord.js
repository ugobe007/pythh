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

async function computeTrackRecord(supabase) {
  const { data: metricsRow, error: metricsErr } = await supabase
    .from('portfolio_metrics')
    .select('*')
    .maybeSingle();
  if (metricsErr) throw new Error(metricsErr.message);

  const metrics = enrichPortfolioMetrics(metricsRow || {});

  const { data: picks, error: picksErr } = await supabase
    .from('virtual_portfolio')
    .select('id, entry_god_score, entry_date, moic, status');
  if (picksErr) throw new Error(picksErr.message);

  const { data: fundingEvents, error: evErr } = await supabase
    .from('portfolio_events')
    .select(
      'portfolio_id, event_type, event_date, verified, amount_usd, source_url, headline, lead_investor'
    )
    .eq('event_type', 'funding_round');
  if (evErr) throw new Error(evErr.message);

  const fundedIds = new Set();
  const verifiedFundedIds = new Set();
  const firstFundingDays = [];

  for (const ev of fundingEvents || []) {
    if (!ev.portfolio_id) continue;
    fundedIds.add(ev.portfolio_id);
    if (ev.verified) verifiedFundedIds.add(ev.portfolio_id);
  }

  const pickById = new Map((picks || []).map((p) => [p.id, p]));

  for (const id of fundedIds) {
    const pick = pickById.get(id);
    if (!pick?.entry_date) continue;
    const entryMs = new Date(pick.entry_date).getTime();
    const eventsForPick = (fundingEvents || []).filter((e) => e.portfolio_id === id);
    const first = eventsForPick.sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    )[0];
    if (first) {
      const days = Math.round((new Date(first.event_date).getTime() - entryMs) / 86_400_000);
      if (days >= 0) firstFundingDays.push(days);
    }
  }

  firstFundingDays.sort((a, b) => a - b);
  const medianDaysToFunding =
    firstFundingDays.length === 0
      ? null
      : firstFundingDays[Math.floor(firstFundingDays.length / 2)];

  const verifiedMoics = (picks || [])
    .filter((p) => verifiedFundedIds.has(p.id) && p.moic != null)
    .map((p) => Number(p.moic))
    .filter((n) => Number.isFinite(n));

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

  const featuredPick = featuredRow
    ? mapPerformerRow(featuredRow, verifiedFundedIds, fundingEvents)
    : null;

  return {
    oracle: {
      ...metrics,
      entry_god_threshold: entryThreshold,
      oracle_picks_at_threshold: oraclePicks.length,
      median_days_to_funding: medianDaysToFunding,
      verified_avg_moic: verifiedMoics.length
        ? Math.round((verifiedMoics.reduce((a, b) => a + b, 0) / verifiedMoics.length) * 100) / 100
        : null,
      moic_note:
        'Avg MOIC includes signal-inferred valuations. Verified avg MOIC uses picks with press-confirmed raises only.',
    },
    by_god_tier: byGodTier,
    featured_pick: featuredPick,
    top_performers: topPerformers,
    methodology: {
      funded: 'Pick logged at least one funding_round portfolio event after Oracle entry.',
      verified_funded:
        'Funding event has source URL plus parsed raise amount from Google News headline match.',
      exited: 'Pick status is exited, acquired, or IPO.',
      entry_bar: `GOD ≥ ${entryThreshold} at virtual check-in.`,
    },
    computed_at: new Date().toISOString(),
  };
}

module.exports = {
  GOD_TIERS,
  enrichPortfolioMetrics,
  computeTrackRecord,
};
