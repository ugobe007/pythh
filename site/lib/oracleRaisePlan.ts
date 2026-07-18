/**
 * Oracle raise plan — client state for authorization + autonomy + decisions.
 */

import { trackFunnelEvent } from '@/lib/matchEngagement';

export type AutonomyLevel = 'observe' | 'prepare' | 'execute';

const AUTONOMY_KEY = 'pythia_autonomy_level';
const AUTHORIZED_STARTUP_KEY = 'pythia_raise_plan_authorized';
const DECISIONS_KEY = 'pythia_oracle_decisions';

export interface OracleDecision {
  id: string;
  type: string;
  title: string;
  body: string;
  requires_plan_auth?: boolean;
  outreach_count?: number;
  gap_count?: number;
  status: 'pending' | 'approved' | 'deferred';
}

export function getAutonomyLevel(): AutonomyLevel {
  const v = sessionStorage.getItem(AUTONOMY_KEY);
  if (v === 'observe' || v === 'execute') return v;
  return 'prepare';
}

export function setAutonomyLevel(level: AutonomyLevel) {
  sessionStorage.setItem(AUTONOMY_KEY, level);
  void trackFunnelEvent('autonomy_level_set', { level, source: 'oracle_raise_plan' });
}

export function isRaisePlanAuthorized(startupId: string): boolean {
  return sessionStorage.getItem(AUTHORIZED_STARTUP_KEY) === startupId;
}

export function markRaisePlanAuthorized(startupId: string, autonomy: AutonomyLevel) {
  sessionStorage.setItem(AUTHORIZED_STARTUP_KEY, startupId);
  sessionStorage.setItem(AUTONOMY_KEY, autonomy);
  void trackFunnelEvent('raise_plan_authorized', {
    startup_id: startupId,
    autonomy_level: autonomy,
    source: 'oracle_raise_plan',
  });
  void trackFunnelEvent('autonomy_level_set', { level: autonomy, source: 'raise_plan_authorize' });
}

export function loadDecisionState(startupId: string): Record<string, OracleDecision['status']> {
  try {
    const raw = sessionStorage.getItem(`${DECISIONS_KEY}:${startupId}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, OracleDecision['status']>;
  } catch {
    return {};
  }
}

export function saveDecisionStatus(
  startupId: string,
  decisionId: string,
  status: OracleDecision['status'],
) {
  const current = loadDecisionState(startupId);
  current[decisionId] = status;
  sessionStorage.setItem(`${DECISIONS_KEY}:${startupId}`, JSON.stringify(current));
}

export function approveDecision(startupId: string, decision: OracleDecision) {
  saveDecisionStatus(startupId, decision.id, 'approved');
  void trackFunnelEvent('decision_approved', {
    startup_id: startupId,
    decision_id: decision.id,
    decision_type: decision.type,
    source: 'oracle_decision_card',
  });
  if (decision.type === 'outreach_batch') {
    void trackFunnelEvent('outreach_authorized', {
      startup_id: startupId,
      outreach_count: decision.outreach_count,
      source: 'oracle_decision_card',
    });
  }
}

export function deferDecision(startupId: string, decision: OracleDecision) {
  saveDecisionStatus(startupId, decision.id, 'deferred');
  void trackFunnelEvent('decision_deferred', {
    startup_id: startupId,
    decision_id: decision.id,
    decision_type: decision.type,
    source: 'oracle_decision_card',
  });
}
