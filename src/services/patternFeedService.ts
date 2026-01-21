/**
 * PATTERN FEED SERVICE — Sprint 3
 * ================================
 * 
 * "New patterns relevant to you"
 * 
 * Feed sources:
 * - New story matches profile
 * - Story evolves in archetype they saved
 * - Path durability changes for archetype they care about
 * - Investor-linked story appears for tracked investor
 */

import { supabase } from '../lib/supabase';
import type { 
  PatternFeedItem,
  PatternFeedType,
  FounderLearningProfile 
} from '../lib/database.types';
import { getOrCreateLearningProfile } from './personalLibraryService';

// =============================================================================
// TYPES
// =============================================================================

export interface FeedGenerationResult {
  itemsCreated: number;
  errors: string[];
}

// =============================================================================
// GET FEED
// =============================================================================

export async function getPatternFeed(
  startupUrl: string,
  options: {
    limit?: number;
    includeRead?: boolean;
    feedTypes?: PatternFeedType[];
  } = {}
): Promise<PatternFeedItem[]> {
  const { limit = 20, includeRead = false, feedTypes } = options;
  
  try {
    let query = (supabase as any)
      .from('founder_pattern_feed')
      .select('*')
      .eq('startup_url', startupUrl)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (!includeRead) {
      query = query.eq('is_read', false);
    }
    
    if (feedTypes && feedTypes.length > 0) {
      query = query.in('feed_type', feedTypes);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[PatternFeed] Fetch error:', error);
      return [];
    }
    
    return (data || []) as PatternFeedItem[];
  } catch (err) {
    console.error('[PatternFeed] Error:', err);
    return [];
  }
}

export async function getUnreadFeedCount(startupUrl: string): Promise<number> {
  try {
    const { count } = await (supabase as any)
      .from('founder_pattern_feed')
      .select('*', { count: 'exact', head: true })
      .eq('startup_url', startupUrl)
      .eq('is_read', false)
      .eq('is_dismissed', false);
    
    return count || 0;
  } catch (err) {
    return 0;
  }
}

// =============================================================================
// MARK FEED ITEMS
// =============================================================================

export async function markFeedItemRead(itemId: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_pattern_feed')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', itemId);
    
    return !error;
  } catch (err) {
    console.error('[PatternFeed] Mark read error:', err);
    return false;
  }
}

export async function dismissFeedItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_pattern_feed')
      .update({ 
        is_dismissed: true
      })
      .eq('id', itemId);
    
    return !error;
  } catch (err) {
    console.error('[PatternFeed] Dismiss error:', err);
    return false;
  }
}

export async function markAllFeedRead(startupUrl: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_pattern_feed')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('startup_url', startupUrl)
      .eq('is_read', false);
    
    return !error;
  } catch (err) {
    console.error('[PatternFeed] Mark all read error:', err);
    return false;
  }
}

// =============================================================================
// GENERATE FEED ITEMS
// =============================================================================

export async function createFeedItem(
  startupUrl: string,
  item: {
    feedType: PatternFeedType;
    storyId?: string;
    investorId?: string;
    archetype?: string;
    headline: string;
    subheadline?: string;
    detailText?: string;
    relevanceReason?: string;
    relevanceScore?: number;
  }
): Promise<PatternFeedItem | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('founder_pattern_feed')
      .upsert({
        startup_url: startupUrl,
        feed_type: item.feedType,
        story_id: item.storyId,
        investor_id: item.investorId,
        archetype: item.archetype,
        headline: item.headline,
        subheadline: item.subheadline,
        detail_text: item.detailText,
        relevance_reason: item.relevanceReason,
        relevance_score: item.relevanceScore || 0.5,
        is_read: false,
        is_dismissed: false
      }, {
        onConflict: 'startup_url,feed_type,story_id'
      })
      .select()
      .single();
    
    if (error) {
      // Duplicate key is expected, not an error
      if (error.code === '23505') return null;
      console.error('[PatternFeed] Create error:', error);
      return null;
    }
    
    return data as PatternFeedItem;
  } catch (err) {
    console.error('[PatternFeed] Error:', err);
    return null;
  }
}

// =============================================================================
// PATTERN DETECTION & FEED GENERATION
// =============================================================================

/**
 * Generate feed items for a founder based on new patterns
 * This should be called periodically (e.g., daily) or when new stories are added
 */
export async function generateFeedForFounder(
  startupUrl: string
): Promise<FeedGenerationResult> {
  const result: FeedGenerationResult = { itemsCreated: 0, errors: [] };
  
  try {
    // Get founder's learning profile
    const profile = await getOrCreateLearningProfile(startupUrl);
    if (!profile) {
      result.errors.push('No learning profile found');
      return result;
    }
    
    // Get recent stories (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: recentStories } = await supabase
      .from('alignment_stories')
      .select('*')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!recentStories || recentStories.length === 0) {
      return result;
    }
    
    // Get founder's saved stories and tracked investors
    const { data: savedStories } = await (supabase as any)
      .from('story_bookmarks')
      .select('story_id')
      .eq('startup_url', startupUrl);
    
    const savedStoryIds = new Set(savedStories?.map((s: any) => s.story_id) || []);
    
    const { data: trackedInvestors } = await (supabase as any)
      .from('founder_investor_study')
      .select('investor_id')
      .eq('startup_url', startupUrl);
    
    const trackedInvestorIds = new Set(trackedInvestors?.map((i: any) => i.investor_id) || []);
    
    // Process each recent story
    for (const story of recentStories) {
      // Skip already saved stories
      if (savedStoryIds.has(story.id)) continue;
      
      // Check for profile match (new_pattern)
      if (isProfileMatch(story, profile)) {
        const item = await createFeedItem(startupUrl, {
          feedType: 'new_pattern',
          storyId: story.id,
          archetype: story.archetype || undefined,
          headline: 'New alignment pattern detected',
          subheadline: `${story.stage} ${story.industry} startup`,
          detailText: story.what_changed_text,
          relevanceReason: getMatchReason(story, profile),
          relevanceScore: calculateRelevanceScore(story, profile)
        });
        
        if (item) result.itemsCreated++;
      }
      
      // Check for investor link (investor_linked)
      if (story.typical_investors && trackedInvestorIds.size > 0) {
        const linkedInvestor = story.typical_investors.find(
          (id: string) => trackedInvestorIds.has(id)
        );
        
        if (linkedInvestor) {
          const item = await createFeedItem(startupUrl, {
            feedType: 'investor_linked',
            storyId: story.id,
            investorId: linkedInvestor,
            headline: 'Pattern found for tracked investor',
            subheadline: `Relevant to an investor you're watching`,
            detailText: story.result_text,
            relevanceReason: 'This investor typically engages with this pattern',
            relevanceScore: 0.8
          });
          
          if (item) result.itemsCreated++;
        }
      }
    }
    
    // Check for archetype updates (stories with same archetype as saved)
    if (savedStoryIds.size > 0) {
      // Get archetypes of saved stories
      const { data: savedWithArchetypes } = await supabase
        .from('alignment_stories')
        .select('archetype')
        .in('id', Array.from(savedStoryIds) as string[])
        .not('archetype', 'is', null);
      
      const savedArchetypes = new Set(
        savedWithArchetypes?.map(s => s.archetype).filter(Boolean) || []
      );
      
      // Find recent stories with same archetype
      for (const story of recentStories) {
        if (story.archetype && savedArchetypes.has(story.archetype) && !savedStoryIds.has(story.id)) {
          const item = await createFeedItem(startupUrl, {
            feedType: 'archetype_update',
            storyId: story.id,
            archetype: story.archetype,
            headline: 'Update in tracked pattern',
            subheadline: `New ${story.archetype} story`,
            detailText: story.what_changed_text,
            relevanceReason: `You're following the ${story.archetype} pattern`,
            relevanceScore: 0.7
          });
          
          if (item) result.itemsCreated++;
        }
      }
    }
    
    return result;
  } catch (err) {
    console.error('[PatternFeed] Generation error:', err);
    result.errors.push(String(err));
    return result;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isProfileMatch(
  story: any,
  profile: FounderLearningProfile
): boolean {
  let matchScore = 0;
  
  // Stage match
  if (profile.primary_stage && story.stage === profile.primary_stage) {
    matchScore += 1;
  }
  
  // Industry match
  if (profile.primary_industry && story.industry === profile.primary_industry) {
    matchScore += 1;
  }
  
  // Signal overlap
  if (profile.primary_signals && story.signals_present) {
    const overlap = profile.primary_signals.filter(
      s => story.signals_present?.includes(s)
    );
    if (overlap.length > 0) {
      matchScore += 0.5;
    }
  }
  
  // Archetype preference
  if (profile.preferred_archetypes && story.archetype) {
    if (profile.preferred_archetypes.includes(story.archetype)) {
      matchScore += 0.5;
    }
  }
  
  return matchScore >= 1.5; // Require at least 1.5 match points
}

function getMatchReason(
  story: any,
  profile: FounderLearningProfile
): string {
  const reasons: string[] = [];
  
  if (profile.primary_stage && story.stage === profile.primary_stage) {
    reasons.push(`same stage (${story.stage})`);
  }
  
  if (profile.primary_industry && story.industry === profile.primary_industry) {
    reasons.push(`same industry (${story.industry})`);
  }
  
  if (profile.primary_signals && story.signals_present) {
    const overlap = profile.primary_signals.filter(
      s => story.signals_present?.includes(s)
    );
    if (overlap.length > 0) {
      reasons.push(`shared signals`);
    }
  }
  
  return reasons.length > 0 
    ? `Matches your profile: ${reasons.join(', ')}`
    : 'Relevant to your profile';
}

function calculateRelevanceScore(
  story: any,
  profile: FounderLearningProfile
): number {
  let score = 0.3; // Base score
  
  if (profile.primary_stage && story.stage === profile.primary_stage) {
    score += 0.25;
  }
  
  if (profile.primary_industry && story.industry === profile.primary_industry) {
    score += 0.25;
  }
  
  if (profile.primary_signals && story.signals_present) {
    const overlap = profile.primary_signals.filter(
      s => story.signals_present?.includes(s)
    );
    score += Math.min(0.2, overlap.length * 0.05);
  }
  
  if (story.is_canonical) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

// =============================================================================
// STORY EVOLUTION DETECTION
// =============================================================================

/**
 * Check for story evolution and generate feed items
 * Called when story chapters are updated
 */
export async function detectStoryEvolution(
  storyId: string
): Promise<void> {
  try {
    // Get story details
    const { data: story } = await supabase
      .from('alignment_stories')
      .select('*')
      .eq('id', storyId)
      .single();
    
    if (!story) return;
    
    // Find founders who saved this story
    const { data: bookmarks } = await (supabase as any)
      .from('story_bookmarks')
      .select('startup_url')
      .eq('story_id', storyId);
    
    if (!bookmarks || bookmarks.length === 0) return;
    
    // Create evolution feed items for each founder
    for (const bookmark of bookmarks) {
      await createFeedItem(bookmark.startup_url, {
        feedType: 'story_evolution',
        storyId: story.id,
        archetype: story.archetype || undefined,
        headline: 'Story you saved evolved',
        subheadline: story.startup_type_label,
        detailText: 'This pattern has been updated with new developments',
        relevanceReason: 'You saved this pattern',
        relevanceScore: 0.9
      });
    }
  } catch (err) {
    console.error('[PatternFeed] Evolution detection error:', err);
  }
}

/**
 * Check for path durability shifts and notify interested founders
 */
export async function detectDurabilityShift(
  archetype: string,
  previousDurability: string,
  newDurability: string
): Promise<void> {
  try {
    // Find founders who track this archetype
    const { data: profiles } = await (supabase as any)
      .from('founder_learning_profiles')
      .select('startup_url')
      .contains('preferred_archetypes', [archetype]);
    
    if (!profiles || profiles.length === 0) return;
    
    const shiftDirection = getDurabilityDirection(previousDurability, newDurability);
    
    for (const profile of profiles) {
      await createFeedItem(profile.startup_url, {
        feedType: 'path_durability_shift',
        archetype,
        headline: `Path durability ${shiftDirection}`,
        subheadline: `${archetype} pattern`,
        detailText: `Durability changed from ${previousDurability} to ${newDurability}`,
        relevanceReason: `You track the ${archetype} pattern`,
        relevanceScore: 0.75
      });
    }
  } catch (err) {
    console.error('[PatternFeed] Durability shift error:', err);
  }
}

function getDurabilityDirection(prev: string, next: string): string {
  const levels = ['low', 'moderate', 'high', 'very_high'];
  const prevIndex = levels.indexOf(prev.toLowerCase());
  const nextIndex = levels.indexOf(next.toLowerCase());
  
  if (nextIndex > prevIndex) return 'improved';
  if (nextIndex < prevIndex) return 'weakened';
  return 'updated';
}
