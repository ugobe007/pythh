/**
 * Exit / strategic acquisition propensity (heuristic, not a securities forecast).
 * Four interpretable factors → blended score 0–100 + confidence from data richness.
 */

export type ExitPropensityTier = 'low' | 'moderate' | 'elevated' | 'high' | 'realized' | 'n_a';

export interface ExitPropensityBreakdown {
  /** Market + product + vision — strategic asset quality */
  market_strategic_fit: number;
  /** Revenue, customers, growth — operating momentum */
  traction_momentum: number;
  /** Stage / maturity vs typical M&A window */
  stage_readiness: number;
  /** Press/signals visibility — strategic interest proxy */
  strategic_visibility: number;
  /** Short labels for UI */
  labels: Record<string, string>;
}

export interface ExitPropensityResult {
  score: number | null;
  tier: ExitPropensityTier;
  confidence: number;
  breakdown: ExitPropensityBreakdown;
  explanation: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pillarBalance(team: number, traction: number, market: number, product: number): number {
  const vals = [team, traction, market, product].map((v) => clamp(Number(v) || 0, 0, 10));
  const spread = Math.max(...vals) - Math.min(...vals);
  // Balanced profile (low spread) reads as more "ready" for diligence than one-spike
  return clamp(100 - spread * 5, 0, 100);
}

function stageReadinessScore(startup: Record<string, unknown>): number {
  const stage = Number(startup.stage);
  const ex = (startup.extracted_data as Record<string, unknown>) || {};
  const round = String(ex.last_round_type || ex.funding_stage || '').toLowerCase();
  let base = 35;
  if (Number.isFinite(stage) && stage > 0) {
    base = clamp(25 + stage * 12, 30, 85);
  }
  if (/series\s*[c-e]|late|growth/i.test(round)) base = Math.max(base, 78);
  else if (/series\s*b/i.test(round)) base = Math.max(base, 68);
  else if (/series\s*a|seed/i.test(round)) base = Math.max(base, 52);

  const mat = String(startup.maturity_level || '').toLowerCase();
  const matBoost: Record<string, number> = {
    freshman: 0,
    sophomore: 4,
    junior: 10,
    senior: 16,
    graduate: 22,
    phd: 28,
  };
  base += matBoost[mat] ?? 0;

  return clamp(base, 0, 100);
}

/**
 * Compute acquisition propensity for a startup row (startup_uploads shape).
 * Returns score null when company already exited via acquisition / IPO path.
 */
export function computeExitPropensity(startup: Record<string, unknown>): ExitPropensityResult {
  const status = String(startup.company_status || 'active').toLowerCase();
  if (status === 'acquired' || status === 'dead') {
    return {
      score: null,
      tier: status === 'acquired' ? 'realized' : 'n_a',
      confidence: 1,
      breakdown: {
        market_strategic_fit: 0,
        traction_momentum: 0,
        stage_readiness: 0,
        strategic_visibility: 0,
        labels: {
          market_strategic_fit: 'Not scored — terminal state',
          traction_momentum: '—',
          stage_readiness: '—',
          strategic_visibility: '—',
        },
      },
      explanation:
        status === 'acquired'
          ? 'Company marked acquired — exit propensity not applicable'
          : 'Company inactive — not scored',
    };
  }

  const gate = String(startup.entity_gate || '').toLowerCase();
  const team = Number(startup.team_score) || 0;
  const traction = Number(startup.traction_score) || 0;
  const market = Number(startup.market_score) || 0;
  const product = Number(startup.product_score) || 0;
  const vision = Number(startup.vision_score) || 0;
  const god = Number(startup.total_god_score) || 0;
  const signals = Number(startup.signals_bonus) || 0;

  const arr =
    Number(startup.arr_usd) ||
    Number(startup.arr) ||
    Number(startup.revenue_usd) ||
    0;
  const exData = startup.extracted_data as Record<string, unknown> | null | undefined;
  const customers =
    Number(startup.parsed_customers) ||
    Number(startup.customer_count) ||
    Number(exData?.customers ?? exData?.customer_count) ||
    0;
  const growth = Number(startup.growth_rate_monthly) || 0;

  const marketStrategic = clamp(((market + product + vision) / 3) * 10, 0, 100);
  let tractionScore = clamp(traction * 10, 0, 100);
  if (arr > 1_000_000) tractionScore = clamp(tractionScore + 12, 0, 100);
  else if (arr > 100_000) tractionScore = clamp(tractionScore + 6, 0, 100);
  if (customers > 500) tractionScore = clamp(tractionScore + 8, 0, 100);
  else if (customers > 50) tractionScore = clamp(tractionScore + 4, 0, 100);
  if (growth > 0.05) tractionScore = clamp(tractionScore + 5, 0, 100);

  const balance = pillarBalance(team, traction, market, product);
  const tractionBlended = clamp(tractionScore * 0.75 + balance * 0.25, 0, 100);

  const stageR = stageReadinessScore(startup);

  let visibility = clamp(signals * 10 + god * 0.35, 0, 100);
  const ex = startup.extracted_data as Record<string, unknown> | null;
  const pressHints = JSON.stringify(ex || '').toLowerCase();
  if (/\bacqui|merger|strategic|buyer|takeover\b/i.test(pressHints)) {
    visibility = clamp(visibility + 10, 0, 100);
  }

  let raw =
    marketStrategic * 0.28 + tractionBlended * 0.3 + stageR * 0.22 + visibility * 0.2;

  let confidence = 0.75;
  if (gate === 'qualified') confidence = 0.95;
  else if (gate === 'needs_url') confidence = 0.72;
  else if (gate === 'junk') confidence = 0.35;
  if (!startup.website && !(startup as { company_website?: string }).company_website) confidence *= 0.9;
  if (god < 40) confidence *= 0.85;

  if (gate === 'junk') raw *= 0.45;

  const score = Math.round(clamp(raw, 0, 100));

  let tier: ExitPropensityTier = 'moderate';
  if (score >= 76) tier = 'high';
  else if (score >= 51) tier = 'elevated';
  else if (score <= 25) tier = 'low';

  const breakdown: ExitPropensityBreakdown = {
    market_strategic_fit: Math.round(marketStrategic),
    traction_momentum: Math.round(tractionBlended),
    stage_readiness: Math.round(stageR),
    strategic_visibility: Math.round(visibility),
    labels: {
      market_strategic_fit: 'Market, product & vision pillars vs ceiling',
      traction_momentum: 'Traction + revenue/customers/growth + pillar balance',
      stage_readiness: 'Round + maturity vs typical strategic window',
      strategic_visibility: 'GOD + market signals + M&A language in extracted text',
    },
  };

  return {
    score,
    tier,
    confidence: Math.round(confidence * 100) / 100,
    breakdown,
    explanation: `Blended ${score}/100 (${tier}). Confidence ${(confidence * 100).toFixed(0)}% (entity gate + URL + GOD depth).`,
  };
}
