/**
 * WEEKLY DIGEST SERVICE — Sprint 4
 * =================================
 * 
 * The batching and digest generation engine.
 * 
 * Rules:
 * - Max 1 digest per week per founder
 * - If multiple events, batch into one (1-3 bullets max)
 * - If nothing meaningful changed → send nothing
 * - Silence builds trust
 * 
 * Copy Principles:
 * - Subject: "Your investor alignment just changed" (locked)
 * - Opening: "Something in your startup profile shifted this week."
 * - No footer marketing, no CTA stacking, no advice
 * - Train: "When Pythh emails me, it matters."
 */

import { supabase } from '../lib/supabase';
import type {
  NotificationQueueItem,
  WeeklyDigest,
  DigestBullet,
  NotificationCategory
} from '../lib/database.types';

// =============================================================================
// ISO WEEK HELPERS
// =============================================================================

/**
 * Get ISO week string (e.g., "2026-W03")
 */
export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// =============================================================================
// DIGEST GENERATION
// =============================================================================

const LOCKED_SUBJECT = 'Your investor alignment just changed';
const LOCKED_HEADLINE = 'Something in your startup profile shifted this week.';

/**
 * Priority order for bullets (1 = show first)
 */
const CATEGORY_PRIORITY: Record<NotificationCategory, number> = {
  positive: 1,
  neutral: 2,
  negative: 3
};

/**
 * Convert queue items to digest bullets
 */
function createBullets(items: NotificationQueueItem[]): DigestBullet[] {
  // Sort by priority then category
  const sorted = [...items].sort((a, b) => {
    // First by explicit priority
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Then by category
    const catA = (a.trigger_data as Record<string, unknown>)?._category as NotificationCategory || 'neutral';
    const catB = (b.trigger_data as Record<string, unknown>)?._category as NotificationCategory || 'neutral';
    return CATEGORY_PRIORITY[catA] - CATEGORY_PRIORITY[catB];
  });
  
  // Take top 3
  const top3 = sorted.slice(0, 3);
  
  // Convert to bullets
  return top3.map(item => {
    const data = item.trigger_data as Record<string, unknown>;
    return {
      type: (data._category as NotificationCategory) || 'neutral',
      text: (data._bulletText as string) || formatDefaultBullet(item),
      trigger_type: item.trigger_type
    };
  });
}

/**
 * Default bullet formatting if template wasn't applied
 */
function formatDefaultBullet(item: NotificationQueueItem): string {
  const data = item.trigger_data as Record<string, unknown>;
  
  switch (item.trigger_type) {
    case 'investor_appeared':
      return `You became visible to ${data.count || 'new'} investors`;
    case 'investor_activated':
      return `${data.investor_name || 'An investor'} moved from monitoring to active`;
    case 'alignment_improved':
      return `Your alignment state improved to ${data.new_state || 'active'}`;
    case 'signal_strengthened':
      return `Your ${data.signal_type || 'traction'} signal strengthened`;
    case 'milestone_detected':
      return `${data.milestone_type || 'A new'} milestone detected`;
    case 'investor_disappeared':
      return 'One investor dropped off after recent silence';
    case 'alignment_dropped':
      return 'Your alignment state shifted';
    case 'signal_weakened':
      return 'One of your signals needs attention';
    default:
      return 'Your investor alignment changed';
  }
}

/**
 * Check if any items are meaningful enough to warrant a digest
 */
function hasMeaningfulChanges(items: NotificationQueueItem[]): boolean {
  // Must have at least one item
  if (items.length === 0) return false;
  
  // Check for at least one positive trigger or significant negative
  const hasPositive = items.some(i => 
    ['investor_appeared', 'investor_activated', 'alignment_improved', 'signal_strengthened', 'milestone_detected']
      .includes(i.trigger_type)
  );
  
  // For negative only, need multiple or high priority
  if (!hasPositive) {
    const negativeCount = items.filter(i => 
      ['investor_disappeared', 'alignment_dropped', 'signal_weakened'].includes(i.trigger_type)
    ).length;
    return negativeCount >= 2;
  }
  
  return true;
}

// =============================================================================
// DIGEST CREATION
// =============================================================================

export interface GenerateDigestParams {
  startupUrl: string;
  startupId?: string;
  founderSessionId?: string;
  founderEmail?: string;
  deliveryChannel?: 'in_app' | 'email' | 'both';
}

export interface GenerateDigestResult {
  created: boolean;
  digest?: WeeklyDigest;
  reason?: string;
}

/**
 * Generate a weekly digest for a startup
 * 
 * This:
 * 1. Fetches unprocessed queue items
 * 2. Checks if changes are meaningful
 * 3. Creates digest with 1-3 bullets
 * 4. Marks queue items as processed
 */
export async function generateWeeklyDigest(params: GenerateDigestParams): Promise<GenerateDigestResult> {
  const { startupUrl, startupId, founderSessionId, founderEmail, deliveryChannel = 'in_app' } = params;
  const currentWeek = getISOWeek();
  
  // 1. Check if digest already exists for this week
  const { data: existingDigest } = await (supabase as any)
    .from('weekly_digests')
    .select('id')
    .eq('startup_url', startupUrl)
    .eq('digest_week', currentWeek)
    .single();
  
  if (existingDigest) {
    return { created: false, reason: 'Digest already exists for this week' };
  }
  
  // 2. Fetch unprocessed queue items
  const { data: queueItems } = await (supabase as any)
    .from('notification_queue')
    .select('*')
    .eq('startup_url', startupUrl)
    .is('processed_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });
  
  const items = (queueItems || []) as NotificationQueueItem[];
  
  // 3. Check if meaningful
  if (!hasMeaningfulChanges(items)) {
    return { created: false, reason: 'No meaningful changes to report' };
  }
  
  // 4. Create bullets
  const bullets = createBullets(items);
  
  // 5. Create digest
  const digestData = {
    startup_id: startupId,
    startup_url: startupUrl,
    founder_session_id: founderSessionId,
    founder_email: founderEmail,
    subject: LOCKED_SUBJECT,
    headline: LOCKED_HEADLINE,
    bullets,
    delivery_channel: deliveryChannel,
    status: 'pending',
    digest_week: currentWeek
  };
  
  const { data: newDigest, error: digestError } = await (supabase as any)
    .from('weekly_digests')
    .insert(digestData)
    .select()
    .single();
  
  if (digestError) {
    console.error('[WeeklyDigest] Failed to create digest:', digestError);
    return { created: false, reason: 'Database error creating digest' };
  }
  
  // 6. Mark queue items as processed
  const itemIds = items.map(i => i.id);
  if (itemIds.length > 0) {
    await (supabase as any)
      .from('notification_queue')
      .update({ processed_at: new Date().toISOString() })
      .in('id', itemIds);
  }
  
  // 7. Update notification indicator
  await updateNotificationIndicator(startupUrl, founderSessionId);
  
  return { created: true, digest: newDigest as WeeklyDigest };
}

// =============================================================================
// NOTIFICATION INDICATOR
// =============================================================================

/**
 * Update the unread notification count for a startup
 */
async function updateNotificationIndicator(startupUrl: string, founderSessionId?: string): Promise<void> {
  // Count unread digests
  const { count } = await (supabase as any)
    .from('weekly_digests')
    .select('*', { count: 'exact', head: true })
    .eq('startup_url', startupUrl)
    .in('status', ['pending', 'delivered']);
  
  // Upsert indicator
  await (supabase as any)
    .from('notification_indicators')
    .upsert({
      startup_url: startupUrl,
      founder_session_id: founderSessionId,
      unread_count: count || 0,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'startup_url'
    });
}

// =============================================================================
// DIGEST RETRIEVAL
// =============================================================================

/**
 * Get pending/unread digests for a startup
 */
export async function getUnreadDigests(startupUrl: string): Promise<WeeklyDigest[]> {
  const { data } = await (supabase as any)
    .from('weekly_digests')
    .select('*')
    .eq('startup_url', startupUrl)
    .in('status', ['pending', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(5);
  
  return (data || []) as WeeklyDigest[];
}

/**
 * Get all digests for a startup (history)
 */
export async function getDigestHistory(startupUrl: string, limit = 10): Promise<WeeklyDigest[]> {
  const { data } = await (supabase as any)
    .from('weekly_digests')
    .select('*')
    .eq('startup_url', startupUrl)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (data || []) as WeeklyDigest[];
}

/**
 * Get notification indicator for UI badge
 */
export async function getNotificationIndicator(startupUrl: string): Promise<{ unreadCount: number; hasNew: boolean }> {
  const { data } = await (supabase as any)
    .from('notification_indicators')
    .select('*')
    .eq('startup_url', startupUrl)
    .single();
  
  if (!data) {
    return { unreadCount: 0, hasNew: false };
  }
  
  return {
    unreadCount: data.unread_count || 0,
    hasNew: data.unread_count > 0
  };
}

// =============================================================================
// DIGEST INTERACTIONS
// =============================================================================

/**
 * Mark a digest as viewed (in-app shown)
 */
export async function markDigestViewed(digestId: string): Promise<void> {
  await (supabase as any)
    .from('weekly_digests')
    .update({
      status: 'viewed',
      in_app_shown_at: new Date().toISOString()
    })
    .eq('id', digestId);
}

/**
 * Mark a digest as clicked (user engaged)
 */
export async function markDigestClicked(digestId: string): Promise<void> {
  await (supabase as any)
    .from('weekly_digests')
    .update({
      status: 'clicked',
      clicked_at: new Date().toISOString()
    })
    .eq('id', digestId);
}

/**
 * Dismiss a digest
 */
export async function dismissDigest(digestId: string): Promise<void> {
  await (supabase as any)
    .from('weekly_digests')
    .update({ status: 'dismissed' })
    .eq('id', digestId);
}

/**
 * Mark all digests as seen for a startup
 */
export async function markAllDigestsSeen(startupUrl: string): Promise<void> {
  // Update indicator
  await (supabase as any)
    .from('notification_indicators')
    .update({
      unread_count: 0,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('startup_url', startupUrl);
  
  // Update pending digests to delivered
  await (supabase as any)
    .from('weekly_digests')
    .update({ status: 'delivered' })
    .eq('startup_url', startupUrl)
    .eq('status', 'pending');
}

// =============================================================================
// BATCH PROCESSING (for cron/scheduled runs)
// =============================================================================

/**
 * Process all startups that need weekly digests
 * This would typically run via cron job
 */
export async function processWeeklyDigestBatch(): Promise<{
  processed: number;
  created: number;
  skipped: number;
}> {
  // Get distinct startup URLs with unprocessed queue items
  const { data: startups } = await (supabase as any)
    .from('notification_queue')
    .select('startup_url, founder_session_id')
    .is('processed_at', null)
    .not('startup_url', 'is', null);
  
  if (!startups || startups.length === 0) {
    return { processed: 0, created: 0, skipped: 0 };
  }
  
  // Deduplicate
  const uniqueStartups = Array.from(
    new Map(startups.map((s: { startup_url: string; founder_session_id: string }) => [s.startup_url, s])).values()
  ) as { startup_url: string; founder_session_id: string }[];
  
  let created = 0;
  let skipped = 0;
  
  for (const startup of uniqueStartups) {
    const result = await generateWeeklyDigest({
      startupUrl: startup.startup_url,
      founderSessionId: startup.founder_session_id
    });
    
    if (result.created) {
      created++;
    } else {
      skipped++;
    }
  }
  
  return {
    processed: uniqueStartups.length,
    created,
    skipped
  };
}
