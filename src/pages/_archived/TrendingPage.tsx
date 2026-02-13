import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, Search, Zap, Brain, Building2,
  ChevronRight,
  Sparkles, ArrowRight, ChevronDown,
  Lightbulb, Code2, CheckCircle2, Info, X,
  Users, Target, BarChart3, Eye, Layers, Flame
} from 'lucide-react';
import FlameIcon from '../components/FlameIcon';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import LiveMatchDemo from '../components/LiveMatchDemo';
import TrendingAnalytics from '../components/TrendingAnalytics';

// Algorithm Definitions
const ALGORITHMS = [
  {
    id: 'god',
    name: 'GOD Algorithm',
    shortName: 'GOD',
    icon: Flame,
    color: 'from-red-500 to-amber-500',
    bgColor: 'from-red-900/40 to-amber-900/30',
    borderColor: 'border-red-500/40',
    description: 'Our proprietary 14-factor scoring system: Team, Traction, Market, Product, Vision + YC Philosophy + Smell Tests.',
    formula: 'Balanced composite (0-100)',
    weight: { balanced: 1.0 }
  },
  {
    id: 'yc',
    name: 'YC Smell Test',
    shortName: 'YC',
    icon: Lightbulb,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'from-orange-900/40 to-amber-900/30',
    borderColor: 'border-orange-500/40',
    description: "Paul Graham's 5 heuristics: Can 2 people build this? Users emotionally attached? Learning in public? Inevitable? Massive if works?",
    formula: 'Smell Tests + GOD (0-100)',
    weight: { smell_test: 20, god: 1 }
  },
  {
    id: 'sequoia',
    name: 'Sequoia Capital Style',
    shortName: 'Sequoia',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'from-emerald-900/40 to-teal-900/30',
    borderColor: 'border-emerald-500/40',
    description: 'Execution & market focus. Massive TAM, strong traction metrics, proven revenue growth, and market timing.',
    formula: 'Traction + Market + Team (0-100)',
    weight: { traction: 2.0, market: 1.5, team: 1.0 }
  },
  {
    id: 'a16z',
    name: 'Andreessen Horowitz Style',
    shortName: 'A16Z',
    icon: Code2,
    color: 'from-purple-500 to-indigo-500',
    bgColor: 'from-purple-900/40 to-indigo-900/30',
    borderColor: 'border-purple-500/40',
    description: 'Technical moat & vision. Product innovation, contrarian bets, technical founders, and deep tech capabilities.',
    formula: 'Product + Vision + Team (0-100)',
    weight: { product: 1.8, vision: 1.5, team: 1.2, tech_bonus: 20 }
  }
];

interface Startup {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  sectors?: string[];
  stage?: number;
  location?: string;
  website?: string;
  
  // GOD Scores
  total_god_score?: number;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  vision_score?: number;
  
  // Smell Tests
  smell_test_score?: number;
  smell_test_lean?: boolean;
  smell_test_user_passion?: boolean;
  smell_test_learning_public?: boolean;
  smell_test_inevitable?: boolean;
  smell_test_massive_if_works?: boolean;
  
  // Extra metrics
  tam_estimate?: string;
  market_timing_score?: number;
  has_technical_cofounder?: boolean;
  arr?: number;
  mrr?: number;
  customer_count?: number;
  growth_rate_monthly?: number;
  latest_funding_amount?: string;
  latest_funding_round?: string;
  
  // Calculated scores
  ycScore?: number;
  sequoiaScore?: number;
  a16zScore?: number;
}

// ALL SCORES NORMALIZED TO 0-100 SCALE
// GOD score is our comprehensive baseline using 50+ data points
// VC scores apply their unique investment thesis as modifiers to create differentiation

// Calculate YC Score (normalized 0-100)
// YC philosophy: Favors early-stage velocity, user obsession, lean teams
// Penalizes: Over-capitalization, slow iteration, weak founder-market fit
function calculateYCScore(startup: Startup): number {
  const godScore = startup.total_god_score || 0;
  
  // YC modifiers (can increase OR decrease from GOD baseline)
  let modifier = 0;
  
  // YC loves strong smell test (founder intuition/passion)
  modifier += (startup.smell_test_score || 0) * 2; // Up to +10
  
  // YC penalizes over-funded early stage (prefer lean)
  const funding = startup.funding_amount || 0;
  if (funding > 5000000) modifier -= 5; // Raised too much too early
  
  // YC values technical founders
  if (startup.has_technical_cofounder) modifier += 3;
  
  // YC is tough on market timing
  modifier -= 3; // Base penalty (YC is selective)
  
  return Math.max(0, Math.min(100, Math.round(godScore + modifier)));
}

// Calculate Sequoia Score (normalized 0-100)
// Sequoia philosophy: Market size obsessed, execution focused, metrics driven
// Penalizes: Small TAM, weak traction, unclear path to scale
function calculateSequoiaScore(startup: Startup): number {
  const godScore = startup.total_god_score || 0;
  
  // Sequoia modifiers
  let modifier = 0;
  
  // Sequoia LOVES strong traction
  const traction = startup.traction_score || 0;
  if (traction > 70) modifier += 5;
  else if (traction < 40) modifier -= 5;
  
  // Sequoia values large markets
  const market = startup.market_score || 0;
  if (market > 70) modifier += 5;
  else if (market < 40) modifier -= 8; // Harsh on small TAM
  
  // Sequoia is execution focused - penalize if weak team
  const team = startup.team_score || 0;
  if (team < 40) modifier -= 5;
  
  // Sequoia has high bar
  modifier -= 5; // Base penalty (Sequoia is very selective)
  
  return Math.max(0, Math.min(100, Math.round(godScore + modifier)));
}

// Calculate A16Z Score (normalized 0-100)  
// A16Z philosophy: Tech-first, network effects, bold vision, founder empowerment
// Penalizes: Incremental innovation, weak moats, non-technical founders
function calculateA16ZScore(startup: Startup): number {
  const godScore = startup.total_god_score || 0;
  
  // A16Z modifiers
  let modifier = 0;
  
  // A16Z values product innovation
  const product = startup.product_score || 0;
  if (product > 70) modifier += 5;
  else if (product < 40) modifier -= 8; // Harsh on weak product
  
  // A16Z loves bold vision
  const vision = startup.vision_score || 0;
  if (vision > 70) modifier += 5;
  else if (vision < 40) modifier -= 5;
  
  // A16Z strongly favors technical founders
  if (startup.has_technical_cofounder) modifier += 5;
  else modifier -= 3;
  
  // A16Z has high standards
  modifier -= 4; // Base penalty
  
  return Math.max(0, Math.min(100, Math.round(godScore + modifier)));
}

// Format currency
function formatCurrency(amount?: number): string {
  if (!amount) return '-';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

// Get TAM badge color
function getTAMColor(tam?: string): string {
  if (!tam) return 'bg-gray-500/20 text-gray-300';
  if (tam.includes('100B')) return 'bg-emerald-500/20 text-emerald-300';
  if (tam.includes('10B')) return 'bg-blue-500/20 text-blue-300';
  if (tam.includes('1B')) return 'bg-purple-500/20 text-purple-300';
  return 'bg-gray-500/20 text-gray-300';
}

export default function TrendingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('god');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });
  const [showMethodology, setShowMethodology] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Fetch startups with GOD scores and smell tests
      const { data: startupData, error } = await supabase
        .from('startup_uploads')
        .select(`
          id, name, tagline, description, sectors, stage, location, website,
          total_god_score, team_score, traction_score, market_score, product_score, vision_score,
          tam_estimate, market_timing_score, has_technical_cofounder,
          arr, mrr, customer_count, growth_rate_monthly,
          latest_funding_amount, latest_funding_round
        `)
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false })
        .limit(5000);
      
      if (error) {
        console.error('Error fetching startups:', error);
      }
      
      // Calculate all algorithm scores
      const typedData = (startupData || []) as any[];
      const startupsWithScores = typedData.map((s: any) => ({
        ...s,
        ycScore: calculateYCScore(s),
        sequoiaScore: calculateSequoiaScore(s),
        a16zScore: calculateA16ZScore(s)
      }))
      
      setStartups(startupsWithScores);
      
      // Fetch stats
      const [{ count: startupCount }, { count: investorCount }, { count: matchCount }] = await Promise.all([
        supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('investors').select('*', { count: 'exact', head: true }),
        supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true })
      ]);
      
      setStats({
        startups: startupCount || 0,
        investors: investorCount || 0,
        matches: matchCount || 0
      });
      
      setLoading(false);
    }
    
    fetchData();
  }, []);

  // Sort and filter startups based on selected algorithm
  const sortedStartups = useMemo(() => {
    let filtered = startups;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = startups.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.tagline?.toLowerCase().includes(query) ||
        s.sectors?.some(sec => sec.toLowerCase().includes(query))
      );
    }
    
    // Sort by selected algorithm
    return [...filtered].sort((a, b) => {
      switch (selectedAlgorithm) {
        case 'god':
          return (b.total_god_score || 0) - (a.total_god_score || 0);
        case 'yc':
          return (b.ycScore || 0) - (a.ycScore || 0);
        case 'sequoia':
          return (b.sequoiaScore || 0) - (a.sequoiaScore || 0);
        case 'a16z':
          return (b.a16zScore || 0) - (a.a16zScore || 0);
        default:
          return (b.total_god_score || 0) - (a.total_god_score || 0);
      }
    });
  }, [startups, selectedAlgorithm, searchQuery]);

  // Get score for current algorithm
  const getScore = (startup: Startup): number => {
    switch (selectedAlgorithm) {
      case 'god': return startup.total_god_score || 0;
      case 'yc': return startup.ycScore || 0;
      case 'sequoia': return startup.sequoiaScore || 0;
      case 'a16z': return startup.a16zScore || 0;
      default: return startup.total_god_score || 0;
    }
  };

  // Get max score for normalization
  const maxScore = useMemo(() => {
    const scores = sortedStartups.map(getScore);
    return Math.max(...scores, 1);
  }, [sortedStartups, selectedAlgorithm]);

  // Current algorithm info
  const currentAlgo = ALGORITHMS.find(a => a.id === selectedAlgorithm) || ALGORITHMS[0];
  const AlgoIcon = currentAlgo.icon;

  // Handle startup click
  const handleStartupClick = (startup: Startup) => {
    setSelectedStartup(startup);
    setShowSignupPrompt(true);
  };

  // Smell test indicators
  const SmellTestBadge = ({ startup }: { startup: Startup }) => {
    if (selectedAlgorithm !== 'yc') return null;
    
    const tests = [
      { key: 'smell_test_lean', label: 'Lean', icon: '🏃' },
      { key: 'smell_test_user_passion', label: 'Passion', icon: '❤️' },
      { key: 'smell_test_learning_public', label: 'Public', icon: '📢' },
      { key: 'smell_test_inevitable', label: 'Inevitable', icon: '🎯' },
      { key: 'smell_test_massive_if_works', label: 'Massive', icon: '🚀' }
    ];
    
    return (
      <div className="flex items-center gap-1">
        {tests.map(test => (
          <span
            key={test.key}
            className={`text-xs px-1.5 py-0.5 rounded ${
              startup[test.key as keyof Startup] 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-red-500/20 text-red-400 opacity-50'
            }`}
            title={test.label}
          >
            {test.icon}
          </span>
        ))}
      </div>
    );
  };

  // Sequoia metrics
  const SequoiaMetrics = ({ startup }: { startup: Startup }) => {
    if (selectedAlgorithm !== 'sequoia') return null;
    
    return (
      <div className="flex items-center gap-2 text-xs">
        {startup.arr && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
            ARR: {formatCurrency(startup.arr)}
          </span>
        )}
        {startup.growth_rate_monthly && startup.growth_rate_monthly > 0 && (
          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
            +{startup.growth_rate_monthly}%/mo
          </span>
        )}
        {startup.tam_estimate && (
          <span className={`px-2 py-0.5 rounded ${getTAMColor(startup.tam_estimate)}`}>
            TAM: {startup.tam_estimate}
          </span>
        )}
      </div>
    );
  };

  // A16Z metrics
  const A16ZMetrics = ({ startup }: { startup: Startup }) => {
    if (selectedAlgorithm !== 'a16z') return null;
    
    return (
      <div className="flex items-center gap-2 text-xs">
        {startup.has_technical_cofounder && (
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            Tech Founder
          </span>
        )}
        {startup.product_score && startup.product_score >= 90 && (
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
            🏆 Top Product
          </span>
        )}
        {startup.vision_score && startup.vision_score >= 90 && (
          <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
            🔮 Visionary
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0015] via-[#1a0a2e] to-[#0f0520] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Logo Dropdown Menu (includes fixed header) */}
      <LogoDropdownMenu />

      <div className="relative z-10 container mx-auto px-6 pt-20 pb-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-full mb-4">
            <FlameIcon variant={1} size="sm" />
            <span className="text-orange-300 text-sm font-medium">Algorithmic Intelligence • Real-Time Rankings</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center justify-center gap-3">
            <FlameIcon variant={1} size="xl" />
            <span>
              <span className="block bg-gradient-to-r from-purple-600 via-violet-400 to-cyan-400 bg-clip-text text-transparent">Perfect Matches</span>
              <span className="block bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-300 bg-clip-text text-transparent">... in Seconds</span>
            </span>
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto mb-4">
            Our <span className="text-yellow-400 font-bold">GOD Score™</span> + <span className="text-cyan-400 font-bold">Social Signaling</span> analyzes 50+ factors to find your perfect match.
          </p>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto">
            See startups through the lens of top VCs. Compare how YC, Sequoia, and A16Z would rank the same companies using their unique investment philosophies.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="flex justify-center gap-6 mb-8 flex-wrap items-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <FlameIcon variant={8} size="sm" />
            <span className="text-2xl font-bold text-white">{stats.startups.toLocaleString()}</span>
            <span className="text-sm text-gray-400">Startups</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <Building2 className="w-5 h-5 text-purple-400" />
            <span className="text-2xl font-bold text-white">{stats.investors.toLocaleString()}</span>
            <span className="text-sm text-gray-400">Investors</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-white">{stats.matches.toLocaleString()}</span>
            <span className="text-sm text-gray-400">Matches</span>
          </div>
        </div>

        {/* Analytics & Insights Section */}
        <div className="mb-8">
          <TrendingAnalytics startups={startups} selectedAlgorithm={selectedAlgorithm} />
        </div>

        {/* Algorithm Selector */}
        <div className="mb-12">
          <p className="text-center text-gray-400 text-sm mb-4">👆 Click an algorithm to see how top VCs would rank startups 👇</p>
          <div className="flex flex-col md:flex-row gap-4 justify-center pb-8">
            {ALGORITHMS.map((algo) => {
              const Icon = algo.icon;
              const isSelected = selectedAlgorithm === algo.id;
              
              return (
                <button
                  key={algo.id}
                  onClick={() => setSelectedAlgorithm(algo.id)}
                  className={`relative group flex-1 max-w-sm p-4 rounded-2xl border-2 transition-all duration-300 ${
                    isSelected 
                      ? `bg-gradient-to-br ${algo.bgColor} ${algo.borderColor} shadow-lg` 
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${algo.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">{algo.name}</h3>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{algo.description}</p>
                      <div className="mt-2 text-xs text-gray-500 font-mono bg-black/20 px-2 py-1 rounded">
                        {algo.formula}
                      </div>
                    </div>
                  </div>
                  {/* Down arrow indicator when selected */}
                  {isSelected && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce">
                      <ChevronDown className={`w-6 h-6 bg-gradient-to-r ${algo.color} bg-clip-text text-transparent`} style={{ color: algo.id === 'yc' ? '#f97316' : algo.id === 'sequoia' ? '#10b981' : '#a855f7' }} />
                      <span className="text-xs text-gray-400 whitespace-nowrap">See rankings below</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search startups by name, tagline, or sector..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-purple-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading algorithmic rankings...</p>
          </div>
        ) : (
          <>
            {/* Current Algorithm Header */}
            <div className={`mb-6 p-6 rounded-2xl bg-gradient-to-br ${currentAlgo.bgColor} border ${currentAlgo.borderColor}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${currentAlgo.color} flex items-center justify-center shadow-lg`}>
                    <AlgoIcon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      {currentAlgo.name} Rankings
                      <span className="text-sm font-normal bg-white/10 px-3 py-1 rounded-full">
                        Top {Math.min(sortedStartups.length, 50)} Startups
                      </span>
                    </h2>
                    <p className="text-gray-300 text-sm mt-1">{currentAlgo.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {sortedStartups.length}
                  </div>
                  <div className="text-xs text-gray-400">Startups Ranked</div>
                </div>
              </div>
            </div>

            {/* Rankings Table */}
            <div className="bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-2xl border border-purple-500/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-purple-500/20 bg-black/20">
                      <th className="py-4 pl-4 w-16">Rank</th>
                      <th className="py-4">Startup</th>
                      <th className="py-4 hidden md:table-cell">Sector</th>
                      <th className="py-4 hidden lg:table-cell">
                        {selectedAlgorithm === 'yc' ? 'Smell Tests' : 
                         selectedAlgorithm === 'sequoia' ? 'Metrics' : 'Strengths'}
                      </th>
                      <th className="py-4 hidden xl:table-cell">GOD Score</th>
                      <th className="py-4 text-right pr-4">{currentAlgo.shortName} Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    {sortedStartups.slice(0, 50).map((startup, index) => {
                      const score = getScore(startup);
                      const normalizedScore = Math.round((score / maxScore) * 100);
                      
                      return (
                        <tr
                          key={startup.id}
                          onClick={() => handleStartupClick(startup)}
                          className="hover:bg-white/5 cursor-pointer transition-colors group"
                        >
                          {/* Rank */}
                          <td className="py-4 pl-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                              index === 0 
                                ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/30' 
                                : index === 1
                                  ? 'bg-gradient-to-br from-gray-200 to-gray-400 text-black shadow-lg'
                                  : index === 2
                                    ? 'bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg'
                                    : 'bg-white/10 text-gray-300 border border-white/20'
                            }`}>
                              {index === 0 ? '👑' : index + 1}
                            </div>
                          </td>
                          
                          {/* Startup Info */}
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-bold text-white group-hover:text-orange-300 transition-colors flex items-center gap-2">
                                  {startup.name}
                                  {index < 3 && <span className="animate-pulse">🔥</span>}
                                  {startup.smell_test_score === 5 && selectedAlgorithm === 'yc' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                                      Perfect 5/5
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
                                  {startup.tagline || startup.description || 'Innovative startup'}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Sector */}
                          <td className="py-4 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(startup.sectors || []).slice(0, 2).map((sector, i) => (
                                <span 
                                  key={i}
                                  className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300"
                                >
                                  {sector}
                                </span>
                              ))}
                            </div>
                          </td>
                          
                          {/* Algorithm-specific metrics */}
                          <td className="py-4 hidden lg:table-cell">
                            <SmellTestBadge startup={startup} />
                            <SequoiaMetrics startup={startup} />
                            <A16ZMetrics startup={startup} />
                          </td>
                          
                          {/* GOD Score */}
                          <td className="py-4 hidden xl:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                                  style={{ width: `${startup.total_god_score || 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-300 w-8">
                                {startup.total_god_score || '-'}
                              </span>
                            </div>
                          </td>
                          
                          {/* Algorithm Score */}
                          <td className="py-4 pr-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${currentAlgo.color} rounded-full`}
                                  style={{ width: `${normalizedScore}%` }}
                                />
                              </div>
                              <span className={`text-xl font-bold bg-gradient-to-r ${currentAlgo.color} bg-clip-text text-transparent min-w-[60px]`}>
                                {score}
                              </span>
                              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Algorithm Comparison Card */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {ALGORITHMS.map((algo) => {
                const Icon = algo.icon;
                const topStartup = [...startups].sort((a, b) => {
                  switch (algo.id) {
                    case 'god': return (b.total_god_score || 0) - (a.total_god_score || 0);
                    case 'yc': return (b.ycScore || 0) - (a.ycScore || 0);
                    case 'sequoia': return (b.sequoiaScore || 0) - (a.sequoiaScore || 0);
                    case 'a16z': return (b.a16zScore || 0) - (a.a16zScore || 0);
                    default: return 0;
                  }
                })[0];
                
                const topScore = topStartup ? (
                  algo.id === 'god' ? topStartup.total_god_score :
                  algo.id === 'yc' ? topStartup.ycScore :
                  algo.id === 'sequoia' ? topStartup.sequoiaScore :
                  topStartup.a16zScore
                ) : 0;
                
                return (
                  <div
                    key={algo.id}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      selectedAlgorithm === algo.id 
                        ? `bg-gradient-to-br ${algo.bgColor} ${algo.borderColor}` 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedAlgorithm(algo.id)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${algo.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{algo.shortName} #1</h3>
                        <p className="text-xs text-gray-400">Top Ranked</p>
                      </div>
                    </div>
                    {topStartup && (
                      <div>
                        <div className="font-semibold text-white truncate">{topStartup.name}</div>
                        <div className="text-xs text-gray-400 truncate">{topStartup.tagline}</div>
                        <div className={`mt-2 text-2xl font-bold bg-gradient-to-r ${algo.color} bg-clip-text text-transparent`}>
                          {topScore}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/30 max-w-2xl mx-auto">
            <FlameIcon variant={5} size="3xl" className="mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Experience the Full Power</h2>
            <p className="text-gray-300 mb-6">
              These rankings demonstrate our GOD Algorithm in action. Get personalized investor matches with our Spark Engine™.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowMethodology(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600/60 to-indigo-600/60 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all border border-purple-400/50"
              >
                <Info className="w-5 h-5" />
                How Our Scoring Works
              </button>
              <Link
                to="/get-matched"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl transition-all shadow-lg"
              >
                <Zap className="w-5 h-5" />
                Get Matched Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology Modal */}
      {showMethodology && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a0033] to-[#2d1b4e] rounded-2xl border border-purple-500/30 max-w-4xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowMethodology(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center mx-auto mb-4">
                <FlameIcon variant={7} size="xl" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">GOD Algorithm</h2>
              <p className="text-gray-400">Our proprietary 14-factor startup scoring & investor matching system</p>
            </div>

            {/* GOD Score Components */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                GOD Score Components (0-100)
              </h3>
              <div className="grid md:grid-cols-5 gap-3">
                {[
                  { name: 'Team', icon: Users, color: 'from-blue-500 to-cyan-500', factors: ['Technical founders', 'Domain expertise', 'Team size', 'Prior exits'] },
                  { name: 'Traction', icon: TrendingUp, color: 'from-green-500 to-emerald-500', factors: ['ARR/MRR', 'Growth rate', 'Customer count', 'NRR'] },
                  { name: 'Market', icon: Target, color: 'from-purple-500 to-violet-500', factors: ['TAM estimate', 'Market timing', 'Competition', 'Winner-take-all'] },
                  { name: 'Product', icon: Layers, color: 'from-orange-500 to-red-500', factors: ['Launch status', 'Demo ready', 'NPS score', 'User engagement'] },
                  { name: 'Vision', icon: Eye, color: 'from-indigo-500 to-violet-500', factors: ['Contrarian belief', 'Why now', 'Unfair advantage', '10x potential'] },
                ].map((component) => (
                  <div key={component.name} className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${component.color} flex items-center justify-center mb-3`}>
                      <component.icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-white mb-2">{component.name}</h4>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {component.factors.map((f, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="text-green-400">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* YC Smell Tests */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-orange-400" />
                YC Smell Tests (5 Binary Tests)
              </h3>
              <div className="bg-black/30 rounded-xl p-4 border border-orange-500/20">
                <p className="text-gray-300 text-sm mb-4">Paul Graham's quick heuristics for evaluating early-stage startups:</p>
                <div className="grid md:grid-cols-5 gap-3">
                  {[
                    { icon: '🏃', test: 'Lean Build', q: 'Could 2 people build this MVP in 3 months?' },
                    { icon: '❤️', test: 'User Passion', q: 'Do users sound emotionally attached?' },
                    { icon: '📢', test: 'Learning Public', q: 'Is the founder learning in public?' },
                    { icon: '🎯', test: 'Inevitable', q: 'Does this feel early but inevitable?' },
                    { icon: '🚀', test: 'Massive If Works', q: 'Could this be massive if it works?' },
                  ].map((test, i) => (
                    <div key={i} className="text-center">
                      <div className="text-2xl mb-2">{test.icon}</div>
                      <div className="font-semibold text-white text-sm">{test.test}</div>
                      <div className="text-xs text-gray-400 mt-1">{test.q}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Investor Matching */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Investor Matching Algorithm
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                  <h4 className="font-bold text-white mb-3">Matching Factors</h4>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Sector alignment (AI, Fintech, etc.)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Stage fit (Pre-seed to Series B)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Check size compatibility</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Geographic preferences</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Portfolio fit analysis</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Investment thesis alignment</li>
                  </ul>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                  <h4 className="font-bold text-white mb-3">Investor Tiers</h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500"></span> <span className="text-yellow-400 font-semibold">Elite</span> <span className="text-gray-400">- Top-tier VCs, proven track record</span></li>
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-violet-500"></span> <span className="text-purple-400 font-semibold">Strong</span> <span className="text-gray-400">- Active investors, good portfolios</span></li>
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500"></span> <span className="text-blue-400 font-semibold">Solid</span> <span className="text-gray-400">- Reliable, sector-focused</span></li>
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"></span> <span className="text-green-400 font-semibold">Emerging</span> <span className="text-gray-400">- New funds, angels</span></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Algorithm Styles */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                VC-Style Weightings
              </h3>
              <div className="grid md:grid-cols-4 gap-3">
                {ALGORITHMS.map((algo) => {
                  const Icon = algo.icon;
                  return (
                    <div key={algo.id} className={`p-4 rounded-xl border bg-gradient-to-br ${algo.bgColor} ${algo.borderColor}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${algo.color} flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-white text-sm">{algo.shortName}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{algo.description}</p>
                      <code className="text-xs text-gray-500 bg-black/30 px-2 py-1 rounded block">{algo.formula}</code>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowMethodology(false)}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white font-bold rounded-xl transition-all"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Startup Detail Modal */}
      {showSignupPrompt && selectedStartup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a0033] to-[#2d1b4e] rounded-2xl border border-purple-500/30 max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowSignupPrompt(false);
                setSelectedStartup(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-5">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${currentAlgo.color} flex items-center justify-center mx-auto mb-3`}>
                <FlameIcon variant={5} size="xl" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{selectedStartup.name}</h2>
              <p className="text-gray-400 text-sm">{selectedStartup.tagline}</p>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-orange-500/10 rounded-xl p-3 text-center border border-orange-500/20">
                <div className="text-2xl font-bold text-orange-400">{selectedStartup.ycScore}</div>
                <div className="text-xs text-gray-400">YC Score</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                <div className="text-2xl font-bold text-emerald-400">{selectedStartup.sequoiaScore}</div>
                <div className="text-xs text-gray-400">Sequoia</div>
              </div>
              <div className="bg-purple-500/10 rounded-xl p-3 text-center border border-purple-500/20">
                <div className="text-2xl font-bold text-purple-400">{selectedStartup.a16zScore}</div>
                <div className="text-xs text-gray-400">A16Z</div>
              </div>
            </div>

            {/* GOD Score Breakdown */}
            <div className="bg-black/30 rounded-xl p-4 mb-5">
              <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                <FlameIcon variant={6} size="sm" />
                GOD Score Breakdown
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Team', score: selectedStartup.team_score, color: 'from-blue-500 to-cyan-500' },
                  { label: 'Traction', score: selectedStartup.traction_score, color: 'from-green-500 to-emerald-500' },
                  { label: 'Market', score: selectedStartup.market_score, color: 'from-purple-500 to-violet-500' },
                  { label: 'Product', score: selectedStartup.product_score, color: 'from-orange-500 to-red-500' },
                  { label: 'Vision', score: selectedStartup.vision_score, color: 'from-indigo-500 to-violet-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-16">{item.label}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                        style={{ width: `${item.score || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-300 w-8">{item.score || '-'}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between">
                <span className="text-sm text-gray-400">Total GOD Score</span>
                <span className="text-lg font-bold text-white">{selectedStartup.total_god_score}</span>
              </div>
            </div>

            {/* Smell Tests */}
            {selectedStartup.smell_test_score !== undefined && (
              <div className="bg-black/30 rounded-xl p-4 mb-5">
                <h3 className="text-sm font-semibold text-orange-300 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  YC Smell Tests ({selectedStartup.smell_test_score}/5)
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { key: 'smell_test_lean', label: 'Can 2 people build in 3mo?', icon: '🏃' },
                    { key: 'smell_test_user_passion', label: 'Users emotionally attached?', icon: '❤️' },
                    { key: 'smell_test_learning_public', label: 'Learning in public?', icon: '📢' },
                    { key: 'smell_test_inevitable', label: 'Feels early but inevitable?', icon: '🎯' },
                    { key: 'smell_test_massive_if_works', label: 'Massive if it works?', icon: '🚀' },
                  ].map((test) => (
                    <div 
                      key={test.key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        selectedStartup[test.key as keyof Startup] 
                          ? 'bg-green-500/20 text-green-300' 
                          : 'bg-red-500/10 text-red-400/60'
                      }`}
                    >
                      <span>{test.icon}</span>
                      <span className="text-xs flex-1">{test.label}</span>
                      <span className="text-sm font-bold">{selectedStartup[test.key as keyof Startup] ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-gray-300 text-sm mb-4">
                Want to see which investors match best with {selectedStartup.name}?
              </p>
              <Link
                to="/get-matched"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl transition-all shadow-lg w-full justify-center"
              >
                <Sparkles className="w-5 h-5" />
                Find Matching Investors
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Live Match Demo Modal */}
      <LiveMatchDemo 
        isOpen={showHowItWorks} 
        onClose={() => setShowHowItWorks(false)} 
      />
    </div>
  );
}
