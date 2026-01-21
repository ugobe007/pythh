/**
 * QUICK NOTE COMPONENT — Sprint 3
 * ================================
 * 
 * Inline note-taking for stories, investors, and timeline events.
 * "Human cognition layered on top of system cognition."
 */

import React, { useState } from 'react';
import { FileText, X, Pin, Save, Loader2 } from 'lucide-react';
import { 
  addStoryNote, 
  addInvestorNote, 
  addPatternNote,
  addGeneralNote 
} from '../../services/alignmentJournalService';

// =============================================================================
// TYPES
// =============================================================================

interface QuickNoteProps {
  startupUrl: string;
  noteType: 'story' | 'investor' | 'pattern' | 'general';
  referenceId?: string;    // storyId, investorId, or archetype
  referenceName?: string;  // For display
  onNoteSaved?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function QuickNote({
  startupUrl,
  noteType,
  referenceId,
  referenceName,
  onNoteSaved,
  onCancel,
  placeholder,
  compact = false
}: QuickNoteProps) {
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async () => {
    if (!noteText.trim()) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      let result = null;
      
      switch (noteType) {
        case 'story':
          result = await addStoryNote(startupUrl, referenceId!, noteText.trim());
          break;
        case 'investor':
          result = await addInvestorNote(startupUrl, referenceId!, noteText.trim());
          break;
        case 'pattern':
          result = await addPatternNote(startupUrl, referenceId!, noteText.trim());
          break;
        case 'general':
          result = await addGeneralNote(startupUrl, noteText.trim());
          break;
      }
      
      if (result) {
        setNoteText('');
        onNoteSaved?.();
      } else {
        setError('Failed to save note');
      }
    } catch (err) {
      setError('Error saving note');
      console.error('[QuickNote] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  const defaultPlaceholder = {
    story: 'What did you learn from this pattern?',
    investor: 'Key insight about this investor...',
    pattern: 'Your observation about this archetype...',
    general: 'Capture a learning moment...'
  }[noteType];
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={placeholder || defaultPlaceholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && noteText.trim()) {
              handleSave();
            }
          }}
          disabled={isSaving}
        />
        <button
          onClick={handleSave}
          disabled={isSaving || !noteText.trim()}
          className="p-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-gray-300">
            {referenceName ? `Note on ${referenceName}` : 'Add Note'}
          </span>
        </div>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="p-1 text-gray-500 hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Textarea */}
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder={placeholder || defaultPlaceholder}
        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none resize-none"
        rows={3}
        disabled={isSaving}
      />
      
      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !noteText.trim()}
          className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Note
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// QUICK NOTE BUTTON (Trigger)
// =============================================================================

interface QuickNoteButtonProps {
  startupUrl: string;
  noteType: 'story' | 'investor' | 'pattern' | 'general';
  referenceId?: string;
  referenceName?: string;
  className?: string;
}

export function QuickNoteButton({
  startupUrl,
  noteType,
  referenceId,
  referenceName,
  className = ''
}: QuickNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (isOpen) {
    return (
      <QuickNote
        startupUrl={startupUrl}
        noteType={noteType}
        referenceId={referenceId}
        referenceName={referenceName}
        onNoteSaved={() => setIsOpen(false)}
        onCancel={() => setIsOpen(false)}
      />
    );
  }
  
  return (
    <button
      onClick={() => setIsOpen(true)}
      className={`flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 transition-colors ${className}`}
    >
      <FileText className="w-3.5 h-3.5" />
      Add note
    </button>
  );
}

// =============================================================================
// INLINE NOTE INDICATOR
// =============================================================================

interface NoteIndicatorProps {
  noteCount: number;
  onClick?: () => void;
}

export function NoteIndicator({ noteCount, onClick }: NoteIndicatorProps) {
  if (noteCount === 0) return null;
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-amber-400/80 hover:text-amber-400 transition-colors"
      title={`${noteCount} note${noteCount > 1 ? 's' : ''}`}
    >
      <FileText className="w-3 h-3" />
      {noteCount}
    </button>
  );
}

export default QuickNote;
