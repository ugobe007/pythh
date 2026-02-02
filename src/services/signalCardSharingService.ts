/**
 * Signal Card Sharing Service
 * 
 * Handles sharing signal cards with investors, advisors, and other founders.
 * Also manages collections and community features.
 */

import { supabase } from '../lib/supabase';

// Placeholder until auth is implemented
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ShareType = 'link' | 'email' | 'user';

export interface SignalCardShare {
  id: string;
  item_id: string;
  shared_by: string;
  share_type: ShareType;
  share_target: string | null;
  share_token: string | null;
  can_comment: boolean;
  expires_at: string | null;
  created_at: string;
  accessed_at: string | null;
  access_count: number;
}

export interface SignalCardCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface FounderProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  company_name: string | null;
  company_stage: string | null;
  sectors: string[] | null;
  twitter_handle: string | null;
  linkedin_url: string | null;
  is_public: boolean;
  show_saved_count: boolean;
  show_activity: boolean;
  saved_count: number;
  collection_count: number;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface SignalCardComment {
  id: string;
  item_id: string | null;
  collection_id: string | null;
  user_id: string;
  comment: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: FounderProfile;
  replies?: SignalCardComment[];
}

// ═══════════════════════════════════════════════════════════════
// SHARING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a unique share token
 */
function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create a shareable link for a signal card item
 */
export async function createShareLink(
  itemId: string, 
  options?: { 
    canComment?: boolean; 
    expiresInDays?: number;
  }
): Promise<{ success: boolean; shareUrl?: string; shareToken?: string; error?: string }> {
  try {
    const shareToken = generateShareToken();
    const expiresAt = options?.expiresInDays 
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('signal_card_shares')
      .insert({
        item_id: itemId,
        shared_by: PLACEHOLDER_USER_ID,
        share_type: 'link',
        share_token: shareToken,
        can_comment: options?.canComment ?? false,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    // Build the share URL (would be your actual domain in production)
    const shareUrl = `${window.location.origin}/shared/signal/${shareToken}`;
    
    return { success: true, shareUrl, shareToken };
  } catch (err: any) {
    console.error('Error creating share link:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Share a signal card via email
 */
export async function shareViaEmail(
  itemId: string,
  email: string,
  options?: { canComment?: boolean; message?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const shareToken = generateShareToken();

    const { error } = await supabase
      .from('signal_card_shares')
      .insert({
        item_id: itemId,
        shared_by: PLACEHOLDER_USER_ID,
        share_type: 'email',
        share_target: email,
        share_token: shareToken,
        can_comment: options?.canComment ?? false,
      });

    if (error) throw error;

    // In production, this would send an email via an email service
    // For now, we just record the share
    console.log(`Share email would be sent to: ${email}`);

    return { success: true };
  } catch (err: any) {
    console.error('Error sharing via email:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get a shared item by token
 */
export async function getSharedItem(shareToken: string): Promise<{ 
  success: boolean; 
  item?: any; 
  canComment?: boolean;
  error?: string 
}> {
  try {
    const { data: share, error: shareError } = await supabase
      .from('signal_card_shares')
      .select('*, item:scorecard_items(*)')
      .eq('share_token', shareToken)
      .single();

    if (shareError) throw shareError;

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { success: false, error: 'Share link has expired' };
    }

    // Update access stats
    await supabase
      .from('signal_card_shares')
      .update({ 
        accessed_at: new Date().toISOString(),
        access_count: (share.access_count || 0) + 1
      })
      .eq('id', share.id);

    return { 
      success: true, 
      item: share.item,
      canComment: share.can_comment
    };
  } catch (err: any) {
    console.error('Error fetching shared item:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Revoke a share
 */
export async function revokeShare(shareId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('signal_card_shares')
      .delete()
      .eq('id', shareId)
      .eq('shared_by', PLACEHOLDER_USER_ID);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error revoking share:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all shares for a user
 */
export async function getMyShares(): Promise<{ shares: SignalCardShare[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('signal_card_shares')
      .select('*, item:scorecard_items(entity_name)')
      .eq('shared_by', PLACEHOLDER_USER_ID)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { shares: data || [] };
  } catch (err: any) {
    console.error('Error fetching shares:', err);
    return { shares: [], error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// COLLECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new collection
 */
export async function createCollection(
  name: string, 
  description?: string,
  isPublic?: boolean
): Promise<{ success: boolean; collection?: SignalCardCollection; error?: string }> {
  try {
    const shareToken = isPublic ? generateShareToken() : null;

    const { data, error } = await supabase
      .from('signal_card_collections')
      .insert({
        user_id: PLACEHOLDER_USER_ID,
        name,
        description: description || null,
        is_public: isPublic ?? false,
        share_token: shareToken,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, collection: data };
  } catch (err: any) {
    console.error('Error creating collection:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Add an item to a collection
 */
export async function addToCollection(
  collectionId: string, 
  itemId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current max position
    const { data: existing } = await supabase
      .from('signal_card_collection_items')
      .select('position')
      .eq('collection_id', collectionId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { error } = await supabase
      .from('signal_card_collection_items')
      .insert({
        collection_id: collectionId,
        item_id: itemId,
        position: nextPosition,
        collection_note: note || null,
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error adding to collection:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Remove item from collection
 */
export async function removeFromCollection(
  collectionId: string, 
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('signal_card_collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('item_id', itemId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error removing from collection:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get user's collections
 */
export async function getMyCollections(): Promise<{ collections: SignalCardCollection[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('signal_card_collections')
      .select(`
        *,
        items:signal_card_collection_items(count)
      `)
      .eq('user_id', PLACEHOLDER_USER_ID)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Map to include item count
    const collections = (data || []).map(c => ({
      ...c,
      item_count: c.items?.[0]?.count || 0,
    }));

    return { collections };
  } catch (err: any) {
    console.error('Error fetching collections:', err);
    return { collections: [], error: err.message };
  }
}

/**
 * Get a collection with its items
 */
export async function getCollection(collectionId: string): Promise<{ 
  collection?: SignalCardCollection; 
  items?: any[];
  error?: string 
}> {
  try {
    const { data: collection, error: collError } = await supabase
      .from('signal_card_collections')
      .select('*')
      .eq('id', collectionId)
      .single();

    if (collError) throw collError;

    const { data: items, error: itemsError } = await supabase
      .from('signal_card_collection_items')
      .select(`
        *,
        item:scorecard_items(*)
      `)
      .eq('collection_id', collectionId)
      .order('position', { ascending: true });

    if (itemsError) throw itemsError;

    return { 
      collection, 
      items: (items || []).map(i => ({ ...i.item, collection_note: i.collection_note }))
    };
  } catch (err: any) {
    console.error('Error fetching collection:', err);
    return { error: err.message };
  }
}

/**
 * Get public collection by share token
 */
export async function getPublicCollection(shareToken: string): Promise<{
  collection?: SignalCardCollection;
  items?: any[];
  error?: string;
}> {
  try {
    const { data: collection, error: collError } = await supabase
      .from('signal_card_collections')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_public', true)
      .single();

    if (collError) throw collError;

    const { data: items, error: itemsError } = await supabase
      .from('signal_card_collection_items')
      .select(`
        *,
        item:scorecard_items(*)
      `)
      .eq('collection_id', collection.id)
      .order('position', { ascending: true });

    if (itemsError) throw itemsError;

    return { 
      collection, 
      items: (items || []).map(i => ({ ...i.item, collection_note: i.collection_note }))
    };
  } catch (err: any) {
    console.error('Error fetching public collection:', err);
    return { error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// COMMUNITY / PROFILE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Create or update founder profile
 */
export async function upsertProfile(profile: Partial<FounderProfile>): Promise<{ 
  success: boolean; 
  profile?: FounderProfile; 
  error?: string 
}> {
  try {
    const { data, error } = await supabase
      .from('founder_profiles')
      .upsert({
        user_id: PLACEHOLDER_USER_ID,
        ...profile,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, profile: data };
  } catch (err: any) {
    console.error('Error upserting profile:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get my profile
 */
export async function getMyProfile(): Promise<{ profile?: FounderProfile; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('founder_profiles')
      .select('*')
      .eq('user_id', PLACEHOLDER_USER_ID)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found"
    return { profile: data || undefined };
  } catch (err: any) {
    console.error('Error fetching profile:', err);
    return { error: err.message };
  }
}

/**
 * Follow a founder
 */
export async function followFounder(founderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('founder_follows')
      .insert({
        follower_id: PLACEHOLDER_USER_ID,
        following_id: founderId,
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error following founder:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Unfollow a founder
 */
export async function unfollowFounder(founderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('founder_follows')
      .delete()
      .eq('follower_id', PLACEHOLDER_USER_ID)
      .eq('following_id', founderId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error unfollowing founder:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Discover public founders (for community browsing)
 */
export async function discoverFounders(options?: {
  sectors?: string[];
  stage?: string;
  limit?: number;
}): Promise<{ founders: FounderProfile[]; error?: string }> {
  try {
    let query = supabase
      .from('founder_profiles')
      .select('*')
      .eq('is_public', true)
      .order('follower_count', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by sectors if provided (client-side for now)
    let founders = data || [];
    if (options?.sectors && options.sectors.length > 0) {
      founders = founders.filter(f => 
        f.sectors?.some(s => options.sectors!.includes(s))
      );
    }
    if (options?.stage) {
      founders = founders.filter(f => f.company_stage === options.stage);
    }

    return { founders };
  } catch (err: any) {
    console.error('Error discovering founders:', err);
    return { founders: [], error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// COMMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Add a comment to an item or collection
 */
export async function addComment(
  target: { itemId?: string; collectionId?: string },
  comment: string,
  parentId?: string
): Promise<{ success: boolean; comment?: SignalCardComment; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('signal_card_comments')
      .insert({
        item_id: target.itemId || null,
        collection_id: target.collectionId || null,
        user_id: PLACEHOLDER_USER_ID,
        comment,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, comment: data };
  } catch (err: any) {
    console.error('Error adding comment:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get comments for an item or collection
 */
export async function getComments(target: { itemId?: string; collectionId?: string }): Promise<{
  comments: SignalCardComment[];
  error?: string;
}> {
  try {
    let query = supabase
      .from('signal_card_comments')
      .select(`
        *,
        author:founder_profiles(display_name, avatar_url, company_name)
      `)
      .is('parent_id', null) // Top-level comments only
      .order('created_at', { ascending: true });

    if (target.itemId) {
      query = query.eq('item_id', target.itemId);
    } else if (target.collectionId) {
      query = query.eq('collection_id', target.collectionId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Fetch replies for each comment
    const comments = data || [];
    for (const comment of comments) {
      const { data: replies } = await supabase
        .from('signal_card_comments')
        .select(`
          *,
          author:founder_profiles(display_name, avatar_url, company_name)
        `)
        .eq('parent_id', comment.id)
        .order('created_at', { ascending: true });
      
      comment.replies = replies || [];
    }

    return { comments };
  } catch (err: any) {
    console.error('Error fetching comments:', err);
    return { comments: [], error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS (for sharing outside the app)
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a shareable summary of a signal card
 */
export function generateShareableText(item: any, options?: { includeNotes?: boolean }): string {
  const lines = [
    `📡 Signal Card: ${item.entity_name || 'Unknown'}`,
    `Type: ${item.entity_type}`,
  ];

  if (item.lens_id) {
    lines.push(`Lens: ${item.lens_id}`);
  }

  if (item.score_value !== null) {
    lines.push(`Score: ${item.score_value}`);
  }

  if (item.rank !== null) {
    const delta = item.rank_delta 
      ? ` (${item.rank_delta > 0 ? '+' : ''}${item.rank_delta})`
      : '';
    lines.push(`Rank: #${item.rank}${delta}`);
  }

  if (options?.includeNotes && item.notes?.length > 0) {
    lines.push('');
    lines.push('Notes:');
    item.notes.forEach((n: any) => lines.push(`  • ${n.note}`));
  }

  lines.push('');
  lines.push('Powered by PYTHH — Capital moves in patterns.');

  return lines.join('\n');
}

/**
 * Copy signal card to clipboard
 */
export async function copyToClipboard(item: any): Promise<boolean> {
  try {
    const text = generateShareableText(item, { includeNotes: true });
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
