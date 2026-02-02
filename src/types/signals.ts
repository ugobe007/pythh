/**
 * PYTHH SIGNAL RADAR TYPES
 * ========================
 * Complete type system for the canonical signal surface.
 * Maps directly to API contracts: Global Observatory, Inject, Tracking.
 */

// ============================================================================
// MODE & STATE MACHINE
// ============================================================================

export type SurfaceMode = 'global' | 'injecting' | 'reveal' | 'tracking';

// ============================================================================
// API RESPONSE SHAPES (Direct from contracts)
// ============================================================================

// Shared channel definition
export interface ChannelState {
  id: string;
  label: string;
  value: number; // 0-100
  delta: number; // signed change
  direction: 'up' | 'down' | 'flat';
  volatility: number; // 0-1
  last_updated_at: string; // ISO 8601
  confidence: number; // 0-1
}

// Radar event (for blips + causality)
export interface RadarEvent {
  id: string;
  type: 'ingestion' | 'alignment' | 'phase_change';
  magnitude: number; // 0-1 (size of blip)
  timestamp: string;
  channel_impacts: {
    channel_id: string;
    delta: number;
  }[];
}

// Causal feed item (right column)
export interface FeedItem {
  id: string;
  text: string;
  timestamp: string;
  confidence: number; // 0-1
  impacts: {
    channel_id: string;
    delta: number;
  }[];
}

// Investor alignment arc
export interface AlignmentArc {
  id: string;
  strength: number; // 0-1
}

// Phase change indicator (convergence ring)
export interface PhaseChange {
  id: string;
  magnitude: number; // 0-1
  timestamp: string;
}

// Panel data (reveals)
export interface FundraisingWindowPanel {
  state: 'closed' | 'opening' | 'open' | 'peak' | 'closing';
  start_days: number;
  end_days: number;
}

export interface AlignmentPanel {
  count: number;
  delta: number;
}

export interface PowerPanel {
  score: number;
  delta: number;
  percentile: number;
}

// Next moves item
export interface NextMoveItem {
  text: string;
  impacts: {
    channel_id: string;
    delta: number;
  }[];
}

// Startup identity
export interface StartupIdentity {
  id: string;
  name: string;
  domain: string;
  initials: string;
  category: string;
  stage: string;
}

// ============================================================================
// API ENDPOINT RESPONSES
// ============================================================================

// GET /api/v1/observatory
export interface GlobalObservatoryResponse {
  ok: boolean;
  cursor: string;
  generated_at: string;
  channels: ChannelState[];
  radar: {
    events: RadarEvent[];
  };
  feed: FeedItem[];
  error_code?: string;
}

// POST /api/v1/startups/resolve
export interface ResolveStartupResponse {
  ok: boolean;
  startup?: StartupIdentity;
  error_code?: 'NOT_FOUND' | 'INVALID_URL' | 'AMBIGUOUS';
  message?: string;
  candidates?: StartupIdentity[];
}

// POST /api/v1/scans
export interface CreateScanResponse {
  ok: boolean;
  scan: {
    scan_id: string;
    status: 'building' | 'ready' | 'failed';
    created_at: string;
    eta_hint_ms?: number;
  };
}

// GET /api/v1/scans/{scan_id}
export interface GetScanResponse {
  ok: boolean;
  scan_id: string;
  status: 'building' | 'ready' | 'failed';
  progress?: {
    stage: string;
    pct: number;
  };
  startup?: StartupIdentity;
  panels?: {
    fundraising_window?: FundraisingWindowPanel;
    alignment?: AlignmentPanel;
    power?: PowerPanel;
  };
  channels?: ChannelState[];
  radar?: {
    events: RadarEvent[];
    arcs?: AlignmentArc[];
    phase_change?: PhaseChange | null;
  };
  next_moves?: {
    items: NextMoveItem[];
  };
  feed?: FeedItem[];
  generated_at?: string;
  error_code?: string;
  message?: string;
}

// GET /api/v1/startups/{startup_id}/tracking
export interface TrackingUpdateResponse {
  ok: boolean;
  startup_id: string;
  cursor: string;
  generated_at: string;
  panels: {
    fundraising_window?: FundraisingWindowPanel;
    alignment?: AlignmentPanel;
    power?: PowerPanel;
  };
  channels?: ChannelState[];
  radar?: {
    events: RadarEvent[];
    arcs?: AlignmentArc[];
    phase_change?: PhaseChange | null;
  };
  feed?: FeedItem[];
}

// POST /api/v1/alerts/subscribe
export interface AlertSubscribeResponse {
  ok: boolean;
  subscription_id?: string;
  error_code?: string;
}

// ============================================================================
// UNIFIED VIEWMODEL (Single Source of Truth)
// ============================================================================

export interface SurfaceViewModel {
  // Mode machine
  mode: SurfaceMode;

  // Startup identity (only set in inject/reveal/tracking)
  startup?: {
    id: string;
    name: string;
    initials: string;
    category?: string;
    stage?: string;
  };

  // Left column: channels
  channels: ChannelState[];

  // Center column: radar
  radar: {
    you?: {
      initials: string;
      intensity: number; // 0-1, derived from power delta
    };
    events: RadarEvent[];
    arcs: AlignmentArc[];
    phase_change?: PhaseChange | null;
    sweep_speed: number; // 1.0 = baseline, 1.8 = injecting
  };

  // Right column: reveal panels (only in reveal/tracking)
  panels?: {
    fundraising_window?: FundraisingWindowPanel;
    alignment?: AlignmentPanel;
    power?: PowerPanel;
  };

  // Next moves (only in reveal/tracking)
  next_moves?: {
    items: NextMoveItem[];
  };

  // Causal feed (all modes)
  feed: FeedItem[];

  // Email capture state
  email_capture: {
    eligible: boolean; // show after ~4-8s in reveal mode
    show: boolean;
  };
}

// ============================================================================
// INTERNAL STATE (Page-level orchestration)
// ============================================================================

export interface PageState {
  view_model: SurfaceViewModel;
  scan_id?: string; // In flight during injecting
  global_cursor?: string; // For polling observatory
  tracking_cursor?: string; // For polling tracking updates
  animation_state: {
    injection_start_time?: number;
    reveal_start_time?: number;
    tracking_start_time?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// LEGACY TYPES (Keep for backwards compatibility)
// ============================================================================

export interface SignalStrength {
  level: 'strong' | 'medium' | 'emerging' | 'watching';
  score: number;
  emoji: string;
  label: string;
  color: string;
}

export interface MatchBreakdown {
  portfolioFit: number;
  stageMatch: number;
  sectorVelocity: number;
  geoFit: number;
}

export interface SignalComposition {
  recentActivity: number;
  portfolioAdjacency: number;
  thesisAlignment: number;
  stageMatch: number;
}

export interface Prediction {
  outreachProbability: number;
  likelyTimeframe: string;
  trigger?: string;
}

export interface RecentContext {
  date: string;
  event: string;
}

export interface InvestorProfile {
  id: string;
  name: string;
  firm: string;
  title: string;
  initials: string;
  avatarUrl?: string;
  practice?: string;
}

export interface SignalResult {
  investor: InvestorProfile;
  signalStrength: number;
  timestamp: Date;
  lookingFor: string[];
  matchBreakdown: MatchBreakdown;
  composition: SignalComposition;
  prediction: Prediction;
  recentContext: RecentContext[];
  expanded?: boolean;
}

export interface SignalSummary {
  totalSignals: number;
  strongMatches: number;
  topSignal: number;
  estimatedDays: string;
}

export interface Recommendation {
  id: string;
  title: string;
  impact: string;
  impactScore: number;
  impactCategory: 'GOD' | 'sector' | 'alignment' | 'adjacency';
  timeframe: 'immediate' | 'strategic';
  currentState: string[];
  benefit: string;
  affectedInvestors: number;
  topInvestors: string[];
  actionItems: string[];
  timeInvestment?: string;
  ctas: RecommendationCTA[];
}

export interface RecommendationCTA {
  label: string;
  action: string;
}

export interface LockedSignalsData {
  count: number;
  breakdown: {
    topTier: number;
    specialists: number;
    corporate: number;
  };
  medianStrength: number;
  avgTimeframe: string;
}
