/**
 * Fundraising Readiness Engine Types
 * 
 * The Four Immutable States:
 * - WINDOW_FORMING: Signals rising, prepare now
 * - TOO_EARLY: Signals flat, strengthen positioning
 * - COOLING_RISK: Signals cooling, pause & reposition
 * - SHIFTING_AWAY: Attention leaving, delay & reframe
 */

export enum FundraisingState {
  WINDOW_FORMING = 'WINDOW_FORMING',
  TOO_EARLY = 'TOO_EARLY',
  COOLING_RISK = 'COOLING_RISK',
  SHIFTING_AWAY = 'SHIFTING_AWAY',
}

export enum ConfidenceLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum AlertType {
  WINDOW_OPENING = 'WINDOW_OPENING',
  COOLING_DETECTED = 'COOLING_DETECTED',
  SHIFTING_AWAY = 'SHIFTING_AWAY',
  REVERSAL_DETECTED = 'REVERSAL_DETECTED',
}

export interface FundraisingReadinessPayload {
  fundraising_state: FundraisingState;
  confidence: ConfidenceLevel;
  time_estimate: string;
  primary_action: string;
  explanation: string;
  drivers: string[];
  checklist: string[];
  risk_flags: string[];
  prediction: {
    first_inbound_probability: number;
    partner_diligence_window: string;
  };
}

export interface StateMetadata {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

// State-specific metadata for UI rendering
export const STATE_METADATA: Record<FundraisingState, StateMetadata> = {
  [FundraisingState.WINDOW_FORMING]: {
    label: 'Fundraising Window Forming',
    emoji: '🟢',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
  },
  [FundraisingState.TOO_EARLY]: {
    label: 'Not Ready Yet',
    emoji: '🟡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
  },
  [FundraisingState.COOLING_RISK]: {
    label: 'Fundraising Risk Detected',
    emoji: '🔴',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
  [FundraisingState.SHIFTING_AWAY]: {
    label: 'Window Closing',
    emoji: '⚫',
    color: 'text-white/60',
    bgColor: 'bg-white/10',
    borderColor: 'border-white/20',
  },
};
