/**
 * DISCOVERY GALLERY PAGE - The Learning Engine v1.1
 * ==================================================
 * "How startups align with investors"
 * 
 * v1.1 UPGRADES:
 * - Personalized default view (auto-filter to founder context)
 * - "Show startups like mine" mode
 * - Investor-linked gallery flow
 * - Personalized headers
 * 
 * This becomes:
 * - Education engine
 * - Retention engine
 * - Authority engine
 * - Community layer
 * - Long-term moat
 * 
 * This is not competition. This is navigation.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, User, X, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';
import {
  GalleryFiltersBar,
  AlignmentStoryCard,
  AlignmentStoryDetail,
  type GalleryFilters,
  type AlignmentStory
} from '../components/gallery';
import { CANONICAL_STORIES } from '../data/canonicalStories';
import type { AlignmentStoryRow } from '../lib/database.types';

// ============================================
// FOUNDER CONTEXT — What we know about this founder
// ============================================
interface FounderContext {
  stage: string | null;
  industry: string | null;
  geography: string | null;
  startupName?: string;
  signals?: string[];
  godScore?: number;
}

// Try to load founder context from session/localStorage
function getFounderContext(): FounderContext | null {
  try {
    // Check sessionStorage first (from recent scan)
    const sessionData = sessionStorage.getItem('pythh_founder_context');
    if (sessionData) {
      return JSON.parse(sessionData);
    }
    
    // Check localStorage (persistent)
    const localData = localStorage.getItem('pythh_founder_context');
    if (localData) {
      return JSON.parse(localData);
    }
    
    // Check for scan data (from DiscoveryPage)
    const scanData = sessionStorage.getItem('pythh_scan_result');
    if (scanData) {
      const parsed = JSON.parse(scanData);
      return {
        stage: parsed.stage || null,
        industry: parsed.sectors?.[0] || parsed.industry || null,
        geography: parsed.geography || null,
        startupName: parsed.name,
        signals: parsed.signals,
        godScore: parsed.total_god_score
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

// Map industry names to canonical values
function normalizeIndustry(industry: string | null): string | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();
  
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine learning')) return 'ai';
  if (lower.includes('fintech') || lower.includes('finance') || lower.includes('payment')) return 'fintech';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('bio')) return 'healthcare';
  if (lower.includes('consumer') || lower.includes('b2c') || lower.includes('social')) return 'consumer';
  if (lower.includes('enterprise') || lower.includes('saas') || lower.includes('b2b')) return 'enterprise';
  if (lower.includes('infra') || lower.includes('devtools') || lower.includes('developer')) return 'infrastructure';
  if (lower.includes('climate') || lower.includes('clean') || lower.includes('energy')) return 'climate';
  if (lower.includes('robot') || lower.includes('hardware')) return 'robotics';
  
  return industry.toLowerCase();
}

// Map stage names to canonical values
function normalizeStage(stage: string | null): string | null {
  if (!stage) return null;
  const lower = stage.toLowerCase();
  
  if (lower.includes('pre-seed') || lower.includes('preseed')) return 'pre-seed';
  if (lower.includes('seed')) return 'seed';
  if (lower.includes('series a') || lower.includes('series-a')) return 'series-a';
  
  return stage.toLowerCase();
}

// Transform DB row to component type
function dbRowToStory(row: AlignmentStoryRow): AlignmentStory {
  return {
    id: row.id,
    stage: row.stage,
    industry: row.industry,
    geography: row.geography,
    archetype: row.archetype || undefined,
    alignment_state_before: row.alignment_state_before || undefined,
    alignment_state_after: row.alignment_state_after || undefined,
    signals_present: row.signals_present || [],
    signals_added: row.signals_added || undefined,
    startup_type_label: row.startup_type_label,
    what_changed_text: row.what_changed_text,
    result_text: row.result_text,
    typical_investors: row.typical_investors || [],
    investor_names: row.investor_names || undefined,
    entry_paths: row.entry_paths || undefined,
    signal_timeline: row.signal_timeline as { month: number; event: string }[] | undefined,
    investor_reactions: row.investor_reactions as { type: string; action: string }[] | undefined,
    timing_context: row.timing_context || undefined,
    tempo_class: row.tempo_class || undefined,
    is_canonical: row.is_canonical || undefined,
    view_count: row.view_count || undefined,
    bookmark_count: row.bookmark_count || undefined
  };
}

// ============================================
// INVESTOR ARCHETYPE MAPPING
// ============================================
const INVESTOR_ARCHETYPE_KEYWORDS: Record<string, string[]> = {
  'infrastructure': ['infra', 'infrastructure', 'devtools', 'developer', 'platform'],
  'ai': ['ai', 'ml', 'machine learning', 'deep tech'],
  'fintech': ['fintech', 'finance', 'payments', 'banking'],
  'consumer': ['consumer', 'b2c', 'social', 'marketplace'],
  'enterprise': ['enterprise', 'b2b', 'saas', 'software'],
  'healthcare': ['health', 'bio', 'medical', 'clinical'],
  'generalist': ['generalist', 'multi-stage', 'seed']
};

function getInvestorArchetype(investorId: string): string | null {
  const lower = investorId.toLowerCase();
  for (const [archetype, keywords] of Object.entries(INVESTOR_ARCHETYPE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      return archetype;
    }
  }
  return null;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function DiscoveryGalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  // URL params
  const urlStage = searchParams.get('stage') || undefined;
  const urlIndustry = searchParams.get('industry') || undefined;
  const urlGeography = searchParams.get('geography') || undefined;
  const investorFilter = searchParams.get('investor') || undefined;
  const investorName = searchParams.get('investorName') || undefined;
  const showLikeMeParam = searchParams.get('likeMe') === 'true';
  
  // Founder context (from previous scan)
  const [founderContext, setFounderContext] = useState<FounderContext | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [showLikeMe, setShowLikeMe] = useState(showLikeMeParam);
  
  // Core state
  const [stories, setStories] = useState<AlignmentStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<GalleryFilters>({
    stage: urlStage || null,
    industry: urlIndustry || null,
    geography: urlGeography || null,
    alignmentState: null
  });
  const [selectedStory, setSelectedStory] = useState<AlignmentStory | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  
  // ============================================
  // LOAD FOUNDER CONTEXT + AUTO-PERSONALIZE
  // ============================================
  useEffect(() => {
    const context = getFounderContext();
    setFounderContext(context);
    
    // Auto-personalize on first load if:
    // 1. We have founder context
    // 2. No explicit URL filters were provided
    // 3. Not coming from Investor Lens (investorFilter)
    if (context && !urlStage && !urlIndustry && !urlGeography && !investorFilter) {
      const normalizedStage = normalizeStage(context.stage);
      const normalizedIndustry = normalizeIndustry(context.industry);
      
      if (normalizedStage || normalizedIndustry) {
        setFilters({
          stage: normalizedStage,
          industry: normalizedIndustry,
          geography: context.geography,
          alignmentState: null
        });
        setIsPersonalized(true);
      }
    }
  }, [urlStage, urlIndustry, urlGeography, investorFilter]);
  
  // ============================================
  // FETCH STORIES
  // ============================================
  useEffect(() => {
    async function fetchStories() {
      setIsLoading(true);
      
      try {
        const { data: dbStories, error } = await supabase
          .from('alignment_stories')
          .select('*')
          .order('is_canonical', { ascending: false })
          .order('view_count', { ascending: false })
          .limit(100);
        
        if (error) {
          console.error('Error fetching stories:', error);
          setStories(CANONICAL_STORIES);
        } else if (dbStories && dbStories.length > 0) {
          setStories(dbStories.map(dbRowToStory));
        } else {
          setStories(CANONICAL_STORIES);
        }
        
        // Fetch user's bookmarks
        if (user?.id) {
          const { data: bookmarks } = await supabase
            .from('story_bookmarks')
            .select('story_id')
            .eq('user_id', user.id);
          
          if (bookmarks) {
            setBookmarkedIds(new Set(bookmarks.map((b: { story_id: string }) => b.story_id)));
          }
        }
      } catch (err) {
        console.error('Error:', err);
        setStories(CANONICAL_STORIES);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchStories();
  }, [user]);
  
  // ============================================
  // "SHOW STARTUPS LIKE MINE" — SMART MATCHING
  // ============================================
  const likeMe = useMemo(() => {
    if (!showLikeMe || !founderContext) return null;
    
    return {
      stage: normalizeStage(founderContext.stage),
      industry: normalizeIndustry(founderContext.industry),
      geography: founderContext.geography,
      signals: founderContext.signals || []
    };
  }, [showLikeMe, founderContext]);
  
  // ============================================
  // FILTER STORIES (with "Like Me" matching)
  // ============================================
  const filteredStories = useMemo(() => {
    let result = stories;
    
    // If "Like Me" mode is active, use smart matching
    if (showLikeMe && likeMe) {
      result = stories.filter(story => {
        // Must match at least one dimension strongly
        let matchScore = 0;
        
        // Stage match (weight: 2)
        if (likeMe.stage && story.stage === likeMe.stage) matchScore += 2;
        
        // Industry match (weight: 3)
        if (likeMe.industry && story.industry === likeMe.industry) matchScore += 3;
        
        // Geography match (weight: 1)
        if (likeMe.geography && story.geography === likeMe.geography) matchScore += 1;
        
        // Signal overlap (weight: 1 per signal)
        if (likeMe.signals && story.signals_present) {
          const overlap = likeMe.signals.filter(s => 
            story.signals_present.some(sp => 
              sp.toLowerCase().includes(s.toLowerCase()) ||
              s.toLowerCase().includes(sp.toLowerCase())
            )
          );
          matchScore += overlap.length;
        }
        
        // Require minimum match score of 2
        return matchScore >= 2;
      });
      
      // Sort by relevance
      result.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (likeMe.stage && a.stage === likeMe.stage) scoreA += 2;
        if (likeMe.stage && b.stage === likeMe.stage) scoreB += 2;
        if (likeMe.industry && a.industry === likeMe.industry) scoreA += 3;
        if (likeMe.industry && b.industry === likeMe.industry) scoreB += 3;
        return scoreB - scoreA;
      });
    } else {
      // Standard filtering
      result = stories.filter(story => {
        if (filters.stage && story.stage !== filters.stage) return false;
        if (filters.industry && story.industry !== filters.industry) return false;
        if (filters.geography && story.geography !== filters.geography) return false;
        if (filters.alignmentState && story.alignment_state_after !== filters.alignmentState) return false;
        
        // Investor filter (from Investor Lens)
        if (investorFilter) {
          const archetype = getInvestorArchetype(investorFilter);
          
          // Match by archetype or investor type keywords
          const investorMatch = 
            (archetype && story.industry === archetype) ||
            story.typical_investors.some(inv => 
              inv.toLowerCase().includes(investorFilter.toLowerCase())
            ) || 
            story.investor_names?.some(inv =>
              inv.toLowerCase().includes(investorFilter.toLowerCase())
            ) ||
            // Also match by entry paths that might mention investor type
            story.entry_paths?.some(path =>
              path.toLowerCase().includes(investorFilter.toLowerCase())
            );
          
          if (!investorMatch) return false;
        }
        
        return true;
      });
    }
    
    return result;
  }, [stories, filters, investorFilter, showLikeMe, likeMe]);
  
  // ============================================
  // ACTIONS
  // ============================================
  const toggleBookmark = async (storyId: string) => {
    if (!user?.id) return;
    
    const isCurrentlyBookmarked = bookmarkedIds.has(storyId);
    
    if (isCurrentlyBookmarked) {
      await supabase
        .from('story_bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('story_id', storyId);
      
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
    } else {
      await supabase
        .from('story_bookmarks')
        .insert({ user_id: user.id, story_id: storyId });
      
      setBookmarkedIds(prev => new Set([...prev, storyId]));
    }
  };
  
  const handleViewStory = async (story: AlignmentStory) => {
    setSelectedStory(story);
    
    if (!story.id.startsWith('canonical-')) {
      supabase
        .from('alignment_stories')
        .update({ view_count: (story.view_count || 0) + 1 })
        .eq('id', story.id)
        .then(() => {});
    }
  };
  
  const clearPersonalization = useCallback(() => {
    setFilters({ stage: null, industry: null, geography: null, alignmentState: null });
    setIsPersonalized(false);
    setShowLikeMe(false);
    setSearchParams({});
  }, [setSearchParams]);
  
  const activateLikeMe = useCallback(() => {
    if (founderContext) {
      setShowLikeMe(true);
      setIsPersonalized(false);
      // Clear manual filters when in "Like Me" mode
      setFilters({ stage: null, industry: null, geography: null, alignmentState: null });
    }
  }, [founderContext]);
  
  // ============================================
  // HEADER CONTENT LOGIC
  // ============================================
  const headerContent = useMemo(() => {
    // Investor-linked gallery (highest priority)
    if (investorFilter) {
      return {
        title: `How founders entered this investor's flow`,
        subtitle: investorName 
          ? `Patterns from startups that aligned with ${investorName}`
          : 'Patterns from startups that aligned with investors like this',
        badge: 'Investor-linked',
        badgeColor: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
      };
    }
    
    // "Like Me" mode
    if (showLikeMe && founderContext) {
      return {
        title: 'Startups like yours',
        subtitle: `Alignment patterns from ${founderContext.stage || 'similar stage'} ${founderContext.industry || ''} startups`,
        badge: 'Personalized',
        badgeColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      };
    }
    
    // Personalized default view
    if (isPersonalized && founderContext) {
      return {
        title: 'Alignment patterns for startups like yours',
        subtitle: `Showing ${filters.stage || founderContext.stage || ''} ${filters.industry || founderContext.industry || ''} patterns`,
        badge: 'Your market',
        badgeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      };
    }
    
    // Default
    return {
      title: 'How startups align with investors',
      subtitle: 'Patterns observed across thousands of founder–investor discovery flows.',
      badge: null,
      badgeColor: ''
    };
  }, [investorFilter, investorName, showLikeMe, isPersonalized, founderContext, filters]);
  
  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Background subtle gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <BrandMark />
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400 text-sm">How startups align</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        
        {/* ============================================ */}
        {/* HEADER BLOCK — Personalized or Default */}
        {/* ============================================ */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {/* Badge */}
              {headerContent.badge && (
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${headerContent.badgeColor} border mb-3`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span className="text-xs font-medium">{headerContent.badge}</span>
                </div>
              )}
              
              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-semibold text-white mb-3">
                {headerContent.title}
              </h1>
              
              {/* Subtitle */}
              <p className="text-gray-500 text-lg max-w-2xl">
                {headerContent.subtitle}
              </p>
            </div>
            
            {/* "Show startups like mine" button */}
            {founderContext && !investorFilter && (
              <div className="flex-shrink-0">
                {showLikeMe ? (
                  <button
                    onClick={clearPersonalization}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 hover:bg-amber-500/15 transition-colors text-sm font-medium"
                  >
                    <User className="w-4 h-4" />
                    Showing startups like mine
                    <X className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <button
                    onClick={activateLikeMe}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-500/10 border border-slate-500/30 rounded-full text-slate-300 hover:bg-slate-500/15 hover:border-amber-500/30 hover:text-amber-400 transition-all text-sm font-medium"
                  >
                    <User className="w-4 h-4" />
                    Show startups like mine
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Personalization notice */}
          {(isPersonalized || showLikeMe || investorFilter) && (
            <div className="flex items-center gap-3">
              <button
                onClick={clearPersonalization}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Filter className="w-3.5 h-3.5" />
                Clear filters & show all patterns
              </button>
            </div>
          )}
        </div>
        
        {/* ============================================ */}
        {/* FILTER BAR (hidden in "Like Me" mode) */}
        {/* ============================================ */}
        {!showLikeMe && (
          <div className="mb-8 pb-6 border-b border-gray-800/50">
            <GalleryFiltersBar
              filters={filters}
              onChange={(newFilters) => {
                setFilters(newFilters);
                setIsPersonalized(false); // User is manually filtering
              }}
              defaultStage={urlStage}
              defaultIndustry={urlIndustry}
            />
          </div>
        )}
        
        {/* Stories count */}
        <div className="mb-6">
          <p className="text-sm text-gray-500">
            {filteredStories.length} pattern{filteredStories.length !== 1 ? 's' : ''} 
            {showLikeMe 
              ? ' similar to your startup' 
              : filters.stage || filters.industry || filters.geography || filters.alignmentState || investorFilter
                ? ' matching filters' 
                : ' available'}
          </p>
        </div>
        
        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span>Loading alignment patterns...</span>
            </div>
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">
              {showLikeMe 
                ? "No patterns closely match your startup yet."
                : "No patterns match these filters."}
            </p>
            <button
              onClick={clearPersonalization}
              className="text-amber-400 hover:text-amber-300 text-sm transition-colors"
            >
              {showLikeMe ? 'Browse all patterns' : 'Clear filters'}
            </button>
          </div>
        ) : (
          /* Stories Grid */
          <div className="grid md:grid-cols-2 gap-6">
            {filteredStories.map(story => (
              <AlignmentStoryCard
                key={story.id}
                story={story}
                onClick={() => handleViewStory(story)}
                onBookmark={() => toggleBookmark(story.id)}
                isBookmarked={bookmarkedIds.has(story.id)}
              />
            ))}
          </div>
        )}
        
        {/* Footer message */}
        {!isLoading && filteredStories.length > 0 && (
          <div className="mt-16 text-center">
            <p className="text-gray-600 text-sm">
              {showLikeMe 
                ? 'Patterns shown are most relevant to your stage and market.'
                : 'Patterns updated as new alignment flows are observed.'}
            </p>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedStory && (
        <AlignmentStoryDetail
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onBookmark={() => toggleBookmark(selectedStory.id)}
          isBookmarked={bookmarkedIds.has(selectedStory.id)}
        />
      )}

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-6 py-8 border-t border-gray-800/50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Pythh — Investor signals that matter</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-gray-400 transition-colors">
              Scan your startup
            </Link>
            <Link to="/how-it-works" className="hover:text-gray-400 transition-colors">
              How it works
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
