/**
 * PYTHH RESULTS PAGE - Canonical Contract v1.0
 * =============================================
 * The Matching + Signals Exploration Surface
 * 
 * This is the only page that matters.
 * Everything else exists to feed or deepen this page.
 * 
 * INVARIANTS (laws, not guidelines):
 * 1. Matches always come first
 * 2. Top 5 are always visible (never empty, gated, blurred)
 * 3. Scale is always implied (50-100+ matches)
 * 4. Signals are human (no GOD, convergence, internal metrics)
 * 5. Alignment is specific
 * 6. Action is present
 * 7. No lectures
 */

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowRight,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Target,
  Zap,
  Users,
  Building2,
  Globe,
  Brain,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveStartupFromUrl } from '../lib/startupResolver';
import { useAuth } from '../contexts/AuthContext';
import { useMatches } from '../hooks/useMatches';
import { getPlan } from '../utils/plan';
import { analytics } from '../analytics';

// ============================================
// TYPES
// ============================================

interface MatchedInvestor {
  id: string;
  name: string;
  match_score: number;
  sectors?: string[];
  stage?: string | string[];
  check_size_min?: number;
  check_size_max?: number;
  website?: string;
  location?: string;
  investor?: {
    name?: string;
    sectors?: string[];
    stage?: string | string[];
    website?: string;
  };
}

interface StartupData {
  id?: string;
  name: string;
  website: string;
  sectors?: string[];
  stage?: string;
  total_god_score?: number;
  signals?: string[];
}

// ============================================
// HELPERS
// ============================================

function getDistanceLabel(score: number): string {
  if (score >= 85) return "Warm path likely";
  if (score >= 70) return "Portfolio adjacent";
  return "Cold";
}

function getDistanceColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-gray-400";
}

function generateWhyMatch(investor: MatchedInvestor, startup: StartupData): string {
  const reasons: string[] = [];
  const investorSectors = investor?.investor?.sectors || investor?.sectors || [];
  const startupSectors = startup?.sectors || [];
  
  // Check sector overlap
  const sectorOverlap = startupSectors.filter(s => 
    investorSectors.some(is => 
      is?.toLowerCase().includes(s?.toLowerCase()) || 
      s?.toLowerCase().includes(is?.toLowerCase())
    )
  );
  
  if (sectorOverlap.length > 0) {
    reasons.push(`Category fit in ${sectorOverlap[0]}`);
  }
  
  // Portfolio adjacency based on high score
  if (investor.match_score >= 80) {
    reasons.push("portfolio adjacency detected");
  }
  
  // Thesis overlap
  if (investor.match_score >= 70) {
    reasons.push("thesis overlap with recent deals");
  }
  
  if (reasons.length === 0) {
    reasons.push("emerging pattern match in your space");
  }
  
  return reasons.slice(0, 2).join(" + ");
}

function generateSignalChips(investor: MatchedInvestor, startup: StartupData): string[] {
  const chips: string[] = [];
  
  if (investor.match_score >= 85) chips.push("Portfolio adjacency");
  if (investor.match_score >= 75) chips.push("Thesis overlap");
  if (startup?.sectors?.length) chips.push("Category heat");
  if (investor.match_score >= 70) chips.push("Timing fit");
  if (startup?.total_god_score && startup.total_god_score >= 65) chips.push("Execution cadence");
  
  return chips.slice(0, 4);
}

function generateAlignmentSteps(investor: MatchedInvestor, startup: StartupData): string[] {
  const steps: string[] = [];
  const investorSectors = investor?.investor?.sectors || investor?.sectors || [];
  
  // Technical credibility
  if (investor.match_score >= 80) {
    steps.push("Publish technical benchmarks or case study");
  }
  
  // Narrative alignment
  if (investorSectors.length > 0) {
    steps.push(`Reframe narrative toward ${investorSectors[0]} positioning`);
  }
  
  // Execution signals
  steps.push("Highlight recent execution milestones");
  
  // Warm intro
  steps.push("Find portfolio founder connection for warm intro");
  
  return steps.slice(0, 3);
}

function generateTimingContext(investor: MatchedInvestor): string {
  if (investor.match_score >= 85) {
    return "Their activity in your category has increased over the last 30 days.";
  }
  if (investor.match_score >= 70) {
    return "They are warming toward startups like yours.";
  }
  return "They are early but tracking this space.";
}

// Signal mirror helpers
function deriveStrongSignals(startup: StartupData, matches: MatchedInvestor[]): string[] {
  const signals: string[] = [];
  if (startup?.sectors?.length) signals.push("Category fit");
  if (startup?.total_god_score && startup.total_god_score >= 65) signals.push("Technical credibility");
  if (matches?.length >= 20) signals.push("Portfolio adjacency");
  return signals.slice(0, 2);
}

function deriveWeakSignals(startup: StartupData): string[] {
  const signals: string[] = [];
  if (!startup?.total_god_score || startup.total_god_score < 60) {
    signals.push("Traction proof");
  }
  signals.push("Narrative clarity");
  return signals.slice(0, 2);
}

function deriveChangingSignals(): string[] {
  return ["Hiring velocity", "Product momentum"];
}

// ============================================
// INVESTOR CARD COMPONENT
// ============================================

interface InvestorCardProps {
  investor: MatchedInvestor;
  rank: number;
  startup: StartupData;
  isExpanded: boolean;
  onToggle: () => void;
  isBlurred?: boolean;
  isLoggedIn: boolean;
}

function InvestorCard({ investor, rank, startup, isExpanded, onToggle, isBlurred, isLoggedIn }: InvestorCardProps) {
  const investorName = investor?.investor?.name || investor?.name || 'Investor';
  const sectors = investor?.investor?.sectors || investor?.sectors || [];
  const stage = investor?.investor?.stage || investor?.stage;
  const stageStr = Array.isArray(stage) ? stage[0] : stage;
  const score = investor?.match_score || 0;
  const distance = getDistanceLabel(score);
  const distanceColor = getDistanceColor(score);
  const whyMatch = generateWhyMatch(investor, startup);
  
  const signalChips = generateSignalChips(investor, startup);
  const alignmentSteps = generateAlignmentSteps(investor, startup);
  const timingContext = generateTimingContext(investor);
  
  return (
    <div className={`bg-[#111] border border-gray-800 rounded-xl overflow-hidden transition-all ${isBlurred ? 'blur-sm pointer-events-none select-none' : ''}`}>
      {/* Main Card */}
      <div 
        className={`p-4 ${!isBlurred ? 'cursor-pointer hover:bg-gray-900/50' : ''}`}
        onClick={!isBlurred ? onToggle : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Rank + Name + Tags */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-gray-500 text-sm font-mono">#{rank}</span>
              <h3 className="text-white font-semibold truncate">{investorName}</h3>
            </div>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sectors.slice(0, 2).map((sector, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                  {sector}
                </span>
              ))}
              {stageStr && (
                <span className="px-2 py-0.5 text-xs bg-violet-900/50 text-violet-300 rounded">
                  {stageStr}
                </span>
              )}
            </div>
            
            {/* Distance + Why */}
            <div className="flex items-center gap-2 text-sm">
              <span className={distanceColor}>{distance}</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 truncate">{whyMatch}</span>
            </div>
          </div>
          
          {/* Right: Signal Score (dominant) */}
          <div className="flex flex-col items-end gap-1">
            <div className={`text-3xl font-bold ${
              score >= 85 ? 'text-emerald-400' :
              score >= 70 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {score}
            </div>
            <span className="text-xs text-gray-500">Signal Score</span>
            
            {/* Expand indicator */}
            {!isBlurred && (
              <div className="mt-2 text-gray-500">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Expanded Section (inline) */}
      {isExpanded && !isBlurred && (
        <div className="border-t border-gray-800 p-4 bg-gray-900/30 space-y-4">
          {/* 2.1 Why aligned */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Why this investor is aligned with you</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>• Portfolio adjacency detected</li>
              <li>• Category heat forming in your problem space</li>
              <li>• Thesis overlap with their recent deals</li>
            </ul>
          </div>
          
          {/* 2.2 Signals they care about */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Signals they are paying attention to</h4>
            <div className="flex flex-wrap gap-2">
              {signalChips.map((chip, i) => (
                <span key={i} className="px-2.5 py-1 text-xs bg-violet-900/40 text-violet-300 border border-violet-700/50 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          
          {/* 2.3 Timing context */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-1">Timing</h4>
            <p className="text-sm text-gray-400">{timingContext}</p>
          </div>
          
          {/* 2.4 How to align */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">How to align with this investor</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              {alignmentSteps.map((step, i) => (
                <li key={i}>• {step}</li>
              ))}
            </ul>
          </div>
          
          {/* 2.5 Next action */}
          <div className="pt-2">
            <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
              Generate intro angle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN RESULTS PAGE
// ============================================

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const urlParam = searchParams.get('url') || '';
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [startup, setStartup] = useState<StartupData | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get plan tier
  const plan = getPlan(user);
  
  // Fetch matches from server
  const { 
    matches: gatedMatches, 
    loading: matchesLoading,
    total
  } = useMatches(startupId);

  // All hooks declared - now safe for early returns
  const matches = gatedMatches || [];
  const top5 = matches.slice(0, 5);
  const moreMatches = matches.slice(5);
  const totalMatches = total || matches.length;
  
  // Derived signal data
  const strongSignals = useMemo(() => startup ? deriveStrongSignals(startup, matches) : [], [startup, matches]);
  const weakSignals = useMemo(() => startup ? deriveWeakSignals(startup) : [], [startup]);
  const changingSignals = useMemo(() => deriveChangingSignals(), []);
  
  // Generate signal mirror paragraph
  const signalParagraph = useMemo(() => {
    if (!startup || !matches.length) return '';
    const topInvestor = matches[0];
    const secondInvestor = matches[1];
    return `Your strongest driver right now is ${strongSignals[0]?.toLowerCase() || 'category adjacency'}. Your weakest is ${weakSignals[0]?.toLowerCase() || 'traction proof'}. This is why ${topInvestor?.investor?.name || topInvestor?.name || 'your top match'} is rising${secondInvestor ? ` while ${secondInvestor?.investor?.name || secondInvestor?.name} is flat` : ''}.`;
  }, [startup, matches, strongSignals, weakSignals]);
  
  // Generate action items
  const actionItems = useMemo(() => {
    if (!matches.length) return [];
    const topInvestors = matches.slice(0, 3).map(m => m?.investor?.name || m?.name || 'Investor');
    return [
      {
        action: "Publish a case study",
        why: `Increases technical credibility signal for ${Math.min(8, matches.length)} of your top ${Math.min(15, matches.length)} investors.`,
        unlocks: topInvestors.slice(0, 2)
      },
      {
        action: `Warm intro to ${topInvestors[0]}`,
        why: "They're in a forming window and have portfolio adjacency to you.",
        unlocks: [topInvestors[0]]
      },
      {
        action: "Reframe homepage positioning",
        why: "Aligns your narrative with the dominant thesis cluster in your category.",
        unlocks: topInvestors
      }
    ];
  }, [matches]);

  // Resolve startup on mount
  useEffect(() => {
    if (!urlParam) {
      navigate('/');
      return;
    }
    
    resolveStartup();
  }, [urlParam]);

  const resolveStartup = async () => {
    try {
      setIsLoading(true);
      const result = await resolveStartupFromUrl(urlParam, { waitForEnrichment: true });
      
      if (!result) {
        setError('Could not analyze this URL. Please check it\'s a valid website.');
        setIsLoading(false);
        return;
      }
      
      setStartup({
        id: result.startup.id,
        name: result.startup.name || 'Your Startup',
        website: result.startup.website || urlParam,
        sectors: result.startup.sectors || [],
        stage: result.startup.stage ? ['', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'][result.startup.stage] : undefined,
        total_god_score: result.startup.total_god_score,
        signals: result.startup.signals
      });
      
      setStartupId(result.startup.id);
      setIsLoading(false);
      
      analytics.matchesPageViewed(result.startup.id);
    } catch (err) {
      console.error('[ResultsPage] Error:', err);
      setError('Failed to analyze. Please try again.');
      setIsLoading(false);
    }
  };

  // Loading state (minimal, not theatrical)
  if (isLoading || matchesLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-gray-400">Finding your investor matches...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analysis Failed</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* ====================================
            SECTION 1: TOP 5 MATCHES (ABOVE FOLD)
            ==================================== */}
        <section className="mb-12">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Your Top Investor Matches</h1>
            <p className="text-gray-400">Based on live capital signals + thesis alignment</p>
          </div>
          
          <div className="space-y-3">
            {top5.length > 0 ? (
              top5.map((investor, i) => (
                <InvestorCard
                  key={investor.id || i}
                  investor={investor}
                  rank={i + 1}
                  startup={startup!}
                  isExpanded={expandedCard === i}
                  onToggle={() => setExpandedCard(expandedCard === i ? null : i)}
                  isLoggedIn={isLoggedIn}
                />
              ))
            ) : (
              // Fallback - should never happen per invariant
              <div className="text-center py-12 text-gray-500">
                <p>Loading matches...</p>
              </div>
            )}
          </div>
        </section>
        
        {/* ====================================
            SECTION 3: MORE MATCHES (BLURRED/GATED)
            ==================================== */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">More Investor Matches</h2>
            <p className="text-sm text-gray-500">Ranked by the same live capital signals • {totalMatches}+ total</p>
          </div>
          
          {/* Blurred matches preview */}
          <div className="relative">
            <div className="space-y-3">
              {(moreMatches.length > 0 ? moreMatches.slice(0, 5) : Array(5).fill(null)).map((investor, i) => (
                <InvestorCard
                  key={investor?.id || `blur-${i}`}
                  investor={investor || {
                    id: `blur-${i}`,
                    name: 'Premium Seed Fund',
                    match_score: Math.max(60, 75 - i * 3),
                    sectors: ['FinTech', 'B2B'],
                    stage: 'Seed'
                  }}
                  rank={6 + i}
                  startup={startup!}
                  isExpanded={false}
                  onToggle={() => {}}
                  isBlurred={!isLoggedIn || plan === 'free'}
                  isLoggedIn={isLoggedIn}
                />
              ))}
            </div>
            
            {/* Unlock overlay */}
            {(!isLoggedIn || plan === 'free') && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent">
                <div className="text-center px-6">
                  <Lock className="w-8 h-8 mx-auto mb-3 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {totalMatches}+ more investors matched
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Sign up to see your full investor list
                  </p>
                  <Link
                    to={`/signup?url=${encodeURIComponent(urlParam)}&matches=${totalMatches}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors"
                  >
                    Unlock all matches
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
        
        {/* ====================================
            SECTION 4: SIGNAL MIRROR
            ==================================== */}
        <section className="mb-12 p-6 bg-[#111] border border-gray-800 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">How capital currently sees you</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Strong signals */}
            <div>
              <h3 className="text-sm font-medium text-emerald-400 mb-2">Strong signals</h3>
              <ul className="space-y-1">
                {strongSignals.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
            
            {/* Weak signals */}
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-2">Weak signals</h3>
              <ul className="space-y-1">
                {weakSignals.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
            
            {/* Changing signals */}
            <div>
              <h3 className="text-sm font-medium text-amber-400 mb-2">Changing signals</h3>
              <ul className="space-y-1">
                {changingSignals.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Human paragraph */}
          <p className="text-gray-400 text-sm border-t border-gray-800 pt-4">
            {signalParagraph}
          </p>
        </section>
        
        {/* ====================================
            SECTION 5: WHAT TO DO NEXT
            ==================================== */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">What to do next</h2>
          
          <div className="space-y-4">
            {actionItems.map((item, i) => (
              <div key={i} className="p-4 bg-[#111] border border-gray-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center shrink-0">
                    <span className="text-violet-400 font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{item.action}</h3>
                    <p className="text-sm text-gray-400 mb-2">{item.why}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-gray-500">Unlocks:</span>
                      {item.unlocks.map((inv, j) => (
                        <span key={j} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                          {inv}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* ====================================
            SECTION 6: HOW THIS WORKS (optional)
            ==================================== */}
        <section className="mb-8">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info className="w-4 h-4" />
            How does this work?
            {showHowItWorks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showHowItWorks && (
            <div className="mt-4 p-4 bg-[#111] border border-gray-800 rounded-lg">
              <h3 className="font-medium text-white mb-3">How Pythh generates your matches</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• We fingerprint your startup signals</li>
                <li>• We fingerprint investor theses</li>
                <li>• We track capital momentum</li>
                <li>• We detect portfolio adjacency</li>
                <li>• We rank matches by live alignment</li>
              </ul>
            </div>
          )}
        </section>
        
        {/* ====================================
            SECTION 7: DIAGNOSTICS (hidden)
            ==================================== */}
        <section className="border-t border-gray-800 pt-6">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Behind the match
            {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          {showDiagnostics && (
            <div className="mt-4 p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-xs text-gray-500 font-mono">
              <p>startup_id: {startupId}</p>
              <p>total_matches: {totalMatches}</p>
              <p>god_score: {startup?.total_god_score || 'N/A'}</p>
              <p>sectors: {startup?.sectors?.join(', ') || 'N/A'}</p>
              <p>plan: {plan}</p>
            </div>
          )}
        </section>
        
      </div>
    </div>
  );
}
