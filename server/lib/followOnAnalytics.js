/**
 * Virtual FOLLOW-ON fund analytics — secondary, late-stage MOIC.
 *
 * The follow-on fund deploys $500K into later-stage rounds of Pythia's seed winners,
 * GOING FORWARD, at each round's REAL post-money. Because every entry is a real, dated
 * round valuation, this MOIC is honest from day one — it measures only appreciation
 * since the follow-on check. Current value uses the same evidence ladder as the seed
 * fund: the strongest of a later verified round or signal accretion since entry.
 */

const {
  PER_POSITION_MOIC_CAP,
  MAX_PLAUSIBLE_VALUATION_USD,
  SIGNAL_VALUATION_WEIGHTS,
  round,
  clampMoic,
  signalMultiplier,
} = require('./portfolioAnalytics');

const EXIT_STATUSES = new Set(['acquired', 'ipo', 'exited']);
const WRITEOFF_STATUSES = new Set(['written_off', 'dead', 'shutdown', 'closed', 'defunct']);
const FOLLOWON_INCEPTION = process.env.FOLLOWON_INCEPTION_DATE || '2026-06-12T00:00:00Z';
const FOLLOWON_CHECK_USD = Number(process.env.FOLLOWON_CHECK_USD) || 500_000;

// Documented late-stage step-up benchmark. Median Series C+ rounds historically re-price
// the prior round ~1.5–2.5× (PitchBook/Carta late-stage step-up data); the broader observed
// band runs 2–10×. We use a deliberately conservative MEDIAN (2.0×) for the projected
// next-round value so the figure is defensible to LPs. This is a FORWARD PROJECTION applied
// only to active positions — it never touches realized MOIC.
const LATE_STAGE_STEPUP = Number(process.env.FOLLOWON_STEPUP) || 2.0;

async function computeFollowOnValue(supabase) {
  const [posRes, evRes] = await Promise.all([
    supabase
      .from('virtual_followon_portfolio')
      .select('id, startup_id, status, check_usd, entry_valuation_usd, entry_date, entry_round_type, exit_valuation_usd'),
    supabase
      .from('portfolio_events')
      .select('startup_id, event_type, verified, post_money_usd, event_date')
      .in('event_type', ['funding_round', ...Object.keys(SIGNAL_VALUATION_WEIGHTS)]),
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (evRes.error) throw new Error(evRes.error.message);

  const rows = posRes.data || [];

  // Index verified rounds + signal events by startup.
  const roundsByStartup = new Map();
  const signalsByStartup = new Map();
  for (const ev of evRes.data || []) {
    if (ev.event_type === 'funding_round') {
      if (!ev.verified || !Number(ev.post_money_usd)) continue;
      if (!roundsByStartup.has(ev.startup_id)) roundsByStartup.set(ev.startup_id, []);
      roundsByStartup.get(ev.startup_id).push(ev);
    } else if (SIGNAL_VALUATION_WEIGHTS[ev.event_type] && ev.startup_id) {
      if (!signalsByStartup.has(ev.startup_id)) signalsByStartup.set(ev.startup_id, []);
      signalsByStartup.get(ev.startup_id).push(ev);
    }
  }

  let costBasis = 0;
  let currentValue = 0;
  let projectedValue = 0;
  let deployed = 0;
  let markedPositions = 0;
  let winners = 0;
  let losers = 0;
  let flat = 0;
  const contributions = [];

  for (const p of rows) {
    const check = Number(p.check_usd) || FOLLOWON_CHECK_USD;
    const entry = Number(p.entry_valuation_usd);
    deployed += check;
    if (!(entry > 0)) continue;
    costBasis += check;

    let moic = 1;
    let basis = 'cost';
    if (WRITEOFF_STATUSES.has(p.status)) {
      moic = 0;
      basis = 'written_off';
    } else if (EXIT_STATUSES.has(p.status) && Number(p.exit_valuation_usd) > 0 && Number(p.exit_valuation_usd) <= MAX_PLAUSIBLE_VALUATION_USD) {
      moic = clampMoic(Number(p.exit_valuation_usd) / entry);
      basis = 'exit';
    } else {
      // Latest plausible verified round AT/AFTER the follow-on entry date.
      const entryMs = p.entry_date ? new Date(p.entry_date).getTime() : 0;
      const laterRounds = (roundsByStartup.get(p.startup_id) || [])
        .filter((r) => Number(r.post_money_usd) <= MAX_PLAUSIBLE_VALUATION_USD)
        .filter((r) => !entryMs || new Date(r.event_date).getTime() >= entryMs);
      const latest = laterRounds.sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0];
      const roundVal = latest ? Number(latest.post_money_usd) : 0;

      // Signal accretion since entry.
      const sigEvents = (signalsByStartup.get(p.startup_id) || []).filter(
        (e) => !entryMs || new Date(e.event_date).getTime() >= entryMs
      );
      const sigVal = entry * signalMultiplier(sigEvents);

      const current = Math.max(roundVal, sigVal, entry);
      if (roundVal >= sigVal && roundVal > entry) basis = 'verified_round';
      else if (sigVal > entry) basis = 'signal_accretion';
      moic = clampMoic(current / entry);
    }

    const value = check * moic;
    currentValue += value;

    // Forward projection: active positions are expected to re-price at the next late-stage
    // round (median step-up). Realized exits and write-offs are terminal — no further upside.
    const terminal = EXIT_STATUSES.has(p.status) || WRITEOFF_STATUSES.has(p.status);
    projectedValue += terminal ? value : value * LATE_STAGE_STEPUP;

    if (moic > 1) markedPositions += 1;
    if (moic > 1.05) winners += 1;
    else if (moic < 0.95) losers += 1;
    else flat += 1;

    contributions.push({
      startup_id: p.startup_id,
      moic: round(moic, 2),
      basis,
      gain_usd: value - check,
      entry_round_type: p.entry_round_type,
      status: p.status,
    });
  }

  const positions = contributions.length;
  const avgMoic = positions
    ? round(contributions.reduce((a, c) => a + (c.moic || 0), 0) / positions, 2)
    : null;
  const gain = currentValue - costBasis;

  // Top contributors (resolve names).
  contributions.sort((a, b) => b.gain_usd - a.gain_usd);
  const top = contributions.slice(0, 6);
  const nameMap = new Map();
  const ids = top.map((c) => c.startup_id).filter(Boolean);
  if (ids.length) {
    const { data: names } = await supabase.from('startup_uploads').select('id, name').in('id', ids);
    for (const r of names || []) nameMap.set(r.id, r.name);
  }
  const topContributors = top.map((c) => ({
    startup_id: c.startup_id,
    name: nameMap.get(c.startup_id) || 'Unknown',
    moic: c.moic,
    basis: c.basis,
    gain_usd: round(c.gain_usd),
    entry_round_type: c.entry_round_type,
  }));

  return {
    fund: 'follow-on',
    inception_date: FOLLOWON_INCEPTION,
    check_size_usd: FOLLOWON_CHECK_USD,
    positions,
    marked_positions: markedPositions,
    deployed_usd: round(deployed),
    cost_basis_usd: round(costBasis),
    current_value_usd: round(currentValue),
    gain_usd: round(gain),
    gain_pct: costBasis ? round((gain / costBasis) * 100, 1) : 0,
    avg_moic: avgMoic,
    tvpi: costBasis ? round(currentValue / costBasis, 2) : null,
    projected_value_usd: round(projectedValue),
    projected_moic: costBasis ? round(projectedValue / costBasis, 2) : null,
    projected_stepup: LATE_STAGE_STEPUP,
    per_position_moic_cap: PER_POSITION_MOIC_CAP,
    winners,
    losers,
    flat,
    win_rate_pct: positions ? round((winners / positions) * 100, 1) : 0,
    top_contributors: topContributors,
    note:
      positions === 0
        ? `Follow-on fund is forward-only (inception ${FOLLOWON_INCEPTION.slice(0, 10)}): a $${(FOLLOWON_CHECK_USD / 1e3).toFixed(0)}K virtual check goes into later-stage rounds (post-money ≥ $100M) of Pythia's seed winners as they close, going forward. No backfill — positions appear as future rounds land.`
        : `Late-stage doubling-down on Pythia's seed winners. Each $${(FOLLOWON_CHECK_USD / 1e3).toFixed(0)}K follow-on is booked at the round's REAL post-money (honest entry), so MOIC reflects only appreciation since the follow-on. ${markedPositions} of ${positions} above cost; per-position MOIC capped at ${PER_POSITION_MOIC_CAP}×. Projected MOIC applies a conservative ${LATE_STAGE_STEPUP}× median late-stage step-up to active positions (forward projection only — excludes realized exits and write-offs).`,
  };
}

module.exports = { computeFollowOnValue, FOLLOWON_INCEPTION, FOLLOWON_CHECK_USD };
