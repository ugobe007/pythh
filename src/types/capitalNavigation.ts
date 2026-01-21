export type MomentumState = "watch" | "warming" | "surge" | "breakout";
export type FlowState = "quiet" | "forming" | "concentrating" | "surging" | "saturated";
export type DirectionState = "outbound" | "stable" | "incoming" | "strongly_incoming";
export type PositionState = "invisible" | "emerging" | "aligned" | "hot" | "crowded";
export type ConfidenceLevel = "low" | "medium" | "high";

export type AlignmentKey =
  | "team"
  | "market"
  | "execution"
  | "portfolio_adjacency"
  | "phase_change";

export type AlignmentMetric = {
  key: AlignmentKey;
  label: string;
  value01: number; // 0..1
  why?: string;
};

export type NavigationTriadData = {
  startupName?: string;
  url?: string;

  // Triad
  positionState: PositionState;
  flowState: FlowState;
  directionState: DirectionState;

  // Core metrics
  observers7d?: number | null; // null/undefined means unknown; 0 means confirmed 0
  activeInvestorsVisible?: number | null;
  activeInvestorsTotal?: number | null;

  // Scores
  positionScore01?: number; // 0..1
  flowScore01?: number; // 0..1
  trajectoryScore01?: number; // 0..1 (for gauge)
  alignment01?: number; // 0..1

  // Confidence + freshness heartbeat
  signalQuality01?: number; // 0..1
  confidence: ConfidenceLevel;
  latestIntentTraceHours?: number | null; // null = unknown; 0.. = known
};

export type ScanStepState = "pending" | "active" | "done" | "degraded";

export type ScanPlaybackData = {
  domainLabel: string; // e.g. automax.ai
  steps: Array<{
    id: "normalize" | "infer" | "collect" | "resolve";
    title: string;
    detail: string;
    state: ScanStepState;
  }>;
  summaryLines?: string[]; // small feed lines beneath
};

export type IntentTracePoint = {
  label: string; // e.g. "Mon"
  value: number; // 0..N
};

export type IntentTraceSeries = {
  title: string;
  points: IntentTracePoint[];
};

export type ConvergenceArchetypeCard = {
  title: string; // "US Seed Infra Specialist"
  fitScore: number; // 0..100
  state: MomentumState; // watch/warming/surge/breakout (still useful)
  evidence: string[]; // 1-3 bullets
  lockedReason: string; // "Identity locked until resolution completes"
};

export type DegradedStatus = {
  isDegraded: boolean;
  reasonCode?: string; // e.g. match_query_failed
  message?: string;
  retryHintSeconds?: number;
};
