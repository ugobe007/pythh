// ============================================================================
// BASE TYPES
// ============================================================================

export type UUID = string;
export type SurfaceMode = "global" | "injecting" | "reveal" | "tracking";
export type Direction = "up" | "down" | "flat";

export type ChannelState = {
  id: string;
  label: string;
  value: number; // 0–100
  delta: number; // signed
  direction: Direction;
  volatility: number; // 0–1
  lastUpdatedAt: string; // ISO
  confidence: number; // 0–1
};

export type RadarEventType = "ingestion" | "alignment" | "phase_change";

export type RadarEvent = {
  id: string;
  type: RadarEventType;
  magnitude: number; // 0–1
  timestamp: string; // ISO
  channelImpacts: { channelId: string; delta: number }[];
};

export type FeedItem = {
  id: string;
  text: string;
  timestamp: string; // ISO
  confidence: number; // 0–1
  impacts: { channelId: string; delta: number }[];
};

export type StartupIdentity = {
  id: string;
  name: string;
  initials: string;
  category?: string;
  stage?: string;
};

export type SurfaceViewModel = {
  mode: SurfaceMode;

  startup?: StartupIdentity;

  channels: ChannelState[];

  radar: {
    sweepSpeed: number; // 1.0 baseline, >1 faster
    you?: { initials: string; intensity: number }; // 0–1
    events: RadarEvent[];
    arcs: { id: string; strength: number }[];
    phaseChange?: { id: string; magnitude: number; timestamp: string } | null;
  };

  panels?: {
    fundraisingWindow?: { state: "closed" | "opening" | "open" | "peak" | "closing"; startDays: number; endDays: number };
    alignment?: { count: number; delta: number };
    power?: { score: number; delta: number; percentile?: number };
  };

  nextMoves?: {
    items: { text: string; impacts: { channelId: string; delta: number }[] }[];
  };

  // Live matches from the matching engine (4.5M+ pre-calculated matches)
  matches?: MatchRecord[];
  matchesTotal?: number;

  feed: FeedItem[];

  // Animation triggers (UI-only)
  pulseSeq: number; // increment to trigger micro-jitter everywhere
};

// ============================================================================
// API CONTRACTS (locked, prevent drift between prose and code)
// ============================================================================

// POST /api/v1/startups/resolve
export type ResolveStartupRequest = { url: string };
export type ResolveStartupResponse = {
  ok: boolean;
  startup?: StartupIdentity;
  reason?: string; // "NOT_FOUND" | "INVALID_URL" | "AMBIGUOUS"
};

// POST /api/v1/scans
export type CreateScanRequest = { startup_id: UUID };
export type CreateScanResponse = {
  ok: boolean;
  scan?: { scan_id: UUID; status: "building" | "ready" | "failed" };
  reason?: string;
};

// GET /api/v1/scans/{scan_id}
export type GetScanResponse = {
  ok: boolean;
  status: "building" | "ready" | "failed";
  cursor?: string; // For subsequent tracking polls
  vm?: Partial<SurfaceViewModel>; // Startup identity + panels + channels + radar
  reason?: string;
};

// GET /api/v1/startups/{startup_id}/tracking
export type TrackingUpdateResponse = {
  ok: boolean;
  cursor: string; // For next poll
  delta: Partial<SurfaceViewModel>; // Only changed fields (channels, panels, feed, radar)
  reason?: string;
};

// POST /api/v1/alerts/subscribe
export type AlertSubscribeRequest = { startup_id: UUID; email: string };
export type AlertSubscribeResponse = {
  ok: boolean;
  subscription_id?: UUID;
  reason?: string;
};

// ============================================================================
// LIVE MATCHING ENGINE
// ============================================================================

export type InvestorProfile = {
  id: UUID;
  name: string;
  firm?: string;
  photo_url?: string | null;
  linkedin_url?: string | null;
  sectors: string[];
  stage: string[];
  check_size_min?: number | null;
  check_size_max?: number | null;
  type?: string | null;
  notable_investments?: string[] | null;
  investment_thesis?: string | null;
};

export type MatchRecord = {
  id: UUID;
  startup_id: UUID;
  investor_id: UUID;
  investor: InvestorProfile;
  match_score: number; // 0-100
  reasoning?: string;
  why_you_match?: string[];
  fit_analysis?: {
    stage_fit: boolean;
    sector_fit: boolean;
    check_size_fit: boolean;
    geography_fit: boolean;
  };
  status: "suggested" | "viewed" | "saved" | "contacted" | "rejected";
  created_at: string; // ISO
};

// GET /api/v1/startups/{startup_id}/matches
export type GetLiveMatchesRequest = { startup_id: UUID; limit?: number };
export type GetLiveMatchesResponse = {
  ok: boolean;
  matches: MatchRecord[];
  total_count: number;
  reason?: string;
};
