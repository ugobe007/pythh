// ============================================================================
// SIGNALS — FIND INVESTOR SIGNALS — CANONICAL DATA CONTRACT v1
// ============================================================================
// This page REPLACES the match engine.
// It converts a founder's URL into live investor signal intelligence.
//
// Contract principles:
//   1. URL is the only required input
//   2. Results are SIGNALS, not matches (non-judgmental)
//   3. Feels like market telemetry, not recommendations
//   4. Never blank - always show state
// ============================================================================

// -----------------------------------------------------------------------------
// CANONICAL TYPES (Locked per spec)
// -----------------------------------------------------------------------------

/**
 * Page state machine.
 */
export type SignalsPageState = 
  | { mode: 'idle' }                               // Waiting for URL
  | { mode: 'analyzing'; url: string }             // Processing
  | { mode: 'live'; url: string; startupId: string }  // Showing results
  | { mode: 'not_found'; url: string }             // URL didn't resolve
  | { mode: 'error'; url: string; message: string };  // Error state

/**
 * Single row in the signal stream (investor signal).
 */
export interface InvestorSignalRowViewModel {
  // Identity
  signalId: string;
  investorId: string;
  
  // ENTITY column (Investor)
  entity: {
    name: string;
  };
  
  // CONTEXT column (Why they appear, max 60 chars)
  context: string;                    // "AI infrastructure alignment"
  
  // SIGNAL column (0.0-10.0)
  signal: {
    value: number;
    direction: 'up' | 'down' | 'flat';
  };
  
  // FIT column (1-5 bars)
  fit: {
    tier: 1 | 2 | 3 | 4 | 5;
  };
  
  // Freshness
  isNew: boolean;                     // True for first 3-5 seconds
  updatedAt: Date;
  
  // Glow derivation
  glow: {
    base: 'none' | 'cyan';            // Cyan when new/updated
    hover: 'cyan' | 'cyan-green';     // cyan-green if FIT ≥ 4
  };
}

/**
 * Complete Signals page view model.
 */
export interface SignalsViewModel {
  state: SignalsPageState;
  
  // Resolved startup (when state is 'live')
  startup: {
    id: string;
    name: string;
    url: string;
  } | null;
  
  // Signal rows
  rows: InvestorSignalRowViewModel[];
  
  // Live indicator
  isLive: boolean;
  lastUpdateAt: Date | null;
  
  // System messages
  systemMessage: string;              // Current status message
}

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

export const SIGNALS_THRESHOLDS = {
  // Display thresholds
  SIGNAL_HIGH: 7.5,
  FIT_HIGH: 4,
  
  // Freshness
  NEW_DURATION_MS: 5000,              // 5 seconds
  STALE_THRESHOLD_MS: 60000,          // 1 minute
} as const;

export const SYSTEM_MESSAGES = {
  idle: 'Waiting for a startup URL to analyze investor signals…',
  analyzing: 'Analyzing market signals, investor language, and fund activity…',
  live: 'Updated moments ago',
  stale: 'Showing last known signals • Live feed will resume shortly',
  no_signals: 'No strong investor signals detected yet. Monitoring continues…',
  not_found: 'Could not find a startup matching this URL',
  error: 'Something went wrong. Please try again.',
} as const;

// -----------------------------------------------------------------------------
// RAW DATA INTERFACE (from database/RPC)
// -----------------------------------------------------------------------------

export interface InvestorSignalRawData {
  id: string;
  investor_id: string;
  investor_name: string;
  signal_score: number;
  signal_delta?: number | null;
  fit_tier: number;
  reason?: string | null;
  sector_match?: string | null;
  updated_at: string;
}

export interface StartupResolverResult {
  found: boolean;
  startup_id?: string;
  name?: string;
  website?: string;
}

// -----------------------------------------------------------------------------
// MAPPING FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Generate context string for investor signal.
 */
function generateSignalContext(raw: InvestorSignalRawData): string {
  // Use provided reason if available
  if (raw.reason && raw.reason.length <= 60) {
    return raw.reason;
  }
  
  // Generate from sector match
  if (raw.sector_match) {
    return `${raw.sector_match} alignment`;
  }
  
  // Default based on signal strength
  if (raw.signal_score >= SIGNALS_THRESHOLDS.SIGNAL_HIGH) {
    return 'Strong alignment detected';
  }
  
  return 'Pattern detected';
}

/**
 * Map raw data to InvestorSignalRowViewModel.
 */
export function mapRawToInvestorSignalRow(
  raw: InvestorSignalRawData,
  nowMs: number = Date.now()
): InvestorSignalRowViewModel {
  const updatedAt = new Date(raw.updated_at);
  const ageMs = nowMs - updatedAt.getTime();
  const isNew = ageMs <= SIGNALS_THRESHOLDS.NEW_DURATION_MS;
  
  const fitTier = Math.max(1, Math.min(5, raw.fit_tier)) as 1 | 2 | 3 | 4 | 5;
  const isHighFit = fitTier >= SIGNALS_THRESHOLDS.FIT_HIGH;
  
  // Direction from delta
  const direction: 'up' | 'down' | 'flat' = 
    raw.signal_delta != null 
      ? (raw.signal_delta > 0.1 ? 'up' : raw.signal_delta < -0.1 ? 'down' : 'flat')
      : 'flat';
  
  return {
    signalId: raw.id,
    investorId: raw.investor_id,
    
    entity: {
      name: raw.investor_name,
    },
    
    context: generateSignalContext(raw),
    
    signal: {
      value: Math.round(raw.signal_score * 10) / 10,
      direction,
    },
    
    fit: {
      tier: fitTier,
    },
    
    isNew,
    updatedAt,
    
    glow: {
      base: isNew ? 'cyan' : 'none',
      hover: isHighFit ? 'cyan-green' : 'cyan',
    },
  };
}

/**
 * Build complete SignalsViewModel.
 */
export function buildSignalsViewModel(
  state: SignalsPageState,
  startup: { id: string; name: string; url: string } | null,
  rawSignals: InvestorSignalRawData[],
  nowMs: number = Date.now()
): SignalsViewModel {
  // Map signals
  const rows = rawSignals
    .map(raw => mapRawToInvestorSignalRow(raw, nowMs))
    .sort((a, b) => b.signal.value - a.signal.value); // Sort by signal strength
  
  // Determine live status
  const lastUpdate = rows.length > 0 
    ? new Date(Math.max(...rows.map(r => r.updatedAt.getTime())))
    : null;
  const isLive = lastUpdate != null && (nowMs - lastUpdate.getTime()) < SIGNALS_THRESHOLDS.STALE_THRESHOLD_MS;
  
  // System message
  let systemMessage: string;
  switch (state.mode) {
    case 'idle':
      systemMessage = SYSTEM_MESSAGES.idle;
      break;
    case 'analyzing':
      systemMessage = SYSTEM_MESSAGES.analyzing;
      break;
    case 'live':
      if (rows.length === 0) {
        systemMessage = SYSTEM_MESSAGES.no_signals;
      } else if (!isLive) {
        systemMessage = SYSTEM_MESSAGES.stale;
      } else {
        systemMessage = SYSTEM_MESSAGES.live;
      }
      break;
    case 'not_found':
      systemMessage = SYSTEM_MESSAGES.not_found;
      break;
    case 'error':
      systemMessage = state.message || SYSTEM_MESSAGES.error;
      break;
    default:
      systemMessage = '';
  }
  
  return {
    state,
    startup,
    rows,
    isLive,
    lastUpdateAt: lastUpdate,
    systemMessage,
  };
}

// -----------------------------------------------------------------------------
// URL VALIDATION
// -----------------------------------------------------------------------------

/**
 * Validate and normalize startup URL.
 */
export function normalizeStartupUrl(input: string): string | null {
  let url = input.trim();
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    const parsed = new URL(url);
    // Return just the hostname for display
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Extract domain for API call.
 */
export function extractDomainForLookup(input: string): string {
  let url = input.trim();
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return input.trim();
  }
}

// -----------------------------------------------------------------------------
// VALIDATION
// -----------------------------------------------------------------------------

export function validateSignalsViewModel(vm: SignalsViewModel): string[] {
  const issues: string[] = [];
  
  for (const row of vm.rows) {
    // Signal should be 0-10
    if (row.signal.value < 0 || row.signal.value > 10) {
      issues.push(`Signal out of range: ${row.signal.value} for investor ${row.entity.name}`);
    }
    
    // Fit should be 1-5
    if (row.fit.tier < 1 || row.fit.tier > 5) {
      issues.push(`Invalid fit tier: ${row.fit.tier} for investor ${row.entity.name}`);
    }
    
    // Context should not exceed 60 chars
    if (row.context.length > 60) {
      issues.push(`Context too long (${row.context.length} chars) for investor ${row.entity.name}`);
    }
  }
  
  return issues;
}
