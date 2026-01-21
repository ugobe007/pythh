/**
 * PYTHH CONSTITUTIONAL SCHEMA
 * ============================
 * Immutable Backend Response Contract v1.0
 * Frozen: January 20, 2026
 * 
 * This schema constitutionally binds the engine and UI together.
 * Any deviation from this schema is a doctrine violation.
 * 
 * DO NOT MODIFY without explicit doctrine review.
 */

// ============================================
// SECTION 0: INVOCATION STATE
// ============================================

export interface InvocationState {
  startup_name: string;
  domain: string;
  category_guess: string;
  status: 'analyzing' | 'complete' | 'partial' | 'failed';
}

// ============================================
// SECTION 1: TOP 5 REVELATION SURFACE
// ============================================

export type DistanceLabel = 'warm' | 'portfolio-adjacent' | 'cold';

export interface Top5Investor {
  investor_id: string;
  name: string;
  signal_score: number;
  distance: DistanceLabel;
  tags: string[];
  why_line: string;
  rising?: boolean;
  new_match?: boolean;
  overlapping_signals: string[];
  leverage_signals: string[];
}

export interface WhyThisMatch {
  causal_reasons: string[];      // max 3
  overlapping_signals: string[];
  timing_context: string;        // one sentence
}

export interface HowToAlign {
  leverage_actions: string[];    // max 3
  why_this_works: string;        // one sentence
  collateral_effects: string[];  // investor names
}

export interface Top5ExpandedData {
  why_this_match: WhyThisMatch;
  how_to_align: HowToAlign;
}

// ============================================
// SECTION 2: MISALIGNMENT SURFACE
// ============================================

export type MisalignmentDistance = 'cold' | 'orthogonal' | 'narrative-repelled';

export interface MisalignedInvestor {
  investor_id: string;
  name: string;
  stage: string;
  thesis: string;
  fit_score: number;
  why_not_line: string;
  missing_signals: string[];
  distance: MisalignmentDistance;
  near_miss?: boolean;
}

// ============================================
// SECTION 3: TRUST MIRROR
// ============================================

export interface TrustMirror {
  /**
   * Exactly 4-6 statements.
   * Format: "You are being read as {statement}."
   * NO numbers. NO scores. NO advice.
   */
  orientation_statements: string[];
  
  /**
   * Format: "This is why {explanation}."
   */
  synthesis_sentence: string;
}

// ============================================
// SECTION 4: CONVICTION SURFACE
// ============================================

export interface ConvictionSurface {
  investor_name: string;
  distance_to_flip: number;
  blocking_signals: string[];
  leverage_actions: string[];
  collateral_investors: string[];
}

// ============================================
// SECTION 5: DESIRE SURFACE
// ============================================

export interface BlurredInvestor {
  rank: number;
  category: string;
  stage: string;
  thesis: string;
  distance: string;
  why_partial: string;  // First half visible, rest blurred
}

export interface DesireSurface {
  more_aligned_count: number;
  more_misaligned_count: number;
  new_matches_this_week: number;
  warming_up_count: number;
  cooling_off_count: number;
  blurred_aligned: BlurredInvestor[];
  blurred_misaligned: BlurredInvestor[];
}

// ============================================
// SECTION 6: DIAGNOSTICS (Optional)
// ============================================

export interface Diagnostics {
  god_score?: number;
  component_scores?: {
    team?: number;
    traction?: number;
    market?: number;
    product?: number;
    vision?: number;
  };
  match_engine_version?: string;
  scan_duration_ms?: number;
  enrichment_status?: string;
  [key: string]: unknown;  // Unbounded
}

// ============================================
// COMPLETE RESPONSE SCHEMA
// ============================================

/**
 * PythhResponse — The Constitutional Response Shape
 * 
 * This is the ONLY allowed shape of the /api/matches response.
 * Frontend must consume this exact shape.
 * Backend must produce this exact shape.
 * 
 * Deviation is a doctrine violation.
 */
export interface PythhResponse {
  /**
   * SECTION 0: Invocation confirmation
   */
  invocation: InvocationState;
  
  /**
   * SECTION 1: Top 5 matches (ALWAYS FIRST)
   * Must be present even if empty.
   */
  top5: Top5Investor[];
  
  /**
   * SECTION 2: Misaligned investors
   * Must be present. Must not be hidden.
   */
  misaligned: MisalignedInvestor[];
  
  /**
   * SECTION 3: Trust Mirror
   * NO numbers. NO scores. NO advice.
   */
  trust_mirror: TrustMirror;
  
  /**
   * SECTION 4: Conviction surface
   * Investor-specific. Near-miss framing.
   */
  conviction: ConvictionSurface | null;
  
  /**
   * SECTION 5: Desire surface
   * Scale + inevitability. Blur names, not insight.
   */
  desire: DesireSurface;
  
  /**
   * SECTION 6: Diagnostics (HIDDEN)
   * Optional. Never primary. Never early.
   */
  diagnostics?: Diagnostics;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validates that orientation statements contain no numbers or scores.
 */
export function validateTrustMirror(mirror: TrustMirror): boolean {
  const hasNumbers = mirror.orientation_statements.some(s => /\d/.test(s));
  const hasScoreWords = mirror.orientation_statements.some(s => 
    /score|grade|rating|percent|%/i.test(s)
  );
  return !hasNumbers && !hasScoreWords;
}

/**
 * Validates that why_line contains no banned phrases.
 */
const BANNED_PHRASES = [
  'too early', 'not ready', 'weak signals', 'low quality',
  'bad fit', 'improve your', 'you should', 'you must',
  'you need to', 'ai-powered', 'our model', 'god score',
  'algorithm'
];

export function validateWhyLine(whyLine: string): boolean {
  const lower = whyLine.toLowerCase();
  return !BANNED_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Validates complete response against doctrine.
 */
export function validatePythhResponse(response: PythhResponse): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  
  // Top 5 must exist
  if (!response.top5) {
    violations.push('DOCTRINE VIOLATION: top5 is missing');
  }
  
  // Misaligned must exist
  if (!response.misaligned) {
    violations.push('DOCTRINE VIOLATION: misaligned is missing');
  }
  
  // Trust mirror validation
  if (response.trust_mirror) {
    if (!validateTrustMirror(response.trust_mirror)) {
      violations.push('DOCTRINE VIOLATION: Trust mirror contains numbers or scores');
    }
    if (response.trust_mirror.orientation_statements.length < 4 ||
        response.trust_mirror.orientation_statements.length > 6) {
      violations.push('DOCTRINE VIOLATION: Trust mirror must have 4-6 statements');
    }
  } else {
    violations.push('DOCTRINE VIOLATION: trust_mirror is missing');
  }
  
  // Why line validation for top 5
  response.top5?.forEach((investor, i) => {
    if (!validateWhyLine(investor.why_line)) {
      violations.push(`DOCTRINE VIOLATION: top5[${i}].why_line contains banned phrase`);
    }
  });
  
  // Why not line validation for misaligned
  response.misaligned?.forEach((investor, i) => {
    if (!validateWhyLine(investor.why_not_line)) {
      violations.push(`DOCTRINE VIOLATION: misaligned[${i}].why_not_line contains banned phrase`);
    }
  });
  
  // Desire surface validation
  if (!response.desire) {
    violations.push('DOCTRINE VIOLATION: desire surface is missing');
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

// ============================================
// TYPE GUARDS
// ============================================

export function isTop5Investor(obj: unknown): obj is Top5Investor {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.investor_id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.signal_score === 'number' &&
    ['warm', 'portfolio-adjacent', 'cold'].includes(o.distance as string) &&
    Array.isArray(o.tags) &&
    typeof o.why_line === 'string'
  );
}

export function isPythhResponse(obj: unknown): obj is PythhResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    'invocation' in o &&
    'top5' in o &&
    'misaligned' in o &&
    'trust_mirror' in o &&
    'desire' in o
  );
}

// ============================================
// FACTORY (For backend implementation)
// ============================================

/**
 * Creates an empty but valid PythhResponse.
 * Use when scan fails but page must still render.
 */
export function createEmptyPythhResponse(
  startupName: string,
  domain: string
): PythhResponse {
  return {
    invocation: {
      startup_name: startupName,
      domain: domain,
      category_guess: 'Unknown',
      status: 'failed'
    },
    top5: [],
    misaligned: [],
    trust_mirror: {
      orientation_statements: [
        'early-stage with a forming narrative',
        'not yet legible to most capital sources',
        'having limited external proof yet',
        'at a stage before pattern recognition kicks in'
      ],
      synthesis_sentence: 'This is why the capital topology is not yet visible for your startup.'
    },
    conviction: null,
    desire: {
      more_aligned_count: 0,
      more_misaligned_count: 0,
      new_matches_this_week: 0,
      warming_up_count: 0,
      cooling_off_count: 0,
      blurred_aligned: [],
      blurred_misaligned: []
    }
  };
}
