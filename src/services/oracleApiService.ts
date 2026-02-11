// ============================================================================
// Oracle API Service
// ============================================================================
// Frontend service for Oracle system - calls Express API endpoints
// Works with oracle_sessions, oracle_actions, oracle_insights tables
// ============================================================================

import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// ---------------------------------------------------------------------------
// Types (matching database schema)
// ---------------------------------------------------------------------------

export interface OracleSession {
  id: string;
  user_id: string;
  startup_id: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  current_step: number;
  progress_percentage: number;
  
  // JSONB step data
  step_1_stage?: any;
  step_2_problem?: any;
  step_3_solution?: any;
  step_4_traction?: any;
  step_5_team?: any;
  step_6_pitch?: any;
  step_7_vision?: any;
  step_8_market?: any;
  
  // Computed outputs
  signal_score?: number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  
  // Timestamps
  started_at: string;
  completed_at?: string;
  last_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface OracleAction {
  id: string;
  user_id: string;
  startup_id: string | null;
  session_id: string | null;
  title: string;
  description?: string;
  category: 'traction' | 'team' | 'product' | 'market' | 'fundraising' | 'signals' | 'positioning' | 'strategy' | 'execution' | 'other';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact_score?: number;
  effort_estimate?: 'quick' | 'hours' | 'days' | 'weeks' | 'months';
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  blocked_reason?: string;
  notes?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface OracleInsight {
  id: string;
  user_id: string;
  startup_id: string | null;
  session_id: string | null;
  insight_type: 'strength' | 'weakness' | 'opportunity' | 'threat' | 'prediction' | 'recommendation' | 'warning' | 'coaching' | 'vc_alignment' | 'market_timing';
  title: string;
  content: string;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  source: string;
  model_version?: string;
  is_dismissed: boolean;
  dismissed_at?: string;
  is_pinned: boolean;
  display_order: number;
  viewed_at?: string;
  acted_on: boolean;
  related_action_id?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helper to get auth token
// ---------------------------------------------------------------------------

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// SESSION MANAGEMENT
// ---------------------------------------------------------------------------

export async function listSessions(params?: {
  status?: 'in_progress' | 'completed' | 'abandoned';
  startup_id?: string;
}): Promise<OracleSession[]> {
  const query = new URLSearchParams(params as any).toString();
  const endpoint = `/oracle/sessions${query ? `?${query}` : ''}`;
  const { sessions } = await apiFetch<{ sessions: OracleSession[] }>(endpoint);
  return sessions;
}

export async function getSession(sessionId: string): Promise<OracleSession> {
  const { session } = await apiFetch<{ session: OracleSession }>(`/oracle/sessions/${sessionId}`);
  return session;
}

export async function createSession(startupId?: string): Promise<OracleSession> {
  const { session } = await apiFetch<{ session: OracleSession }>('/oracle/sessions', {
    method: 'POST',
    body: JSON.stringify({ startup_id: startupId || null }),
  });
  return session;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<OracleSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<OracleSession> {
  const { session } = await apiFetch<{ session: OracleSession }>(`/oracle/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/oracle/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// WIZARD STEP HELPERS
// ---------------------------------------------------------------------------

export async function saveWizardStep(
  sessionId: string,
  stepNumber: number,
  stepData: any
): Promise<OracleSession> {
  const stepKey = `step_${stepNumber}_${getStepName(stepNumber)}` as keyof OracleSession;
  
  const updates: any = {
    [stepKey]: stepData,
    current_step: stepNumber < 8 ? stepNumber + 1 : stepNumber,
  };

  return updateSession(sessionId, updates);
}

export async function completeWizard(
  sessionId: string,
  signalScore?: number,
  strengths?: string[],
  weaknesses?: string[],
  recommendations?: string[]
): Promise<OracleSession> {
  return updateSession(sessionId, {
    status: 'completed',
    signal_score: signalScore,
    strengths,
    weaknesses,
    recommendations,
  });
}

function getStepName(stepNumber: number): string {
  const names = ['stage', 'problem', 'solution', 'traction', 'team', 'pitch', 'vision', 'market'];
  return names[stepNumber - 1] || 'unknown';
}

// ---------------------------------------------------------------------------
// ACTIONS MANAGEMENT
// ---------------------------------------------------------------------------

export async function listActions(params?: {
  status?: string;
  startup_id?: string;
  session_id?: string;
  priority?: string;
}): Promise<OracleAction[]> {
  const query = new URLSearchParams(params as any).toString();
  const endpoint = `/oracle/actions${query ? `?${query}` : ''}`;
  const { actions } = await apiFetch<{ actions: OracleAction[] }>(endpoint);
  return actions;
}

export async function getAction(actionId: string): Promise<OracleAction> {
  const { action } = await apiFetch<{ action: OracleAction }>(`/oracle/actions/${actionId}`);
  return action;
}

export async function createAction(data: {
  startup_id?: string;
  session_id?: string;
  title: string;
  description?: string;
  category: OracleAction['category'];
  priority?: OracleAction['priority'];
  impact_score?: number;
  effort_estimate?: OracleAction['effort_estimate'];
  assigned_to?: string;
  due_date?: string;
  notes?: string;
}): Promise<OracleAction> {
  const { action } = await apiFetch<{ action: OracleAction }>('/oracle/actions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return action;
}

export async function updateAction(
  actionId: string,
  updates: Partial<Omit<OracleAction, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<OracleAction> {
  const { action } = await apiFetch<{ action: OracleAction }>(`/oracle/actions/${actionId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return action;
}

export async function deleteAction(actionId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/oracle/actions/${actionId}`, {
    method: 'DELETE',
  });
}

export async function updateActionStatus(
  actionId: string,
  status: OracleAction['status']
): Promise<OracleAction> {
  return updateAction(actionId, { status });
}

// ---------------------------------------------------------------------------
// INSIGHTS MANAGEMENT
// ---------------------------------------------------------------------------

export async function listInsights(params?: {
  insight_type?: string;
  startup_id?: string;
  session_id?: string;
  dismissed?: boolean;
}): Promise<OracleInsight[]> {
  const query = new URLSearchParams(params as any).toString();
  const endpoint = `/oracle/insights${query ? `?${query}` : ''}`;
  const { insights } = await apiFetch<{ insights: OracleInsight[] }>(endpoint);
  return insights;
}

export async function getInsight(insightId: string): Promise<OracleInsight> {
  const { insight } = await apiFetch<{ insight: OracleInsight }>(`/oracle/insights/${insightId}`);
  return insight;
}

export async function createInsight(data: {
  startup_id?: string;
  session_id?: string;
  insight_type: OracleInsight['insight_type'];
  title: string;
  content: string;
  confidence?: number;
  severity?: OracleInsight['severity'];
  category?: string;
  source?: string;
  model_version?: string;
  related_action_id?: string;
}): Promise<OracleInsight> {
  const { insight } = await apiFetch<{ insight: OracleInsight }>('/oracle/insights', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return insight;
}

export async function updateInsight(
  insightId: string,
  updates: {
    is_dismissed?: boolean;
    is_pinned?: boolean;
    acted_on?: boolean;
    related_action_id?: string;
    display_order?: number;
  }
): Promise<OracleInsight> {
  const { insight } = await apiFetch<{ insight: OracleInsight }>(`/oracle/insights/${insightId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return insight;
}

export async function deleteInsight(insightId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/oracle/insights/${insightId}`, {
    method: 'DELETE',
  });
}

export async function dismissInsight(insightId: string): Promise<OracleInsight> {
  return updateInsight(insightId, { is_dismissed: true });
}

export async function pinInsight(insightId: string, pinned: boolean): Promise<OracleInsight> {
  return updateInsight(insightId, { is_pinned: pinned });
}

// ---------------------------------------------------------------------------
// CONVENIENCE FUNCTIONS
// ---------------------------------------------------------------------------

export async function getOrCreateActiveSession(startupId?: string): Promise<OracleSession> {
  // Try to find existing in-progress session
  const sessions = await listSessions({ 
    status: 'in_progress',
    startup_id: startupId 
  });
  
  if (sessions.length > 0) {
    return sessions[0];
  }
  
  // Create new session
  return createSession(startupId);
}

export async function getPendingActions(startupId?: string): Promise<OracleAction[]> {
  return listActions({ 
    status: 'pending',
    startup_id: startupId 
  });
}

export async function getActiveInsights(startupId?: string): Promise<OracleInsight[]> {
  return listInsights({ 
    dismissed: false,
    startup_id: startupId 
  });
}

export async function generateDemoActions(sessionId: string): Promise<OracleAction[]> {
  // Generate some demo actions based on common needs
  const demoActions = [
    {
      session_id: sessionId,
      title: 'Update pitch deck',
      description: 'Refine value proposition slide based on investor feedback',
      category: 'fundraising' as const,
      priority: 'high' as const,
      impact_score: 8,
      effort_estimate: 'days' as const,
    },
    {
      session_id: sessionId,
      title: 'Schedule 10 investor meetings',
      description: 'Target VCs aligned with your stage and sector',
      category: 'fundraising' as const,
      priority: 'critical' as const,
      impact_score: 10,
      effort_estimate: 'weeks' as const,
    },
    {
      session_id: sessionId,
      title: 'Strengthen team slide',
      description: 'Add advisor profiles and highlight domain expertise',
      category: 'team' as const,
      priority: 'medium' as const,
      impact_score: 6,
      effort_estimate: 'hours' as const,
    },
  ];

  const created = await Promise.all(
    demoActions.map(action => createAction(action))
  );

  return created;
}

export async function generateDemoInsights(sessionId: string): Promise<OracleInsight[]> {
  const demoInsights = [
    {
      session_id: sessionId,
      insight_type: 'strength' as const,
      title: 'Strong market timing',
      content: 'Your entry timing aligns with emerging market trends. Recent regulatory changes and tech adoption create a favorable window.',
      confidence: 0.85,
      severity: 'high' as const,
      category: 'market',
    },
    {
      session_id: sessionId,
      insight_type: 'weakness' as const,
      title: 'Limited traction metrics',
      content: 'Investors will want to see stronger evidence of product-market fit. Focus on acquiring 10-20 beta users with measurable engagement.',
      confidence: 0.9,
      severity: 'high' as const,
      category: 'traction',
    },
    {
      session_id: sessionId,
      insight_type: 'recommendation' as const,
      title: 'Target 3-5 lead investors first',
      content: 'Focus your initial outreach on investors with strong domain expertise in your sector. Getting one credible lead will create momentum.',
      confidence: 0.8,
      severity: 'medium' as const,
      category: 'fundraising',
    },
  ];

  const created = await Promise.all(
    demoInsights.map(insight => createInsight(insight))
  );

  return created;
}

// ============================================
// AI INSIGHT GENERATION
// ============================================

export async function generateAIInsights(
  sessionId: string,
  startupId: string,
  context?: string
): Promise<OracleInsight[]> {
  const url = `${API_BASE_URL}/insights/generate`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      session_id: sessionId,
      startup_id: startupId,
      context,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate AI insights');
  }

  const data = await response.json();
  return data.insights;
}
