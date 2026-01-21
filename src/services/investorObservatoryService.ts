// @ts-nocheck
/**
 * INVESTOR OBSERVATORY SERVICE
 * ============================================================================
 * "How discovery is forming around me."
 * 
 * NOT a marketplace. NOT leads. NOT deals.
 * This is: Decision support + observatory
 * 
 * CRITICAL PRINCIPLES (LOCKED):
 * ❌ Never expose founders
 * ❌ Never allow messaging
 * ❌ Never create inboxes
 * ❌ Never create marketplaces
 * ❌ Never sell access
 * ❌ Never show scores
 * ============================================================================
 */

import { supabase } from '../lib/supabase';
import type { AlignmentState } from './observatoryTypes';

// =============================================================================
// ALIGNMENT LABEL MAPPING (Observatory-friendly, no score perception)
// =============================================================================

export function mapAlignmentStateLabel(dbValue: string): AlignmentState {
  // Map from DB values to UI-friendly labels
  const mapping: Record<string, AlignmentState> = {
    'high_alignment': 'strong_pattern_match',
    'moderate_alignment': 'multiple_signals',
    'low_alignment': 'early_signals',
    'minimal_alignment': 'emerging',
    'strong': 'multiple_signals',  // Legacy mapping
    'active': 'strong_pattern_match',  // Legacy mapping
    'forming': 'early_signals'  // Legacy mapping
  };
  
  return mapping[dbValue] || (dbValue as AlignmentState);
}

export function getAlignmentDisplayText(state: AlignmentState): string {
  const labels: Record<string, string> = {
    'strong_pattern_match': 'Strong pattern match',
    'multiple_signals': 'Multiple signals',
    'early_signals': 'Early signals',
    'emerging': 'Emerging',
    // Legacy support:
    'high_alignment': 'Strong pattern match',
    'moderate_alignment': 'Multiple signals',
    'low_alignment': 'Early signals',
    'minimal_alignment': 'Emerging',
    'strong': 'Multiple signals',
    'active': 'Strong pattern match',
    'forming': 'Early signals'
  };
  
  return labels[state] || state;
}

export function getAlignmentColor(state: AlignmentState): string {
  const colors: Record<string, string> = {
    'strong_pattern_match': 'text-emerald-400',
    'multiple_signals': 'text-blue-400',
    'early_signals': 'text-amber-400',
    'emerging': 'text-gray-400',
    // Legacy:
    'high_alignment': 'text-emerald-400',
    'moderate_alignment': 'text-blue-400',
    'low_alignment': 'text-amber-400',
    'minimal_alignment': 'text-gray-400',
    'strong': 'text-blue-400',
    'active': 'text-emerald-400',
    'forming': 'text-amber-400'
  };
  
  return colors[state] || 'text-gray-400';
}

// =============================================================================
// TYPES
// =============================================================================

export interface DiscoveryFlowItem {
  id: string;
  startup_type_label: string;
  stage: string;
  industry: string;
  geography?: string;
  alignment_state: 'forming' | 'active' | 'strong';
  signals_present: string[];
  why_appeared: string;
  trend: 'new' | 'rising' | 'stable' | 'fading';
  first_appeared_at: string;
  last_signal_at: string;
  signal_count: number;
}

export interface SignalDistributionItem {
  signal_type: string;
  signal_label: string;
  occurrence_count: number;
  percentage: number;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface EntryPathItem {
  entry_path: string;
  path_label: string;
  occurrence_count: number;
  percentage: number;
  avg_alignment_quality: number;
  conversion_rate: number;
}

export interface QualityDriftWeek {
  week_bucket: string;
  total_inbound: number;
  strong_count: number;
  active_count: number;
  forming_count: number;
  strong_percentage: number;
  active_percentage: number;
  forming_percentage: number;
  quality_score: number;
  week_over_week_change: number;
  trend_direction: 'improving' | 'stable' | 'declining';
}

export interface ObservatorySummary {
  total_in_flow: number;
  new_this_week: number;
  strong_alignment_count: number;
  top_signal: string;
  top_entry_path: string;
  quality_trend: 'improving' | 'stable' | 'declining';
}

// =============================================================================
// DISCOVERY FLOW
// =============================================================================

/**
 * Get startups entering investor's alignment orbit
 * Anonymized - never exposes founder identity
 */
export async function getDiscoveryFlow(
  investorId: string,
  filters?: {
    alignment_state?: string;
    trend?: string;
    stage?: string;
    industry?: string;
    limit?: number;
  }
): Promise<DiscoveryFlowItem[]> {
  let query = supabase
    .from('investor_discovery_flow')
    .select('*')
    .eq('investor_id', investorId)
    .order('last_signal_at', { ascending: false });

  if (filters?.alignment_state) {
    query = query.eq('alignment_state', filters.alignment_state);
  }
  if (filters?.trend) {
    query = query.eq('trend', filters.trend);
  }
  if (filters?.stage) {
    query = query.eq('stage', filters.stage);
  }
  if (filters?.industry) {
    query = query.eq('industry', filters.industry);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching discovery flow:', error);
    return [];
  }

  return data || [];
}

/**
 * Get discovery flow summary stats
 */
export async function getDiscoveryFlowSummary(investorId: string): Promise<{
  total: number;
  by_state: Record<string, number>;
  by_trend: Record<string, number>;
  new_this_week: number;
}> {
  const { data, error } = await supabase
    .from('investor_discovery_flow')
    .select('alignment_state, trend, first_appeared_at')
    .eq('investor_id', investorId);

  if (error || !data) {
    return { total: 0, by_state: {}, by_trend: {}, new_this_week: 0 };
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const by_state: Record<string, number> = {};
  const by_trend: Record<string, number> = {};
  let new_this_week = 0;

  for (const item of data) {
    by_state[item.alignment_state] = (by_state[item.alignment_state] || 0) + 1;
    by_trend[item.trend] = (by_trend[item.trend] || 0) + 1;
    if (new Date(item.first_appeared_at) >= oneWeekAgo) {
      new_this_week++;
    }
  }

  return {
    total: data.length,
    by_state,
    by_trend,
    new_this_week
  };
}

// =============================================================================
// SIGNAL DISTRIBUTION
// =============================================================================

/**
 * Get signal distribution for investor
 * What signals are driving inbound
 */
export async function getSignalDistribution(
  investorId: string
): Promise<SignalDistributionItem[]> {
  const { data, error } = await supabase
    .from('investor_signal_distribution')
    .select('*')
    .eq('investor_id', investorId)
    .order('percentage', { ascending: false });

  if (error) {
    console.error('Error fetching signal distribution:', error);
    return [];
  }

  return data || [];
}

/**
 * Update signal distribution (called by background job)
 */
export async function updateSignalDistribution(
  investorId: string
): Promise<void> {
  // Aggregate signals from discovery flow
  const { data: flowData } = await supabase
    .from('investor_discovery_flow')
    .select('signals_present')
    .eq('investor_id', investorId);

  if (!flowData || flowData.length === 0) return;

  // Count signal occurrences
  const signalCounts: Record<string, number> = {};
  let totalSignals = 0;

  for (const item of flowData) {
    for (const signal of (item.signals_present || [])) {
      signalCounts[signal] = (signalCounts[signal] || 0) + 1;
      totalSignals++;
    }
  }

  // Signal labels
  const signalLabels: Record<string, string> = {
    'technical_credibility': 'Technical Credibility',
    'design_partners': 'Design Partners',
    'revenue_early': 'Early Revenue',
    'market_timing': 'Market Timing',
    'team_pedigree': 'Team Pedigree',
    'prior_exit': 'Prior Exit',
    'repeat_founder': 'Repeat Founder',
    'domain_expertise': 'Domain Expertise',
    'network_quality': 'Network Quality',
    'accelerator_tier1': 'Tier 1 Accelerator',
    'angel_backing': 'Angel Backing',
    'growth_velocity': 'Growth Velocity'
  };

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);

  // Upsert signal distribution
  for (const [signal, count] of Object.entries(signalCounts)) {
    const percentage = totalSignals > 0 ? (count / totalSignals) * 100 : 0;

    await supabase
      .from('investor_signal_distribution')
      .upsert({
        investor_id: investorId,
        signal_type: signal,
        signal_label: signalLabels[signal] || signal,
        occurrence_count: count,
        percentage: parseFloat(percentage.toFixed(2)),
        trend_direction: 'stable',
        window_start: windowStart.toISOString(),
        window_end: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'investor_id,signal_type,window_start'
      });
  }
}

// =============================================================================
// ENTRY PATH DISTRIBUTION
// =============================================================================

/**
 * Get entry path distribution for investor
 * How founders are reaching this investor
 */
export async function getEntryPathDistribution(
  investorId: string
): Promise<EntryPathItem[]> {
  const { data, error } = await supabase
    .from('investor_entry_path_distribution')
    .select('*')
    .eq('investor_id', investorId)
    .order('percentage', { ascending: false });

  if (error) {
    console.error('Error fetching entry path distribution:', error);
    return [];
  }

  return data || [];
}

// =============================================================================
// QUALITY DRIFT
// =============================================================================

/**
 * Get quality drift over time
 */
export async function getQualityDrift(
  investorId: string,
  weeks: number = 12
): Promise<QualityDriftWeek[]> {
  const { data, error } = await supabase
    .from('investor_quality_drift')
    .select('*')
    .eq('investor_id', investorId)
    .order('week_bucket', { ascending: false })
    .limit(weeks);

  if (error) {
    console.error('Error fetching quality drift:', error);
    return [];
  }

  return (data || []).reverse(); // Return chronological order
}

/**
 * Get current quality status
 */
export async function getCurrentQualityStatus(investorId: string): Promise<{
  current_score: number;
  trend: 'improving' | 'stable' | 'declining';
  strong_percentage: number;
  active_percentage: number;
}> {
  const { data } = await supabase
    .from('investor_quality_drift')
    .select('*')
    .eq('investor_id', investorId)
    .order('week_bucket', { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return {
      current_score: 0,
      trend: 'stable',
      strong_percentage: 0,
      active_percentage: 0
    };
  }

  return {
    current_score: data.quality_score || 0,
    trend: data.trend_direction || 'stable',
    strong_percentage: data.strong_percentage || 0,
    active_percentage: data.active_percentage || 0
  };
}

// =============================================================================
// OBSERVATORY SUMMARY
// =============================================================================

/**
 * Get full observatory summary
 */
export async function getObservatorySummary(
  investorId: string
): Promise<ObservatorySummary> {
  const [flowSummary, signals, paths, qualityStatus] = await Promise.all([
    getDiscoveryFlowSummary(investorId),
    getSignalDistribution(investorId),
    getEntryPathDistribution(investorId),
    getCurrentQualityStatus(investorId)
  ]);

  return {
    total_in_flow: flowSummary.total,
    new_this_week: flowSummary.new_this_week,
    strong_alignment_count: flowSummary.by_state['strong'] || 0,
    top_signal: signals[0]?.signal_label || 'N/A',
    top_entry_path: paths[0]?.path_label || 'N/A',
    quality_trend: qualityStatus.trend
  };
}

// =============================================================================
// ACCESS CONTROL (with kill switch enforcement)
// =============================================================================

export interface AccessCheckResult {
  hasAccess: boolean;
  isEnabled: boolean;
  disabledReason?: string;
}

/**
 * Check if investor has observatory access
 * Enforces BOTH access_granted AND is_enabled (kill switch)
 */
export async function checkObservatoryAccess(investorId: string): Promise<boolean> {
  const result = await checkObservatoryAccessFull(investorId);
  return result.hasAccess && result.isEnabled;
}

/**
 * Full access check with kill switch details
 */
export async function checkObservatoryAccessFull(investorId: string): Promise<AccessCheckResult> {
  const { data, error } = await supabase
    .from('investor_observatory_access')
    .select('access_granted, is_enabled, disabled_reason')
    .eq('investor_id', investorId)
    .single();

  if (error || !data) {
    return { hasAccess: false, isEnabled: true };
  }

  return {
    hasAccess: data.access_granted || false,
    isEnabled: data.is_enabled !== false, // Default to enabled if null
    disabledReason: data.disabled_reason
  };
}

/**
 * Disable observatory access (kill switch)
 */
export async function disableObservatoryAccess(
  investorId: string, 
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('investor_observatory_access')
    .update({
      is_enabled: false,
      disabled_reason: reason,
      disabled_at: new Date().toISOString()
    })
    .eq('investor_id', investorId);

  if (!error) {
    console.log(`[SECURITY] Observatory access disabled for investor ${investorId}: ${reason}`);
  }
  
  return !error;
}

/**
 * Re-enable observatory access
 */
export async function enableObservatoryAccess(investorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('investor_observatory_access')
    .update({
      is_enabled: true,
      disabled_reason: null,
      disabled_at: null
    })
    .eq('investor_id', investorId);

  return !error;
}

/**
 * Grant observatory access with invite code
 */
export async function grantObservatoryAccess(
  investorId: string,
  inviteCode: string,
  invitedBy?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('investor_observatory_access')
    .upsert({
      investor_id: investorId,
      access_granted: true,
      invite_code: inviteCode,
      invited_by: invitedBy,
      updated_at: new Date().toISOString()
    });

  return !error;
}

/**
 * Validate invite code
 */
export async function validateInviteCode(code: string): Promise<boolean> {
  const { data } = await supabase
    .from('investor_observatory_access')
    .select('id')
    .eq('invite_code', code)
    .is('investor_id', null)
    .single();

  return !!data;
}

// =============================================================================
// SESSION TRACKING
// =============================================================================

/**
 * Start observatory session
 */
export async function startObservatorySession(investorId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('investor_observatory_sessions')
    .insert({
      investor_id: investorId,
      session_start: new Date().toISOString(),
      sections_visited: []
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error starting session:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Update session activity
 */
export async function updateObservatorySession(
  sessionId: string,
  updates: {
    items_viewed?: number;
    feedback_given?: number;
    sections_visited?: string[];
    time_on_page_seconds?: number;
  }
): Promise<void> {
  await supabase
    .from('investor_observatory_sessions')
    .update({
      ...updates,
      session_end: new Date().toISOString()
    })
    .eq('id', sessionId);
}

// =============================================================================
// POPULATE DISCOVERY FLOW (from match data)
// =============================================================================

/**
 * Populate discovery flow from existing match data
 * Called by background job to sync matches to observatory
 */
export async function populateDiscoveryFlowFromMatches(
  investorId: string
): Promise<number> {
  // Get matches for this investor
  const { data: matches } = await supabase
    .from('startup_investor_matches')
    .select(`
      id,
      startup_id,
      match_score,
      semantic_similarity,
      created_at,
      startup_uploads(
        id,
        name,
        sectors,
        stage,
        total_god_score,
        team_score,
        traction_score,
        market_score,
        product_score,
        vision_score,
        extracted_data
      )
    `)
    .eq('investor_id', investorId)
    .order('match_score', { ascending: false });

  if (!matches || matches.length === 0) return 0;

  let added = 0;

  for (const match of matches) {
    const startup = match.startup_uploads as any;
    if (!startup) continue;

    // Determine alignment state based on match score
    let alignment_state: 'forming' | 'active' | 'strong' = 'forming';
    if (match.match_score >= 70) {
      alignment_state = 'strong';
    } else if (match.match_score >= 50) {
      alignment_state = 'active';
    }

    // Identify signals present
    const signals: string[] = [];
    if (startup.team_score >= 70) signals.push('team_pedigree');
    if (startup.traction_score >= 70) signals.push('revenue_early');
    if (startup.market_score >= 70) signals.push('market_timing');
    if (startup.product_score >= 70) signals.push('technical_credibility');
    if (startup.total_god_score >= 80) signals.push('domain_expertise');

    // Generate anonymized label
    const stage = startup.stage || 'Early-stage';
    const sectors = startup.sectors || [];
    const primarySector = sectors[0] || 'Tech';
    const typeLabel = `${stage} ${primarySector} startup`;

    // Upsert to discovery flow
    const { error } = await supabase
      .from('investor_discovery_flow')
      .upsert({
        investor_id: investorId,
        startup_id: startup.id,
        startup_type_label: typeLabel,
        stage: startup.stage || 'Seed',
        industry: primarySector,
        alignment_state,
        signals_present: signals,
        why_appeared: `Matches your ${primarySector.toLowerCase()} screening patterns`,
        trend: 'new',
        first_appeared_at: match.created_at,
        last_signal_at: new Date().toISOString(),
        signal_count: signals.length,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'investor_id,startup_id',
        ignoreDuplicates: false
      });

    if (!error) added++;
  }

  // Update signal distribution after populating
  await updateSignalDistribution(investorId);

  return added;
}
