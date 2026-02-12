/**
 * /app/signals — SIGNAL CARD (CANONICAL)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Role: A private, persistent decision journal tied to Pythh's intelligence.
 * 
 * This is NOT:
 * - A CRM
 * - A to-do list  
 * - A kanban board
 * 
 * This IS where founders:
 * - Save insights
 * - Track timing
 * - Record intent
 * - Plan moves
 * - Learn discipline
 * 
 * Philosophy: Good fundraising is timing, not volume.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Sparkles, ArrowRight, Plus, Clock, Target, TrendingUp, Users, Zap } from 'lucide-react';
import { 
  getSignalCardItems, 
  getUpcomingReviews, 
  getSignalCardStats,
  removeFromSignalCard,
  addNote,
  updateReviewStatus,
  snoozeReview as snoozeReviewService,
  type SignalCardItem,
  type SignalCardReview,
  type EntityType,
} from '../services/signalCardService';
import VCQuoteCard from '../components/VCQuoteCard';
import ShareSignalCardModal from '../components/ShareSignalCardModal';
import StrategyBlock from '../components/StrategyBlock';
import { getRandomQuote, type VCQuote } from '../data/vcWisdom';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type SavedItemType = 'startup' | 'investor' | 'signal' | 'score_snapshot';
type FilterTab = 'all' | 'startup' | 'investor' | 'signal' | 'score_snapshot';

// Lens color mapping
const LENS_COLORS: Record<string, string> = {
  god: '#22d3ee',
  yc: '#f97316',
  sequoia: '#ef4444',
  a16z: '#a855f7',
  foundersfund: '#22c55e',
  greylock: '#6366f1',
};

const LENS_NAMES: Record<string, string> = {
  god: 'GOD Score',
  yc: 'YC',
  sequoia: 'Sequoia',
  a16z: 'a16z',
  foundersfund: 'Founders Fund',
  greylock: 'Greylock',
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const formatRelativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

const formatDueDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[date.getDay()];
};

const getTypeIcon = (type: SavedItemType): string => {
  switch (type) {
    case 'startup': return '🏢';
    case 'investor': return '💼';
    case 'signal': return '📡';
    case 'score_snapshot': return '📊';
    default: return '•';
  }
};

const getTypeLabel = (type: SavedItemType): string => {
  switch (type) {
    case 'startup': return 'Startup';
    case 'investor': return 'Investor';
    case 'signal': return 'Signal';
    case 'score_snapshot': return 'Score';
    default: return 'Item';
  }
};

// ═══════════════════════════════════════════════════════════════
// SAVED ITEM ROW COMPONENT
// ═══════════════════════════════════════════════════════════════

const SavedItemRow: React.FC<{
  item: SignalCardItem;
  onNoteChange: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onShare: (item: SignalCardItem) => void;
}> = ({ item, onNoteChange, onRemove, onShare }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const latestNote = item.notes?.[0]?.note || '';
  const [noteValue, setNoteValue] = useState(latestNote);
  const [isSaving, setIsSaving] = useState(false);
  
  const lensAccent = item.lens_id ? LENS_COLORS[item.lens_id] || '#22d3ee' : '#22d3ee';
  const lensName = item.lens_id ? LENS_NAMES[item.lens_id] || item.lens_id : '—';

  const handleSaveNote = async () => {
    setIsSaving(true);
    await onNoteChange(item.id, noteValue);
    setIsSaving(false);
    setEditingNote(false);
  };

  return (
    <div className="border-b border-[#2e2e2e] last:border-b-0">
      {/* Main row */}
      <div 
        className="grid grid-cols-[40px_1fr_100px_100px_80px] gap-4 px-4 py-3 hover:bg-[#2e2e2e]/50 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Type icon */}
        <div className="text-base" title={getTypeLabel(item.entity_type as SavedItemType)}>
          {getTypeIcon(item.entity_type as SavedItemType)}
        </div>
        
        {/* Item name + score snapshot */}
        <div>
          <div className="text-white text-sm truncate">
            {item.entity_name || 'Unknown'}
          </div>
          {item.score_value && (
            <div className="text-xs text-[#8f8f8f] mt-0.5">
              Score: <span className="text-[#3ECF8E]">{item.score_value.toFixed(1)}</span>
              {item.rank && <span> • #{item.rank}</span>}
              {item.rank_delta !== null && item.rank_delta !== 0 && (
                <span className={item.rank_delta > 0 ? 'text-[#3ECF8E]' : 'text-red-400'}>
                  {' '}({item.rank_delta > 0 ? '+' : ''}{item.rank_delta})
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Lens */}
        <div className="text-xs text-[#8f8f8f] px-2 py-0.5 rounded bg-[#2e2e2e] w-fit h-fit">
          {lensName}
        </div>
        
        {/* Window / Context */}
        <div className="text-[#8f8f8f] text-xs">
          {item.time_window || item.context || '—'}
        </div>
        
        {/* Saved time */}
        <div className="text-[#5f5f5f] text-xs text-right">
          {formatRelativeDate(item.created_at)}
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-14 space-y-4 bg-[#1c1c1c]">
          {/* Founder notes */}
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Your Notes
            </div>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-white placeholder-[#5f5f5f] focus:outline-none focus:border-[#3ECF8E] resize-none"
                  rows={3}
                  placeholder="Add your notes..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={isSaving}
                    className="px-3 py-1.5 bg-[#3ECF8E] text-black text-xs rounded hover:bg-[#3ECF8E]/90 transition-colors disabled:opacity-50 font-medium"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setNoteValue(latestNote);
                      setEditingNote(false);
                    }}
                    className="px-3 py-1.5 text-[#8f8f8f] text-xs hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="text-sm text-[#8f8f8f] cursor-pointer hover:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNote(true);
                }}
              >
                {latestNote || <span className="text-[#5f5f5f]">Click to add notes...</span>}
              </div>
            )}
          </div>
          
          {/* Strategy Block - Signal Strategies for this item */}
          <StrategyBlock 
            scorecardItemId={item.id} 
            signal={{
              entityName: item.entity_name || 'Unknown',
              entityType: (item.entity_type === 'startup' || item.entity_type === 'investor') 
                ? item.entity_type 
                : 'startup',
              lensId: item.lens_id || undefined,
              timingState: item.time_window || 'stable',
              signalStrength: item.score_value || 0,
              rank: item.rank || undefined,
              rankDelta: item.rank_delta || undefined,
              category: item.context || undefined,
            }}
            className="mt-4" 
          />
          
          {/* Actions */}
          <div className="flex items-center gap-4 pt-2 border-t border-[#2e2e2e] mt-2">
            {item.entity_type === 'startup' && (
              <Link
                to={`/app/startup/${item.entity_id}`}
                className="text-xs text-[#8f8f8f] hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                View details →
              </Link>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(item);
              }}
              className="text-xs text-[#8f8f8f] hover:text-[#3ECF8E] transition-colors flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="text-xs text-[#5f5f5f] hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCHEDULED REVIEW ROW COMPONENT
// ═══════════════════════════════════════════════════════════════

interface ReviewWithItem extends SignalCardReview {
  item?: SignalCardItem;
}

const ScheduledReviewRow: React.FC<{
  review: ReviewWithItem;
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
}> = ({ review, onComplete, onSnooze }) => {
  const dueText = formatDueDate(review.review_at);
  const isOverdue = dueText === 'Overdue';
  const isDueToday = dueText === 'Today';
  const itemType = review.item?.entity_type || 'startup';
  const itemName = review.item?.entity_name || 'Unknown';
  
  return (
    <div className={`
      flex items-center justify-between px-4 py-3
      border-b border-[#2e2e2e] last:border-b-0
      ${isOverdue ? 'bg-red-500/5' : isDueToday ? 'bg-amber-500/5' : ''}
    `}>
      <div className="flex items-center gap-3">
        <span className="text-base">{getTypeIcon(itemType as SavedItemType)}</span>
        <div>
          <div className="text-sm text-white truncate max-w-[150px]">{itemName}</div>
          <div className="text-xs text-[#5f5f5f]">Review</div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className={`text-xs px-2 py-0.5 rounded ${
          isOverdue ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 
          isDueToday ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 
          'text-[#8f8f8f]'
        }`}>
          {dueText}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onComplete(review.id)}
            className="p-1.5 text-[#8f8f8f] hover:text-[#3ECF8E] hover:bg-[#3ECF8E]/10 rounded transition-colors"
            title="Mark as done"
          >
            ✓
          </button>
          <button
            onClick={() => onSnooze(review.id)}
            className="p-1.5 text-[#8f8f8f] hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
            title="Snooze 1 week"
          >
            ⏰
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const SignalCardPage: React.FC = () => {
  const [savedItems, setSavedItems] = useState<SignalCardItem[]>([]);
  const [upcomingReviews, setUpcomingReviews] = useState<ReviewWithItem[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, upcomingReviews: 0, thisWeekSaves: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  
  // Share modal state
  const [shareModalItem, setShareModalItem] = useState<SignalCardItem | null>(null);
  
  // Hero quote state - rotates for engagement
  const [heroQuote, setHeroQuote] = useState<VCQuote | null>(() => getRandomQuote());
  const [quoteAnimating, setQuoteAnimating] = useState(false);
  
  const refreshQuote = () => {
    setQuoteAnimating(true);
    setTimeout(() => {
      setHeroQuote(getRandomQuote());
      setQuoteAnimating(false);
    }, 200);
  };
  
  // Auto-refresh quote every 45 seconds for engagement
  useEffect(() => {
    const interval = setInterval(() => {
      refreshQuote();
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    const [itemsResult, reviewsResult, statsResult] = await Promise.all([
      getSignalCardItems(),
      getUpcomingReviews(7),
      getSignalCardStats(),
    ]);

    setSavedItems(itemsResult.items);
    setUpcomingReviews(reviewsResult.reviews as ReviewWithItem[]);
    setStats(statsResult);
    setIsLoading(false);
  };

  // Filter saved items by type
  const filteredItems = activeTab === 'all' 
    ? savedItems 
    : savedItems.filter(item => item.entity_type === activeTab);

  // Handlers
  const handleNoteChange = async (id: string, note: string) => {
    const result = await addNote(id, note);
    if (result.success) {
      // Refresh data
      loadData();
    }
  };

  const handleRemoveItem = async (id: string) => {
    const result = await removeFromSignalCard(id);
    if (result.success) {
      setSavedItems(prev => prev.filter(item => item.id !== id));
      // Update stats
      setStats(prev => ({ ...prev, totalItems: prev.totalItems - 1 }));
    }
  };

  const handleCompleteReview = async (id: string) => {
    const result = await updateReviewStatus(id, 'completed');
    if (result.success) {
      setUpcomingReviews(prev => prev.filter(review => review.id !== id));
    }
  };

  const handleSnoozeReview = async (id: string) => {
    const result = await snoozeReviewService(id, 7);
    if (result.success) {
      loadData(); // Refresh to get new dates
    }
  };

  // Item counts for tabs
  const itemCounts = {
    all: savedItems.length,
    startup: savedItems.filter(i => i.entity_type === 'startup').length,
    investor: savedItems.filter(i => i.entity_type === 'investor').length,
    signal: savedItems.filter(i => i.entity_type === 'signal').length,
    score_snapshot: savedItems.filter(i => i.entity_type === 'score_snapshot').length,
  };

  // Notes count
  const notesCount = savedItems.filter(i => i.notes && i.notes.length > 0).length;

  return (
    <div 
      className="min-h-screen bg-[#1c1c1c]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Minimal CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER - Supabase style
      ═══════════════════════════════════════════════════════════════ */}
      <header className="border-b border-[#2e2e2e]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <Link to="/" className="text-white font-semibold text-lg tracking-tight">
              pythh
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/signals" className="text-[#8f8f8f] hover:text-white transition-colors">
                Signals
              </Link>
              <Link to="/matches" className="text-[#8f8f8f] hover:text-white transition-colors">
                Matches
              </Link>
              <Link to="/trends" className="text-[#8f8f8f] hover:text-white transition-colors">
                Trends
              </Link>
              <span className="text-white font-medium">Signal Card</span>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ═══════════════════════════════════════════════════════════════
            HERO: VC WISDOM + STATS - Clean Supabase style
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* VC Quote - Left side, spans 2 cols */}
            <div className="lg:col-span-2 bg-[#232323] rounded-lg border border-[#2e2e2e] p-6">
              <div className={`transition-opacity duration-150 ${quoteAnimating ? 'opacity-0' : 'opacity-100'}`}>
                {heroQuote && (
                  <div>
                    <div className="flex items-start gap-4">
                      <div className="w-1 h-full min-h-[60px] bg-emerald-500 rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <blockquote className="text-lg text-white leading-relaxed mb-4">
                          "{heroQuote.quote}"
                        </blockquote>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2e2e2e] flex items-center justify-center text-emerald-400 text-sm font-medium">
                              {heroQuote.author.charAt(0)}
                            </div>
                            <div>
                              <div className="text-white text-sm font-medium">{heroQuote.author}</div>
                              <div className="text-[#8f8f8f] text-xs">{heroQuote.firm}</div>
                            </div>
                          </div>
                          <button 
                            onClick={refreshQuote}
                            className="text-[#8f8f8f] hover:text-emerald-400 transition-colors text-xs px-3 py-1.5 rounded border border-[#2e2e2e] hover:border-emerald-500/50"
                          >
                            New quote
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Stats Panel - Right side */}
            <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] p-6">
              <h1 className="text-lg font-semibold text-white mb-1">Signal Card</h1>
              <p className="text-[#8f8f8f] text-sm mb-5">Your private intelligence journal</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-[#2e2e2e]">
                  <span className="text-[#8f8f8f] text-sm">Signals saved</span>
                  <span className="text-white font-mono text-lg">{stats.totalItems}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#2e2e2e]">
                  <span className="text-[#8f8f8f] text-sm">Reviews pending</span>
                  <span className={`font-mono text-lg ${stats.upcomingReviews > 0 ? 'text-amber-400' : 'text-white'}`}>
                    {stats.upcomingReviews}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#8f8f8f] text-sm">This week</span>
                  <span className="text-emerald-400 font-mono text-lg">{stats.thisWeekSaves}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            QUICK ACTIONS - Minimal cards
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {upcomingReviews.length > 0 && (
            <button 
              onClick={() => {
                const reviewSection = document.getElementById('reviews-section');
                reviewSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="p-4 rounded-lg bg-[#232323] border border-[#2e2e2e] hover:border-amber-500/50 transition-colors text-left group"
            >
              <Clock className="w-4 h-4 text-amber-400 mb-2" />
              <div className="text-white text-sm font-medium">{stats.upcomingReviews} Reviews</div>
              <div className="text-[#8f8f8f] text-xs group-hover:text-amber-400 transition-colors">Take action →</div>
            </button>
          )}
          
          <Link 
            to="/app/trends"
            className="p-4 rounded-lg bg-[#232323] border border-[#2e2e2e] hover:border-emerald-500/50 transition-colors group"
          >
            <Plus className="w-4 h-4 text-emerald-400 mb-2" />
            <div className="text-white text-sm font-medium">Add Signal</div>
            <div className="text-[#8f8f8f] text-xs group-hover:text-emerald-400 transition-colors">Browse trends →</div>
          </Link>
          
          <Link 
            to="/community"
            className="p-4 rounded-lg bg-[#232323] border border-[#2e2e2e] hover:border-blue-500/50 transition-colors group"
          >
            <Users className="w-4 h-4 text-blue-400 mb-2" />
            <div className="text-white text-sm font-medium">Community</div>
            <div className="text-[#8f8f8f] text-xs group-hover:text-blue-400 transition-colors">Connect →</div>
          </Link>
          
          <button 
            onClick={() => {}}
            className="p-4 rounded-lg bg-[#232323] border border-[#2e2e2e] hover:border-[#3ECF8E]/50 transition-colors text-left group"
          >
            <Share2 className="w-4 h-4 text-[#3ECF8E] mb-2" />
            <div className="text-white text-sm font-medium">Share</div>
            <div className="text-[#8f8f8f] text-xs group-hover:text-[#3ECF8E] transition-colors">Export →</div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══════════════════════════════════════════════════════════════
              2) SAVED ITEMS (Main column) - Supabase style table
          ═══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2">
            <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] overflow-hidden">
              {/* Section header with tabs */}
              <div className="px-4 py-4 border-b border-[#2e2e2e]">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-white">
                    Saved Signals
                  </div>
                  <div className="text-xs text-[#8f8f8f]">
                    {savedItems.length} total
                  </div>
                </div>
                
                {/* Type filter tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(['all', 'startup', 'investor', 'signal', 'score_snapshot'] as FilterTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`
                        px-3 py-1.5 text-xs rounded transition-colors
                        ${activeTab === tab 
                          ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30' 
                          : 'text-[#8f8f8f] hover:text-white hover:bg-[#2e2e2e]'
                        }
                      `}
                    >
                      {tab === 'all' ? 'All' : getTypeLabel(tab)} ({itemCounts[tab]})
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Table header */}
              <div className="grid grid-cols-[40px_1fr_100px_100px_80px] gap-4 px-4 py-2 text-xs text-[#8f8f8f] uppercase tracking-wider border-b border-[#2e2e2e] bg-[#1c1c1c]">
                <div>Type</div>
                <div>Item</div>
                <div>Lens</div>
                <div>Context</div>
                <div className="text-right">Saved</div>
              </div>
              
              {/* Items list */}
              <div className="max-h-[500px] overflow-y-auto">
                {isLoading ? (
                  <div className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#3ECF8E] border-t-transparent rounded-full animate-spin" />
                      <div className="text-[#8f8f8f] text-sm">Loading...</div>
                    </div>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 rounded-lg bg-[#2e2e2e] flex items-center justify-center mx-auto mb-4">
                      <Target className="w-6 h-6 text-[#8f8f8f]" />
                    </div>
                    <div className="text-white font-medium mb-2">No signals yet</div>
                    <div className="text-[#8f8f8f] text-sm mb-6 max-w-sm mx-auto">
                      Save startups, investors, or signals from Trends and Matches.
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Link 
                        to="/app/trends"
                        className="px-4 py-2 bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-black text-sm font-medium rounded transition-colors"
                      >
                        Explore Trends
                      </Link>
                      <Link 
                        to="/app/matches"
                        className="px-4 py-2 bg-[#2e2e2e] hover:bg-[#3a3a3a] text-white text-sm font-medium rounded transition-colors border border-[#3a3a3a]"
                      >
                        View Matches
                      </Link>
                    </div>
                  </div>
                ) : (
                  filteredItems.map((item, index) => (
                    <div 
                      key={item.id}
                      style={{ 
                        animationDelay: `${index * 30}ms`,
                        animation: 'fadeIn 0.2s ease-out forwards',
                        opacity: 0,
                      }}
                    >
                      <SavedItemRow
                        item={item}
                        onNoteChange={handleNoteChange}
                        onRemove={handleRemoveItem}
                        onShare={(item) => setShareModalItem(item)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              3) SIDEBAR (Reviews + Export) - Supabase style
          ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            {/* Upcoming Reviews */}
            <div id="reviews-section" className="bg-[#232323] rounded-lg border border-[#2e2e2e] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2e2e2e] flex items-center justify-between">
                <div className="text-sm font-medium text-white">Reviews</div>
                {upcomingReviews.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs border border-amber-500/30">
                    {upcomingReviews.length}
                  </span>
                )}
              </div>
              
              {upcomingReviews.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="text-[#8f8f8f] text-sm">No reviews scheduled</div>
                </div>
              ) : (
                <div>
                  {upcomingReviews.map(review => (
                    <ScheduledReviewRow
                      key={review.id}
                      review={review}
                      onComplete={handleCompleteReview}
                      onSnooze={handleSnoozeReview}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Export */}
            <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] p-4">
              <div className="text-sm font-medium text-white mb-3">Export</div>
              <div className="space-y-1">
                <button className="w-full text-left px-3 py-2 text-sm text-[#8f8f8f] hover:text-white hover:bg-[#2e2e2e] rounded transition-colors">
                  Copy to clipboard
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-[#5f5f5f] rounded flex items-center justify-between cursor-not-allowed">
                  <span>Export to Notion</span>
                  <span className="text-xs text-[#5f5f5f] bg-[#2e2e2e] px-2 py-0.5 rounded">soon</span>
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-[#5f5f5f] rounded flex items-center justify-between cursor-not-allowed">
                  <span>Add to Calendar</span>
                  <span className="text-xs text-[#5f5f5f] bg-[#2e2e2e] px-2 py-0.5 rounded">soon</span>
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] p-4">
              <div className="flex items-start gap-3">
                <div className="w-1 h-full min-h-[40px] bg-[#3ECF8E] rounded-full flex-shrink-0" />
                <p className="text-[#8f8f8f] text-sm leading-relaxed">
                  The best founders review their signals weekly. Patterns emerge over time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-10 pt-6 border-t border-[#2e2e2e] text-center">
          <p className="text-[#5f5f5f] text-sm">
            Good fundraising is timing, not volume.
          </p>
        </div>
      </main>

      {/* Share Modal */}
      {shareModalItem && (
        <ShareSignalCardModal
          isOpen={true}
          onClose={() => setShareModalItem(null)}
          item={shareModalItem}
        />
      )}
    </div>
  );
};

export default SignalCardPage;
