/**
 * ALIGNMENT STORY CARD - The Heart of the Gallery
 * ================================================
 * Each card represents a pattern of how a startup aligned with investors.
 * Not a company profile. Not a pitch. Not a brag.
 * This is a learning unit.
 * 
 * v1.1 — Added story evolution (current status, trend, durability)
 */

import { Bookmark, ChevronRight, TrendingUp, TrendingDown, Minus, Clock, Zap } from 'lucide-react';

export interface AlignmentStory {
  id: string;
  stage: string;
  industry: string;
  geography: string;
  archetype?: string;
  alignment_state_before?: string;
  alignment_state_after?: string;
  signals_present: string[];
  signals_added?: string[];
  startup_type_label: string;
  what_changed_text: string;
  result_text: string;
  typical_investors: string[];
  investor_names?: string[];
  entry_paths?: string[];
  signal_timeline?: { month: number; event: string }[];
  investor_reactions?: { type: string; action: string }[];
  timing_context?: string;
  tempo_class?: string;
  is_canonical?: boolean;
  view_count?: number;
  bookmark_count?: number;
  
  // Evolution fields (Sprint 2)
  current_alignment_state?: 'active' | 'stable' | 'fading' | 'converted' | 'unknown';
  alignment_trend?: 'improving' | 'stable' | 'fading';
  months_since_alignment?: number;
  last_investor_reaction?: string;
  path_durability?: 'high' | 'moderate' | 'fragile' | 'unknown';
  chapters?: StoryChapter[];
}

export interface StoryChapter {
  chapter_number: number;
  chapter_title: string;
  chapter_summary: string;
  alignment_state_at_chapter: string;
  time_delta_months?: number;
}

interface AlignmentStoryCardProps {
  story: AlignmentStory;
  onClick: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
}

// Alignment state badge config
const ALIGNMENT_BADGE = {
  active: {
    label: 'Investor alignment: Active',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    dotColor: 'bg-amber-400'
  },
  forming: {
    label: 'Investor alignment: Forming',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    textColor: 'text-slate-300',
    dotColor: 'bg-slate-400'
  },
  limited: {
    label: 'Investor alignment: Limited',
    bgColor: 'bg-slate-600/10',
    borderColor: 'border-slate-600/30',
    textColor: 'text-slate-400',
    dotColor: 'bg-slate-500'
  }
};

// Evolution status config (Sprint 2)
const EVOLUTION_STATUS = {
  active: { label: 'Active', color: 'text-emerald-400' },
  stable: { label: 'Stable', color: 'text-blue-400' },
  fading: { label: 'Fading', color: 'text-orange-400' },
  converted: { label: 'Raised', color: 'text-amber-400' },
  unknown: { label: 'Unknown', color: 'text-gray-500' }
};

const TREND_ICONS = {
  improving: { icon: TrendingUp, color: 'text-emerald-400' },
  stable: { icon: Minus, color: 'text-blue-400' },
  fading: { icon: TrendingDown, color: 'text-orange-400' }
};

const DURABILITY_LABELS = {
  high: { label: 'High durability', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  moderate: { label: 'Moderate durability', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  fragile: { label: 'Fragile path', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  unknown: { label: '', color: '', bg: '' }
};

export default function AlignmentStoryCard({ 
  story, 
  onClick, 
  onBookmark,
  isBookmarked = false 
}: AlignmentStoryCardProps) {
  
  const alignmentState = story.alignment_state_after || 'forming';
  const badge = ALIGNMENT_BADGE[alignmentState as keyof typeof ALIGNMENT_BADGE] || ALIGNMENT_BADGE.forming;
  
  return (
    <div 
      onClick={onClick}
      className="group bg-[#0d0d0d] border border-gray-800/60 rounded-2xl p-6 cursor-pointer 
                 hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-white font-medium text-lg group-hover:text-amber-100 transition-colors">
            {story.startup_type_label}
          </h3>
        </div>
        
        {/* Alignment Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bgColor} ${badge.borderColor} border`}>
          <div className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
          <span className={`text-xs font-medium ${badge.textColor}`}>
            {alignmentState.charAt(0).toUpperCase() + alignmentState.slice(1)}
          </span>
        </div>
      </div>
      
      {/* Section 1: Signals Present */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Signals present</p>
        <div className="flex flex-wrap gap-2">
          {story.signals_present.slice(0, 5).map((signal, i) => (
            <span 
              key={i}
              className="px-3 py-1 bg-gray-800/40 border border-gray-700/50 rounded-full text-sm text-gray-300"
            >
              {signal}
            </span>
          ))}
        </div>
      </div>
      
      {/* Section 2: Typical Aligned Investors */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Investors typically aligned</p>
        <p className="text-sm text-gray-400">
          {story.typical_investors.slice(0, 3).join(' · ')}
        </p>
      </div>
      
      {/* Section 3: What Changed Alignment — THE MAGIC */}
      <div className="mb-5 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
        <p className="text-xs text-amber-500/70 uppercase tracking-wider mb-2">What changed alignment</p>
        <p className="text-white text-sm leading-relaxed">
          {story.what_changed_text}
        </p>
      </div>
      
      {/* Section 4: Result */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Result</p>
        <p className="text-sm text-gray-300">
          {story.result_text}
        </p>
      </div>
      
      {/* Section 5: Evolution Status (Sprint 2) */}
      {(story.current_alignment_state || story.path_durability) && (
        <div className="mb-4 flex items-center justify-between text-xs">
          {/* Current Status */}
          {story.current_alignment_state && story.current_alignment_state !== 'unknown' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Current status:</span>
              <span className={EVOLUTION_STATUS[story.current_alignment_state]?.color || 'text-gray-400'}>
                {EVOLUTION_STATUS[story.current_alignment_state]?.label || story.current_alignment_state}
              </span>
              {story.alignment_trend && story.alignment_trend !== 'stable' && (
                <span className="flex items-center gap-1">
                  {story.alignment_trend === 'improving' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                  {story.alignment_trend === 'fading' && <TrendingDown className="w-3 h-3 text-orange-400" />}
                </span>
              )}
              {story.months_since_alignment && story.months_since_alignment > 0 && (
                <span className="text-gray-600">
                  ({story.months_since_alignment}mo)
                </span>
              )}
            </div>
          )}
          
          {/* Path Durability */}
          {story.path_durability && story.path_durability !== 'unknown' && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${DURABILITY_LABELS[story.path_durability].bg}`}>
              <Zap className={`w-3 h-3 ${DURABILITY_LABELS[story.path_durability].color}`} />
              <span className={`${DURABILITY_LABELS[story.path_durability].color}`}>
                {DURABILITY_LABELS[story.path_durability].label}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmark?.();
          }}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isBookmarked 
              ? 'text-amber-400' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400' : ''}`} />
          {isBookmarked ? 'Saved' : 'Save pattern'}
        </button>
        
        <div className="flex items-center gap-1 text-xs text-gray-500 group-hover:text-amber-400 transition-colors">
          <span>View details</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}
