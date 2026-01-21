/**
 * ALIGNMENT STORY DETAIL - The Deep Dive
 * =======================================
 * When a founder clicks a card, they see:
 * - Signal timeline (how alignment evolved)
 * - Investor response patterns (how discovery unfolded)
 * - Entry paths used (signal → path → outcome)
 * - Story chapters (how the journey continued) [v1.1]
 * - Path durability insights [v1.1]
 */

import { X, Clock, TrendingUp, TrendingDown, Minus, Route, Bookmark, ArrowLeft, Zap, Layers } from 'lucide-react';
import type { AlignmentStory } from './AlignmentStoryCard';
import { PATH_DURABILITY_BY_ARCHETYPE } from '../../data/canonicalStories';

interface AlignmentStoryDetailProps {
  story: AlignmentStory;
  onClose: () => void;
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

// Evolution status colors (Sprint 2)
const EVOLUTION_STATUS = {
  active: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  stable: { label: 'Stable', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  fading: { label: 'Fading', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  converted: { label: 'Raised', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  unknown: { label: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-500/10' }
};

const DURABILITY_CONFIG = {
  high: { label: 'High Durability Path', color: 'text-emerald-400', icon: '●', insight: 'This path typically sustains alignment.' },
  moderate: { label: 'Moderate Durability', color: 'text-blue-400', icon: '◐', insight: 'This path requires ongoing effort to sustain.' },
  fragile: { label: 'Fragile Path', color: 'text-orange-400', icon: '○', insight: 'This path can fade quickly without reinforcement.' },
  unknown: { label: 'Unknown', color: 'text-gray-500', icon: '?', insight: '' }
};

export default function AlignmentStoryDetail({ 
  story, 
  onClose, 
  onBookmark,
  isBookmarked = false 
}: AlignmentStoryDetailProps) {
  
  const alignmentState = story.alignment_state_after || 'forming';
  const badge = ALIGNMENT_BADGE[alignmentState as keyof typeof ALIGNMENT_BADGE] || ALIGNMENT_BADGE.forming;
  
  // Default timeline if not provided
  const timeline = story.signal_timeline?.length ? story.signal_timeline : [
    { month: 1, event: story.signals_present[0] ? `${story.signals_present[0]} present` : 'Initial signals detected' },
    { month: 2, event: story.signals_present[1] ? `${story.signals_present[1]} emerges` : 'Additional traction builds' },
    { month: 3, event: story.what_changed_text },
    { month: 4, event: story.result_text }
  ];
  
  // Default investor reactions if not provided
  const reactions = story.investor_reactions?.length ? story.investor_reactions : 
    story.typical_investors.map(inv => ({
      type: inv,
      action: 'began monitoring after signal shift'
    }));
  
  // Default entry paths if not provided
  const entryPaths = story.entry_paths?.length ? story.entry_paths : [
    'Organic discovery via signal strength',
    'Network referral from domain operators',
    'Community visibility in relevant spaces'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border border-gray-800 rounded-2xl">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-800/50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-semibold text-white mb-2">
                {story.startup_type_label}
              </h2>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bgColor} ${badge.borderColor} border`}>
                <div className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                <span className={`text-xs font-medium ${badge.textColor}`}>
                  {badge.label}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onBookmark}
                className={`p-2 rounded-lg transition-colors ${
                  isBookmarked 
                    ? 'text-amber-400 bg-amber-500/10' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-8">
          
          {/* Signals Present */}
          <section>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Signals present</h3>
            <div className="flex flex-wrap gap-2">
              {story.signals_present.map((signal, i) => (
                <span 
                  key={i}
                  className="px-3 py-1.5 bg-gray-800/40 border border-gray-700/50 rounded-full text-sm text-gray-300"
                >
                  {signal}
                </span>
              ))}
            </div>
          </section>
          
          {/* The Magic: What Changed */}
          <section className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-xl">
            <h3 className="text-xs text-amber-500/70 uppercase tracking-wider mb-3">What changed alignment</h3>
            <p className="text-white text-base leading-relaxed">
              {story.what_changed_text}
            </p>
          </section>
          
          {/* Result */}
          <section>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Result</h3>
            <p className="text-gray-300 leading-relaxed">
              {story.result_text}
            </p>
          </section>
          
          {/* Signal Timeline */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-500" />
              <h3 className="text-xs text-gray-500 uppercase tracking-wider">Signal evolution</h3>
            </div>
            <div className="relative pl-6 border-l border-gray-800">
              {timeline.map((item, i) => (
                <div key={i} className="relative mb-6 last:mb-0">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${
                    i === timeline.length - 1 
                      ? 'bg-amber-400 border-amber-400' 
                      : 'bg-[#0a0a0a] border-gray-600'
                  }`} />
                  
                  <div className="ml-2">
                    <p className="text-xs text-gray-500 mb-1">Month {item.month}</p>
                    <p className={`text-sm ${i === timeline.length - 1 ? 'text-white' : 'text-gray-400'}`}>
                      {item.event}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {/* Investor Response Patterns */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <h3 className="text-xs text-gray-500 uppercase tracking-wider">How investors reacted</h3>
            </div>
            <div className="space-y-3">
              {reactions.slice(0, 4).map((reaction, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-3 p-3 bg-gray-800/20 rounded-lg"
                >
                  <div className="w-1.5 h-1.5 mt-2 rounded-full bg-gray-500" />
                  <div>
                    <p className="text-sm text-white">{reaction.type}</p>
                    <p className="text-xs text-gray-500">{reaction.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {/* Entry Paths Used */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Route className="w-4 h-4 text-gray-500" />
              <h3 className="text-xs text-gray-500 uppercase tracking-wider">How founders entered the flow</h3>
            </div>
            <div className="space-y-2">
              {entryPaths.map((path, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3 text-sm text-gray-400"
                >
                  <span className="text-gray-600">→</span>
                  {path}
                </div>
              ))}
            </div>
          </section>
          
          {/* Story Evolution / Chapters (Sprint 2) */}
          {story.chapters && story.chapters.length > 0 && (
            <section className="border-t border-gray-800/50 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs text-gray-500 uppercase tracking-wider">Story evolution</h3>
                {story.current_alignment_state && story.current_alignment_state !== 'unknown' && (
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${EVOLUTION_STATUS[story.current_alignment_state]?.bg} ${EVOLUTION_STATUS[story.current_alignment_state]?.color}`}>
                    Current: {EVOLUTION_STATUS[story.current_alignment_state]?.label}
                    {story.alignment_trend === 'improving' && <TrendingUp className="w-3 h-3 inline ml-1" />}
                    {story.alignment_trend === 'fading' && <TrendingDown className="w-3 h-3 inline ml-1" />}
                  </span>
                )}
              </div>
              
              <div className="relative pl-6 border-l-2 border-violet-500/30">
                {story.chapters.map((chapter, i) => (
                  <div key={i} className="relative mb-6 last:mb-0">
                    {/* Chapter marker */}
                    <div className={`absolute -left-[25px] w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === story.chapters!.length - 1 
                        ? 'bg-violet-500 text-white' 
                        : 'bg-gray-800 text-gray-400 border border-gray-600'
                    }`}>
                      {chapter.chapter_number}
                    </div>
                    
                    <div className="ml-2 p-3 bg-gray-800/20 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">{chapter.chapter_title}</p>
                        {chapter.time_delta_months !== undefined && chapter.time_delta_months > 0 && (
                          <span className="text-xs text-gray-500">+{chapter.time_delta_months} months</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{chapter.chapter_summary}</p>
                      <p className={`text-xs mt-1 ${
                        chapter.alignment_state_at_chapter === 'converted' ? 'text-amber-400' :
                        chapter.alignment_state_at_chapter === 'active' ? 'text-emerald-400' :
                        chapter.alignment_state_at_chapter === 'forming' ? 'text-blue-400' :
                        'text-gray-500'
                      }`}>
                        → {chapter.alignment_state_at_chapter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Path Durability Insight (Sprint 2) */}
          {story.archetype && PATH_DURABILITY_BY_ARCHETYPE[story.archetype] && (
            <section className="p-4 bg-gradient-to-br from-violet-500/5 to-blue-500/5 border border-violet-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs text-gray-400 uppercase tracking-wider">Path durability insight</h3>
              </div>
              
              {(() => {
                const stats = PATH_DURABILITY_BY_ARCHETYPE[story.archetype!];
                const config = DURABILITY_CONFIG[stats.durability];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${config.color}`}>{config.icon}</span>
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    </div>
                    
                    <p className="text-sm text-gray-400">{stats.insight}</p>
                    
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-800/50">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Sustains 3+ months</p>
                        <p className="text-sm text-white">{stats.sustainRate3m}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Converts to round</p>
                        <p className="text-sm text-white">{stats.convertRate}%</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}
          
          {/* Timing Context */}
          {story.timing_context && (
            <section className="p-4 bg-gray-800/20 rounded-xl">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Timing context</h3>
              <p className="text-sm text-gray-400">
                {story.timing_context}
              </p>
            </section>
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-gray-800/50 p-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to gallery
          </button>
        </div>
      </div>
    </div>
  );
}
