/**
 * INVESTOR MATCHES PAGE
 * =====================
 * Shows startup matches for an investor using GOD Score matching
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Zap, 
  Target, 
  TrendingUp,
  Loader2,
  Sparkles,
  Filter,
  ChevronDown,
  Search,
  Users,
  Lightbulb,
  DollarSign,
  MapPin,
  Globe,
  Linkedin,
  ExternalLink,
  Star,
  Save,
  Bookmark
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  findMatchesForInvestor, 
  INVESTOR_PREFERENCES,
  getInvestorTypeIcon,
  formatCheckSize
} from '../lib/matchingService';

interface Investor {
  id: string;
  name: string;
  firm?: string;
  bio?: string;
  investment_thesis?: string;
  sectors?: string[];
  stage?: string[];
  check_size_min?: number;
  check_size_max?: number;
  geography_focus?: string[];
  notable_investments?: any;
  investor_type?: string;
  primary_motivation?: string;
  blog_url?: string;
  linkedin_url?: string;
}

interface StartupMatch {
  startup: any;
  score: number;
  reasons: string[];
}

export default function InvestorMatches() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [matches, setMatches] = useState<StartupMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchingStatus, setMatchingStatus] = useState<string>('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [matchesSaved, setMatchesSaved] = useState(false);
  
  // Filters
  const [filterStage, setFilterStage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user));
  }, []);

  // Load investor and generate matches
  useEffect(() => {
    if (!id) return;
    loadInvestorAndMatches();
  }, [id]);

  const loadInvestorAndMatches = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load investor
      const { data: investorData, error: investorError } = await supabase
        .from('investors')
        .select('*')
        .eq('id', id)
        .single();

      if (investorError || !investorData) {
        setError('Investor not found');
        setIsLoading(false);
        return;
      }

      setInvestor(investorData);

      // Generate matches
      await generateMatches(investorData.id);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAllMatches = () => {
    if (!investor || matches.length === 0) return;
    
    // Redirect free users to investor signup - they can't view saved matches without an account
    if (!isSignedIn) {
      navigate('/investor/signup?redirect=/investor/' + investor.id + '/matches');
      return;
    }
    
    // TODO: Implement save functionality for investors (similar to startups)
    // For now, just show a message
    alert('Save functionality coming soon!');
  };

  const generateMatches = async (investorId: string) => {
    setIsMatching(true);
    setMatchingStatus('Analyzing investor preferences...');

    try {
      setMatchingStatus('Finding compatible startups...');
      
      const matchResults = await findMatchesForInvestor(
        investorId,
        50,
        {
          stages: filterStage ? [filterStage] : undefined,
          minGodScore: 25
        }
      );

      setMatchingStatus(`Found ${matchResults.length} matches!`);
      setMatches(matchResults);
    } catch (err) {
      console.error('Matching error:', err);
      setError('Failed to generate matches');
    } finally {
      setIsMatching(false);
      setMatchingStatus('');
    }
  };

  // Filter matches by stage
  const filteredMatches = filterStage 
    ? matches.filter(m => m.startup.stage?.toLowerCase().includes(filterStage.toLowerCase()))
    : matches;

  // Parse notable investments
  const notableInvestments = (() => {
    if (!investor?.notable_investments) return [];
    if (Array.isArray(investor.notable_investments)) return investor.notable_investments;
    if (typeof investor.notable_investments === 'string') {
      try {
        return JSON.parse(investor.notable_investments);
      } catch {
        return [];
      }
    }
    return [];
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (error || !investor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error || 'Investor not found'}</p>
          <Link to="/" className="text-purple-400 hover:text-purple-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">{getInvestorTypeIcon(investor.investor_type)}</span>
                  {investor.name}
                </h1>
                <p className="text-sm text-slate-400">
                  {investor.firm || investor.investor_type || 'Investor'} • Startup Matches
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm">Save Matches</span>
                </button>
              )}
              {investor.blog_url && (
                <a
                  href={investor.blog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                </a>
              )}
              {investor.linkedin_url && (
                <a
                  href={investor.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Investor Profile Summary */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-6 border border-slate-700">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Bio & Thesis */}
            <div>
              {investor.investment_thesis && (
                <div className="mb-4">
                  <h3 className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    Investment Thesis
                  </h3>
                  <p className="text-white">{investor.investment_thesis}</p>
                </div>
              )}
              
              {investor.bio && !investor.investment_thesis && (
                <div className="mb-4">
                  <h3 className="text-sm text-slate-400 mb-1">About</h3>
                  <p className="text-white">{investor.bio}</p>
                </div>
              )}

              {/* Notable Investments */}
              {notableInvestments.length > 0 && (
                <div>
                  <h3 className="text-sm text-slate-400 mb-2 flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Notable Investments
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {notableInvestments.slice(0, 8).map((company: string, i: number) => (
                      <span 
                        key={i}
                        className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm"
                      >
                        {company}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                  <DollarSign className="w-3 h-3" />
                  Check Size
                </div>
                <div className="text-white font-semibold">
                  {formatCheckSize(investor.check_size_min, investor.check_size_max)}
                </div>
              </div>
              
              <div className="bg-slate-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                  <TrendingUp className="w-3 h-3" />
                  Stage Focus
                </div>
                <div className="text-white font-semibold text-sm">
                  {investor.stage?.slice(0, 2).join(', ') || 'All Stages'}
                </div>
              </div>
              
              <div className="bg-slate-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                  <MapPin className="w-3 h-3" />
                  Geography
                </div>
                <div className="text-white font-semibold text-sm truncate">
                  {investor.geography_focus?.slice(0, 2).join(', ') || 'Global'}
                </div>
              </div>
              
              <div className="bg-slate-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                  <Building2 className="w-3 h-3" />
                  Type
                </div>
                <div className="text-white font-semibold">
                  {investor.investor_type || 'VC'}
                </div>
              </div>
            </div>
          </div>

          {/* Sectors */}
          {investor.sectors && investor.sectors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="text-sm text-slate-400 mb-2">Focus Sectors</h3>
              <div className="flex flex-wrap gap-2">
                {investor.sectors.map((sector, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filter
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            
            {filterStage && (
              <button
                onClick={() => setFilterStage(null)}
                className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
              >
                {filterStage} ✕
              </button>
            )}
          </div>
          
          <p className="text-slate-400">
            {filteredMatches.length} matches found
          </p>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
            <p className="text-sm text-slate-400 mb-3">Filter by Stage:</p>
            <div className="flex flex-wrap gap-2">
              {['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth'].map(stage => (
                <button
                  key={stage}
                  onClick={() => setFilterStage(filterStage === stage ? null : stage)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    filterStage === stage
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Matching Status */}
        {isMatching && (
          <div className="bg-purple-500/20 rounded-xl p-4 mb-6 border border-purple-500/30 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <span className="text-purple-300">{matchingStatus}</span>
          </div>
        )}

        {/* Match Results */}
        {filteredMatches.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match, index) => (
              <StartupMatchCard 
                key={match.startup.id}
                startup={match.startup}
                score={match.score}
                reasons={match.reasons}
                rank={index + 1}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No matches found</p>
            <p className="text-slate-500 text-sm mt-2">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Startup Match Card Component
function StartupMatchCard({ 
  startup, 
  score, 
  reasons,
  rank 
}: { 
  startup: any; 
  score: number; 
  reasons: string[];
  rank: number;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'from-green-500 to-emerald-500';
    if (s >= 60) return 'from-cyan-500 to-blue-500';
    if (s >= 40) return 'from-cyan-500 to-blue-500';
    return 'from-cyan-600 to-blue-600';
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl overflow-hidden border border-slate-700 hover:border-cyan-500/50 transition-all shadow-xl">
      {/* Header */}
      <div className="relative p-4 bg-gradient-to-r from-slate-800/30 to-slate-900/30">
        {/* Rank Badge */}
        <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-slate-800">
          #{rank}
        </div>
        
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4 ml-4">
            <h3 className="text-lg font-bold text-white">{startup.name}</h3>
            {startup.tagline && (
              <p className="text-sm text-slate-400 line-clamp-1">{startup.tagline}</p>
            )}
          </div>
          
          {/* Match Score */}
          <div className={`px-3 py-1 rounded-full font-bold bg-gradient-to-r ${getScoreColor(score)} text-white`}>
            {score}%
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* GOD Score */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            GOD Score
          </span>
          <span className="text-white font-semibold">{startup.total_god_score || 50}/100</span>
        </div>

        {/* Stage & Location */}
        <div className="flex items-center gap-4 text-sm">
          {startup.stage && (
            <span className="text-slate-300 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-slate-400" />
              {startup.stage}
            </span>
          )}
          {startup.location && (
            <span className="text-slate-300 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {startup.location}
            </span>
          )}
        </div>

        {/* Sectors */}
        {startup.sectors && startup.sectors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {startup.sectors.slice(0, 3).map((sector: string, i: number) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-cyan-600/20 text-cyan-300 rounded-full text-xs"
              >
                {sector}
              </span>
            ))}
          </div>
        )}

        {/* Match Reasons */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reasons.map((reason, i) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-xs flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* Action */}
        <Link
          to={`/startup/${startup.id}`}
          className="block w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2 px-4 rounded-lg font-medium text-center hover:from-cyan-500 hover:to-blue-500 transition-all text-sm mt-2"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
