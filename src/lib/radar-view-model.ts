// ============================================================================
// RADAR CANONICAL DATA CONTRACT v1
// ============================================================================
// TRUTH TABLE: This file is the SINGLE SOURCE OF TRUTH for how raw data
// maps to Radar display fields. NO COMPUTATIONS IN UI COMPONENTS.
//
// Contract principles:
//   1. GOD is STARTUP-LEVEL only - injected once, reused on every row
//   2. SIGNAL/YC++/FIT are INVESTOR↔STARTUP specific
//   3. Nothing is recomputed client-side
//   4. If a value repeats incorrectly, the bug is UPSTREAM, not cosmetic
// ============================================================================

import type { MatchRow, StartupContext } from './pythh-types';

// -----------------------------------------------------------------------------
// CANONICAL FIELD TYPES (Locked per spec)
// -----------------------------------------------------------------------------

/**
 * Single row in Radar table - all fields normalized to display-ready format.
 * NO FURTHER COMPUTATION should happen after this mapping.
 */
export interface RadarRowViewModel {
  // Row identity
  investorId: string;
  rank: number;
  
  // ENTITY column
  entity: {
    name: string;               // investor.name or "Locked Investor"
    context: string | null;     // Thesis snippet or FIT-derived text
    isLocked: boolean;
  };
  
  // SIGNAL column (investor↔startup movement, 0.0-10.0)
  signal: {
    value: number;              // 0.0-10.0, one decimal
    delta: number | null;       // delta_7d: positive, negative, or null
    direction: 'up' | 'down' | 'flat';
  };
  
  // GOD column (startup position, 0-100) - CONSTANT ACROSS ALL ROWS
  god: number;                  // Injected from startup_god_score.total
  
  // YC++ column (investor perception, 0-100)
  ycPlusPlus: number;           // How this investor perceives this startup
  
  // Δ column (surface tension / composite delta)
  delta: number | null;         // composite_delta, one decimal
  
  // FIT column (1-5 bars)
  fit: {
    tier: 1 | 2 | 3 | 4 | 5;
    bars: number;               // Same as tier, for bar rendering
  };
  
  // STATUS column (deterministic)
  status: 'LOCKED' | 'READY' | 'LIVE' | 'WARMING';
  
  // ACTION column
  action: 'Unlock' | 'View';
  
  // Glow derivation (per spec)
  glow: {
    row: 'signal' | 'good' | 'none';     // Row glow (cyan for high signal, green for high fit)
    action: 'locked' | 'none';            // Action column glow (orange for locked)
  };
}

/**
 * Complete Radar page state - includes startup-level GOD score.
 */
export interface RadarViewModel {
  startupId: string;
  startupName: string | null;
  
  // GOD score - STARTUP LEVEL, NOT PER-INVESTOR
  godScore: number;             // From startup_uploads.total_god_score
  
  // Rows (each has godScore baked in)
  unlockedRows: RadarRowViewModel[];
  lockedRows: RadarRowViewModel[];
  
  // Entitlements
  unlocksRemaining: number;
  
  // Metadata
  lastUpdated: Date | null;
}

// -----------------------------------------------------------------------------
// THRESHOLD CONSTANTS (Locked per spec)
// -----------------------------------------------------------------------------

export const RADAR_THRESHOLDS = {
  // SIGNAL levels
  SIGNAL_WINDOW_OPENING: 7.5,   // High urgency
  SIGNAL_ACTIVE: 5.5,           // Active interest
  SIGNAL_COOLING: 4.0,          // Cooling off
  
  // FIT tier boundaries (for bar count)
  FIT_HIGH: 4,                  // ≥4 bars = green
  FIT_MEDIUM: 3,                // 3 bars = neutral
  FIT_LOW: 2,                   // ≤2 bars = muted
  
  // YC++ perception levels
  YC_EXCELLENT: 80,             // Green
  YC_GOOD: 60,                  // Neutral
  // Below 60 = muted
} as const;

// -----------------------------------------------------------------------------
// CONTEXT DERIVATION (for locked rows)
// -----------------------------------------------------------------------------

/**
 * Derive context text for locked investors based on FIT tier.
 * Prevents identical "Locked Investor" rows from feeling fake.
 */
function deriveLockedContext(fitTier: number): string {
  if (fitTier >= 4) return 'Top-tier alignment';
  if (fitTier >= 3) return 'Strong market overlap';
  return 'Relevant sector match';
}

// -----------------------------------------------------------------------------
// ROW MAPPING (MatchRow → RadarRowViewModel)
// -----------------------------------------------------------------------------

/**
 * Map a single RPC MatchRow to display-ready RadarRowViewModel.
 * 
 * @param row - Raw MatchRow from get_live_match_table RPC
 * @param godScore - Startup's GOD score (injected, NOT derived)
 * @param index - Row index (0-based) for auto-unlock logic
 */
export function mapMatchRowToRadarRow(
  row: MatchRow,
  godScore: number,
  index?: number
): RadarRowViewModel {
  // --- AUTO-UNLOCK TOP 5 ---
  // Top 5 investors are always unlocked to show founders the value
  // Rows 6+ require unlock action
  const isAutoUnlocked = index !== undefined && index < 5;
  const effectivelyLocked = row.is_locked && !isAutoUnlocked;
  // --- SIGNAL ---
  // Source: row.signal_score (0-10 from RPC)
  // Delta source: momentum_bucket (until we have investor_startup_signal.delta_7d)
  const signalValue = row.signal_score ?? 5.0;
  const signalDirection = deriveSignalDirection(row.momentum_bucket);
  const signalDelta = deriveDeltaFromMomentum(row.momentum_bucket);
  
  // --- YC++ ---
  // Currently derived from signal_score + fit_bucket
  // TODO: Replace with investor_perception_score.yc_plus_plus when available
  const ycPlusPlus = deriveYCPlusScore(row);
  
  // --- FIT ---
  // Source: row.fit_bucket → tier 1-5
  const fitTier = deriveFitTier(row.fit_bucket);
  
  // --- COMPOSITE DELTA (Δ column) ---
  // TODO: Replace with investor_startup_signal.composite_delta when available
  const compositeDelta = signalDelta;
  
  // --- STATUS ---
  // Deterministic: 
  //   - is_fallback → WARMING (fallback tier, needs badge)
  //   - locked → LOCKED
  //   - else → READY
  // LIVE reserved for future real-time indicator
  const status: RadarRowViewModel['status'] = 
    row.is_fallback ? 'WARMING' :
    effectivelyLocked ? 'LOCKED' : 
    'READY';
  
  // --- CONTEXT ---
  // Warming: "Early signal" (fallback tier)
  // Unlocked: from investor data (not available in current MatchRow)
  // Locked: derived from FIT tier
  const context = 
    row.is_fallback ? 'Early signal' :
    effectivelyLocked ? deriveLockedContext(fitTier) :
    null; // TODO: Add investor.thesis or investment_focus
  
  // --- GLOW ---
  const hasHighSignal = signalValue >= RADAR_THRESHOLDS.SIGNAL_WINDOW_OPENING;
  const hasHighFit = fitTier >= RADAR_THRESHOLDS.FIT_HIGH;
  
  const rowGlow: RadarRowViewModel['glow']['row'] = 
    hasHighSignal ? 'signal' : 
    (hasHighFit && !effectivelyLocked) ? 'good' : 
    'none';
  
  const actionGlow: RadarRowViewModel['glow']['action'] = 
    effectivelyLocked ? 'locked' : 'none';
  
  return {
    investorId: row.investor_id,
    rank: row.rank,
    
    entity: {
      name: effectivelyLocked ? 'Locked Investor' : (row.investor_name ?? 'Unknown'),
      context,
      isLocked: effectivelyLocked,
    },
    
    signal: {
      value: Math.round(signalValue * 10) / 10, // 1 decimal
      delta: signalDelta,
      direction: signalDirection,
    },
    
    god: godScore, // Injected, NOT computed
    
    ycPlusPlus,
    
    delta: compositeDelta,
    
    fit: {
      tier: fitTier as 1 | 2 | 3 | 4 | 5,
      bars: fitTier,
    },
    
    status,
    
    action: effectivelyLocked ? 'Unlock' : 'View',
    
    glow: {
      row: rowGlow,
      action: actionGlow,
    },
  };
}

// -----------------------------------------------------------------------------
// FULL VIEW MODEL BUILDER
// -----------------------------------------------------------------------------

/**
 * Build complete RadarViewModel from raw data.
 * This is the ONLY place where data transformation happens.
 * 
 * @param startupId - Startup UUID
 * @param rows - Raw MatchRow[] from RPC
 * @param context - StartupContext from RPC (contains GOD score)
 * @param startupName - Display name
 */
export function buildRadarViewModel(
  startupId: string,
  rows: MatchRow[],
  context: StartupContext | null,
  startupName: string | null = null
): RadarViewModel {
  // --- GOD SCORE ---
  // CRITICAL: Single value from startup_uploads.total_god_score
  // If null/undefined, use 50 as neutral (but log warning)
  const godScore = context?.god?.total ?? 50;
  
  if (context?.god?.total == null) {
    console.warn(
      `[RadarViewModel] GOD score missing for startup ${startupId}. ` +
      `Using fallback 50. This indicates upstream data issue.`
    );
  }
  
  // Map all rows with index for auto-unlock logic
  const mappedRows = rows.map((row, index) => mapMatchRowToRadarRow(row, godScore, index));
  
  // Separate locked/unlocked
  const unlockedRows = mappedRows.filter(r => !r.entity.isLocked);
  const lockedRows = mappedRows.filter(r => r.entity.isLocked);
  
  // Entitlements
  const unlocksRemaining = context?.entitlements?.unlocks_remaining ?? 0;
  
  return {
    startupId,
    startupName,
    godScore,
    unlockedRows,
    lockedRows,
    unlocksRemaining,
    lastUpdated: new Date(),
  };
}

// -----------------------------------------------------------------------------
// HELPER DERIVATIONS (Temporary until proper data sources)
// -----------------------------------------------------------------------------

/**
 * Derive signal direction from momentum_bucket.
 * TODO: Replace with investor_startup_signal.delta_7d sign
 */
function deriveSignalDirection(
  momentum: MatchRow['momentum_bucket']
): 'up' | 'down' | 'flat' {
  switch (momentum) {
    case 'strong':
    case 'emerging':
      return 'up';
    case 'cooling':
    case 'cold':
      return 'down';
    default:
      return 'flat';
  }
}

/**
 * Derive numeric delta from momentum_bucket.
 * TODO: Replace with investor_startup_signal.delta_7d value
 */
function deriveDeltaFromMomentum(
  momentum: MatchRow['momentum_bucket']
): number | null {
  switch (momentum) {
    case 'strong': return 1.2;
    case 'emerging': return 0.5;
    case 'cooling': return -0.3;
    case 'cold': return -0.8;
    default: return null;
  }
}

/**
 * Derive YC++ perception score.
 * TODO: Replace with investor_perception_score.yc_plus_plus from DB
 * 
 * Current logic: signal_score (0-10) × 10 + fit adjustment
 * This is TEMPORARY until proper perception model exists.
 */
function deriveYCPlusScore(row: MatchRow): number {
  const base = (row.signal_score ?? 5) * 10;
  
  const fitAdjustment = {
    high: 12,
    good: 5,
    early: -8,
  }[row.fit_bucket] || 0;
  
  // Clamp to 40-95 (realistic perception range)
  return Math.max(40, Math.min(95, Math.round(base + fitAdjustment)));
}

/**
 * Map fit_bucket to tier (1-5).
 * Source: Eventually from investor_startup_fit.tier
 */
function deriveFitTier(bucket: MatchRow['fit_bucket']): number {
  const tierMap = {
    high: 5,
    good: 4,
    early: 2,
  };
  return tierMap[bucket] || 3;
}

// -----------------------------------------------------------------------------
// DIAGNOSTIC HELPERS
// -----------------------------------------------------------------------------

/**
 * Validate RadarViewModel for contract violations.
 * Use in dev/debug to catch upstream bugs.
 */
export function validateRadarViewModel(vm: RadarViewModel): string[] {
  const issues: string[] = [];
  
  // GOD should not be 100 (likely a bug)
  if (vm.godScore === 100) {
    issues.push('GOD score is exactly 100 - possible aggregation/fallback bug');
  }
  
  // GOD should be consistent across all rows
  const allRows = [...vm.unlockedRows, ...vm.lockedRows];
  const godValues = new Set(allRows.map(r => r.god));
  if (godValues.size > 1) {
    issues.push(`GOD score varies across rows: ${[...godValues].join(', ')} - CONTRACT VIOLATION`);
  }
  
  // Signal should be 0-10
  for (const row of allRows) {
    if (row.signal.value < 0 || row.signal.value > 10) {
      issues.push(`Signal out of range: ${row.signal.value} for investor ${row.investorId}`);
    }
  }
  
  // YC++ should be 0-100
  for (const row of allRows) {
    if (row.ycPlusPlus < 0 || row.ycPlusPlus > 100) {
      issues.push(`YC++ out of range: ${row.ycPlusPlus} for investor ${row.investorId}`);
    }
  }
  
  return issues;
}
