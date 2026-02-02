/**
 * Signal Card Service
 * 
 * Handles all signal card persistence operations.
 * This is the single source of truth for saving/retrieving signal card data.
 */

import { supabase } from '../lib/supabase';

// Types
export type EntityType = 'startup' | 'investor' | 'signal' | 'score_snapshot';
export type LensId = 'god' | 'yc' | 'sequoia' | 'foundersfund' | 'a16z' | 'greylock';
export type TimeWindow = '1h' | '24h' | '7d' | '30d';
export type ReviewStatus = 'scheduled' | 'completed' | 'snoozed';

export interface SavePayload {
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  lensId?: LensId;
  window?: TimeWindow;
  scoreValue?: number;
  rank?: number;
  rankDelta?: number;
  context?: string;
}

export interface SignalCardItem {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  entity_name: string | null;
  lens_id: LensId | null;
  time_window: TimeWindow | null;
  score_value: number | null;
  rank: number | null;
  rank_delta: number | null;
  context: string | null;
  created_at: string;
  notes?: SignalCardNote[];
  reviews?: SignalCardReview[];
}

export interface SignalCardNote {
  id: string;
  scorecard_item_id: string;
  note: string;
  created_at: string;
}

export interface SignalCardReview {
  id: string;
  scorecard_item_id: string;
  review_at: string;
  status: ReviewStatus;
  created_at: string;
}

// Placeholder user ID until auth is implemented
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Save an item to the signal card
 */
export async function saveToSignalCard(payload: SavePayload): Promise<{ success: boolean; item?: SignalCardItem; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scorecard_items')
      .insert({
        user_id: PLACEHOLDER_USER_ID,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        entity_name: payload.entityName || null,
        lens_id: payload.lensId || null,
        time_window: payload.window || null,
        score_value: payload.scoreValue || null,
        rank: payload.rank || null,
        rank_delta: payload.rankDelta || null,
        context: payload.context || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, item: data };
  } catch (err: any) {
    console.error('Error saving to signal card:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Remove an item from the signal card
 */
export async function removeFromSignalCard(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scorecard_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error removing from signal card:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if an entity is already saved
 */
export async function isEntitySaved(entityType: EntityType, entityId: string, lensId?: LensId): Promise<{ saved: boolean; itemId?: string }> {
  try {
    let query = supabase
      .from('scorecard_items')
      .select('id')
      .eq('user_id', PLACEHOLDER_USER_ID)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (lensId) {
      query = query.eq('lens_id', lensId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return { saved: !!data, itemId: data?.id };
  } catch (err: any) {
    console.error('Error checking saved status:', err);
    return { saved: false };
  }
}

/**
 * Toggle save state - saves if not saved, removes if saved
 */
export async function toggleSaveToSignalCard(payload: SavePayload): Promise<{ saved: boolean; item?: SignalCardItem; error?: string }> {
  const { saved, itemId } = await isEntitySaved(payload.entityType, payload.entityId, payload.lensId);

  if (saved && itemId) {
    const result = await removeFromSignalCard(itemId);
    return { saved: false, error: result.error };
  } else {
    const result = await saveToSignalCard(payload);
    return { saved: true, item: result.item, error: result.error };
  }
}

/**
 * Get all signal card items for the current user
 */
export async function getSignalCardItems(filters?: {
  entityType?: EntityType;
  limit?: number;
}): Promise<{ items: SignalCardItem[]; error?: string }> {
  try {
    let query = supabase
      .from('scorecard_items')
      .select(`
        *,
        notes:scorecard_notes(*),
        reviews:scorecard_reviews(*)
      `)
      .eq('user_id', PLACEHOLDER_USER_ID)
      .order('created_at', { ascending: false });

    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { items: data || [] };
  } catch (err: any) {
    console.error('Error fetching signal card items:', err);
    return { items: [], error: err.message };
  }
}

/**
 * Get upcoming reviews
 */
export async function getUpcomingReviews(daysAhead: number = 7): Promise<{ reviews: (SignalCardReview & { item: SignalCardItem })[]; error?: string }> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('scorecard_reviews')
      .select(`
        *,
        item:scorecard_items(*)
      `)
      .eq('status', 'scheduled')
      .lte('review_at', futureDate.toISOString())
      .order('review_at', { ascending: true });

    if (error) throw error;
    return { reviews: data || [] };
  } catch (err: any) {
    console.error('Error fetching upcoming reviews:', err);
    return { reviews: [], error: err.message };
  }
}

/**
 * Add a note to a signal card item
 */
export async function addNote(itemId: string, note: string): Promise<{ success: boolean; note?: SignalCardNote; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scorecard_notes')
      .insert({
        scorecard_item_id: itemId,
        note,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, note: data };
  } catch (err: any) {
    console.error('Error adding note:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Schedule a review for a signal card item
 */
export async function scheduleReview(itemId: string, reviewAt: Date): Promise<{ success: boolean; review?: SignalCardReview; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scorecard_reviews')
      .insert({
        scorecard_item_id: itemId,
        review_at: reviewAt.toISOString(),
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, review: data };
  } catch (err: any) {
    console.error('Error scheduling review:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update review status
 */
export async function updateReviewStatus(reviewId: string, status: ReviewStatus): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scorecard_reviews')
      .update({ status })
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error updating review status:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Snooze a review by X days
 */
export async function snoozeReview(reviewId: string, days: number): Promise<{ success: boolean; error?: string }> {
  try {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);

    const { error } = await supabase
      .from('scorecard_reviews')
      .update({ 
        review_at: newDate.toISOString(),
        status: 'scheduled'
      })
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error snoozing review:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get quick stats for the signal card
 */
export async function getSignalCardStats(): Promise<{ 
  totalItems: number; 
  upcomingReviews: number; 
  thisWeekSaves: number;
  error?: string;
}> {
  try {
    // Total items
    const { count: totalItems } = await supabase
      .from('scorecard_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', PLACEHOLDER_USER_ID);

    // Upcoming reviews
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const { count: upcomingReviews } = await supabase
      .from('scorecard_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .lte('review_at', futureDate.toISOString());

    // This week saves
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: thisWeekSaves } = await supabase
      .from('scorecard_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', PLACEHOLDER_USER_ID)
      .gte('created_at', weekAgo.toISOString());

    return {
      totalItems: totalItems || 0,
      upcomingReviews: upcomingReviews || 0,
      thisWeekSaves: thisWeekSaves || 0,
    };
  } catch (err: any) {
    console.error('Error fetching signal card stats:', err);
    return { totalItems: 0, upcomingReviews: 0, thisWeekSaves: 0, error: err.message };
  }
}

/**
 * Get saved entity IDs for quick lookup (for rendering save buttons)
 */
export async function getSavedEntityIds(entityType?: EntityType): Promise<Set<string>> {
  try {
    let query = supabase
      .from('scorecard_items')
      .select('entity_id, lens_id')
      .eq('user_id', PLACEHOLDER_USER_ID);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Create composite keys: "entityId" or "entityId:lensId"
    const ids = new Set<string>();
    data?.forEach(item => {
      ids.add(item.entity_id);
      if (item.lens_id) {
        ids.add(`${item.entity_id}:${item.lens_id}`);
      }
    });

    return ids;
  } catch (err: any) {
    console.error('Error fetching saved entity IDs:', err);
    return new Set();
  }
}
