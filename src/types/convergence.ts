/**
 * CONVERGENCE API TYPES - Single Source of Truth
 * ==============================================
 * All types for /api/discovery/convergence endpoint
 */

export type VelocityClass = 'fast_feedback' | 'building' | 'early' | 'regulated_long';
export type FOMOState = 'watch' | 'warming' | 'surge' | 'breakout';
export type ComparableTier = 'top_5' | 'top_12' | 'top_25' | 'unranked';
export type Confidence = 'low' | 'med' | 'high';
export type SignalState = 'watch' | 'warming' | 'surge' | 'breakout';
export type Stage = 'preseed' | 'seed' | 'series_a' | 'series_b_plus';
export type FitLevel = 'strong' | 'good' | 'weak';
export type AlignmentLevel = 'high' | 'med' | 'low';

export interface StartupInfo {
  id: string;
  url: string;
  name?: string;
  stage_hint?: Stage;
  sector_hint?: string[];
  created_at: string;
}

export interface StatusMetrics {
  velocity_class: VelocityClass;
  signal_strength_0_10: number;
  fomo_state: FOMOState;
  observers_7d: number;
  comparable_tier: ComparableTier;
  phase_change_score_0_1: number;
  confidence: Confidence;
  updated_at: string;
}

export interface FitMetrics {
  stage_fit: FitLevel;
  sector_fit_pct: number;
  portfolio_adjacency: FitLevel;
  velocity_alignment: AlignmentLevel;
}

export interface WhyMatch {
  bullets: string[];
  evidence_tags?: string[];
}

export interface InvestorMatch {
  investor_id: string;
  firm_name: string;
  firm_logo_url?: string;
  partner_name?: string;
  match_score_0_100: number;
  signal_state: SignalState;
  confidence: Confidence;
  signal_age_hours: number;
  fit: FitMetrics;
  why: WhyMatch;
}

export interface HiddenInvestorPreview {
  blurred_id: string;
  stage: Stage;
  sector: string;
  signal_state: SignalState;
}

export interface ComparableStartup {
  startup_id: string;
  name: string;
  stage: string;
  sector: string;
  god_score_0_10: number;
  fomo_state: FOMOState;
  matched_investors: number;
  reason_tags: string[];
}

export interface AlignmentBreakdown {
  team_0_1: number;
  market_0_1: number;
  execution_0_1: number;
  portfolio_0_1: number;
  phase_change_0_1: number;
  message: string;
}

export interface ImproveAction {
  title: string;
  impact_pct: number;
  steps: string[];
  category: 'technical' | 'traction' | 'phase_change' | 'narrative';
}

export interface DebugInfo {
  query_time_ms: number;
  data_sources: string[];
  match_version: string;
}

export interface ConvergenceResponse {
  startup: StartupInfo;
  status: StatusMetrics;
  visible_investors: InvestorMatch[];
  hidden_investors_preview: HiddenInvestorPreview[];
  hidden_investors_total: number;
  comparable_startups: ComparableStartup[];
  alignment: AlignmentBreakdown;
  improve_actions: ImproveAction[];
  debug?: DebugInfo;
}

// Helper type for empty-but-valid responses
export interface EmptyConvergenceResponse extends Partial<ConvergenceResponse> {
  startup: StartupInfo;
  status: StatusMetrics;
  visible_investors: [];
  hidden_investors_preview: [];
  hidden_investors_total: 0;
}
