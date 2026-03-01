/**
 * FUNDING PREDICTION ENGINE
 * ==========================
 * Admin Approved: Feb 28, 2026
 *
 * Predicts WHEN high-GOD-score startups are likely to receive funding.
 * Produces a confidence-weighted window (not a fake exact date).
 *
 * Output:
 *   confidence_label: 'Likely' | 'Strong Signal' | 'Imminent'
 *   window_days: how many days the window spans from now
 *   window_end: countdown target date
 *
 * Signals used:
 *   - GOD score tier (70–74 / 75–79 / 80+)
 *   - Investor pedigree tier (Elite / Top / Notable)
 *   - Social signals score (funded/mentioned online)
 *   - Momentum score (forward velocity)
 *   - Raise language detected in pitch/description
 *   - YC Demo Day proximity (mid-March, mid-September)
 */

export interface FundingPrediction {
  startup_id: string;
  god_score: number;
  signals_score: number;
  confidence: number;
  confidence_label: 'Likely' | 'Strong Signal' | 'Imminent';
  window_start: Date;
  window_end: Date;
  window_days: number;
  signals_snapshot: Record<string, unknown>;
}

// ============================================================================
// YC DEMO DAY PROXIMITY
// ============================================================================
// YC Demo Days: ~March 15 and ~September 15 each year
function daysToNearestYCDemoDay(from: Date): number {
  const year = from.getFullYear();
  const candidates = [
    new Date(year, 2, 15),      // March 15
    new Date(year, 8, 15),      // Sept 15
    new Date(year + 1, 2, 15),  // Next March 15
  ];
  const diffs = candidates.map(d => Math.abs((d.getTime() - from.getTime()) / 86_400_000));
  return Math.min(...diffs);
}

// ============================================================================
// RAISE LANGUAGE DETECTOR
// ============================================================================
const RAISE_PATTERNS = [
  /currently raising/i,
  /raising (?:a |our )?(?:seed|series [a-d]|pre-seed|angel)/i,
  /open (?:to|for) investment/i,
  /seeking (?:investment|investors|funding)/i,
  /looking for (?:a lead|investors|funding)/i,
  /in (?:process|talks) (?:of|with) raising/i,
  /fundraise/i,
  /our (?:seed|series [a-d]|round)/i,
  /\$\d+[MK] (?:seed|round|raise)/i,
];

function detectRaiseLanguage(text: string): boolean {
  return RAISE_PATTERNS.some(p => p.test(text));
}

// ============================================================================
// PEDIGREE TIER DETECTOR (mirrors investorPedigreeScoringService)
// ============================================================================
const TIER1_PATTERNS = [
  'y combinator', 'yc', 'sequoia', 'andreessen', 'a16z', 'founders fund',
  'benchmark', 'tiger global', 'coatue', 'softbank', 'khosla', 'greylock',
  'index ventures', 'general atlantic', 'lightspeed', 'insight partners',
  'dragoneer', 'greenoaks', 'pioneer', 'neo',
];

const TIER2_PATTERNS = [
  'accel', 'general catalyst', 'gv', 'google ventures', 'first round',
  'bessemer', 'spark capital', 'union square', 'felicis', 'battery ventures',
  'bain capital ventures', 'balderton', 'atomico', 'true ventures',
  'initialized', 'pear vc', 'pear', 'floodgate', 'amplify', 'village global',
];

type PedigreeTier = 'elite' | 'top' | 'notable' | 'none';

function detectPedigreeTier(startup: any): PedigreeTier {
  const sources: string[] = [];

  const ex = startup.extracted_data || {};
  if (Array.isArray(startup.backed_by)) sources.push(...startup.backed_by.map(String));
  if (typeof startup.backed_by === 'string') sources.push(startup.backed_by);
  if (Array.isArray(ex.investors)) sources.push(...ex.investors.map(String));
  if (typeof ex.investors === 'string') sources.push(ex.investors);

  // Add pitch text for indirect signals
  const pitch = String(startup.description || startup.pitch || ex.pitch || ex.description || '');
  sources.push(pitch);

  const combined = sources.join(' ').toLowerCase();

  if (TIER1_PATTERNS.some(p => combined.includes(p))) return 'elite';
  if (TIER2_PATTERNS.some(p => combined.includes(p))) return 'top';
  return 'none';
}

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================
export function predictFundingWindow(startup: any): FundingPrediction | null {
  const godScore: number = startup.total_god_score || 0;

  // Only predict for 70+ GOD scores
  if (godScore < 70) return null;

  const now = new Date();
  const signalsScore: number = startup.signals_bonus || 0;
  const momentumScore: number = startup.momentum_score || 0;
  const pedigreeTier = detectPedigreeTier(startup);

  // Raise language check across all text fields
  const allText = [
    startup.description, startup.pitch, startup.tagline, startup.value_proposition,
    startup.problem, startup.solution,
    (startup.extracted_data || {}).pitch,
    (startup.extracted_data || {}).description,
  ].filter(Boolean).join(' ');
  const hasRaiseLanguage = detectRaiseLanguage(allText);

  // YC Demo Day proximity (shortens window if near)
  const daysToYC = daysToNearestYCDemoDay(now);
  const nearYCDemoDay = pedigreeTier === 'elite' && daysToYC <= 75;

  // ============================================================================
  // BASE WINDOW (days) by GOD score tier
  // ============================================================================
  let baseWindowDays: number;
  if (godScore >= 85) baseWindowDays = 45;
  else if (godScore >= 80) baseWindowDays = 60;
  else if (godScore >= 75) baseWindowDays = 90;
  else baseWindowDays = 120; // 70-74

  // ============================================================================
  // COMPRESSION FACTORS (shorten window)
  // ============================================================================
  let compression = 0;

  if (pedigreeTier === 'elite') compression += 20;
  else if (pedigreeTier === 'top') compression += 10;

  if (momentumScore >= 8) compression += 25;
  else if (momentumScore >= 5) compression += 15;
  else if (momentumScore >= 3) compression += 8;

  if (signalsScore >= 25) compression += 20;
  else if (signalsScore >= 15) compression += 12;
  else if (signalsScore >= 8)  compression += 6;

  if (hasRaiseLanguage) compression += 35;
  if (nearYCDemoDay) compression += 20;

  if (godScore >= 90) compression += 15;
  else if (godScore >= 85) compression += 10;

  // Clamp window to minimum 14 days (even "Imminent" needs some runway)
  const windowDays = Math.max(14, baseWindowDays - compression);

  const windowEnd = new Date(now.getTime() + windowDays * 86_400_000);

  // ============================================================================
  // CONFIDENCE SCORE
  // ============================================================================
  let confidence = 0.40; // Base: Likely

  if (godScore >= 85) confidence += 0.15;
  else if (godScore >= 80) confidence += 0.10;
  else if (godScore >= 75) confidence += 0.05;

  if (pedigreeTier === 'elite') confidence += 0.15;
  else if (pedigreeTier === 'top') confidence += 0.08;

  if (signalsScore >= 25) confidence += 0.12;
  else if (signalsScore >= 15) confidence += 0.07;
  else if (signalsScore >= 8)  confidence += 0.04;

  if (momentumScore >= 8) confidence += 0.10;
  else if (momentumScore >= 5) confidence += 0.06;
  else if (momentumScore >= 3) confidence += 0.03;

  if (hasRaiseLanguage) confidence += 0.15;
  if (nearYCDemoDay) confidence += 0.08;

  confidence = Math.min(0.95, confidence);

  // ============================================================================
  // CONFIDENCE LABEL
  // ============================================================================
  let confidence_label: 'Likely' | 'Strong Signal' | 'Imminent';
  if (confidence >= 0.80) confidence_label = 'Imminent';
  else if (confidence >= 0.60) confidence_label = 'Strong Signal';
  else confidence_label = 'Likely';

  return {
    startup_id: startup.id,
    god_score: godScore,
    signals_score: signalsScore,
    confidence,
    confidence_label,
    window_start: now,
    window_end: windowEnd,
    window_days: windowDays,
    signals_snapshot: {
      god_score: godScore,
      signals_score: signalsScore,
      momentum_score: momentumScore,
      pedigree_tier: pedigreeTier,
      has_raise_language: hasRaiseLanguage,
      near_yc_demo_day: nearYCDemoDay,
      days_to_yc_demo_day: Math.round(daysToYC),
      base_window_days: baseWindowDays,
      compression_applied: compression,
      final_window_days: windowDays,
    },
  };
}
