// ============================================================================
// STARTUP SELECT — CANONICAL DATA CONTRACT v1
// ============================================================================
// This page is STARTUP-LEVEL AGGREGATION.
// No investor-specific values appear here.
// Answers: "Which startup is most ready + moving + attractive right now?"
//
// Contract principles:
//   1. All values are startup-level (no investor rows)
//   2. No UI computations - all scores from server
//   3. READINESS tells founders "what to do next"
//   4. Default sort: READINESS desc → SIGNAL desc → Δ desc → MATCHES desc
// ============================================================================

// -----------------------------------------------------------------------------
// CANONICAL TYPES (Locked per spec)
// -----------------------------------------------------------------------------

/**
 * Single row in Startup Select table.
 * All values are startup-level aggregates.
 */
export interface StartupSelectRowViewModel {
  // Identity
  startupId: string;
  
  // ENTITY column
  entity: {
    name: string;                    // startup.name
    context: string | null;          // "AI/ML · Seed" (sector + stage, max 60 chars)
  };
  
  // SIGNAL column (movement benchmark, 0.0-10.0)
  signal: {
    value: number;                   // startup_signal_aggregate.signal_score
    direction: 'up' | 'down' | 'flat';
  };
  
  // GOD column (position benchmark, 0-100)
  god: number | null;                // startup_god_score.total (null → display "—")
  
  // YC++ column (optics benchmark, 0-100)
  ycPlusPlus: number | null;         // startup_yc_aggregate.yc_plus_plus
  
  // Δ column (surface tension / change)
  delta: number | null;              // startup_signal_aggregate.delta_7d
  
  // READINESS column (1-5)
  readiness: {
    tier: 1 | 2 | 3 | 4 | 5;
    label: string;                   // "Outreach now" | "Shortlist" | etc.
  };
  
  // MATCHES column (volume)
  matchCount: number;                // startup_match_summary.match_count
  
  // ACTION
  action: 'Enter';                   // Always "Enter" for this page
  
  // Glow derivation
  glow: {
    hover: 'cyan' | 'cyan-green';    // cyan-green if READINESS ≥ 4
  };
}

/**
 * Complete Startup Select page state.
 */
export interface StartupSelectViewModel {
  rows: StartupSelectRowViewModel[];
  sortedBy: SortKey;
  sortDirection: 'asc' | 'desc';
  totalCount: number;
  loading: boolean;
}

export type SortKey = 'readiness' | 'signal' | 'delta' | 'matches' | 'god' | 'ycPlusPlus';

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

export const STARTUP_SELECT_THRESHOLDS = {
  // READINESS tier rubric
  GOD_THRESHOLD: 70,       // +1 if GOD ≥ 70
  YC_THRESHOLD: 70,        // +1 if YC++ ≥ 70
  SIGNAL_THRESHOLD: 6,     // +1 if SIGNAL ≥ 6
  DELTA_NEGATIVE: -0.5,    // -1 if Δ < this
  
  // Display thresholds
  SIGNAL_HIGH: 7.5,
  SIGNAL_ACTIVE: 5.5,
  GOD_EXCELLENT: 80,
  GOD_GOOD: 60,
  YC_EXCELLENT: 80,
  YC_GOOD: 60,
} as const;

export const READINESS_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'Outreach now',
  4: 'Shortlist',
  3: 'Improve one lever',
  2: 'Reposition',
  1: 'Not ready',
};

// Default sort order (locked per spec)
export const DEFAULT_SORT: { key: SortKey; direction: 'desc' }[] = [
  { key: 'readiness', direction: 'desc' },
  { key: 'signal', direction: 'desc' },
  { key: 'delta', direction: 'desc' },
  { key: 'matches', direction: 'desc' },
];

// -----------------------------------------------------------------------------
// RAW DATA INTERFACE (from database/RPC)
// -----------------------------------------------------------------------------

export interface StartupSelectRawData {
  id: string;
  name: string;
  sectors?: string[] | null;
  stage?: string | null;
  total_god_score?: number | null;
  signal_score?: number | null;
  signal_delta_7d?: number | null;
  yc_plus_plus?: number | null;
  readiness_tier?: number | null;
  match_count?: number | null;
}

// -----------------------------------------------------------------------------
// MAPPING FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Calculate READINESS tier from scores (server-side logic replicated for reference).
 * In production, this should come from startup_readiness.tier in the database.
 */
export function calculateReadinessTier(
  god: number | null,
  ycPlusPlus: number | null,
  signal: number | null,
  delta: number | null
): 1 | 2 | 3 | 4 | 5 {
  let tier = 3; // Base
  
  if (god != null && god >= STARTUP_SELECT_THRESHOLDS.GOD_THRESHOLD) tier++;
  if (ycPlusPlus != null && ycPlusPlus >= STARTUP_SELECT_THRESHOLDS.YC_THRESHOLD) tier++;
  if (signal != null && signal >= STARTUP_SELECT_THRESHOLDS.SIGNAL_THRESHOLD) tier++;
  if (delta != null && delta < STARTUP_SELECT_THRESHOLDS.DELTA_NEGATIVE) tier--;
  
  return Math.max(1, Math.min(5, tier)) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Build context string from sector + stage.
 */
function buildContext(sectors: string[] | null | undefined, stage: string | null | undefined): string | null {
  const parts: string[] = [];
  
  if (sectors && sectors.length > 0) {
    parts.push(sectors[0]); // Primary sector only
  }
  
  if (stage) {
    parts.push(stage);
  }
  
  if (parts.length === 0) return null;
  
  const context = parts.join(' · ');
  return context.length > 60 ? context.slice(0, 57) + '...' : context;
}

/**
 * Derive signal direction from delta.
 */
function deriveDirection(delta: number | null): 'up' | 'down' | 'flat' {
  if (delta == null) return 'flat';
  if (delta > 0.1) return 'up';
  if (delta < -0.1) return 'down';
  return 'flat';
}

/**
 * Map raw database row to StartupSelectRowViewModel.
 */
export function mapRawToStartupSelectRow(raw: StartupSelectRawData): StartupSelectRowViewModel {
  // Extract values with null safety
  const god = raw.total_god_score ?? null;
  const signal = raw.signal_score ?? 5.0;
  const ycPlusPlus = raw.yc_plus_plus ?? null;
  const delta = raw.signal_delta_7d ?? null;
  const matchCount = raw.match_count ?? 0;
  
  // Use server-provided readiness or calculate
  const readinessTier = (raw.readiness_tier as 1 | 2 | 3 | 4 | 5) ?? 
    calculateReadinessTier(god, ycPlusPlus, signal, delta);
  
  // Validate GOD score (prevent 100 bug)
  let validatedGod = god;
  if (god != null && (god > 100 || god < 0)) {
    console.warn(`[StartupSelect] Invalid GOD score ${god} for startup ${raw.id}`);
    validatedGod = null;
  }
  
  return {
    startupId: raw.id,
    
    entity: {
      name: raw.name,
      context: buildContext(raw.sectors, raw.stage),
    },
    
    signal: {
      value: Math.round(signal * 10) / 10, // 1 decimal
      direction: deriveDirection(delta),
    },
    
    god: validatedGod,
    
    ycPlusPlus,
    
    delta: delta != null ? Math.round(delta * 10) / 10 : null,
    
    readiness: {
      tier: readinessTier,
      label: READINESS_LABELS[readinessTier],
    },
    
    matchCount,
    
    action: 'Enter',
    
    glow: {
      hover: readinessTier >= 4 ? 'cyan-green' : 'cyan',
    },
  };
}

/**
 * Build complete StartupSelectViewModel from raw data.
 */
export function buildStartupSelectViewModel(
  rawData: StartupSelectRawData[],
  sortKey: SortKey = 'readiness',
  sortDirection: 'asc' | 'desc' = 'desc'
): StartupSelectViewModel {
  // Map all rows
  const rows = rawData.map(mapRawToStartupSelectRow);
  
  // Sort according to spec
  const sortedRows = sortStartupSelectRows(rows, sortKey, sortDirection);
  
  return {
    rows: sortedRows,
    sortedBy: sortKey,
    sortDirection,
    totalCount: rows.length,
    loading: false,
  };
}

/**
 * Sort rows by specified key.
 */
export function sortStartupSelectRows(
  rows: StartupSelectRowViewModel[],
  key: SortKey,
  direction: 'asc' | 'desc'
): StartupSelectRowViewModel[] {
  const multiplier = direction === 'desc' ? -1 : 1;
  
  return [...rows].sort((a, b) => {
    let aVal: number;
    let bVal: number;
    
    switch (key) {
      case 'readiness':
        aVal = a.readiness.tier;
        bVal = b.readiness.tier;
        break;
      case 'signal':
        aVal = a.signal.value;
        bVal = b.signal.value;
        break;
      case 'delta':
        aVal = a.delta ?? 0;
        bVal = b.delta ?? 0;
        break;
      case 'matches':
        aVal = a.matchCount;
        bVal = b.matchCount;
        break;
      case 'god':
        aVal = a.god ?? 0;
        bVal = b.god ?? 0;
        break;
      case 'ycPlusPlus':
        aVal = a.ycPlusPlus ?? 0;
        bVal = b.ycPlusPlus ?? 0;
        break;
      default:
        return 0;
    }
    
    return (aVal - bVal) * multiplier;
  });
}

// -----------------------------------------------------------------------------
// VALIDATION
// -----------------------------------------------------------------------------

export function validateStartupSelectViewModel(vm: StartupSelectViewModel): string[] {
  const issues: string[] = [];
  
  for (const row of vm.rows) {
    // GOD should not be exactly 100
    if (row.god === 100) {
      issues.push(`GOD=100 for startup ${row.startupId} (${row.entity.name})`);
    }
    
    // Signal should be 0-10
    if (row.signal.value < 0 || row.signal.value > 10) {
      issues.push(`Signal out of range: ${row.signal.value} for ${row.entity.name}`);
    }
    
    // YC++ should be 0-100 if present
    if (row.ycPlusPlus != null && (row.ycPlusPlus < 0 || row.ycPlusPlus > 100)) {
      issues.push(`YC++ out of range: ${row.ycPlusPlus} for ${row.entity.name}`);
    }
    
    // Readiness should be 1-5
    if (row.readiness.tier < 1 || row.readiness.tier > 5) {
      issues.push(`Invalid readiness tier: ${row.readiness.tier} for ${row.entity.name}`);
    }
  }
  
  return issues;
}
