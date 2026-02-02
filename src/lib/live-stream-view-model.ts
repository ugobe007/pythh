// ============================================================================
// HOME — LIVE MATCHING STREAM — CANONICAL DATA CONTRACT v1
// ============================================================================
// This page exists for TRUST + ALIVENESS, not decision-making.
// It answers: "Is this engine real, active, and worth my attention right now?"
//
// Contract principles:
//   1. Live tape, not dashboard - chronological order only
//   2. Every row = something happening NOW
//   3. No startup-level GOD aggregation
//   4. No YC++ explanation
//   5. Just motion + convergence
// ============================================================================

// -----------------------------------------------------------------------------
// CANONICAL TYPES (Locked per spec)
// -----------------------------------------------------------------------------

/**
 * Single row in Home Live Stream.
 * Represents a live event, not a static match.
 */
export interface LiveStreamRowViewModel {
  // Identity
  eventId: string;
  timestamp: Date;
  
  // ENTITY column
  entity: {
    type: 'investor' | 'startup';
    name: string;
  };
  
  // CONTEXT column (max 60 chars)
  context: string;                    // "Looking at AI infrastructure startups"
  
  // SIGNAL column (0.0-10.0)
  signal: {
    value: number;
    hasArrow: boolean;                // Show ▲ if delta exists
  };
  
  // FIT column (1-5 bars)
  fit: {
    tier: 1 | 2 | 3 | 4 | 5;
  };
  
  // STATUS column
  status: 'LIVE' | 'NEW' | 'COOLING';
  
  // For routing on click
  linkedStartupId: string | null;
  
  // Glow derivation
  glow: {
    base: 'none' | 'cyan-pulse';      // NEW/LIVE get pulse
    hover: 'cyan' | 'cyan-green';     // cyan-green if FIT ≥ 4
  };
  
  // Age in seconds (for status transitions)
  ageSeconds: number;
}

/**
 * Complete Home Live Stream page state.
 */
export interface LiveStreamViewModel {
  rows: LiveStreamRowViewModel[];
  isLive: boolean;                    // True if receiving updates
  lastUpdateAt: Date | null;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
}

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

export const LIVE_STREAM_THRESHOLDS = {
  // Status transitions
  NEW_DURATION_SECONDS: 5,            // NEW status for first 5 seconds
  COOLING_THRESHOLD_SECONDS: 300,     // 5 minutes → COOLING
  
  // Display thresholds
  SIGNAL_HIGH: 7.5,
  FIT_HIGH: 4,
} as const;

// Context templates (for generating plausible contexts from event data)
export const CONTEXT_TEMPLATES = {
  sector_interest: (sector: string) => `Looking at ${sector} startups`,
  activity_spike: (sector: string) => `Recent activity in ${sector}`,
  velocity_spike: (stage: string) => `${stage} velocity spike detected`,
  portfolio_match: () => `Portfolio adjacency match`,
  thesis_alignment: (focus: string) => `${focus} thesis alignment`,
} as const;

// -----------------------------------------------------------------------------
// RAW DATA INTERFACE (from database/RPC/realtime)
// -----------------------------------------------------------------------------

export interface LiveStreamRawEvent {
  id: string;
  created_at: string;                 // ISO timestamp
  event_type: 'match' | 'signal_spike' | 'activity' | 'convergence';
  
  // Entity (one of these will be primary)
  investor_id?: string | null;
  investor_name?: string | null;
  startup_id?: string | null;
  startup_name?: string | null;
  
  // Metrics
  signal_score?: number | null;
  fit_tier?: number | null;
  has_delta?: boolean;
  
  // Context
  reason?: string | null;
  sector?: string | null;
  stage?: string | null;
}

// -----------------------------------------------------------------------------
// MAPPING FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Derive status from event age.
 */
function deriveStatus(ageSeconds: number): 'LIVE' | 'NEW' | 'COOLING' {
  if (ageSeconds <= LIVE_STREAM_THRESHOLDS.NEW_DURATION_SECONDS) {
    return 'NEW';
  }
  if (ageSeconds >= LIVE_STREAM_THRESHOLDS.COOLING_THRESHOLD_SECONDS) {
    return 'COOLING';
  }
  return 'LIVE';
}

/**
 * Generate context string from event data.
 */
function generateContext(raw: LiveStreamRawEvent): string {
  // Use provided reason if available
  if (raw.reason && raw.reason.length <= 60) {
    return raw.reason;
  }
  
  // Generate from event type + metadata
  switch (raw.event_type) {
    case 'signal_spike':
      if (raw.sector) return CONTEXT_TEMPLATES.sector_interest(raw.sector);
      return 'Signal activity detected';
    case 'activity':
      if (raw.sector) return CONTEXT_TEMPLATES.activity_spike(raw.sector);
      return 'Recent activity spike';
    case 'convergence':
      return CONTEXT_TEMPLATES.portfolio_match();
    case 'match':
    default:
      if (raw.sector) return CONTEXT_TEMPLATES.thesis_alignment(raw.sector);
      return 'Alignment detected';
  }
}

/**
 * Map raw event to LiveStreamRowViewModel.
 */
export function mapRawToLiveStreamRow(
  raw: LiveStreamRawEvent,
  nowMs: number = Date.now()
): LiveStreamRowViewModel {
  const eventTime = new Date(raw.created_at);
  const ageSeconds = Math.floor((nowMs - eventTime.getTime()) / 1000);
  
  // Determine entity (prefer investor as per spec)
  const entityType: 'investor' | 'startup' = raw.investor_name ? 'investor' : 'startup';
  const entityName = raw.investor_name || raw.startup_name || 'Unknown';
  
  // Metrics with defaults
  const signal = raw.signal_score ?? 5.0;
  const fitTier = (raw.fit_tier ?? 3) as 1 | 2 | 3 | 4 | 5;
  
  // Status from age
  const status = deriveStatus(ageSeconds);
  
  // Glow rules
  const isHighFit = fitTier >= LIVE_STREAM_THRESHOLDS.FIT_HIGH;
  const isActive = status === 'LIVE' || status === 'NEW';
  
  return {
    eventId: raw.id,
    timestamp: eventTime,
    
    entity: {
      type: entityType,
      name: entityName,
    },
    
    context: generateContext(raw),
    
    signal: {
      value: Math.round(signal * 10) / 10,
      hasArrow: raw.has_delta ?? false,
    },
    
    fit: {
      tier: fitTier,
    },
    
    status,
    
    linkedStartupId: raw.startup_id || null,
    
    glow: {
      base: isActive ? 'cyan-pulse' : 'none',
      hover: isHighFit ? 'cyan-green' : 'cyan',
    },
    
    ageSeconds,
  };
}

/**
 * Build complete LiveStreamViewModel from raw events.
 * Events are sorted chronologically (most recent first).
 */
export function buildLiveStreamViewModel(
  rawEvents: LiveStreamRawEvent[],
  isLive: boolean = true,
  nowMs: number = Date.now()
): LiveStreamViewModel {
  // Map and sort by timestamp (most recent first)
  const rows = rawEvents
    .map(raw => mapRawToLiveStreamRow(raw, nowMs))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return {
    rows,
    isLive,
    lastUpdateAt: rows.length > 0 ? rows[0].timestamp : null,
    connectionStatus: isLive ? 'connected' : 'disconnected',
  };
}

// -----------------------------------------------------------------------------
// PLACEHOLDER ROWS (for empty state)
// -----------------------------------------------------------------------------

export function createPlaceholderRows(): LiveStreamRowViewModel[] {
  const now = new Date();
  return [
    {
      eventId: 'placeholder-1',
      timestamp: now,
      entity: { type: 'investor', name: '—' },
      context: 'Waiting for live market signals…',
      signal: { value: 0, hasArrow: false },
      fit: { tier: 3 },
      status: 'COOLING',
      linkedStartupId: null,
      glow: { base: 'none', hover: 'cyan' },
      ageSeconds: 0,
    },
    {
      eventId: 'placeholder-2',
      timestamp: now,
      entity: { type: 'investor', name: '—' },
      context: '',
      signal: { value: 0, hasArrow: false },
      fit: { tier: 3 },
      status: 'COOLING',
      linkedStartupId: null,
      glow: { base: 'none', hover: 'cyan' },
      ageSeconds: 0,
    },
    {
      eventId: 'placeholder-3',
      timestamp: now,
      entity: { type: 'investor', name: '—' },
      context: '',
      signal: { value: 0, hasArrow: false },
      fit: { tier: 3 },
      status: 'COOLING',
      linkedStartupId: null,
      glow: { base: 'none', hover: 'cyan' },
      ageSeconds: 0,
    },
  ];
}

// -----------------------------------------------------------------------------
// VALIDATION
// -----------------------------------------------------------------------------

export function validateLiveStreamViewModel(vm: LiveStreamViewModel): string[] {
  const issues: string[] = [];
  
  for (const row of vm.rows) {
    // Signal should be 0-10
    if (row.signal.value < 0 || row.signal.value > 10) {
      issues.push(`Signal out of range: ${row.signal.value} for event ${row.eventId}`);
    }
    
    // Fit should be 1-5
    if (row.fit.tier < 1 || row.fit.tier > 5) {
      issues.push(`Invalid fit tier: ${row.fit.tier} for event ${row.eventId}`);
    }
    
    // Context should not exceed 60 chars
    if (row.context.length > 60) {
      issues.push(`Context too long (${row.context.length} chars) for event ${row.eventId}`);
    }
  }
  
  return issues;
}
