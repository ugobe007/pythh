/**
 * Signal VELOCITY → valuation multiple, indexed across the portfolio.
 *
 * Thesis (the user's): a company whose signal is ACCELERATING deserves a momentum premium on
 * its valuation — the same way fast-growing companies command higher revenue multiples. This
 * module:
 *   1. Computes a per-company signal velocity from the live data we actually have:
 *        • event velocity  — weighted material-signal events (partnership, customer_win,
 *          key_hire, product_launch, revenue/team milestone) in the trailing 90d, and whether
 *          that rate is ACCELERATING vs the prior 90d;
 *        • signal level    — the current blended signal score (startup_signal_scores.signals_total,
 *          which itself folds in news_momentum + execution_velocity dimensions).
 *      (GOD-score slope would be ideal but score_history is empty; signals_total daily snapshots
 *       are being recorded going forward so true score-slope velocity can replace the level term.)
 *   2. INDEXES velocity across the whole portfolio via percentile rank → a 0–100 Velocity Index,
 *      so every company is scored relative to its peers ("index velocity across all companies").
 *   3. Maps the Velocity Index → a momentum multiple via a transparent tier table
 *      ("if velocity is X then the multiple is Y").
 *   4. Applies that multiple to each position's HONEST current value to produce a clearly-labeled,
 *      FORWARD-LOOKING momentum-implied valuation. This never touches realized/sourced MOIC.
 */

const {
  SIGNAL_VALUATION_WEIGHTS,
  MAX_PLAUSIBLE_VALUATION_USD,
  computeVerifiedMoic,
  round,
} = require('./portfolioAnalytics');

const WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

// Velocity Index → momentum multiple. Transparent + tunable. Forward-looking premium only;
// the bottom tier is 1.00× (absence of tracked signals is not penalized as a decline).
const VELOCITY_TIERS = [
  { min: 85, mult: 1.40, label: 'accelerating' },
  { min: 70, mult: 1.25, label: 'hot' },
  { min: 50, mult: 1.12, label: 'warming' },
  { min: 30, mult: 1.04, label: 'steady' },
  { min: 0, mult: 1.00, label: 'quiet' },
];

function tierFor(index) {
  return VELOCITY_TIERS.find((t) => index >= t.min) || VELOCITY_TIERS[VELOCITY_TIERS.length - 1];
}

/** Percentile rank (0–100) of each value within the array (ties share the lower rank). */
function percentileRanks(values) {
  const n = values.length;
  if (n <= 1) return values.map(() => (values[0] > 0 ? 100 : 0));
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    let below = 0;
    while (below < n && sorted[below] < v) below += 1;
    return round((below / (n - 1)) * 100, 1);
  });
}

async function computeSignalVelocity(supabase) {
  const [posRes, evRes, ssRes] = await Promise.all([
    supabase
      .from('virtual_portfolio')
      .select('id, startup_id, status, virtual_check_usd, entry_valuation_usd, exit_valuation_usd, entry_date'),
    supabase
      .from('portfolio_events')
      .select('startup_id, portfolio_id, event_type, verified, post_money_usd, event_date')
      .in('event_type', ['funding_round', ...Object.keys(SIGNAL_VALUATION_WEIGHTS)]),
    supabase.from('startup_signal_scores').select('startup_id, signals_total'),
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (evRes.error) throw new Error(evRes.error.message);

  const now = Date.now();

  // Index events: verified rounds (for honest value), recent/prior weighted signal mass.
  const roundsByPortfolio = new Map();
  const roundsByStartup = new Map();
  const signalsByStartup = new Map(); // full list (for honest-value signal accretion)
  const recentMass = new Map();
  const priorMass = new Map();
  for (const ev of evRes.data || []) {
    if (ev.event_type === 'funding_round') {
      if (!ev.verified || !Number(ev.post_money_usd)) continue;
      if (ev.portfolio_id) {
        if (!roundsByPortfolio.has(ev.portfolio_id)) roundsByPortfolio.set(ev.portfolio_id, []);
        roundsByPortfolio.get(ev.portfolio_id).push(ev);
      }
      if (ev.startup_id) {
        if (!roundsByStartup.has(ev.startup_id)) roundsByStartup.set(ev.startup_id, []);
        roundsByStartup.get(ev.startup_id).push(ev);
      }
      continue;
    }
    const w = SIGNAL_VALUATION_WEIGHTS[ev.event_type];
    if (!w || !ev.startup_id) continue;
    if (!signalsByStartup.has(ev.startup_id)) signalsByStartup.set(ev.startup_id, []);
    signalsByStartup.get(ev.startup_id).push(ev);
    const age = now - new Date(ev.event_date).getTime();
    if (age <= WINDOW_DAYS * DAY_MS) recentMass.set(ev.startup_id, (recentMass.get(ev.startup_id) || 0) + w);
    else if (age <= 2 * WINDOW_DAYS * DAY_MS) priorMass.set(ev.startup_id, (priorMass.get(ev.startup_id) || 0) + w);
  }

  const signalLevelByStartup = new Map();
  for (const r of ssRes.data || []) signalLevelByStartup.set(r.startup_id, Number(r.signals_total) || 0);

  // First pass: per-position honest value + raw velocity components.
  const rows = [];
  for (const p of posRes.data || []) {
    const check = Number(p.virtual_check_usd) || 0;
    if (check <= 0) continue;

    const verifiedRounds = roundsByPortfolio.get(p.id) || roundsByStartup.get(p.startup_id) || [];
    const signalEvents = signalsByStartup.get(p.startup_id) || [];
    const { moic } = computeVerifiedMoic({
      status: p.status,
      entryValuation: p.entry_valuation_usd,
      exitValuation: p.exit_valuation_usd,
      verifiedRounds,
      signalEvents,
      entryDate: p.entry_date,
    });
    const honestValue = check * moic;

    const recent = recentMass.get(p.startup_id) || 0;
    const prior = priorMass.get(p.startup_id) || 0;
    const accel = recent - prior; // >0 = speeding up
    const level = signalLevelByStartup.get(p.startup_id) || 0;

    rows.push({
      portfolio_id: p.id,
      startup_id: p.startup_id,
      status: p.status,
      honestValue,
      eventVel: recent + Math.max(0, accel) * 0.5, // recent rate, boosted by acceleration
      accelerating: recent > prior && recent > 0,
      level,
    });
  }

  // Index velocity across the portfolio: percentile-rank each component, blend.
  const eventPct = percentileRanks(rows.map((r) => r.eventVel));
  const levelPct = percentileRanks(rows.map((r) => r.level));

  let honestTotal = 0;
  let momentumTotal = 0;
  const tierCounts = {};
  for (const t of VELOCITY_TIERS) tierCounts[t.label] = 0;

  rows.forEach((r, i) => {
    // Event velocity is the freshest momentum (0.6); signal level is the slower-moving
    // confirmation (0.4). Swap weight toward true score-slope once snapshots accrue.
    r.velocityIndex = round(0.6 * eventPct[i] + 0.4 * levelPct[i], 0);
    const tier = tierFor(r.velocityIndex);
    r.momentumMultiple = tier.mult;
    r.tier = tier.label;
    r.momentumValue = r.honestValue * tier.mult;
    honestTotal += r.honestValue;
    momentumTotal += r.momentumValue;
    tierCounts[tier.label] += 1;
  });

  // Top movers by momentum uplift (resolve names).
  const movers = [...rows]
    .filter((r) => r.momentumMultiple > 1)
    .sort((a, b) => b.velocityIndex - a.velocityIndex || (b.momentumValue - b.honestValue) - (a.momentumValue - a.honestValue))
    .slice(0, 10);
  const ids = movers.map((m) => m.startup_id).filter(Boolean);
  const nameMap = new Map();
  if (ids.length) {
    const { data: names } = await supabase.from('startup_uploads').select('id, name').in('id', ids);
    for (const r of names || []) nameMap.set(r.id, r.name);
  }
  const topMovers = movers.map((m) => ({
    name: nameMap.get(m.startup_id) || 'Unknown',
    velocity_index: m.velocityIndex,
    momentum_multiple: m.momentumMultiple,
    tier: m.tier,
    accelerating: m.accelerating,
    signal_level: round(m.level, 1),
    honest_value_usd: round(m.honestValue),
    momentum_value_usd: round(m.momentumValue),
    uplift_usd: round(m.momentumValue - m.honestValue),
  }));

  const scored = rows.length;
  const accelerating = rows.filter((r) => r.accelerating).length;
  const hot = rows.filter((r) => r.velocityIndex >= 70).length;
  const avgIndex = scored ? round(rows.reduce((a, r) => a + r.velocityIndex, 0) / scored, 0) : 0;

  return {
    method: 'event_velocity + signal_level',
    window_days: WINDOW_DAYS,
    blend: { event: 0.6, signal_level: 0.4 },
    tiers: VELOCITY_TIERS.map((t) => ({ min_index: t.min, multiple: t.mult, label: t.label })),
    positions_scored: scored,
    avg_velocity_index: avgIndex,
    accelerating_count: accelerating,
    hot_count: hot,
    tier_counts: tierCounts,
    honest_value_usd: round(honestTotal),
    momentum_implied_value_usd: round(momentumTotal),
    momentum_uplift_usd: round(momentumTotal - honestTotal),
    momentum_uplift_pct: honestTotal ? round(((momentumTotal - honestTotal) / honestTotal) * 100, 1) : 0,
    top_movers: topMovers,
    note: `Signal velocity indexes each company's momentum (weighted material signals in the last ${WINDOW_DAYS}d, accelerating vs prior ${WINDOW_DAYS}d, plus current signal score) by percentile across the portfolio, then maps the 0–100 Velocity Index to a momentum multiple. Momentum-implied value applies that multiple to each position's HONEST current value — a FORWARD-LOOKING premium on accelerating companies, never mixed into realized MOIC. ${accelerating} of ${scored} companies are accelerating.`,
  };
}

module.exports = { computeSignalVelocity, VELOCITY_TIERS };
