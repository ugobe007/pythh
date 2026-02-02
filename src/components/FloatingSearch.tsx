import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Rocket, 
  Briefcase, 
  TrendingUp, 
  Zap, 
  ChevronRight,
  X,
  Sparkles,
  Target,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
interface SearchResult {
  id: string;
  type: 'startup' | 'investor';
  name: string;
  tagline?: string;
  description?: string;
  firm?: string;
  sectors?: string[];
  stage?: string | string[];
  score?: number;
}

interface Match {
  id: string;
  name: string;
  description?: string;
  tagline?: string;
  firm?: string;
  sectors?: string[];
  stage?: string | string[];
  score: number;
  type: 'startup' | 'investor';
}

type SearchMode = 'startup' | 'investor';

const FREE_SEARCH_LIMIT = 2;
const SEARCH_COUNT_KEY = 'hotmatch_search_count';

export default function FloatingSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>('startup');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const [showLimitReached, setShowLimitReached] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load search count from localStorage on mount
  useEffect(() => {
    const savedCount = localStorage.getItem(SEARCH_COUNT_KEY);
    if (savedCount) {
      setSearchCount(parseInt(savedCount, 10));
    }
  }, []);

  // Check if limit reached
  const isLimitReached = searchCount >= FREE_SEARCH_LIMIT;

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      if (mode === 'startup') {
        const { data } = await supabase
          .from('startup_uploads')
          .select('id, name, tagline, description, sectors, stage, total_god_score')
          .or(`name.ilike.%${searchQuery}%,tagline.ilike.%${searchQuery}%`)
          .eq('status', 'approved')
          .order('total_god_score', { ascending: false, nullsFirst: false })
          .limit(8);

        setResults((data || []).map(s => ({
          id: s.id,
          type: 'startup' as const,
          name: s.name,
          tagline: s.tagline,
          sectors: s.sectors,
          stage: s.stage,
          score: s.total_god_score,
        })));
      } else {
        const { data } = await supabase
          .from('investors')
          .select('id, name, firm, bio, sectors, stage')
          .or(`name.ilike.%${searchQuery}%,firm.ilike.%${searchQuery}%`)
          .limit(8);

        setResults((data || []).map(i => ({
          id: i.id,
          type: 'investor' as const,
          name: i.name,
          firm: i.firm,
          description: i.bio,
          sectors: i.sectors,
          stage: i.stage,
        })));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [mode]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // Load matches
  const loadMatches = async (result: SearchResult) => {
    // Check search limit before loading matches
    if (isLimitReached) {
      setShowLimitReached(true);
      return;
    }
    
    // Increment search count
    const newCount = searchCount + 1;
    setSearchCount(newCount);
    localStorage.setItem(SEARCH_COUNT_KEY, newCount.toString());
    
    setSelectedResult(result);
    setIsLoadingMatches(true);

    try {
      if (result.type === 'startup') {
        // Step 1: Fetch match rows only (NO EMBEDS)
        const { data: matchRows } = await supabase
          .from('startup_investor_matches')
          .select('investor_id, match_score')
          .eq('startup_id', result.id)
          .eq('status', 'suggested')
          .order('match_score', { ascending: false })
          .limit(12);

        if (matchRows && matchRows.length > 0) {
          // Step 2: Fetch investors by IDs
          const investorIds = matchRows.map(m => m.investor_id).filter(Boolean);
          const { data: investors } = await supabase
            .from('investors')
            .select('id, name, firm, bio, sectors, stage')
            .in('id', investorIds);

          // Step 3: Join in memory
          const investorById = new Map((investors || []).map(inv => [inv.id, inv]));
          setMatches(matchRows
            .map(m => {
              const inv = investorById.get(m.investor_id);
              if (!inv) return null;
              return {
                id: inv.id,
                name: inv.name,
                firm: inv.firm,
                description: inv.bio,
                sectors: inv.sectors,
                stage: inv.stage,
                score: m.match_score,
                type: 'investor' as const,
              };
            })
            .filter(Boolean) as any[]);
        } else {
          setMatches([]);
        }
      } else {
        // Step 1: Fetch match rows only (NO EMBEDS)
        const { data: matchRows } = await supabase
          .from('startup_investor_matches')
          .select('startup_id, match_score')
          .eq('investor_id', result.id)
          .eq('status', 'suggested')
          .order('match_score', { ascending: false })
          .limit(12);

        if (matchRows && matchRows.length > 0) {
          // Step 2: Fetch startups by IDs
          const startupIds = matchRows.map(m => m.startup_id).filter(Boolean);
          const { data: startups } = await supabase
            .from('startup_uploads')
            .select('id, name, tagline, sectors, stage, total_god_score')
            .in('id', startupIds);

          // Step 3: Join in memory
          const startupById = new Map((startups || []).map(s => [s.id, s]));
          setMatches(matchRows
            .map(m => {
              const startup = startupById.get(m.startup_id);
              if (!startup) return null;
              return {
                id: startup.id,
                name: startup.name,
                tagline: startup.tagline,
                sectors: startup.sectors,
                stage: startup.stage,
                score: m.match_score,
                type: 'startup' as const,
              };
            })
            .filter(Boolean) as any[]);
        } else {
          setMatches([]);
        }
      }
    } catch (err) {
      console.error('Error loading matches:', err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const resetSearch = () => {
    setSelectedResult(null);
    setMatches([]);
    setQuery('');
    setResults([]);
    setShowLimitReached(false);
    inputRef.current?.focus();
  };

  const closeModal = () => {
    setIsOpen(false);
    setSelectedResult(null);
    setMatches([]);
    setQuery('');
    setResults([]);
    setShowLimitReached(false);
  };

  const remainingSearches = Math.max(0, FREE_SEARCH_LIMIT - searchCount);

  return (
    <>
      {/* Floating Button - Amber with dark text */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="relative">
          {/* Glow effect - amber */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
          
          {/* Button - amber bg, dark text, dark border */}
          <div className="relative flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full text-gray-900 font-bold shadow-2xl border-2 border-cyan-600 hover:scale-105 hover:from-cyan-300 hover:to-blue-300 transition-all">
            <Search className="w-5 h-5" />
            <span>Find Matches</span>
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                Search Matches
              </h2>
              <div className="flex items-center gap-3">
                {/* Search count indicator */}
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  remainingSearches > 0 
                    ? 'bg-cyan-500/20 text-cyan-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {remainingSearches > 0 
                    ? `${remainingSearches} free search${remainingSearches === 1 ? '' : 'es'} left`
                    : 'Limit reached'
                  }
                </div>
                <button 
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex justify-center p-4 border-b border-white/5">
              <div className="inline-flex bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => { setMode('startup'); resetSearch(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    mode === 'startup'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Rocket className="w-4 h-4" />
                  Find Investors
                </button>
                <button
                  onClick={() => { setMode('investor'); resetSearch(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    mode === 'investor'
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  Find Startups
                </button>
              </div>
            </div>

            {/* Search Input */}
            {!selectedResult && !showLimitReached && (
              <div className="p-4">
                {/* Remaining searches warning */}
                {remainingSearches === 1 && (
                  <div className="mb-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-blue-400 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Last free search! Sign up for unlimited access.</span>
                  </div>
                )}
                
                <div className="relative flex items-center bg-slate-800 border border-white/10 rounded-xl">
                  <Search className={`ml-4 w-5 h-5 ${isSearching ? 'text-cyan-400 animate-pulse' : 'text-gray-400'}`} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={mode === 'startup' 
                      ? 'Search for your startup...' 
                      : 'Search by name or firm...'
                    }
                    className="flex-1 px-4 py-3 bg-transparent text-white placeholder-gray-500 outline-none"
                  />
                  {query && (
                    <button 
                      onClick={() => { setQuery(''); setResults([]); }}
                      className="p-2 mr-2 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                  <div className="mt-2 bg-slate-800/50 rounded-xl overflow-hidden border border-white/5">
                    {results.map((result, idx) => (
                      <button
                        key={result.id}
                        onClick={() => loadMatches(result)}
                        className={`w-full text-left p-3 hover:bg-slate-700/50 transition-all flex items-center gap-3 ${
                          idx !== results.length - 1 ? 'border-b border-white/5' : ''
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          result.type === 'startup' 
                            ? 'bg-cyan-600/20' 
                            : 'bg-purple-500/20'
                        }`}>
                          {result.type === 'startup' 
                            ? <Rocket className="w-5 h-5 text-cyan-400" />
                            : <Briefcase className="w-5 h-5 text-purple-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate">{result.name}</span>
                            {result.score && (
                              <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded">
                                {result.score}
                              </span>
                            )}
                          </div>
                          {result.firm && <p className="text-purple-400 text-sm">{result.firm}</p>}
                          {result.tagline && <p className="text-gray-500 text-sm truncate">{result.tagline}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))}
                  </div>
                )}

                {query.length >= 2 && !isSearching && results.length === 0 && (
                  <div className="mt-4 text-center text-gray-400 py-8">
                    No {mode}s found for "{query}"
                  </div>
                )}
              </div>
            )}

            {/* Limit Reached CTA */}
            {showLimitReached && !selectedResult && (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                  <span className="text-4xl">🔒</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Free Search Limit Reached</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  You've used your {FREE_SEARCH_LIMIT} free searches. Sign up for a free account to unlock unlimited match searches!
                </p>
                <div className="space-y-3">
                  <a 
                    href="/get-matched"
                    className="block w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
                  >
                    🚀 Sign Up Free — Unlock Unlimited Searches
                  </a>
                  <button 
                    onClick={closeModal}
                    className="w-full py-3 rounded-xl bg-slate-800 text-gray-400 font-medium hover:bg-slate-700 transition-all"
                  >
                    Maybe Later
                  </button>
                </div>
                <p className="mt-4 text-gray-500 text-sm">
                  ✓ Free forever • ✓ No credit card • ✓ Instant access
                </p>
              </div>
            )}

            {/* Selected + Matches */}
            {selectedResult && (
              <div className="p-4">
                {/* Selected Header */}
                <div className="flex items-center gap-3 mb-4">
                  <button 
                    onClick={resetSearch}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedResult.type === 'startup' ? 'bg-cyan-600' : 'bg-purple-500'
                  }`}>
                    {selectedResult.type === 'startup' 
                      ? <Rocket className="w-5 h-5 text-white" />
                      : <Briefcase className="w-5 h-5 text-white" />
                    }
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedResult.name}</h3>
                    {selectedResult.firm && <p className="text-purple-400 text-sm">{selectedResult.firm}</p>}
                  </div>
                </div>

                {/* Matches */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    {selectedResult.type === 'startup' ? 'MATCHED INVESTORS' : 'MATCHED STARTUPS'}
                    <span className="ml-auto text-cyan-400">{matches.length} found</span>
                  </h4>

                  {isLoadingMatches ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                  ) : matches.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                      {matches.map((match, idx) => (
                        <div
                          key={match.id}
                          className="bg-slate-900/50 rounded-lg p-3 border border-white/5 hover:border-cyan-500/30 transition-all"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                              idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                              idx === 2 ? 'bg-cyan-600/20 text-blue-400' :
                              'bg-slate-700 text-gray-500'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1 text-cyan-400 text-xs font-bold">
                              <Target className="w-3 h-3" />
                              {match.score}%
                            </div>
                          </div>
                          <h5 className="text-white font-medium text-sm truncate">{match.name}</h5>
                          {match.firm && <p className="text-purple-400 text-xs truncate">{match.firm}</p>}
                          {match.sectors && match.sectors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {match.sectors.slice(0, 2).map((s, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-slate-700 text-gray-400 text-xs rounded">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No matches found yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
