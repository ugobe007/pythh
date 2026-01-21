/**
 * ALIGNMENT CHANGE DETECTOR SERVICE
 * ==================================
 * The habit engine's brain.
 * 
 * This service:
 * 1. Takes snapshots of alignment state
 * 2. Detects changes between snapshots
 * 3. Creates timeline events
 * 4. Powers the "What Changed" panel
 * 5. [Sprint 4] Queues notifications for drift nudges
 */

import { supabase } from '../lib/supabase';
import type { AlignmentSnapshot, AlignmentEvent } from '../lib/database.types';
import { processChangeEvent, type ChangeEvent } from './notificationTriggerService';

// ============================================
// TYPES
// ============================================
export interface AlignmentState {
  alignmentStatus: string;
  godScore?: number;
  signals: string[];
  investorCount: number;
  topInvestors?: string[];
  componentScores?: {
    team: number;
    traction: number;
    market: number;
    product: number;
    vision: number;
  };
}

export interface DetectedChange {
  type: string;
  title: string;
  description?: string;
  impact: 'positive' | 'negative' | 'neutral';
  importance: 'high' | 'medium' | 'low';
}

// ============================================
// SNAPSHOT MANAGEMENT
// ============================================

/**
 * Take a snapshot of current alignment state
 */
export async function takeAlignmentSnapshot(
  startupId: string,
  state: AlignmentState
): Promise<AlignmentSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from('founder_alignment_snapshots')
      .insert({
        startup_id: startupId,
        alignment_state: state.alignmentStatus,
        alignment_score: state.godScore || null,
        signals_present: state.signals,
        signal_count: state.signals.length,
        investor_count: state.investorCount,
        team_score: state.componentScores?.team || null,
        traction_score: state.componentScores?.traction || null,
        market_score: state.componentScores?.market || null,
        product_score: state.componentScores?.product || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error taking snapshot:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Snapshot error:', err);
    return null;
  }
}

/**
 * Get the latest snapshot for comparison
 */
export async function getLatestSnapshot(
  startupId: string
): Promise<AlignmentSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from('founder_alignment_snapshots')
      .select('*')
      .eq('startup_id', startupId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      // No snapshot yet is fine
      if (error.code === 'PGRST116') return null;
      console.error('Error getting snapshot:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Get snapshot error:', err);
    return null;
  }
}

/**
 * Get snapshot history
 */
export async function getSnapshotHistory(
  startupId: string,
  limit = 10
): Promise<AlignmentSnapshot[]> {
  try {
    const { data, error } = await supabase
      .from('founder_alignment_snapshots')
      .select('*')
      .eq('startup_id', startupId)
      .order('snapshot_date', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting history:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('History error:', err);
    return [];
  }
}

// ============================================
// CHANGE DETECTION
// ============================================

/**
 * Compare two states and detect changes
 */
export function detectChanges(
  current: AlignmentState,
  previous: AlignmentState
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  
  // Alignment status change
  const statusOrder = ['Cold', 'Emerging', 'Forming', 'Active', 'Hot'];
  const currentIdx = statusOrder.indexOf(current.alignmentStatus);
  const previousIdx = statusOrder.indexOf(previous.alignmentStatus);
  
  if (currentIdx !== previousIdx && currentIdx !== -1 && previousIdx !== -1) {
    const improved = currentIdx > previousIdx;
    changes.push({
      type: improved ? 'alignment_improved' : 'alignment_declined',
      title: improved 
        ? `Alignment upgraded to ${current.alignmentStatus}`
        : `Alignment shifted to ${current.alignmentStatus}`,
      description: improved 
        ? 'Your signal density increased'
        : 'Signal density has changed',
      impact: improved ? 'positive' : 'negative',
      importance: 'high'
    });
  }
  
  // GOD score change
  if (current.godScore && previous.godScore) {
    const diff = current.godScore - previous.godScore;
    if (Math.abs(diff) >= 5) {
      changes.push({
        type: diff > 0 ? 'score_improved' : 'score_declined',
        title: diff > 0 
          ? `Alignment score improved by ${diff} points`
          : `Alignment score decreased by ${Math.abs(diff)} points`,
        impact: diff > 0 ? 'positive' : 'negative',
        importance: Math.abs(diff) >= 10 ? 'high' : 'medium'
      });
    }
  }
  
  // New signals detected
  const newSignals = current.signals.filter(s => !previous.signals.includes(s));
  if (newSignals.length > 0) {
    changes.push({
      type: 'signal_detected',
      title: newSignals.length === 1 
        ? `${newSignals[0]} signal detected`
        : `${newSignals.length} new signals detected`,
      description: newSignals.length === 1 ? undefined : newSignals.join(', '),
      impact: 'positive',
      importance: 'high'
    });
  }
  
  // Lost signals
  const lostSignals = previous.signals.filter(s => !current.signals.includes(s));
  if (lostSignals.length > 0) {
    changes.push({
      type: 'signal_lost',
      title: lostSignals.length === 1 
        ? `${lostSignals[0]} signal weakened`
        : `${lostSignals.length} signals weakened`,
      impact: 'negative',
      importance: 'medium'
    });
  }
  
  // Investor count changes
  const investorDiff = current.investorCount - previous.investorCount;
  if (investorDiff !== 0) {
    if (investorDiff > 0) {
      changes.push({
        type: 'investor_appeared',
        title: investorDiff === 1
          ? `Entered monitoring by 1 new investor`
          : `Entered monitoring by ${investorDiff} new investors`,
        impact: 'positive',
        importance: investorDiff >= 3 ? 'high' : 'medium'
      });
    } else {
      changes.push({
        type: 'investor_dropped',
        title: Math.abs(investorDiff) === 1
          ? `1 investor stopped monitoring`
          : `${Math.abs(investorDiff)} investors stopped monitoring`,
        impact: 'negative',
        importance: 'medium'
      });
    }
  }
  
  return changes;
}

// ============================================
// EVENT CREATION
// ============================================

/**
 * Record a single alignment event
 */
export async function recordAlignmentEvent(
  startupId: string,
  event: {
    type: string;
    title: string;
    description?: string;
    impact: 'positive' | 'negative' | 'neutral';
    importance: 'high' | 'medium' | 'low';
    relatedData?: Record<string, any>;
  }
): Promise<AlignmentEvent | null> {
  try {
    const { data, error } = await supabase
      .from('alignment_events')
      .insert({
        startup_id: startupId,
        event_type: event.type,
        event_title: event.title,
        event_description: event.description,
        impact: event.impact,
        importance: event.importance,
        related_data: event.relatedData || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error recording event:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Event error:', err);
    return null;
  }
}

/**
 * Record multiple events from detected changes
 */
export async function recordDetectedChanges(
  startupId: string,
  changes: DetectedChange[]
): Promise<number> {
  let recorded = 0;
  
  for (const change of changes) {
    const event = await recordAlignmentEvent(startupId, change);
    if (event) recorded++;
  }
  
  return recorded;
}

// ============================================
// MAIN FLOW: CHECK AND RECORD CHANGES
// ============================================

/**
 * Main function: Compare current state to last snapshot,
 * detect changes, record events, and take new snapshot
 */
export async function checkAndRecordAlignmentChanges(
  startupId: string,
  currentState: AlignmentState,
  context?: { startupUrl?: string; founderSessionId?: string }
): Promise<{
  changes: DetectedChange[];
  eventsRecorded: number;
  snapshotTaken: boolean;
}> {
  // Get last snapshot
  const lastSnapshot = await getLatestSnapshot(startupId);
  
  // If no previous snapshot, this is first scan
  if (!lastSnapshot) {
    // Take initial snapshot
    const snapshot = await takeAlignmentSnapshot(startupId, currentState);
    
    // Record "first scan" event
    await recordAlignmentEvent(startupId, {
      type: 'first_scan',
      title: 'First alignment scan completed',
      description: `Initial status: ${currentState.alignmentStatus}`,
      impact: 'positive',
      importance: 'high'
    });
    
    return {
      changes: [],
      eventsRecorded: 1,
      snapshotTaken: !!snapshot
    };
  }
  
  // Build previous state from snapshot
  const previousState: AlignmentState = {
    alignmentStatus: lastSnapshot.alignment_state || 'Cold',
    godScore: lastSnapshot.alignment_score || undefined,
    signals: (lastSnapshot.signals_present as string[]) || [],
    investorCount: lastSnapshot.investor_count || 0
  };
  
  // Detect changes
  const changes = detectChanges(currentState, previousState);
  
  // If no significant changes, don't spam events
  if (changes.length === 0) {
    return {
      changes: [],
      eventsRecorded: 0,
      snapshotTaken: false
    };
  }
  
  // Record events
  const eventsRecorded = await recordDetectedChanges(startupId, changes);
  
  // Take new snapshot
  const snapshot = await takeAlignmentSnapshot(startupId, currentState);
  
  // [Sprint 4] Queue notifications for significant changes
  await queueNotificationsForChanges(changes, {
    startupId,
    startupUrl: context?.startupUrl,
    founderSessionId: context?.founderSessionId
  });
  
  return {
    changes,
    eventsRecorded,
    snapshotTaken: !!snapshot
  };
}

// ============================================
// SPRINT 4: NOTIFICATION QUEUEING
// ============================================

/**
 * Convert detected changes to notification events and queue them
 */
async function queueNotificationsForChanges(
  changes: DetectedChange[],
  context: { startupId?: string; startupUrl?: string; founderSessionId?: string }
): Promise<void> {
  for (const change of changes) {
    // Map to notification trigger event
    const event = mapChangeToTriggerEvent(change);
    if (event) {
      await processChangeEvent(event, context);
    }
  }
}

/**
 * Map a detected change to a notification trigger event
 */
function mapChangeToTriggerEvent(change: DetectedChange): ChangeEvent | null {
  switch (change.type) {
    case 'alignment_improved':
      return {
        type: 'alignment',
        action: 'improved',
        data: {
          new_state: change.title.split(' to ')[1] || 'Active'
        }
      };
      
    case 'alignment_declined':
      // Only trigger on significant declines (handled in trigger matrix)
      return {
        type: 'alignment',
        action: 'dropped',
        data: {
          new_state: change.title.split(' to ')[1] || 'Forming'
        }
      };
      
    case 'signal_detected':
      return {
        type: 'signal',
        action: 'strengthened',
        data: {
          signal_type: change.title.replace(' signal detected', ''),
          signal_name: change.title
        }
      };
      
    case 'signal_lost':
      return {
        type: 'signal',
        action: 'weakened',
        data: {
          signal_type: change.title.replace(' signal weakened', '')
        }
      };
      
    case 'investor_appeared':
      // Extract count from title like "Entered monitoring by 3 new investors"
      const appearMatch = change.title.match(/(\d+)/);
      return {
        type: 'investor',
        action: 'appeared',
        data: {
          count: appearMatch ? parseInt(appearMatch[1]) : 1,
          sector: 'seed' // Would need actual sector data
        }
      };
      
    case 'investor_dropped':
      // Only significant losses
      return {
        type: 'investor',
        action: 'disappeared',
        data: {}
      };
      
    default:
      return null;
  }
}

// ============================================
// UTILITY: Get Recent Events for Display
// ============================================

/**
 * Get recent events for timeline display
 */
export async function getRecentAlignmentEvents(
  startupId: string,
  limit = 10
): Promise<AlignmentEvent[]> {
  try {
    const { data, error } = await supabase
      .from('alignment_events')
      .select('*')
      .eq('startup_id', startupId)
      .order('event_date', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting events:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Events error:', err);
    return [];
  }
}
