/**
 * PERSONAL LIBRARY SERVICE — Sprint 3
 * ====================================
 * 
 * "A private learning journal of how the market responds to me."
 * 
 * Three sections:
 * 1. Saved Patterns — Stories founder explicitly saved
 * 2. Stories Like You — Auto-matched by profile
 * 3. Stories For Your Investors — Investor-linked playbooks
 */

import { supabase } from '../lib/supabase';
import type { 
  AlignmentStoryRow,
  FounderLearningProfile,
  InvestorStudyEntry 
} from '../lib/database.types';

// =============================================================================
// TYPES
// =============================================================================

export interface SavedStory {
  story: AlignmentStoryRow;
  savedAt: string;
  saveReason?: string;
  isStudying: boolean;
  notes?: string;
}

export interface SimilarStory {
  story: AlignmentStoryRow;
  relevanceScore: number;
  matchReasons: string[];
}

export interface InvestorLinkedStory {
  story: AlignmentStoryRow;
  investorId: string;
  investorName?: string;
  relevanceReason: string;
}

export interface PersonalLibrary {
  savedPatterns: SavedStory[];
  storiesLikeYou: SimilarStory[];
  storiesForInvestors: InvestorLinkedStory[];
  profile?: FounderLearningProfile;
  trackedInvestors: InvestorStudyEntry[];
}

// =============================================================================
// LEARNING PROFILE
// =============================================================================

export async function getOrCreateLearningProfile(
  startupUrl: string,
  founderSessionId?: string
): Promise<FounderLearningProfile | null> {
  try {
    // Try to fetch existing profile
    const { data: existing } = await (supabase as any)
      .from('founder_learning_profiles')
      .select('*')
      .eq('startup_url', startupUrl)
      .maybeSingle();
    
    if (existing) {
      return existing as FounderLearningProfile;
    }
    
    // Create new profile with defaults
    const { data: newProfile, error } = await (supabase as any)
      .from('founder_learning_profiles')
      .insert({
        startup_url: startupUrl,
        founder_session_id: founderSessionId,
        stories_viewed: 0,
        stories_saved: 0,
        patterns_discovered: 0,
        learning_streak_days: 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('[PersonalLibrary] Failed to create profile:', error);
      return null;
    }
    
    return newProfile as FounderLearningProfile;
  } catch (err) {
    console.error('[PersonalLibrary] Profile error:', err);
    return null;
  }
}

export async function updateLearningProfile(
  startupUrl: string,
  updates: Partial<FounderLearningProfile>
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_learning_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('startup_url', startupUrl);
    
    return !error;
  } catch (err) {
    console.error('[PersonalLibrary] Profile update error:', err);
    return false;
  }
}

// =============================================================================
// SAVED PATTERNS (BOOKMARKS)
// =============================================================================

export async function getSavedPatterns(startupUrl: string): Promise<SavedStory[]> {
  try {
    // Get bookmarks with story details
    const { data: bookmarks } = await (supabase as any)
      .from('story_bookmarks')
      .select(`
        id,
        story_id,
        created_at,
        save_reason,
        is_studying,
        notes,
        startup_url
      `)
      .eq('startup_url', startupUrl)
      .order('created_at', { ascending: false });
    
    if (!bookmarks || bookmarks.length === 0) {
      return [];
    }
    
    // Fetch the actual stories
    const storyIds = bookmarks.map((b: any) => b.story_id);
    const { data: stories } = await supabase
      .from('alignment_stories')
      .select('*')
      .in('id', storyIds);
    
    if (!stories) return [];
    
    // Map bookmarks to saved stories
    const storyMap = new Map(stories.map(s => [s.id, s]));
    
    return bookmarks
      .filter((b: any) => storyMap.has(b.story_id))
      .map((b: any) => ({
        story: storyMap.get(b.story_id)!,
        savedAt: b.created_at,
        saveReason: b.save_reason,
        isStudying: b.is_studying || false,
        notes: b.notes
      }));
  } catch (err) {
    console.error('[PersonalLibrary] Failed to get saved patterns:', err);
    return [];
  }
}

export async function saveStory(
  startupUrl: string,
  storyId: string,
  saveReason?: string
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('story_bookmarks')
      .upsert({
        startup_url: startupUrl,
        user_id: startupUrl, // Using startup_url as user_id for now
        story_id: storyId,
        save_reason: saveReason,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,story_id'
      });
    
    if (!error) {
      // Log learning activity
      await logLearningActivity(startupUrl, 'story_saved', 'story', storyId);
      
      // Increment saved count - use raw SQL update
      await (supabase as any)
        .from('founder_learning_profiles')
        .update({ 
          stories_saved: (supabase as any).raw('stories_saved + 1'),
          last_learning_activity: new Date().toISOString()
        })
        .eq('startup_url', startupUrl);
    }
    
    return !error;
  } catch (err) {
    console.error('[PersonalLibrary] Failed to save story:', err);
    return false;
  }
}

export async function unsaveStory(startupUrl: string, storyId: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('story_bookmarks')
      .delete()
      .eq('startup_url', startupUrl)
      .eq('story_id', storyId);
    
    if (!error) {
      await logLearningActivity(startupUrl, 'story_unsaved', 'story', storyId);
    }
    
    return !error;
  } catch (err) {
    console.error('[PersonalLibrary] Failed to unsave story:', err);
    return false;
  }
}

export async function markStoryAsStudying(
  startupUrl: string,
  storyId: string,
  isStudying: boolean
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('story_bookmarks')
      .update({ 
        is_studying: isStudying,
        updated_at: new Date().toISOString()
      })
      .eq('startup_url', startupUrl)
      .eq('story_id', storyId);
    
    return !error;
  } catch (err) {
    console.error('[PersonalLibrary] Failed to update studying status:', err);
    return false;
  }
}

// =============================================================================
// STORIES LIKE YOU (AUTO-MATCHED)
// =============================================================================

export async function getStoriesLikeYou(
  startupUrl: string,
  profile?: FounderLearningProfile,
  limit: number = 10
): Promise<SimilarStory[]> {
  try {
    // Get or infer profile
    const learningProfile = profile || await getOrCreateLearningProfile(startupUrl);
    
    if (!learningProfile) {
      return [];
    }
    
    // Build query based on profile
    let query = supabase
      .from('alignment_stories')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(limit * 2); // Fetch more, filter locally
    
    // Filter by stage if known
    if (learningProfile.primary_stage) {
      query = query.eq('stage', learningProfile.primary_stage);
    }
    
    // Filter by industry if known
    if (learningProfile.primary_industry) {
      query = query.eq('industry', learningProfile.primary_industry);
    }
    
    const { data: stories } = await query;
    
    if (!stories || stories.length === 0) {
      // Fallback: get canonical stories
      const { data: fallback } = await supabase
        .from('alignment_stories')
        .select('*')
        .eq('is_canonical', true)
        .order('view_count', { ascending: false })
        .limit(limit);
      
      return (fallback || []).map(story => ({
        story,
        relevanceScore: 0.5,
        matchReasons: ['Popular alignment pattern']
      }));
    }
    
    // Score and rank stories
    const scoredStories = stories.map(story => {
      const matchReasons: string[] = [];
      let score = 0;
      
      // Stage match
      if (learningProfile.primary_stage && story.stage === learningProfile.primary_stage) {
        score += 0.3;
        matchReasons.push(`Same stage: ${story.stage}`);
      }
      
      // Industry match
      if (learningProfile.primary_industry && story.industry === learningProfile.primary_industry) {
        score += 0.3;
        matchReasons.push(`Same industry: ${story.industry}`);
      }
      
      // Signal overlap
      if (learningProfile.primary_signals && story.signals_present) {
        const overlap = learningProfile.primary_signals.filter(
          s => story.signals_present?.includes(s)
        );
        if (overlap.length > 0) {
          score += 0.2 * (overlap.length / learningProfile.primary_signals.length);
          matchReasons.push(`Shared signals: ${overlap.slice(0, 2).join(', ')}`);
        }
      }
      
      // Archetype preference
      if (learningProfile.preferred_archetypes && story.archetype) {
        if (learningProfile.preferred_archetypes.includes(story.archetype)) {
          score += 0.2;
          matchReasons.push(`Preferred archetype: ${story.archetype}`);
        }
      }
      
      // Canonical bonus
      if (story.is_canonical) {
        score += 0.1;
        matchReasons.push('Verified pattern');
      }
      
      return {
        story,
        relevanceScore: Math.min(score, 1.0),
        matchReasons: matchReasons.length > 0 ? matchReasons : ['Relevant to your profile']
      };
    });
    
    // Sort by score and return top N
    return scoredStories
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  } catch (err) {
    console.error('[PersonalLibrary] Failed to get similar stories:', err);
    return [];
  }
}

// =============================================================================
// STORIES FOR YOUR INVESTORS
// =============================================================================

export async function getStoriesForInvestors(
  startupUrl: string,
  limit: number = 10
): Promise<InvestorLinkedStory[]> {
  try {
    // Get tracked investors
    const { data: trackedInvestors } = await (supabase as any)
      .from('founder_investor_study')
      .select('investor_id')
      .eq('startup_url', startupUrl)
      .in('study_status', ['watching', 'studying', 'preparing']);
    
    if (!trackedInvestors || trackedInvestors.length === 0) {
      return [];
    }
    
    const investorIds = trackedInvestors.map((t: any) => t.investor_id);
    
    // Get investor names
    const { data: investors } = await supabase
      .from('investors')
      .select('id, name')
      .in('id', investorIds);
    
    const investorMap = new Map(investors?.map(i => [i.id, i.name]) || []);
    
    // Find stories that mention these investors
    const { data: stories } = await supabase
      .from('alignment_stories')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100); // Fetch more, filter locally
    
    if (!stories) return [];
    
    // Filter stories that reference tracked investors
    const linkedStories: InvestorLinkedStory[] = [];
    
    for (const story of stories) {
      // Check typical_investors array
      if (story.typical_investors) {
        for (const investorId of investorIds) {
          if (story.typical_investors.includes(investorId)) {
            linkedStories.push({
              story,
              investorId,
              investorName: investorMap.get(investorId),
              relevanceReason: 'This investor typically engages with this pattern'
            });
            break;
          }
        }
      }
      
      // Check investor_names array for name matches
      if (story.investor_names && investors) {
        for (const investor of investors) {
          if (investor.name && story.investor_names.includes(investor.name)) {
            if (!linkedStories.find(ls => ls.story.id === story.id)) {
              linkedStories.push({
                story,
                investorId: investor.id,
                investorName: investor.name,
                relevanceReason: `Story mentions ${investor.name}`
              });
            }
            break;
          }
        }
      }
      
      if (linkedStories.length >= limit) break;
    }
    
    return linkedStories.slice(0, limit);
  } catch (err) {
    console.error('[PersonalLibrary] Failed to get investor-linked stories:', err);
    return [];
  }
}

// =============================================================================
// INVESTOR STUDY LIST
// =============================================================================

export async function getTrackedInvestors(startupUrl: string): Promise<InvestorStudyEntry[]> {
  try {
    const { data } = await (supabase as any)
      .from('founder_investor_study')
      .select('*')
      .eq('startup_url', startupUrl)
      .order('added_at', { ascending: false });
    
    return (data || []) as InvestorStudyEntry[];
  } catch (err) {
    console.error('[PersonalLibrary] Failed to get tracked investors:', err);
    return [];
  }
}

export async function trackInvestor(
  startupUrl: string,
  investorId: string,
  status: InvestorStudyEntry['study_status'] = 'watching'
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_investor_study')
      .upsert({
        startup_url: startupUrl,
        investor_id: investorId,
        study_status: status,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'startup_url,investor_id'
      });
    
    if (!error) {
      await logLearningActivity(startupUrl, 'investor_studied', 'investor', investorId);
    }
    
    return !error;
  } catch (err) {
    console.error('[PersonalLibrary] Failed to track investor:', err);
    return false;
  }
}

export async function updateInvestorStudyStatus(
  startupUrl: string,
  investorId: string,
  status: InvestorStudyEntry['study_status']
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_investor_study')
      .update({
        study_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('startup_url', startupUrl)
      .eq('investor_id', investorId);
    
    return !error;
  } catch (err) {
    console.error('[PersonalLibrary] Failed to update investor status:', err);
    return false;
  }
}

// =============================================================================
// FULL PERSONAL LIBRARY
// =============================================================================

export async function getPersonalLibrary(
  startupUrl: string,
  founderSessionId?: string
): Promise<PersonalLibrary> {
  try {
    // Fetch all data in parallel
    const [profile, savedPatterns, trackedInvestors] = await Promise.all([
      getOrCreateLearningProfile(startupUrl, founderSessionId),
      getSavedPatterns(startupUrl),
      getTrackedInvestors(startupUrl)
    ]);
    
    // Get stories like you and investor-linked stories
    const [storiesLikeYou, storiesForInvestors] = await Promise.all([
      getStoriesLikeYou(startupUrl, profile || undefined),
      getStoriesForInvestors(startupUrl)
    ]);
    
    return {
      savedPatterns,
      storiesLikeYou,
      storiesForInvestors,
      profile: profile || undefined,
      trackedInvestors
    };
  } catch (err) {
    console.error('[PersonalLibrary] Failed to get library:', err);
    return {
      savedPatterns: [],
      storiesLikeYou: [],
      storiesForInvestors: [],
      trackedInvestors: []
    };
  }
}

// =============================================================================
// LEARNING ACTIVITY LOGGING
// =============================================================================

export async function logLearningActivity(
  startupUrl: string,
  activityType: string,
  referenceType?: string,
  referenceId?: string,
  referenceData?: Record<string, unknown>
): Promise<void> {
  try {
    await (supabase as any)
      .from('founder_learning_activity')
      .insert({
        startup_url: startupUrl,
        activity_type: activityType,
        reference_type: referenceType,
        reference_id: referenceId,
        reference_data: referenceData
      });
    
    // Update last activity in profile
    await (supabase as any)
      .from('founder_learning_profiles')
      .update({ last_learning_activity: new Date().toISOString() })
      .eq('startup_url', startupUrl);
  } catch (err) {
    // Non-critical, just log
    console.log('[PersonalLibrary] Activity log error:', err);
  }
}

export async function recordStoryView(
  startupUrl: string,
  storyId: string
): Promise<void> {
  await logLearningActivity(startupUrl, 'story_viewed', 'story', storyId);
  
  // Note: Increment handled by database trigger or manual update
  // Skipping complex increment logic for now
}
