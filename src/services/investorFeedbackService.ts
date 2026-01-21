// @ts-nocheck
/**
 * INVESTOR FEEDBACK SERVICE
 * ============================================================================
 * Light feedback buttons only:
 * 👍 Good inbound / 👎 Not relevant / ⏸ Too early
 * 
 * NO comments. NO notes. NO explanations.
 * 
 * Purpose: Train signal weights, entry path success, timing windows
 * ============================================================================
 */

import { supabase } from '../lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export type FeedbackType = 'good_inbound' | 'not_relevant' | 'too_early';

export interface InboundFeedback {
  id: string;
  investor_id: string;
  discovery_flow_id: string;
  feedback_type: FeedbackType;
  signals_at_feedback: string[];
  alignment_state_at_feedback: string;
  created_at: string;
}

export interface FeedbackStats {
  total_feedback: number;
  good_inbound: number;
  not_relevant: number;
  too_early: number;
  feedback_rate: number; // % of flow items with feedback
}

// =============================================================================
// SUBMIT FEEDBACK
// =============================================================================

/**
 * Submit feedback on a discovery flow item
 * Light reaction only - no comments allowed
 */
export async function submitFeedback(
  investorId: string,
  discoveryFlowId: string,
  feedbackType: FeedbackType
): Promise<{ success: boolean; error?: string }> {
  // Get current flow item state for learning
  const { data: flowItem } = await supabase
    .from('investor_discovery_flow')
    .select('signals_present, alignment_state')
    .eq('id', discoveryFlowId)
    .single();

  const { error } = await supabase
    .from('investor_inbound_feedback')
    .upsert({
      investor_id: investorId,
      discovery_flow_id: discoveryFlowId,
      feedback_type: feedbackType,
      signals_at_feedback: flowItem?.signals_present || [],
      alignment_state_at_feedback: flowItem?.alignment_state || 'unknown',
      created_at: new Date().toISOString()
    }, {
      onConflict: 'investor_id,discovery_flow_id'
    });

  if (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, error: error.message };
  }

  // Update flow item trend based on feedback
  await updateFlowItemTrend(discoveryFlowId, feedbackType);

  return { success: true };
}

/**
 * Update flow item trend based on feedback
 */
async function updateFlowItemTrend(
  flowId: string,
  feedbackType: FeedbackType
): Promise<void> {
  // Feedback affects trend:
  // good_inbound → rising
  // not_relevant → fading
  // too_early → stable (timing issue, not quality)
  
  const trendMap: Record<FeedbackType, string> = {
    'good_inbound': 'rising',
    'not_relevant': 'fading',
    'too_early': 'stable'
  };

  await supabase
    .from('investor_discovery_flow')
    .update({ 
      trend: trendMap[feedbackType],
      updated_at: new Date().toISOString()
    })
    .eq('id', flowId);
}

// =============================================================================
// REMOVE FEEDBACK
// =============================================================================

/**
 * Remove feedback from a discovery flow item
 */
export async function removeFeedback(
  investorId: string,
  discoveryFlowId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('investor_inbound_feedback')
    .delete()
    .eq('investor_id', investorId)
    .eq('discovery_flow_id', discoveryFlowId);

  if (error) {
    console.error('Error removing feedback:', error);
    return { success: false, error: error.message };
  }

  // Reset flow item trend to stable
  await supabase
    .from('investor_discovery_flow')
    .update({ 
      trend: 'stable',
      updated_at: new Date().toISOString()
    })
    .eq('id', discoveryFlowId);

  return { success: true };
}

// =============================================================================
// GET FEEDBACK
// =============================================================================

/**
 * Get feedback for a specific flow item
 */
export async function getFeedbackForItem(
  investorId: string,
  discoveryFlowId: string
): Promise<FeedbackType | null> {
  const { data } = await supabase
    .from('investor_inbound_feedback')
    .select('feedback_type')
    .eq('investor_id', investorId)
    .eq('discovery_flow_id', discoveryFlowId)
    .single();

  return data?.feedback_type || null;
}

/**
 * Get all feedback for an investor
 */
export async function getAllFeedback(
  investorId: string
): Promise<InboundFeedback[]> {
  const { data, error } = await supabase
    .from('investor_inbound_feedback')
    .select('*')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedback:', error);
    return [];
  }

  return data || [];
}

/**
 * Get feedback stats
 */
export async function getFeedbackStats(
  investorId: string
): Promise<FeedbackStats> {
  const [feedbackData, flowData] = await Promise.all([
    supabase
      .from('investor_inbound_feedback')
      .select('feedback_type')
      .eq('investor_id', investorId),
    supabase
      .from('investor_discovery_flow')
      .select('id', { count: 'exact', head: true })
      .eq('investor_id', investorId)
  ]);

  const feedback = feedbackData.data || [];
  const totalFlow = flowData.count || 0;

  const stats = {
    total_feedback: feedback.length,
    good_inbound: 0,
    not_relevant: 0,
    too_early: 0,
    feedback_rate: totalFlow > 0 ? (feedback.length / totalFlow) * 100 : 0
  };

  for (const f of feedback) {
    if (f.feedback_type === 'good_inbound') stats.good_inbound++;
    if (f.feedback_type === 'not_relevant') stats.not_relevant++;
    if (f.feedback_type === 'too_early') stats.too_early++;
  }

  return stats;
}

// =============================================================================
// FEEDBACK INSIGHTS (for learning)
// =============================================================================

/**
 * Get signal effectiveness based on feedback
 * Which signals correlate with "good_inbound"?
 */
export async function getSignalEffectiveness(
  investorId: string
): Promise<Record<string, { good_rate: number; total: number }>> {
  const { data } = await supabase
    .from('investor_inbound_feedback')
    .select('feedback_type, signals_at_feedback')
    .eq('investor_id', investorId);

  if (!data || data.length === 0) return {};

  const signalStats: Record<string, { good: number; total: number }> = {};

  for (const feedback of data) {
    const signals = feedback.signals_at_feedback || [];
    const isGood = feedback.feedback_type === 'good_inbound';

    for (const signal of signals) {
      if (!signalStats[signal]) {
        signalStats[signal] = { good: 0, total: 0 };
      }
      signalStats[signal].total++;
      if (isGood) signalStats[signal].good++;
    }
  }

  // Convert to rates
  const result: Record<string, { good_rate: number; total: number }> = {};
  for (const [signal, stats] of Object.entries(signalStats)) {
    result[signal] = {
      good_rate: stats.total > 0 ? (stats.good / stats.total) * 100 : 0,
      total: stats.total
    };
  }

  return result;
}

/**
 * Get timing insights based on feedback
 * What alignment states get "too_early" feedback?
 */
export async function getTimingInsights(
  investorId: string
): Promise<Record<string, { too_early_rate: number; total: number }>> {
  const { data } = await supabase
    .from('investor_inbound_feedback')
    .select('feedback_type, alignment_state_at_feedback')
    .eq('investor_id', investorId);

  if (!data || data.length === 0) return {};

  const stateStats: Record<string, { too_early: number; total: number }> = {};

  for (const feedback of data) {
    const state = feedback.alignment_state_at_feedback || 'unknown';
    const isTooEarly = feedback.feedback_type === 'too_early';

    if (!stateStats[state]) {
      stateStats[state] = { too_early: 0, total: 0 };
    }
    stateStats[state].total++;
    if (isTooEarly) stateStats[state].too_early++;
  }

  // Convert to rates
  const result: Record<string, { too_early_rate: number; total: number }> = {};
  for (const [state, stats] of Object.entries(stateStats)) {
    result[state] = {
      too_early_rate: stats.total > 0 ? (stats.too_early / stats.total) * 100 : 0,
      total: stats.total
    };
  }

  return result;
}

// =============================================================================
// FEEDBACK UI HELPERS
// =============================================================================

/**
 * Get feedback button config
 */
export function getFeedbackButtonConfig(type: FeedbackType): {
  emoji: string;
  label: string;
  color: string;
  activeColor: string;
} {
  // Dark theme colors consistent with Pythh design
  const config: Record<FeedbackType, { emoji: string; label: string; color: string; activeColor: string }> = {
    'good_inbound': {
      emoji: '👍',
      label: 'Good inbound',
      color: 'text-gray-500 hover:text-green-400',
      activeColor: 'text-green-400 bg-green-500/20 border border-green-500/30'
    },
    'not_relevant': {
      emoji: '👎',
      label: 'Not relevant',
      color: 'text-gray-500 hover:text-red-400',
      activeColor: 'text-red-400 bg-red-500/20 border border-red-500/30'
    },
    'too_early': {
      emoji: '⏸',
      label: 'Too early',
      color: 'text-gray-500 hover:text-amber-400',
      activeColor: 'text-amber-400 bg-amber-500/20 border border-amber-500/30'
    }
  };

  return config[type];
}

/**
 * Get all feedback types
 */
export function getAllFeedbackTypes(): FeedbackType[] {
  return ['good_inbound', 'not_relevant', 'too_early'];
}
