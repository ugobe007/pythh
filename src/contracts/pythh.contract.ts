/* ============================================================================
 * PYTHH CONTRACT — IMMUTABLE v1.0
 * ---------------------------------------------------------------------------
 * This file is the single source of truth for the Pythh product response.
 * Backend MUST return exactly this shape.
 * Frontend MUST render only from this shape.
 *
 * DO NOT add fields casually. Any change = product contract change.
 * ========================================================================== */

export type PythhDistanceAligned = "warm" | "portfolio-adjacent" | "cold";
export type PythhDistanceMisaligned = "cold" | "orthogonal" | "narrative-repelled";

export type PythhInvocationStatus = "analyzing" | "complete" | "partial" | "failed";

export type PythhStartupIdentity = {
  name: string;
  domain: string;
  detected_category: string;
  detected_stage: string;
  short_description: string;
};

export type PythhInvocationState = {
  status: PythhInvocationStatus;
  message: string;
};

/**
 * TOP 5 — The product.
 * - Always return 5 items (placeholders allowed).
 * - No diagnostics or internal leakage here.
 * - No readiness framing. No judgment language.
 */
export type PythhTop5Match = {
  investor_id: string;
  name: string;

  // Keep as a number so UI can format; do NOT interpret as a "grade".
  signal_score: number;

  distance: PythhDistanceAligned;
  tags: string[];

  // One sentence. Human causal language.
  why_line: string;

  rising?: boolean;
  new_match?: boolean;

  overlapping_signals: string[];

  why_expanded: {
    causal_reasons: string[]; // max 3 (backend enforces)
    timing_context: string; // one sentence
  };

  align_expanded: {
    leverage_actions: string[]; // max 3 (backend enforces)
    why_this_works: string; // one sentence
    collateral_investors: string[];
  };
};

/**
 * MISALIGNMENT — Symmetry builds belief.
 * - Must return real investor names.
 * - No shame language, no "too early", no "not ready".
 * - Not gated. Not blurred.
 */
export type PythhMisalignedInvestor = {
  investor_id: string;
  name: string;

  stage: string;
  thesis: string;

  // Percent-like number is OK; UI formats.
  fit_score: number;

  // One sentence. Human causal language.
  why_not_line: string;

  // Missing or repelling signals. Neutral tone.
  missing_signals: string[];

  distance: PythhDistanceMisaligned;

  // Used to highlight leverage opportunity.
  near_miss?: boolean;
};

/**
 * TRUST MIRROR — Orientation without judgment.
 * - Exactly 4–6 statements (backend enforces).
 * - No numbers. No advice. No diagnostics.
 */
export type PythhTrustMirror = {
  orientation_statements: string[]; // exactly 4–6
  synthesis_sentence: string; // exactly 1
};

/**
 * CONVICTION — Agency via leverage.
 * - Investor-specific.
 * - Small viable signal changes only.
 * - No coaching tone. No moral language.
 */
export type PythhConvictionSurface = {
  investor_name: string;

  // e.g. "8" meaning 8% away. UI decides formatting.
  distance_to_flip: number;

  blocking_signals: string[];
  leverage_actions: string[];
  collateral_investors: string[];
};

/**
 * DESIRE — Reveal scale + movement.
 * - Blur NAMES only (UI), never blur insight.
 * - Must show counts + temporal movement.
 */
export type PythhDesireSurface = {
  more_aligned_count: number;
  more_misaligned_count: number;

  new_matches_this_week: number;
  warming_up_count: number;
  cooling_off_count: number;

  blurred_aligned: Array<{
    rank: number;
    category: string;
    stage: string;
    thesis: string;
    distance: string;
    why_partial: string; // partial text OK; do NOT include investor name
  }>;
};

/**
 * DIAGNOSTICS — Engine room (optional).
 * - Must never be required for rendering product surfaces.
 * - Must only be shown behind a toggle.
 */
export type PythhDiagnosticsSurface = {
  raw_signals: Record<string, number>;
  convergence_scores: Record<string, number>;
  phase_change: Record<string, number>;
  internal_notes: string[];
};

/**
 * PythhResponse — THE CONTRACT
 * 
 * This is the ONLY allowed shape of the /api/matches response.
 * Backend must produce this exact shape.
 * Frontend must consume this exact shape.
 * Deviation is a doctrine violation.
 */
export type PythhResponse = {
  startup: PythhStartupIdentity;
  invocation: PythhInvocationState;

  top5: PythhTop5Match[];

  misaligned: PythhMisalignedInvestor[];

  trust_mirror: PythhTrustMirror;

  conviction: PythhConvictionSurface;

  desire: PythhDesireSurface;

  diagnostics?: PythhDiagnosticsSurface;
};

/* ============================================================================
 * RUNTIME GUARDS
 * ---------------------------------------------------------------------------
 * Use these in backend + frontend to hard-fail on contract drift.
 * No extra deps required.
 * ========================================================================== */

export function isPythhResponse(x: unknown): x is PythhResponse {
  if (!x || typeof x !== "object") return false;
  const r = x as any;

  // minimal structural checks (keep light; do not overfit)
  if (!r.startup || typeof r.startup.domain !== "string") return false;
  if (!r.invocation || typeof r.invocation.status !== "string") return false;

  if (!Array.isArray(r.top5) || r.top5.length !== 5) return false;
  if (!Array.isArray(r.misaligned) || r.misaligned.length < 5) return false;

  if (!r.trust_mirror || !Array.isArray(r.trust_mirror.orientation_statements)) return false;
  if (!r.conviction || typeof r.conviction.investor_name !== "string") return false;
  if (!r.desire || typeof r.desire.more_aligned_count !== "number") return false;

  return true;
}

/**
 * Hard-fail helper. Use everywhere you parse API responses.
 */
export function assertPythhResponse(x: unknown, label = "PythhResponse"): asserts x is PythhResponse {
  if (!isPythhResponse(x)) {
    throw new Error(`${label} contract violation: response shape does not match PythhResponse v1.0`);
  }
}

/* ============================================================================
 * WIRING GUIDE
 * ---------------------------------------------------------------------------
 * Backend:
 *   import { PythhResponse } from '@/contracts/pythh.contract';
 *   // Make your /match or /results handler return PythhResponse
 * 
 * Frontend:
 *   import { assertPythhResponse, PythhResponse } from '@/contracts/pythh.contract';
 *   const json = await res.json();
 *   assertPythhResponse(json); // throws on drift
 *   // render only from typed object
 * ========================================================================== */
