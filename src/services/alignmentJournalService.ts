/**
 * ALIGNMENT JOURNAL SERVICE — Sprint 3
 * =====================================
 * 
 * Private notes on stories, investors, and timeline events.
 * 
 * "Human cognition layered on top of system cognition."
 * 
 * This is how:
 * - Traders build edge
 * - Scientists build insight
 * - Doctors build judgment
 */

import { supabase } from '../lib/supabase';
import type { 
  AlignmentJournalEntry,
  JournalNoteType 
} from '../lib/database.types';
import { logLearningActivity } from './personalLibraryService';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateNoteParams {
  startupUrl: string;
  noteType: JournalNoteType;
  noteText: string;
  storyId?: string;
  investorId?: string;
  eventId?: string;
  archetype?: string;
  noteTags?: string[];
}

export interface JournalStats {
  totalNotes: number;
  notesByType: Record<JournalNoteType, number>;
  recentNotes: AlignmentJournalEntry[];
  pinnedNotes: AlignmentJournalEntry[];
}

// =============================================================================
// CREATE / UPDATE NOTES
// =============================================================================

export async function createJournalNote(
  params: CreateNoteParams
): Promise<AlignmentJournalEntry | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('founder_alignment_journal')
      .insert({
        startup_url: params.startupUrl,
        note_type: params.noteType,
        note_text: params.noteText,
        story_id: params.storyId,
        investor_id: params.investorId,
        event_id: params.eventId,
        archetype: params.archetype,
        note_tags: params.noteTags,
        is_pinned: false,
        is_private: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Journal] Create note error:', error);
      return null;
    }
    
    // Log learning activity
    await logLearningActivity(
      params.startupUrl,
      'note_created',
      params.noteType,
      params.storyId || params.investorId || params.eventId
    );
    
    return data as AlignmentJournalEntry;
  } catch (err) {
    console.error('[Journal] Error:', err);
    return null;
  }
}

export async function updateJournalNote(
  noteId: string,
  updates: {
    noteText?: string;
    noteTags?: string[];
    isPinned?: boolean;
  }
): Promise<boolean> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (updates.noteText !== undefined) {
      updateData.note_text = updates.noteText;
    }
    if (updates.noteTags !== undefined) {
      updateData.note_tags = updates.noteTags;
    }
    if (updates.isPinned !== undefined) {
      updateData.is_pinned = updates.isPinned;
    }
    
    const { error } = await (supabase as any)
      .from('founder_alignment_journal')
      .update(updateData)
      .eq('id', noteId);
    
    return !error;
  } catch (err) {
    console.error('[Journal] Update error:', err);
    return false;
  }
}

export async function deleteJournalNote(noteId: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('founder_alignment_journal')
      .delete()
      .eq('id', noteId);
    
    return !error;
  } catch (err) {
    console.error('[Journal] Delete error:', err);
    return false;
  }
}

// =============================================================================
// FETCH NOTES
// =============================================================================

export async function getJournalNotes(
  startupUrl: string,
  options: {
    noteType?: JournalNoteType;
    storyId?: string;
    investorId?: string;
    archetype?: string;
    limit?: number;
    pinnedOnly?: boolean;
  } = {}
): Promise<AlignmentJournalEntry[]> {
  try {
    let query = (supabase as any)
      .from('founder_alignment_journal')
      .select('*')
      .eq('startup_url', startupUrl)
      .order('created_at', { ascending: false });
    
    if (options.noteType) {
      query = query.eq('note_type', options.noteType);
    }
    
    if (options.storyId) {
      query = query.eq('story_id', options.storyId);
    }
    
    if (options.investorId) {
      query = query.eq('investor_id', options.investorId);
    }
    
    if (options.archetype) {
      query = query.eq('archetype', options.archetype);
    }
    
    if (options.pinnedOnly) {
      query = query.eq('is_pinned', true);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Journal] Fetch error:', error);
      return [];
    }
    
    return (data || []) as AlignmentJournalEntry[];
  } catch (err) {
    console.error('[Journal] Error:', err);
    return [];
  }
}

export async function getNotesForStory(
  startupUrl: string,
  storyId: string
): Promise<AlignmentJournalEntry[]> {
  return getJournalNotes(startupUrl, { storyId });
}

export async function getNotesForInvestor(
  startupUrl: string,
  investorId: string
): Promise<AlignmentJournalEntry[]> {
  return getJournalNotes(startupUrl, { investorId });
}

export async function getPinnedNotes(
  startupUrl: string
): Promise<AlignmentJournalEntry[]> {
  return getJournalNotes(startupUrl, { pinnedOnly: true });
}

// =============================================================================
// JOURNAL STATS
// =============================================================================

export async function getJournalStats(startupUrl: string): Promise<JournalStats> {
  try {
    // Get all notes
    const { data: allNotes } = await (supabase as any)
      .from('founder_alignment_journal')
      .select('*')
      .eq('startup_url', startupUrl)
      .order('created_at', { ascending: false });
    
    const notes = (allNotes || []) as AlignmentJournalEntry[];
    
    // Calculate stats
    const notesByType: Record<JournalNoteType, number> = {
      story: 0,
      investor: 0,
      timeline: 0,
      pattern: 0,
      general: 0
    };
    
    for (const note of notes) {
      if (note.note_type in notesByType) {
        notesByType[note.note_type]++;
      }
    }
    
    return {
      totalNotes: notes.length,
      notesByType,
      recentNotes: notes.slice(0, 5),
      pinnedNotes: notes.filter(n => n.is_pinned)
    };
  } catch (err) {
    console.error('[Journal] Stats error:', err);
    return {
      totalNotes: 0,
      notesByType: { story: 0, investor: 0, timeline: 0, pattern: 0, general: 0 },
      recentNotes: [],
      pinnedNotes: []
    };
  }
}

// =============================================================================
// PIN / UNPIN
// =============================================================================

export async function toggleNotePin(noteId: string): Promise<boolean> {
  try {
    // Get current state
    const { data: note } = await (supabase as any)
      .from('founder_alignment_journal')
      .select('is_pinned')
      .eq('id', noteId)
      .single();
    
    if (!note) return false;
    
    // Toggle
    const { error } = await (supabase as any)
      .from('founder_alignment_journal')
      .update({ 
        is_pinned: !note.is_pinned,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);
    
    return !error;
  } catch (err) {
    console.error('[Journal] Toggle pin error:', err);
    return false;
  }
}

// =============================================================================
// QUICK NOTES (INLINE)
// =============================================================================

/**
 * Quick note on a story (from story card or detail view)
 */
export async function addStoryNote(
  startupUrl: string,
  storyId: string,
  noteText: string,
  tags?: string[]
): Promise<AlignmentJournalEntry | null> {
  return createJournalNote({
    startupUrl,
    noteType: 'story',
    noteText,
    storyId,
    noteTags: tags
  });
}

/**
 * Quick note on an investor (from prep mode or investor study)
 */
export async function addInvestorNote(
  startupUrl: string,
  investorId: string,
  noteText: string,
  tags?: string[]
): Promise<AlignmentJournalEntry | null> {
  return createJournalNote({
    startupUrl,
    noteType: 'investor',
    noteText,
    investorId,
    noteTags: tags
  });
}

/**
 * Quick note on a timeline event
 */
export async function addTimelineNote(
  startupUrl: string,
  eventId: string,
  noteText: string,
  tags?: string[]
): Promise<AlignmentJournalEntry | null> {
  return createJournalNote({
    startupUrl,
    noteType: 'timeline',
    noteText,
    eventId,
    noteTags: tags
  });
}

/**
 * Quick note on a pattern/archetype
 */
export async function addPatternNote(
  startupUrl: string,
  archetype: string,
  noteText: string,
  tags?: string[]
): Promise<AlignmentJournalEntry | null> {
  return createJournalNote({
    startupUrl,
    noteType: 'pattern',
    noteText,
    archetype,
    noteTags: tags
  });
}

/**
 * General learning note
 */
export async function addGeneralNote(
  startupUrl: string,
  noteText: string,
  tags?: string[]
): Promise<AlignmentJournalEntry | null> {
  return createJournalNote({
    startupUrl,
    noteType: 'general',
    noteText,
    noteTags: tags
  });
}

// =============================================================================
// SEARCH NOTES
// =============================================================================

export async function searchNotes(
  startupUrl: string,
  searchTerm: string
): Promise<AlignmentJournalEntry[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('founder_alignment_journal')
      .select('*')
      .eq('startup_url', startupUrl)
      .ilike('note_text', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('[Journal] Search error:', error);
      return [];
    }
    
    return (data || []) as AlignmentJournalEntry[];
  } catch (err) {
    console.error('[Journal] Error:', err);
    return [];
  }
}

export async function getNotesByTag(
  startupUrl: string,
  tag: string
): Promise<AlignmentJournalEntry[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('founder_alignment_journal')
      .select('*')
      .eq('startup_url', startupUrl)
      .contains('note_tags', [tag])
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Journal] Tag search error:', error);
      return [];
    }
    
    return (data || []) as AlignmentJournalEntry[];
  } catch (err) {
    console.error('[Journal] Error:', err);
    return [];
  }
}
