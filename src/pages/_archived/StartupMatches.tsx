/**
 * STARTUP MATCHES PAGE
 * ====================
 * Shows investor matches for a startup using GOD Score matching
 * Integrates: Save, Share, Intro Request, Notifications, Analytics
 * Color scheme: Light blue to violet (NO rose/pink)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Rocket, 
  Zap, 
  Target, 
  TrendingUp,
  Loader2,
  Sparkles,
  Filter,
  RefreshCw,
  Lock,
  Users,
  Lightbulb,
  ChevronDown,
  Search,
  BarChart3,
  Bookmark,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  findMatchesForStartup, 
  MatchResult,
  INVESTOR_PREFERENCES 
} from '../lib/matchingService';
import { 
  saveMatch, 
  unsaveMatch, 
  isMatchSaved,
  getSavedMatchCount 
} from '../lib/savedMatchesService';
import MatchCard from '../components/MatchCard';
import ShareMatchModal from '../components/ShareMatchModal';
import RequestIntroModal from '../components/RequestIntroModal';
import MatchNotifications from '../components/MatchNotifications';

const REMATCH_COUNT_KEY = 'hotmatch_rematch_count';
const SEARCH_COUNT_KEY = 'hotmatch_search_count';
const SEARCH_MONTH_KEY = 'hotmatch_search_month';
const MATCHES_WEEK_KEY = 'hotmatch_matches_week';
const MATCHES_WEEK_COUNT_KEY = 'hotmatch_matches_week_count';
const MAX_FREE_REMATCHES = 1;
const MAX_FREE_MATCHES = 3; // For non-signed-in users
const MAX_FREE_MATCHES_PER_WEEK = 3; // For free signed-up users
const MAX_FREE_SEARCHES_PER_MONTH = 3;

interface Startup {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  website?: string;
  sectors?: string[];
  stage?: string;
  total_god_score?: number;
  team_score?: number;
  market_score?: number;
  product_score?: number;
  traction_score?: number;
  vision_score?: number;
  raise_amount?: string;
  location?: string;
}

export default function StartupMatches() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [startup, setStartup] = useState<Startup | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematchCount, setRematchCount] = useState(0);
  const [matchingStatus, setMatchingStatus] = useState<string>('');
  const [savedCount, setSavedCount] = useState(0);
  const [matchesSaved, setMatchesSaved] = useState(false);
  
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [shareModalMatch, setShareModalMatch] = useState<MatchResult | null>(null);
  const [introModalInvestor, setIntroModalInvestor] = useState<{id: string; name: string; firm?: string} | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [savedMatches, setSavedMatches] = useState<Set<string>>(new Set());
  const [searchCount, setSearchCount] = useState(0);
  const [canSearch, setCanSearch] = useState(true);
  const [weeklyMatchCount, setWeeklyMatchCount] = useState(0);
  const [canViewMoreMatches, setCanViewMoreMatches] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(`${REMATCH_COUNT_KEY}_${id}`);
    if (saved) setRematchCount(parseInt(saved, 10));
    
    // Check auth and subscription status
    supabase.auth.getUser().then(({ data }) => {
      const signedIn = !!data.user;
      setIsSignedIn(signedIn);
      
      // Check subscription status (you'll need to implement this based on your subscription system)
      // For now, assume no one is paid unless explicitly set
      const subscriptionStatus = localStorage.getItem('subscription_status');
      const paid = subscriptionStatus === 'paid' || subscriptionStatus === 'premium';
      setIsPaid(paid);
      
      // Check search limits for signed-in free users
      if (signedIn && !paid) {
        const currentMonth = new Date().getMonth();
        const savedMonth = localStorage.getItem(SEARCH_MONTH_KEY);
        const savedCount = localStorage.getItem(SEARCH_COUNT_KEY);
        
        if (savedMonth && parseInt(savedMonth) === currentMonth) {
          const count = parseInt(savedCount || '0', 10);
          setSearchCount(count);
          setCanSearch(count < MAX_FREE_SEARCHES_PER_MONTH);
        } else {
          // New month, reset count
          setSearchCount(0);
          setCanSearch(true);
          localStorage.setItem(SEARCH_MONTH_KEY, currentMonth.toString());
          localStorage.setItem(SEARCH_COUNT_KEY, '0');
        }
        
        // Check weekly match limits for free signed-up users
        const currentWeek = getWeekNumber(new Date());
        const savedWeek = localStorage.getItem(MATCHES_WEEK_KEY);
        const savedWeekCount = localStorage.getItem(MATCHES_WEEK_COUNT_KEY);
        
        if (savedWeek && parseInt(savedWeek) === currentWeek) {
          const count = parseInt(savedWeekCount || '0', 10);
          setWeeklyMatchCount(count);
          setCanViewMoreMatches(count < MAX_FREE_MATCHES_PER_WEEK);
        } else {
          // New week, reset count
          setWeeklyMatchCount(0);
          setCanViewMoreMatches(true);
          localStorage.setItem(MATCHES_WEEK_KEY, currentWeek.toString());
          localStorage.setItem(MATCHES_WEEK_COUNT_KEY, '0');
        }
      }
    });
    
    setSavedCount(getSavedMatchCount());
  }, [id]);
  
  // Helper function to get week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const canRematch = rematchCount < MAX_FREE_REMATCHES;

  useEffect(() => {
    if (!id) return;
    
    // Clear previous state when ID changes (critical fix for duplicate results)
    console.log('🔄 Startup ID changed, clearing previous state:', id);
    setStartup(null);
    setMatches([]);
    setError(null);
    setIsLoading(true);
    
    loadStartupAndMatches();
  }, [id]);

  useEffect(() => {
    if (matches.length > 0 && startup) {
      const saved = new Set<string>();
      matches.forEach(m => {
        if (isMatchSaved(startup.id, m.investor.id)) saved.add(m.investor.id);
      });
      setSavedMatches(saved);
      // Check if all matches are already saved
      if (saved.size === matches.length) {
        setMatchesSaved(true);
      }
    }
  }, [matches, startup]);

  const loadStartupAndMatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!id) {
        setError('Invalid startup ID');
        setIsLoading(false);
        return;
      }

      const { data: startupData, error: startupError } = await supabase
        .from('startup_uploads')
        .select('*')
        .eq('id', id)
        .single();

      if (startupError || !startupData) {
        console.error('❌ Error loading startup:', startupError);
        console.error('Startup ID requested:', id);
        setError('Startup not found');
        setIsLoading(false);
        return;
      }

      // Log for debugging - this will show what startup is actually loaded
      console.log('✅ Loaded startup for matches:', {
        requestedId: id,
        actualId: startupData.id,
        name: startupData.name,
        website: startupData.website,
        godScore: startupData.total_god_score,
        sectors: startupData.sectors,
        stage: startupData.stage
      });

      // Convert null to undefined for optional fields
      const startup: Startup = {
        id: startupData.id,
        name: startupData.name,
        tagline: startupData.tagline ?? undefined,
        description: startupData.description ?? undefined,
        website: startupData.website ?? undefined,
        sectors: startupData.sectors ?? undefined,
        stage: startupData.stage ? String(startupData.stage) : undefined,
        total_god_score: startupData.total_god_score ?? undefined,
        team_score: startupData.team_score ?? undefined,
        market_score: startupData.market_score ?? undefined,
        product_score: startupData.product_score ?? undefined,
        traction_score: startupData.traction_score ?? undefined,
        vision_score: startupData.vision_score ?? undefined,
        raise_amount: startupData.raise_amount ?? undefined,
        location: startupData.location ?? undefined,
      };

      setStartup(startup);
      await generateMatches(startup);
    } catch (err) {
      console.error('Error loading startup:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMatches = async (startupData: Startup) => {
    // Check search limits for signed-in free users
    if (isSignedIn && !isPaid) {
      if (!canSearch) {
        setError('You\'ve reached your monthly search limit. Upgrade to Premium for unlimited searches.');
        return;
      }
      
      // Increment search count
      const newCount = searchCount + 1;
      setSearchCount(newCount);
      localStorage.setItem(SEARCH_COUNT_KEY, newCount.toString());
      
      if (newCount >= MAX_FREE_SEARCHES_PER_MONTH) {
        setCanSearch(false);
      }
    }
    
    setIsMatching(true);
    setMatchingStatus('Finding compatible investors...');
    try {
      if (!startupData.id) {
        setError('Invalid startup ID');
        return;
      }

      // Lower minScore for low-scoring startups to ensure they get matches
      const godScore = startupData.total_god_score || 50;
      const minScore = godScore < 40 ? 20 : 30; // Lower threshold for startups with GOD < 40

      const matchResults = await findMatchesForStartup(startupData.id, 50, {
        investorTypes: filterType ? [filterType] : undefined,
        minScore: minScore
      });
      
      setMatchingStatus(`Found ${matchResults.length} matches!`);
      
      // Log match generation with startup details
      console.log('✅ Generated matches for startup:', {
        startupId: startupData.id,
        startupName: startupData.name,
        website: startupData.website,
        matchCount: matchResults.length,
        godScore: godScore,
        minScore: minScore,
        sectors: startupData.sectors,
        stage: startupData.stage
      });
      
      if (matchResults.length > 0) {
        console.log('   Sample matches:', matchResults.slice(0, 3).map(m => ({
          investor: m.investor.name,
          score: m.score
        })));
      }
      
      setMatches(matchResults);
      
      // If no matches found, log for debugging
      if (matchResults.length === 0) {
        console.warn('⚠️ No matches found for startup:', {
          id: startupData.id,
          name: startupData.name,
          godScore: godScore,
          sectors: startupData.sectors,
          stage: startupData.stage,
          minScore: minScore
        });
      }
    } catch (err) {
      console.error('Error generating matches:', err);
      setError('Failed to generate matches');
    } finally {
      setIsMatching(false);
      setMatchingStatus('');
    }
  };

  const handleRematch = async () => {
    if (!canRematch || !startup) return;
    const newCount = rematchCount + 1;
    setRematchCount(newCount);
    localStorage.setItem(`${REMATCH_COUNT_KEY}_${id}`, newCount.toString());
    await generateMatches(startup);
  };

  const handleSaveMatch = (investorId: string) => {
    if (!startup) return;
    
    const match = matches.find(m => m.investor.id === investorId);
    if (!match) return;

    // Save match to localStorage (works for both free and signed-in users)
    // Free users' matches will be synced when they sign up
    if (savedMatches.has(investorId)) {
      unsaveMatch(startup.id, investorId);
      setSavedMatches(prev => { const next = new Set(prev); next.delete(investorId); return next; });
      setSavedCount(prev => prev - 1);
      setMatchesSaved(false); // Not all saved anymore
    } else {
      saveMatch({
        startupId: startup.id,
        investorId: investorId,
        startupName: startup.name,
        investorName: match.investor.name,
        matchScore: match.score
      });
      setSavedMatches(prev => new Set(prev).add(investorId));
      setSavedCount(prev => prev + 1);
      
      // Check if all matches are now saved
      const allSaved = displayMatches.every(m => 
        m.investor.id === investorId || savedMatches.has(m.investor.id)
      );
      if (allSaved && displayMatches.length > 0) {
        setMatchesSaved(true);
      }
    }
    
    // Redirect free users to signup after saving (so they can view their saved matches)
    if (!isSignedIn) {
      navigate('/get-matched?redirect=/startup/' + startup.id + '/matches');
    }
  };

  const handleShare = (match: MatchResult) => setShareModalMatch(match);
  
  const handleRequestIntro = (investorId: string) => {
    const match = matches.find(m => m.investor.id === investorId);
    if (match) setIntroModalInvestor({ id: investorId, name: match.investor.name, firm: match.investor.firm });
  };

  const filteredMatches = filterType ? matches.filter(m => m.investorType === filterType) : matches;
  
  // Determine how many matches to show based on user tier
  let displayMatches: MatchResult[];
  let hasMoreMatches = false;
  
  if (isPaid) {
    // Paid users: see all matches
    displayMatches = filteredMatches;
  } else if (isSignedIn) {
    // Free signed-up users: 3 matches per week
    const currentWeek = getWeekNumber(new Date());
    const savedWeek = localStorage.getItem(MATCHES_WEEK_KEY);
    const savedWeekCount = localStorage.getItem(MATCHES_WEEK_COUNT_KEY);
    
    let weekCount = 0;
    if (savedWeek && parseInt(savedWeek) === currentWeek) {
      weekCount = parseInt(savedWeekCount || '0', 10);
    }
    
    // Show matches up to weekly limit (but at least show the first 3)
    const maxToShow = Math.max(MAX_FREE_MATCHES_PER_WEEK, weekCount);
    displayMatches = filteredMatches.slice(0, maxToShow);
    hasMoreMatches = filteredMatches.length > displayMatches.length;
    
    // Track viewed matches for weekly limit (only increment if viewing more than current count)
    if (displayMatches.length > weekCount) {
      const newCount = displayMatches.length;
      setWeeklyMatchCount(newCount);
      localStorage.setItem(MATCHES_WEEK_KEY, currentWeek.toString());
      localStorage.setItem(MATCHES_WEEK_COUNT_KEY, newCount.toString());
    }
  } else {
    // Non-signed-in users: only 3 matches
    displayMatches = filteredMatches.slice(0, MAX_FREE_MATCHES);
    hasMoreMatches = filteredMatches.length > MAX_FREE_MATCHES;
  }

  const handleSaveAllMatches = () => {
    if (!startup || displayMatches.length === 0) return;
    
    // Save matches to localStorage (works for both free and signed-in users)
    // Free users can save up to 3 matches, which will be available after signup
    const matchesToSave = !isSignedIn 
      ? displayMatches.slice(0, MAX_FREE_MATCHES) // Free users: only first 3
      : displayMatches; // Signed-in users: all displayed
    
    let newSaveCount = 0;
    matchesToSave.forEach(match => {
      if (!savedMatches.has(match.investor.id)) {
        saveMatch({
          startupId: startup.id,
          investorId: match.investor.id,
          startupName: startup.name,
          investorName: match.investor.name,
          matchScore: match.score
        });
        newSaveCount++;
      }
    });
    
    const savedIds = new Set(matchesToSave.map(m => m.investor.id));
    setSavedMatches(prev => {
      const next = new Set(prev);
      matchesToSave.forEach(m => next.add(m.investor.id));
      return next;
    });
    setSavedCount(prev => prev + newSaveCount);
    setMatchesSaved(matchesToSave.every(m => savedMatches.has(m.investor.id) || savedIds.has(m.investor.id)));
    
    // Redirect free users to signup after saving (so they can view their saved matches)
    if (!isSignedIn) {
      navigate('/get-matched?redirect=/startup/' + startup.id + '/matches');
    }
  };

  if (isLoading) {
    return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (error || !startup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error || 'Startup not found'}</p>
          <Link to="/" className="text-cyan-400 hover:text-cyan-300">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-cyan-400" />
                  {startup.name}
                </h1>
                <p className="text-sm text-slate-400">{startup.tagline || 'Investor Matches'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Save Matches Button */}
              {matchesSaved ? (
                <Link to="/saved-matches" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors">
                  <Bookmark className="w-4 h-4" />
                  <span className="text-sm">{savedCount} Saved ✓</span>
                </Link>
              ) : (
                <button 
                  onClick={handleSaveAllMatches} 
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-colors"
                  title={!isSignedIn ? `Free users can only save the first ${MAX_FREE_MATCHES} matches` : undefined}
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm">
                    {!isSignedIn ? `Save First ${MAX_FREE_MATCHES}` : 'Save Matches'}
                  </span>
                </button>
              )}
              {isSignedIn && !isPaid && (
                <div className="flex items-center gap-1 px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs border border-cyan-500/30">
                  <span>{searchCount}/{MAX_FREE_SEARCHES_PER_MONTH} searches</span>
                </div>
              )}
              {isPaid && <MatchNotifications />}
              {isPaid && (
                <Link to="/analytics" className="p-2 hover:bg-slate-800 rounded-lg transition-colors" title="View Analytics">
                  <BarChart3 className="w-5 h-5 text-slate-400" />
                </Link>
              )}
              {canRematch ? (
                <button onClick={handleRematch} disabled={isMatching} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${isMatching ? 'animate-spin' : ''}`} />
                  Re-match
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-lg">
                  <Lock className="w-4 h-4" />
                  No rematches left
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-32">
        {/* GOD Score Summary */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              GOD Score Profile
            </h2>
            <div className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {startup.total_god_score || 50}/100
            </div>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <ScoreBar label="Team" value={startup.team_score || 50} icon={Users} />
            <ScoreBar label="Market" value={startup.market_score || 50} icon={TrendingUp} />
            <ScoreBar label="Product" value={startup.product_score || 50} icon={Target} />
            <ScoreBar label="Traction" value={startup.traction_score || 50} icon={Zap} />
            <ScoreBar label="Vision" value={startup.vision_score || 50} icon={Lightbulb} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors">
              <Filter className="w-4 h-4" />
              Filter
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {filterType && (
              <button onClick={() => setFilterType(null)} className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm">
                {filterType} ✕
              </button>
            )}
          </div>
          <p className="text-slate-400">{displayMatches.length} of {filteredMatches.length} matches</p>
        </div>

        {showFilters && (
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
            <p className="text-sm text-slate-400 mb-3">Filter by Investor Type:</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(INVESTOR_PREFERENCES).map(type => (
                <button key={type} onClick={() => setFilterType(filterType === type ? null : type)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${filterType === type ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMatching && (
          <div className="bg-cyan-500/20 rounded-xl p-4 mb-6 border border-cyan-500/30 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-cyan-300">{matchingStatus}</span>
          </div>
        )}

        {displayMatches.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayMatches.map((match, index) => (
              <MatchCard 
                key={match.investor.id}
                match={match}
                rank={index + 1}
                isSaved={savedMatches.has(match.investor.id)}
                onSave={handleSaveMatch}
                onShare={handleShare}
                onRequestIntro={handleRequestIntro}
                isPaid={isPaid}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No matches found</p>
            <p className="text-slate-500 text-sm mt-2">Try adjusting your filters</p>
          </div>
        )}

        {(!isSignedIn || hasMoreMatches) && (
          <div className="mt-8 mb-12 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 border border-cyan-500/30 text-center">
            <Lock className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              {filteredMatches.length - displayMatches.length} More Matches Available
            </h3>
            <p className="text-slate-300 mb-6 max-w-md mx-auto">
              {!isSignedIn 
                ? `Sign up to get ${MAX_FREE_MATCHES_PER_WEEK} matches per week and view your saved matches.`
                : isPaid
                  ? 'Upgrade to Premium to unlock all matches and get personalized match advice.'
                  : `You've viewed ${weeklyMatchCount}/${MAX_FREE_MATCHES_PER_WEEK} matches this week. Upgrade to Premium for unlimited matches, personalized match advice, and unlimited searches.`}
            </p>
            <div className="flex gap-4 justify-center">
              {!isSignedIn ? (
                <>
                  <Link to="/get-matched" className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-500 transition-all">Sign Up Free</Link>
                  <Link to="/login" className="px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all">Log In</Link>
                </>
              ) : (
                <Link to="/get-matched" className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-500 transition-all">Upgrade to Premium</Link>
              )}
            </div>
          </div>
        )}
      </div>

      {shareModalMatch && startup && (
        <ShareMatchModal isOpen={true} onClose={() => setShareModalMatch(null)} match={shareModalMatch} startupName={startup.name} />
      )}

      {introModalInvestor && startup && (
        <RequestIntroModal isOpen={true} onClose={() => setIntroModalInvestor(null)} investorId={introModalInvestor.id} investorName={introModalInvestor.name} investorFirm={introModalInvestor.firm} startupId={startup.id} startupName={startup.name} matchScore={matches.find(m => m.investor.id === introModalInvestor.id)?.score || 0} />
      )}
    </div>
  );
}

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const getColor = (v: number) => {
    if (v >= 70) return 'from-emerald-500 to-cyan-500';
    if (v >= 50) return 'from-cyan-500 to-blue-500';
    if (v >= 30) return 'from-blue-500 to-indigo-500';
    return 'from-indigo-500 to-violet-500';
  };

  return (
    <div className="text-center">
      <Icon className="w-5 h-5 text-slate-400 mx-auto mb-1" />
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
        <div className={`h-full rounded-full bg-gradient-to-r ${getColor(value)}`} style={{ width: `${value}%` }} />
      </div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
