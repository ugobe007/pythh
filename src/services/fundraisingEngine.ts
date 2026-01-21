/**
 * Fundraising Readiness Engine
 * 
 * Decision System: Maps capital signals → founder action
 * 
 * Classification Logic:
 * - WINDOW_FORMING: trajectory incoming + clustering rising + high confidence
 * - TOO_EARLY: flat signals + low clustering + no peer breakout
 * - COOLING_RISK: negative slope + falling activity + peer rising
 * - SHIFTING_AWAY: sector rotation + attention shifting + trajectory outbound
 */

import type { NavigationTriadData } from '../types/capitalNavigation';
import type { DemoScenario } from '../data/demoScenarios';
import {
  FundraisingState,
  ConfidenceLevel,
  type FundraisingReadinessPayload,
} from '../types/fundraisingReadiness';

interface ClassificationInputs {
  triad: NavigationTriadData | DemoScenario['triad'];
  observerCount7d?: number;
  momentum?: string;
  activeInvestors?: number;
  latestSignalAge?: string;
}

/**
 * Core Decision Engine
 * Maps capital navigation signals to fundraising readiness state
 */
export function classifyFundraisingState(inputs: ClassificationInputs): FundraisingReadinessPayload {
  const { triad } = inputs;
  
  // Handle both NavigationTriadData and DemoScenario triad formats
  const isDemoFormat = 'position' in triad && 'flow' in triad && 'trajectory' in triad;
  
  // Extract key signals from triad (normalize both formats)
  const trajectoryDirection = isDemoFormat
    ? (triad as DemoScenario['triad']).trajectory.direction.toLowerCase().replace(' ', '_')
    : (triad as NavigationTriadData).directionState || 'stable';
    
  const positionScore = isDemoFormat
    ? (triad as DemoScenario['triad']).position.score
    : (triad as NavigationTriadData).positionScore01 ?? 0.5;
    
  const flowScore = isDemoFormat
    ? (triad as DemoScenario['triad']).flow.score
    : (triad as NavigationTriadData).flowScore01 ?? 0.5;
    
  const trajectoryScore = isDemoFormat
    ? (triad as DemoScenario['triad']).trajectory.outreach_probability / 100
    : (triad as NavigationTriadData).trajectoryScore01 ?? 0.5;
    
  const alignmentScore = isDemoFormat
    ? (triad as DemoScenario['triad']).alignment.score
    : (triad as NavigationTriadData).alignment01 ?? 0.5;
  
  // Calculate confidence (weighted mean of signal quality indicators)
  const confidenceRaw = (
    positionScore * 0.25 +
    flowScore * 0.35 +
    trajectoryScore * 0.25 +
    alignmentScore * 0.15
  );
  
  const confidence = 
    confidenceRaw >= 0.65 ? ConfidenceLevel.HIGH :
    confidenceRaw >= 0.45 ? ConfidenceLevel.MEDIUM :
    ConfidenceLevel.LOW;

  // State Classification Logic
  
  // WINDOW_FORMING: Signals rising + high confidence
  if (
    (trajectoryDirection === 'strongly_incoming' || trajectoryDirection === 'incoming') &&
    flowScore >= 0.55 &&
    trajectoryScore >= 0.5 &&
    confidenceRaw >= 0.65
  ) {
    return buildWindowFormingPayload(
      trajectoryDirection,
      positionScore,
      flowScore,
      trajectoryScore,
      alignmentScore,
      confidence,
      confidenceRaw
    );
  }
  
  // COOLING_RISK: Flow declining + trajectory weak
  if (
    flowScore < 0.4 &&
    (trajectoryDirection === 'stable' || trajectoryDirection === 'outbound') &&
    positionScore >= 0.4 // had momentum before
  ) {
    return buildCoolingRiskPayload(
      trajectoryDirection,
      positionScore,
      flowScore,
      trajectoryScore,
      alignmentScore,
      confidence,
      confidenceRaw
    );
  }
  
  // SHIFTING_AWAY: Attention leaving + trajectory outbound
  if (
    trajectoryDirection === 'outbound' &&
    flowScore < 0.35 &&
    trajectoryScore < 0.3
  ) {
    return buildShiftingAwayPayload(
      trajectoryDirection,
      positionScore,
      flowScore,
      trajectoryScore,
      alignmentScore,
      confidence,
      confidenceRaw
    );
  }
  
  // TOO_EARLY: Default for flat/weak signals
  return buildTooEarlyPayload(
    trajectoryDirection,
    positionScore,
    flowScore,
    trajectoryScore,
    alignmentScore,
    confidence,
    confidenceRaw
  );
}

/**
 * State Payload Builders
 * Each returns founder-facing copy + action checklist
 */

function buildWindowFormingPayload(
  trajectoryDirection: string,
  positionScore: number,
  flowScore: number,
  trajectoryScore: number,
  alignmentScore: number,
  confidence: ConfidenceLevel,
  confidenceRaw: number
): FundraisingReadinessPayload {
  return {
    fundraising_state: FundraisingState.WINDOW_FORMING,
    confidence,
    time_estimate: '10–18 days',
    primary_action: 'Prepare outreach now — optimal window opening in ~2 weeks',
    explanation: 'Investor clustering and return visits accelerating. Similar startups receiving inbound.',
    drivers: [
      `Position score: ${positionScore.toFixed(2)}`,
      `Flow momentum: ${(flowScore * 100).toFixed(0)}%`,
      `Trajectory: ${trajectoryDirection}`,
      `Alignment: ${(alignmentScore * 100).toFixed(0)}%`,
    ],
    checklist: [
      'Finalize narrative + deck',
      'Identify top 20 target funds',
      'Line up warm intros',
      'Do NOT send outreach yet',
    ],
    risk_flags: [],
    prediction: {
      first_inbound_probability: Math.min(confidenceRaw * 0.65, 0.85),
      partner_diligence_window: '1–3 weeks',
    },
  };
}

function buildTooEarlyPayload(
  trajectoryDirection: string,
  positionScore: number,
  flowScore: number,
  trajectoryScore: number,
  alignmentScore: number,
  confidence: ConfidenceLevel,
  confidenceRaw: number
): FundraisingReadinessPayload {
  return {
    fundraising_state: FundraisingState.TOO_EARLY,
    confidence,
    time_estimate: '4–8 weeks',
    primary_action: 'Do not launch fundraising yet. Strengthen positioning before outreach.',
    explanation: 'No clustering detected. Outreach now will burn network and stall momentum.',
    drivers: [
      `Flow score: ${(flowScore * 100).toFixed(0)}% (low)`,
      `Trajectory: ${trajectoryDirection}`,
      'No investor clustering observed',
    ],
    checklist: [
      'Improve positioning / category framing',
      'Generate 1–2 new traction signals',
      'Delay outreach 2–4 weeks',
      'Re-scan weekly',
    ],
    risk_flags: ['Low signal volume', 'Weak clustering'],
    prediction: {
      first_inbound_probability: confidenceRaw * 0.15,
      partner_diligence_window: 'Not applicable',
    },
  };
}

function buildCoolingRiskPayload(
  trajectoryDirection: string,
  positionScore: number,
  flowScore: number,
  trajectoryScore: number,
  alignmentScore: number,
  confidence: ConfidenceLevel,
  confidenceRaw: number
): FundraisingReadinessPayload {
  return {
    fundraising_state: FundraisingState.COOLING_RISK,
    confidence,
    time_estimate: 'Pause recommended',
    primary_action: 'Pause outreach. Reposition narrative — current activity suggests misalignment.',
    explanation: 'Investor attention declining. Competitors may be overtaking positioning.',
    drivers: [
      `Flow declining: ${(flowScore * 100).toFixed(0)}%`,
      `Trajectory: ${trajectoryDirection}`,
      'Momentum loss detected',
    ],
    checklist: [
      'Stop cold outreach immediately',
      'Reframe market narrative',
      'Analyze which peers are winning attention',
      'Adjust ICP / category positioning',
    ],
    risk_flags: ['Cooling signals detected', 'Momentum declining'],
    prediction: {
      first_inbound_probability: confidenceRaw * 0.25,
      partner_diligence_window: 'Not recommended',
    },
  };
}

function buildShiftingAwayPayload(
  trajectoryDirection: string,
  positionScore: number,
  flowScore: number,
  trajectoryScore: number,
  alignmentScore: number,
  confidence: ConfidenceLevel,
  confidenceRaw: number
): FundraisingReadinessPayload {
  return {
    fundraising_state: FundraisingState.SHIFTING_AWAY,
    confidence,
    time_estimate: 'Delay 6–12 weeks',
    primary_action: 'Capital attention is moving away from your segment. Consider reframing or delaying raise.',
    explanation: 'Capital flow rotating elsewhere. Raising now significantly harder.',
    drivers: [
      `Trajectory: ${trajectoryDirection}`,
      `Flow score: ${(flowScore * 100).toFixed(0)}% (declining)`,
      'Sector rotation detected',
    ],
    checklist: [
      'Delay raise if possible',
      'Reframe category / thesis',
      'Monitor weekly for reversal',
      'Prepare contingency runway plan',
    ],
    risk_flags: ['Attention shifting away', 'Sector rotation detected'],
    prediction: {
      first_inbound_probability: confidenceRaw * 0.1,
      partner_diligence_window: 'Not applicable',
    },
  };
}
