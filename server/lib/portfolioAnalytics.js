/**
 * Oracle portfolio analytics — fund value/gain, VC benchmarks, strategy & trend.
 *
 * The virtual fund deploys a fixed virtual_check_usd per pick (default $100K).
 * "Value" of a position = check × MOIC. Because some MOICs are signal-inferred
 * and can spike to absurd multiples (data artifacts), the headline current value
 * caps per-position MOIC. We also report the uncapped figure for transparency.
 */

const PER_POSITION_MOIC_CAP = 25; // mirrors track-record top-performer filter (moic <= 25)
const EXIT_STATUSES = new Set(['acquired', 'ipo', 'exited']);

/**
 * Top-VC reference benchmarks. These are transparent, sourced industry ranges —
 * NOT live competitor data. Used to contextualize Oracle performance, not to claim parity.
 */
const VC_BENCHMARKS = {
  tvpi_top_quartile: 2.5, // top-quartile early-stage TVPI at maturity (Cambridge Associates ranges)
  graduation_rate_pct: 15, // typical seed→Series A graduation (industry ~10–15%)
  top_fund_graduation_rate_pct: 35, // strong seed funds
  exit_rate_pct: 20, // share of a seed cohort reaching a meaningful exit (long horizon)
  loss_rate_pct: 50, // share of seed deals that return < 1× (industry); top funds ~30–40%
  source:
    'Industry reference ranges (Cambridge Associates / PitchBook seed cohorts). Indicative, not live fund data.',
};

function round(n, dp = 0) {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}

function clampMoic(moic) {
  const m = Number(moic);
  if (!Number.isFinite(m) || m <= 0) return 1; // held at cost when unknown
  return Math.min(m, PER_POSITION_MOIC_CAP);
}

/**
 * Verified-only MOIC for a single position. A position only marks above cost (1×)
 * when there is hard evidence: a press-verified funding round with a post-money
 * valuation, or a recorded exit valuation. Signal-inferred valuations are ignored.
 *
 * @returns { moic, basis } where basis ∈ 'exit' | 'verified_round' | 'cost'
 */
function computeVerifiedMoic({ status, entryValuation, exitValuation, verifiedRounds }) {
  const entry = Number(entryValuation);
  if (EXIT_STATUSES.has(status) && Number(exitValuation) > 0 && entry > 0) {
    return { moic: clampMoic(Number(exitValuation) / entry), basis: 'exit' };
  }
  if (entry > 0 && Array.isArray(verifiedRounds) && verifiedRounds.length) {
    const latest = verifiedRounds
      .filter((r) => Number(r.post_money_usd) > 0)
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())[0];
    if (latest) return { moic: clampMoic(Number(latest.post_money_usd) / entry), basis: 'verified_round' };
  }
  return { moic: 1, basis: 'cost' };
}

/**
 * Fund-level value + gain. Current value is built ONLY from press-verified funding
 * rounds and recorded exits — never from signal-inferred valuations. The looser
 * signal-implied value is reported separately for transparency.
 */
async function computePortfolioValue(supabase) {
  const [picksRes, eventsRes] = await Promise.all([
    supabase
      .from('virtual_portfolio')
      .select('id, startup_id, status, virtual_check_usd, moic, entry_valuation_usd, current_valuation_usd, exit_valuation_usd'),
    supabase
      .from('portfolio_events')
      .select('portfolio_id, startup_id, event_type, verified, post_money_usd, event_date')
      .eq('event_type', 'funding_round')
      .eq('verified', true),
  ]);
  if (picksRes.error) throw new Error(picksRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const rows = picksRes.data || [];

  // Index verified funding rounds by portfolio id and startup id.
  const roundsByPortfolio = new Map();
  const roundsByStartup = new Map();
  for (const ev of eventsRes.data || []) {
    if (!Number(ev.post_money_usd)) continue;
    if (ev.portfolio_id) {
      if (!roundsByPortfolio.has(ev.portfolio_id)) roundsByPortfolio.set(ev.portfolio_id, []);
      roundsByPortfolio.get(ev.portfolio_id).push(ev);
    }
    if (ev.startup_id) {
      if (!roundsByStartup.has(ev.startup_id)) roundsByStartup.set(ev.startup_id, []);
      roundsByStartup.get(ev.startup_id).push(ev);
    }
  }

  let costBasis = 0;
  let currentValue = 0; // verified only
  let signalImpliedValue = 0; // signal-inferred (capped raw moic)
  let realizedValue = 0;
  let unrealizedValue = 0;
  let winners = 0;
  let losers = 0;
  let flat = 0;
  let markedPositions = 0;

  const contributions = [];

  for (const p of rows) {
    const check = Number(p.virtual_check_usd) || 0;
    if (check <= 0) continue;
    costBasis += check;

    const verifiedRounds = roundsByPortfolio.get(p.id) || roundsByStartup.get(p.startup_id) || [];
    const { moic: verifiedMoic, basis } = computeVerifiedMoic({
      status: p.status,
      entryValuation: p.entry_valuation_usd,
      exitValuation: p.exit_valuation_usd,
      verifiedRounds,
    });

    const value = check * verifiedMoic;
    currentValue += value;
    if (basis !== 'cost') markedPositions += 1;

    // Signal-implied (transparency only): capped raw moic from the picks table.
    const rawMoic = Number(p.moic);
    signalImpliedValue += check * clampMoic(p.moic);

    if (EXIT_STATUSES.has(p.status)) realizedValue += value;
    else unrealizedValue += value;

    if (verifiedMoic > 1.05) winners += 1;
    else if (verifiedMoic < 0.95) losers += 1;
    else flat += 1;

    contributions.push({
      startup_id: p.startup_id,
      gain_usd: value - check,
      moic_capped: round(verifiedMoic, 2),
      moic_raw: Number.isFinite(rawMoic) ? round(rawMoic, 2) : null,
      basis,
      status: p.status,
    });
  }

  contributions.sort((a, b) => {
    if (b.gain_usd !== a.gain_usd) return b.gain_usd - a.gain_usd;
    return (b.moic_raw || 0) - (a.moic_raw || 0); // break cap ties by true multiple
  });
  const topRaw = contributions.slice(0, 6);

  // Resolve names for top contributors.
  const ids = topRaw.map((c) => c.startup_id).filter(Boolean);
  const nameMap = new Map();
  if (ids.length) {
    const { data: names } = await supabase
      .from('startup_uploads')
      .select('id, name')
      .in('id', ids);
    for (const r of names || []) nameMap.set(r.id, r.name);
  }
  const topContributors = topRaw.map((c) => ({
    startup_id: c.startup_id,
    name: nameMap.get(c.startup_id) || 'Unknown',
    gain_usd: round(c.gain_usd),
    moic: c.moic_capped,
    moic_raw: c.moic_raw,
    basis: c.basis,
    status: c.status,
  }));

  const gain = currentValue - costBasis;
  const positions = contributions.length;

  return {
    positions,
    marked_positions: markedPositions,
    cost_basis_usd: round(costBasis),
    current_value_usd: round(currentValue),
    signal_implied_value_usd: round(signalImpliedValue),
    gain_usd: round(gain),
    gain_pct: costBasis ? round((gain / costBasis) * 100, 1) : 0,
    tvpi: costBasis ? round(currentValue / costBasis, 2) : null,
    realized_value_usd: round(realizedValue),
    unrealized_value_usd: round(unrealizedValue),
    winners,
    losers,
    flat,
    win_rate_pct: positions ? round((winners / positions) * 100, 1) : 0,
    per_position_moic_cap: PER_POSITION_MOIC_CAP,
    top_contributors: topContributors,
    note:
      `Current value is marked from press-verified funding rounds and recorded exits only ` +
      `(${markedPositions} of ${positions} positions marked above cost); per-position MOIC capped at ${PER_POSITION_MOIC_CAP}×. ` +
      `Signal-implied value (looser, signal-inferred valuations) is ${costBasis ? round(signalImpliedValue / costBasis, 2) : '—'}× cost.`,
  };
}

function verdict(actual, benchmark, higherIsBetter = true) {
  if (actual == null) return 'n/a';
  const ratio = benchmark ? actual / benchmark : 0;
  if (higherIsBetter) {
    if (ratio >= 1.1) return 'ahead';
    if (ratio >= 0.9) return 'inline';
    return 'behind';
  }
  if (ratio <= 0.9) return 'ahead';
  if (ratio <= 1.1) return 'inline';
  return 'behind';
}

/** Compare Oracle metrics to top-VC reference ranges. */
function compareToBenchmarks(metrics, value) {
  const fundedRate = Number(metrics.verified_funded_rate_pct) || 0;
  const exitRate = metrics.total_picks
    ? round(((Number(metrics.successful_exits) || 0) / metrics.total_picks) * 100, 1)
    : 0;
  const tvpi = value?.tvpi ?? null;
  const lossRate = value?.positions ? round((value.losers / value.positions) * 100, 1) : 0;

  return {
    rows: [
      {
        metric: 'TVPI (value / invested)',
        oracle: tvpi != null ? `${tvpi}×` : '—',
        benchmark: `${VC_BENCHMARKS.tvpi_top_quartile}× top-quartile`,
        verdict: verdict(tvpi, VC_BENCHMARKS.tvpi_top_quartile, true),
      },
      {
        metric: 'Funding conversion',
        oracle: `${fundedRate}% verified`,
        benchmark: `${VC_BENCHMARKS.graduation_rate_pct}% seed→A (top ${VC_BENCHMARKS.top_fund_graduation_rate_pct}%)`,
        verdict: verdict(fundedRate, VC_BENCHMARKS.top_fund_graduation_rate_pct, true),
      },
      {
        metric: 'Exit rate',
        oracle: `${exitRate}%`,
        benchmark: `${VC_BENCHMARKS.exit_rate_pct}% cohort (long horizon)`,
        verdict: verdict(exitRate, VC_BENCHMARKS.exit_rate_pct, true),
      },
      {
        metric: 'Loss rate (< 1×)',
        oracle: `${lossRate}%`,
        benchmark: `${VC_BENCHMARKS.loss_rate_pct}% seed industry`,
        verdict: verdict(lossRate, VC_BENCHMARKS.loss_rate_pct, false),
      },
    ],
    source: VC_BENCHMARKS.source,
  };
}

/** Data-driven strategy + trend read from picks, sectors, and GOD-tier conversion. */
async function describeStrategyAndTrend(supabase, metrics, trackRecord) {
  const { data: picks } = await supabase
    .from('virtual_portfolio')
    .select('startup_id, status, entry_god_score, entry_stage, entry_date');

  const rows = picks || [];

  // Sector concentration via startup_uploads.
  const ids = rows.map((r) => r.startup_id).filter(Boolean);
  const sectorCount = new Map();
  if (ids.length) {
    const chunk = 200;
    for (let i = 0; i < ids.length; i += chunk) {
      const { data: su } = await supabase
        .from('startup_uploads')
        .select('id, sectors')
        .in('id', ids.slice(i, i + chunk));
      for (const r of su || []) {
        const sector = Array.isArray(r.sectors) && r.sectors[0] ? r.sectors[0] : 'Unclassified';
        sectorCount.set(sector, (sectorCount.get(sector) || 0) + 1);
      }
    }
  }
  const topSectors = [...sectorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([sector, count]) => ({
      sector,
      count,
      pct: rows.length ? round((count / rows.length) * 100, 0) : 0,
    }));

  // Stage mix.
  const stageCount = new Map();
  for (const r of rows) {
    const stage = String(r.entry_stage || 'unknown');
    stageCount.set(stage, (stageCount.get(stage) || 0) + 1);
  }

  // GOD-tier conversion sweet spot (where does verified funding peak?).
  const tiers = trackRecord?.by_god_tier || [];
  let sweetSpot = null;
  let best = -1;
  for (const t of tiers) {
    if (t.verified_funded_rate_pct > best) {
      best = t.verified_funded_rate_pct;
      sweetSpot = t.tier;
    }
  }
  const highTier = tiers.find((t) => t.tier === '90+');
  const inversion =
    highTier && sweetSpot && sweetSpot !== '90+' && highTier.verified_funded_rate_pct < best;

  // Recent momentum: events in last 30 / 90 days.
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ count: ev90 }, { count: ev30 }] = await Promise.all([
    supabase.from('portfolio_events').select('*', { count: 'exact', head: true }).gte('event_date', since90),
    supabase.from('portfolio_events').select('*', { count: 'exact', head: true }).gte('event_date', since30),
  ]);

  const strategy = {
    thesis:
      'Signal-first conviction investing: every startup that crosses GOD ≥ 70 auto-enters the virtual fund at a fixed $100K check, then is tracked in public for funding, exits, and score drift.',
    entry_rule: `GOD ≥ ${trackRecord?.oracle?.entry_god_threshold ?? 70} at virtual check-in`,
    check_size_usd: 100000,
    top_sectors: topSectors,
    stage_mix: [...stageCount.entries()].map(([stage, count]) => ({ stage, count })),
    conviction_sweet_spot: sweetSpot,
    conviction_note: inversion
      ? `GOD ${sweetSpot} converts to verified funding best (${best}%). The 90+ cohort under-converts (${highTier.verified_funded_rate_pct}%) — likely later, more-hyped entries where upside is already priced in. Edge concentrates in the GOD 75–89 band.`
      : sweetSpot
        ? `GOD ${sweetSpot} shows the strongest verified funding conversion (${best}%).`
        : 'Not enough verified outcomes yet to localize the conviction sweet spot.',
  };

  const trend = {
    events_last_30d: ev30 ?? 0,
    events_last_90d: ev90 ?? 0,
    momentum: (ev30 ?? 0) > 0 ? 'active' : 'quiet',
    verdicts: [
      {
        label: 'Higher GOD → higher conversion?',
        ok: !inversion,
        detail: inversion
          ? 'No — conversion peaks in the mid band, not at the top. Watch for over-paying on 90+ hype.'
          : 'Yes — verified funding rises with GOD tier as expected.',
      },
      {
        label: 'Signal pipeline active?',
        ok: (ev30 ?? 0) > 0,
        detail: `${ev30 ?? 0} portfolio events in the last 30 days, ${ev90 ?? 0} in 90 days.`,
      },
      {
        label: 'Diversified?',
        ok: !(topSectors[0] && topSectors[0].pct > 50),
        detail: topSectors[0]
          ? `Top sector ${topSectors[0].sector} is ${topSectors[0].pct}% of picks.`
          : 'Sector data thin.',
      },
    ],
  };

  return { strategy, trend };
}

module.exports = {
  PER_POSITION_MOIC_CAP,
  VC_BENCHMARKS,
  computeVerifiedMoic,
  computePortfolioValue,
  compareToBenchmarks,
  describeStrategyAndTrend,
};
