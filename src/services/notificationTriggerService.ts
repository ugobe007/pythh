/**
 * NOTIFICATION TRIGGER SERVICE — Sprint 4
 * ========================================
 * 
 * The trigger matrix that determines when founders get notified.
 * 
 * Core Principles:
 * ❌ Never spam, sell, nag, create anxiety, show scores, say "act now"
 * ✅ Calm radar update from someone who understands the market
 * 
 * This service:
 * 1. Evaluates events against the trigger matrix
 * 2. Queues notifications for meaningful changes
 * 3. Prevents noise and over-notification
 */

import { supabase } from '../lib/supabase';
import type {
  NotificationTriggerType,
  NotificationCategory,
  NotificationQueueItem,
  NotificationTrigger
} from '../lib/database.types';

// =============================================================================
// TRIGGER EVALUATION
// =============================================================================

export interface ChangeEvent {
  type: 'investor' | 'alignment' | 'signal' | 'milestone';
  action: 'appeared' | 'disappeared' | 'improved' | 'dropped' | 'strengthened' | 'weakened' | 'detected';
  data: Record<string, unknown>;
}

export interface TriggerResult {
  shouldTrigger: boolean;
  triggerType?: NotificationTriggerType;
  priority?: number;
  category?: NotificationCategory;
  bulletText?: string;
}

/**
 * Maps a change event to a notification trigger type
 */
function mapEventToTriggerType(event: ChangeEvent): NotificationTriggerType | null {
  const { type, action } = event;
  
  if (type === 'investor') {
    if (action === 'appeared') return 'investor_appeared';
    if (action === 'improved') return 'investor_activated'; // monitoring → active
    if (action === 'disappeared') return 'investor_disappeared';
  }
  
  if (type === 'alignment') {
    if (action === 'improved') return 'alignment_improved';
    if (action === 'dropped') return 'alignment_dropped';
  }
  
  if (type === 'signal') {
    if (action === 'strengthened' || action === 'detected') return 'signal_strengthened';
    if (action === 'weakened') return 'signal_weakened';
  }
  
  if (type === 'milestone') {
    if (action === 'detected') return 'milestone_detected';
  }
  
  return null;
}

/**
 * Check if a trigger type is enabled in the configuration
 */
async function isTriggerEnabled(triggerType: NotificationTriggerType): Promise<NotificationTrigger | null> {
  const { data } = await (supabase as any)
    .from('notification_triggers')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('is_enabled', true)
    .single();
  
  return data as NotificationTrigger | null;
}

/**
 * Format the bullet text from template and data
 */
function formatBulletText(template: string, data: Record<string, unknown>): string {
  let text = template;
  
  // Replace {{variable}} patterns with data values
  for (const [key, value] of Object.entries(data)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    text = text.replace(pattern, String(value));
  }
  
  // Clean up any unreplaced variables
  text = text.replace(/\{\{[^}]+\}\}/g, '');
  
  return text.trim();
}

/**
 * Evaluate whether a change event should trigger a notification
 */
export async function evaluateTrigger(event: ChangeEvent): Promise<TriggerResult> {
  // Map event to trigger type
  const triggerType = mapEventToTriggerType(event);
  
  if (!triggerType) {
    return { shouldTrigger: false };
  }
  
  // Check if this trigger is enabled
  const trigger = await isTriggerEnabled(triggerType);
  
  if (!trigger) {
    return { shouldTrigger: false };
  }
  
  // Format the bullet text
  const bulletText = formatBulletText(trigger.bullet_template, event.data);
  
  return {
    shouldTrigger: true,
    triggerType,
    priority: trigger.priority,
    category: trigger.category as NotificationCategory,
    bulletText
  };
}

// =============================================================================
// QUEUE MANAGEMENT
// =============================================================================

export interface QueueNotificationParams {
  startupId?: string;
  startupUrl?: string;
  founderSessionId?: string;
  triggerType: NotificationTriggerType;
  triggerData: Record<string, unknown>;
  priority?: number;
}

/**
 * Add a notification to the queue
 * Handles deduplication automatically via DB constraint
 */
export async function queueNotification(params: QueueNotificationParams): Promise<{ success: boolean; queued?: boolean }> {
  const { startupId, startupUrl, founderSessionId, triggerType, triggerData, priority = 3 } = params;
  
  try {
    const { error } = await (supabase as any)
      .from('notification_queue')
      .insert({
        startup_id: startupId,
        startup_url: startupUrl,
        founder_session_id: founderSessionId,
        trigger_type: triggerType,
        trigger_data: triggerData,
        priority
      });
    
    // Unique constraint violation means it's already queued for today
    if (error?.code === '23505') {
      return { success: true, queued: false };
    }
    
    if (error) {
      console.error('[NotificationTrigger] Queue error:', error);
      return { success: false };
    }
    
    return { success: true, queued: true };
  } catch (err) {
    console.error('[NotificationTrigger] Queue exception:', err);
    return { success: false };
  }
}

/**
 * Process a change event end-to-end:
 * 1. Evaluate if it should trigger
 * 2. Queue if yes
 */
export async function processChangeEvent(
  event: ChangeEvent,
  context: { startupId?: string; startupUrl?: string; founderSessionId?: string }
): Promise<{ triggered: boolean; queued: boolean }> {
  // Evaluate the trigger
  const result = await evaluateTrigger(event);
  
  if (!result.shouldTrigger || !result.triggerType) {
    return { triggered: false, queued: false };
  }
  
  // Queue the notification
  const queueResult = await queueNotification({
    startupId: context.startupId,
    startupUrl: context.startupUrl,
    founderSessionId: context.founderSessionId,
    triggerType: result.triggerType,
    triggerData: {
      ...event.data,
      _bulletText: result.bulletText,
      _category: result.category
    },
    priority: result.priority
  });
  
  return {
    triggered: true,
    queued: queueResult.queued || false
  };
}

// =============================================================================
// CHANGE DETECTION INTEGRATION
// =============================================================================

/**
 * Analyze alignment changes and generate appropriate trigger events
 */
export function detectTriggerableChanges(
  previousState: {
    alignmentStatus?: string;
    investorCount?: number;
    investors?: { id: string; name: string; state?: string }[];
    signals?: string[];
  },
  currentState: {
    alignmentStatus?: string;
    investorCount?: number;
    investors?: { id: string; name: string; state?: string }[];
    signals?: string[];
  }
): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  
  // 1. Check for alignment state improvement
  const alignmentRank: Record<string, number> = {
    'cold': 0, 'limited': 0,
    'forming': 1,
    'active': 2,
    'strong': 3
  };
  
  const prevRank = alignmentRank[previousState.alignmentStatus?.toLowerCase() || 'cold'] || 0;
  const currRank = alignmentRank[currentState.alignmentStatus?.toLowerCase() || 'cold'] || 0;
  
  if (currRank > prevRank) {
    events.push({
      type: 'alignment',
      action: 'improved',
      data: {
        old_alignment: previousState.alignmentStatus,
        new_alignment: currentState.alignmentStatus,
        new_state: currentState.alignmentStatus
      }
    });
  } else if (currRank < prevRank && currRank - prevRank <= -2) {
    // Only trigger on significant drops (2+ levels)
    events.push({
      type: 'alignment',
      action: 'dropped',
      data: {
        old_alignment: previousState.alignmentStatus,
        new_alignment: currentState.alignmentStatus
      }
    });
  }
  
  // 2. Check for new investors
  const prevInvestorIds = new Set((previousState.investors || []).map(i => i.id));
  const currInvestors = currentState.investors || [];
  const newInvestors = currInvestors.filter(i => !prevInvestorIds.has(i.id));
  
  if (newInvestors.length > 0) {
    // Group by sector if possible, otherwise generic
    events.push({
      type: 'investor',
      action: 'appeared',
      data: {
        count: newInvestors.length,
        investor_names: newInvestors.map(i => i.name).slice(0, 3),
        sector: 'seed' // Would need to infer from actual data
      }
    });
  }
  
  // 3. Check for investor state changes (monitoring → active)
  const prevInvestorMap = new Map((previousState.investors || []).map(i => [i.id, i]));
  for (const curr of currInvestors) {
    const prev = prevInvestorMap.get(curr.id);
    if (prev && prev.state === 'monitoring' && curr.state === 'active') {
      events.push({
        type: 'investor',
        action: 'improved',
        data: {
          investor_name: curr.name,
          previous_state: 'monitoring',
          new_state: 'active'
        }
      });
    }
  }
  
  // 4. Check for disappeared investors (only if significant)
  const currInvestorIds = new Set(currInvestors.map(i => i.id));
  const disappearedInvestors = (previousState.investors || []).filter(i => !currInvestorIds.has(i.id));
  
  if (disappearedInvestors.length > 0 && disappearedInvestors.length >= 2) {
    // Only notify on significant loss
    events.push({
      type: 'investor',
      action: 'disappeared',
      data: {
        count: disappearedInvestors.length
      }
    });
  }
  
  // 5. Check for new signals (structural/durable only)
  const prevSignals = new Set(previousState.signals || []);
  const currSignals = currentState.signals || [];
  const newSignals = currSignals.filter(s => !prevSignals.has(s));
  
  // Filter for high-value signals
  const highValueSignalPatterns = [
    'design_partner', 'enterprise', 'pilot',
    'revenue', 'funding', 'hire',
    'open_source', 'regulatory', 'patent'
  ];
  
  for (const signal of newSignals) {
    const isHighValue = highValueSignalPatterns.some(p => 
      signal.toLowerCase().includes(p)
    );
    
    if (isHighValue) {
      events.push({
        type: 'signal',
        action: 'strengthened',
        data: {
          signal_type: signal,
          signal_name: signal
        }
      });
    }
  }
  
  return events;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get unprocessed queue items for a startup
 */
export async function getUnprocessedQueue(startupUrl: string): Promise<NotificationQueueItem[]> {
  const { data } = await (supabase as any)
    .from('notification_queue')
    .select('*')
    .eq('startup_url', startupUrl)
    .is('processed_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });
  
  return (data || []) as NotificationQueueItem[];
}

/**
 * Get all trigger configurations
 */
export async function getTriggerConfigs(): Promise<NotificationTrigger[]> {
  const { data } = await (supabase as any)
    .from('notification_triggers')
    .select('*')
    .order('priority', { ascending: true });
  
  return (data || []) as NotificationTrigger[];
}
