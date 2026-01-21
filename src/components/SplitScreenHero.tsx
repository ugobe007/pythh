import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { markUrlSubmitted } from '../lib/routeGuards';
import { useLivePairings } from '../hooks/useLivePairings';
import { getPlan, getLivePairingsLimit, getPlanVisibility, getUpgradeCTA, getPlanFootnote, PlanTier } from '../utils/plan';
import { useAuth } from '../contexts/AuthContext';
import { MicroQuoteWhisper } from './MicroQuoteWhisper';

// Pool of anonymized feed items - mixed positive/negative signals per spec
// REQUIRED FORMAT: No names, no logos, no links. Mix positive + negative. GOD appears with no explanation.
const FEED_POOL = [
  { text: 'Seed robotics startup surfacing to 2 deep-tech funds', score: 81, positive: true },
  { text: 'Capital-heavy startup losing investor attention', score: null, positive: false },
  { text: 'Climate startup resurfacing after new technical validation', score: 74, positive: true },
  { text: 'AI infra startup flagged for agent-first adoption', score: 88, positive: true },
  { text: 'B2B SaaS company showing prolonged silence', score: null, positive: false },
  { text: 'FinTech startup entering view of 3 sector specialists', score: 72, positive: true },
  { text: 'Healthcare ML company gaining momentum', score: 79, positive: true },
  { text: 'Developer tools startup with founder departure signal', score: null, positive: false },
  { text: 'Supply chain startup gaining attention from logistics-focused fund', score: 67, positive: true },
  { text: 'EdTech platform showing consistent forward motion', score: 71, positive: true },
  { text: 'Cybersecurity startup weakening — capital without follow-through', score: null, positive: false },
  { text: 'Clean energy startup actively appearing in discovery', score: 85, positive: true },
  { text: 'PropTech company surfacing after pilot announcement', score: 69, positive: true },
  { text: 'Biotech AI startup surfacing to 4 life science investors', score: 82, positive: true },
  { text: 'Gaming infrastructure startup not yet circulating', score: null, positive: false },
];

// Generate time strings that look recent
const getRecentTimes = () => {
  const times = ['just now', '2m ago', '5m ago', '8m ago', '12m ago', '18m ago', '24m ago', '31m ago'];
  return times.slice(0, 3);
};

// Get 3 random feed items from pool (deterministic per seed)
const getRandomFeedItems = (seed: number) => {
  // deterministic pseudo-random generator (mulberry32)
  const mulberry32 = (a: number) => () => {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rand = mulberry32(seed);
  const shuffled = [...FEED_POOL].sort(() => rand() - 0.5);
  const times = getRecentTimes();

  return shuffled.slice(0, 3).map((item, i) => ({
    ...item,
    time: times[i],
  }));
};

const SplitScreenHero: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Get user's plan for pricing gate
  const plan: PlanTier = getPlan(user as any);
  const visibleLimit = getLivePairingsLimit(plan);
  const visibility = getPlanVisibility(plan);
  const upgradeCTA = getUpgradeCTA(plan);
  
  // Input interaction state (for glow system)
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Armed state: URL looks valid (sensing → inference transition)
  const isArmed = /(\.[a-z]{2,})/i.test(url.trim());
  
  // Staggered reveal state
  const [showHeadline, setShowHeadline] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [showReadout, setShowReadout] = useState(false);
  const [showPairings, setShowPairings] = useState(false);
  
  // Rotating feed items - refresh every 45 seconds
  const [feedItems, setFeedItems] = useState(() => getRandomFeedItems(Date.now()));
  
  // Live Signal Pairings from API - pass plan for server-side gating
  // Server enforces limit and masks fields, so we get exactly what the tier allows
  const { data: livePairings, loading: pairingsLoading, error: pairingsError } = useLivePairings(plan, false);
  
  // Server already slices to tier limit, but UI can slice again for safety
  // DEFENSIVE: always coerce to array to prevent .slice() crash
  const visiblePairings = (livePairings || []).slice(0, visibleLimit);
  const totalPairingsCount = 10; // Always show "of 10" to create FOMO
  
  const [scores, setScores] = useState({
    marketFit: 0,
    stageReadiness: 0,
    capitalVelocity: 0,
    geographicReach: 0,
    thesisConvergence: 0,
  });
  
  const targetScores = {
    marketFit: 72,
    stageReadiness: 68,
    capitalVelocity: 81,
    geographicReach: 65,
    thesisConvergence: 77,
  };

  // Staggered reveal on load
  useEffect(() => {
    setTimeout(() => setShowHeadline(true), 400);
    setTimeout(() => setShowCommand(true), 700);
    setTimeout(() => {
      setShowReadout(true);
      setScores(targetScores);
    }, 1000);
    setTimeout(() => setShowPairings(true), 1400);
  }, []);

  // Rotate feed items every 45 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFeedItems(getRandomFeedItems(Date.now()));
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Breathing animation for bars - every 10 seconds
  useEffect(() => {
    if (!showReadout) return;
    const interval = setInterval(() => {
      setScores({
        marketFit: Math.max(60, Math.min(95, targetScores.marketFit + (Math.random() - 0.5) * 6)),
        stageReadiness: Math.max(55, Math.min(90, targetScores.stageReadiness + (Math.random() - 0.5) * 6)),
        capitalVelocity: Math.max(65, Math.min(95, targetScores.capitalVelocity + (Math.random() - 0.5) * 6)),
        geographicReach: Math.max(50, Math.min(85, targetScores.geographicReach + (Math.random() - 0.5) * 6)),
        thesisConvergence: Math.max(60, Math.min(92, targetScores.thesisConvergence + (Math.random() - 0.5) * 6)),
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [showReadout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setIsAnalyzing(true);
    let cleanUrl = trimmed;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    // Mark session state BEFORE navigating so guards recognize the scan
    markUrlSubmitted(cleanUrl);
    // Navigate to the doctrine-aligned Results Page (not discovery/convergence UI)
    navigate(`/results?url=${encodeURIComponent(cleanUrl)}`);
    setTimeout(() => setIsAnalyzing(false), 800);
  };

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-6">
      <span className="text-[13px] text-gray-300 w-36 text-left font-mono">{label}</span>
      <div className="flex-1 h-1 bg-gray-900/60 overflow-hidden">
        <div 
          className="h-full bg-amber-500/80 transition-all duration-[1500ms] ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="relative w-full min-h-[calc(100vh-120px)] flex flex-col">
      
      {/* BRAND MARK removed - now handled by OracleHeader in TopShell */}
      {/* TICKER removed - now handled by TopShell in MatchingEngine */}
      
      {/* Subtle radial glow - no edges */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-amber-500/[0.02] rounded-full blur-[120px]"></div>
      </div>
      
      {/* Main content with vertical spine */}
      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-[1100px] mx-auto w-full px-8 sm:px-12 py-8">
        
        {/* PRIMARY HEADLINE - Dominant, action-oriented */}
        <h1 className={`text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight mb-4 transition-all duration-700 ${showHeadline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          Find My Investors
        </h1>
        
        {/* SECONDARY LINE - Context and clarity */}
        <p className={`text-xl text-gray-400 mb-12 max-w-lg transition-all duration-700 delay-100 ${showHeadline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          Discover investors aligned with your signals.
        </p>

        {/* COMMAND BAR + READOUT wrapper */}
        <div className="relative">
          {/* COMMAND BAR - instrument, not form */}
          <div className={`relative mb-3 transition-all duration-700 ${showCommand ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {!isAnalyzing ? (
              <form onSubmit={handleSubmit} className="relative">
                {/* Micro quote whisper above button */}
                <MicroQuoteWhisper />
                
                {/* Input wrapper with layered glow system */}
                <div 
                  id="url-input"
                  className={`
                    relative flex items-stretch
                    bg-[#0a0a0a]
                    border
                    transition-all duration-300
                    shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]
                    ${isFocused 
                      ? 'border-cyan-400/45 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_40px_rgba(168,85,247,0.18)]' 
                      : isArmed
                        ? 'border-cyan-400/35 shadow-[0_0_28px_rgba(56,189,248,0.10),0_0_28px_rgba(168,85,247,0.10)]'
                        : isHovered 
                          ? 'border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.08)]' 
                          : 'border-white/10'
                    }
                    ${isArmed && !isFocused ? 'animate-[ctaPulse_2.4s_ease-in-out_infinite]' : ''}
                  `}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  {/* Inner cyan glow layer (focus state) */}
                  <div
                    className={`
                      pointer-events-none absolute inset-0
                      transition-opacity duration-300
                      ${isFocused ? 'opacity-100' : 'opacity-0'}
                    `}
                    style={{
                      boxShadow: `
                        inset 0 0 0 1px rgba(56, 189, 248, 0.35),
                        inset 0 0 18px rgba(56, 189, 248, 0.15)
                      `
                    }}
                  />
                  
                  {/* Violet halo layer (armed state - URL valid) */}
                  {isArmed && isFocused && (
                    <div
                      className="pointer-events-none absolute -inset-[2px] rounded-[2px] transition-opacity duration-500"
                      style={{
                        boxShadow: '0 0 24px rgba(168, 85, 247, 0.15)'
                      }}
                    />
                  )}
                  
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Enter your url"
                    className="flex-1 px-6 py-5 bg-transparent text-white placeholder-gray-600 focus:outline-none text-base font-mono relative z-10 border-0 focus:ring-0"
                  />
                  <button
                    type="submit"
                    className="group px-10 py-5 bg-gradient-to-b from-amber-500 to-amber-600 text-black text-sm font-bold font-mono tracking-wide whitespace-nowrap relative z-10 transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_0_24px_rgba(168,85,247,0.25)] active:shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_0_32px_rgba(168,85,247,0.35)]"
                  >
                    Find My Investors
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3 px-6 py-5 bg-[#0a0a0a] border border-cyan-500/40 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]"
                style={{
                  boxShadow: `
                    inset 0 0 0 1px rgba(56, 189, 248, 0.4),
                    inset 0 0 30px rgba(56, 189, 248, 0.1),
                    0 0 20px rgba(168, 85, 247, 0.1)
                  `
                }}
              >
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-sm text-cyan-400 font-mono">Finding your investors...</span>
              </div>
            )}
          </div>
          
          {/* MICRO-TRUST LINE */}
          <p className={`text-xs text-gray-400 mt-3 mb-4 transition-all duration-500 delay-300 ${showCommand ? 'opacity-100' : 'opacity-0'}`}>
            Private • Anonymized • No messaging • No exposure
          </p>
          
          {/* SECONDARY CTA */}
          <div className={`flex flex-wrap items-center gap-3 mb-8 transition-all duration-500 delay-400 ${showCommand ? 'opacity-100' : 'opacity-0'}`}>
            <Link
              to="/value"
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white transition"
            >
              What you get
            </Link>
            <Link
              to="/how-it-works"
              className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/15 transition"
            >
              How it works →
            </Link>
          </div>

          {/* LIVE FEED - Anonymized, mixed positive/negative signals */}
          <div className={`flex gap-12 mb-10 transition-all duration-700 ${showReadout ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex-1">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.2em] mb-4 font-mono">🔒 DISCOVERY SIGNALS (LIVE)</p>
              <div className="space-y-3">
                {feedItems.map((item, i) => (
                  <div key={`${item.text}-${i}`} className="font-mono transition-opacity duration-500">
                    <p className={`text-sm ${item.positive ? 'text-gray-400' : 'text-gray-500'}`}>
                      • {item.text}
                      {item.score && <span className="text-amber-500 ml-2">(GOD: {item.score})</span>}
                      {!item.positive && <span className="text-red-400/60 ml-2">↓</span>}
                    </p>
                    <p className="text-[10px] text-gray-600 ml-2">{item.time}</p>
                  </div>
                ))}              </div>
            </div>
          </div>
        </div>

        {/* INVESTOR MATCHING HAPPENING NOW - real data from API with pricing gate */}
        <div 
          data-tour-id="signal-pairings"
          className={`mb-10 transition-all duration-700 ${showPairings ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="h-px bg-gray-800/60 mb-6"></div>
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-center gap-3">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.2em] font-mono">🔒 DISCOVERY ACTIVITY (LIVE)</p>
              {upgradeCTA.show && (
                <Link 
                  to="/pricing" 
                  className="text-[10px] text-amber-500/80 hover:text-amber-400 font-mono transition-colors flex items-center gap-1"
                >
                  <Lock className="w-3 h-3" />
                  {upgradeCTA.text}
                </Link>
              )}
            </div>
            <p className="text-[10px] text-gray-600 font-mono">This is how discovery happens before pitch decks.</p>
          </div>
          <div className="space-y-0">
            {/* Header row - show confidence column for elite */}
            <div className={`grid ${visibility.showConfidence ? 'grid-cols-[1fr_auto_1fr_auto_1fr_auto_80px]' : 'grid-cols-[1fr_auto_1fr_auto_1fr]'} gap-x-8 py-2 text-[11px] text-gray-600 border-b border-gray-800/40 font-mono`}>
              <span>Startup Signal</span>
              <span></span>
              <span>Investor Signal</span>
              <span className="text-gray-800">|</span>
              <span>Reason</span>
              {visibility.showConfidence && (
                <>
                  <span className="text-gray-800">|</span>
                  <span>Confidence</span>
                </>
              )}
            </div>
            
            {/* Loading state: skeleton rows based on visibleLimit */}
            {pairingsLoading && (
              <>
                {Array.from({ length: visibleLimit }).map((_, i) => (
                  <div key={i} className={`grid ${visibility.showConfidence ? 'grid-cols-[1fr_auto_1fr_auto_1fr_auto_80px]' : 'grid-cols-[1fr_auto_1fr_auto_1fr]'} gap-x-8 py-3 border-b border-gray-800/30 font-mono animate-pulse`}>
                    <span className="h-4 bg-gray-800/40 rounded w-32"></span>
                    <span className="text-gray-700">→</span>
                    <span className="h-4 bg-amber-500/20 rounded w-24"></span>
                    <span className="text-gray-800">|</span>
                    <span className="h-4 bg-gray-800/30 rounded w-28"></span>
                    {visibility.showConfidence && (
                      <>
                        <span className="text-gray-800">|</span>
                        <span className="h-4 bg-gray-800/30 rounded w-12"></span>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
            
            {/* Error state */}
            {pairingsError && !pairingsLoading && (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-600 font-mono">Unable to load live pairings</p>
              </div>
            )}
            
            {/* Empty state - DEFENSIVE: use optional chaining */}
            {!pairingsLoading && !pairingsError && (livePairings?.length ?? 0) === 0 && (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-600 font-mono">No live pairings yet</p>
              </div>
            )}
            
            {/* Success state: real data rows with pricing gate */}
            {!pairingsLoading && visiblePairings.length > 0 && visiblePairings.map((pairing, index) => (
              <div 
                key={`${pairing.startup_id}-${pairing.investor_id}`} 
                className={`grid ${visibility.showConfidence ? 'grid-cols-[1fr_auto_1fr_auto_1fr_auto_80px]' : 'grid-cols-[1fr_auto_1fr_auto_1fr]'} gap-x-8 py-3 font-mono ${index < visiblePairings.length - 1 ? 'border-b border-gray-800/30' : ''}`}
              >
                {/* Startup name - always visible */}
                <span className="text-base text-gray-300 truncate" title={pairing.startup_name}>
                  {pairing.startup_name}
                </span>
                <span className="text-gray-700">→</span>
                
                {/* Investor name - gated for free users */}
                {visibility.showInvestorName ? (
                  <span className="text-base text-amber-500 truncate" title={pairing.investor_name}>
                    {pairing.investor_name}
                  </span>
                ) : (
                  <span className="text-base truncate flex items-center gap-2">
                    <span className="text-amber-500/40 blur-sm select-none">████████</span>
                    <Link to="/pricing" className="text-[10px] text-amber-500/70 hover:text-amber-400 flex items-center gap-1 whitespace-nowrap">
                      <Lock className="w-3 h-3" />
                      <span>Unlock</span>
                    </Link>
                  </span>
                )}
                
                <span className="text-gray-800">|</span>
                
                {/* Reason - gated for free and pro users */}
                {visibility.showReason ? (
                  <span className="text-sm text-gray-500">{pairing.reason}</span>
                ) : plan === 'pro' ? (
                  <span className="text-sm text-gray-600 italic">Signal detected</span>
                ) : (
                  <span className="text-sm flex items-center gap-2">
                    <span className="text-gray-600/40 blur-sm select-none">████████</span>
                    <Lock className="w-3 h-3 text-gray-700" />
                  </span>
                )}
                
                {/* Confidence - elite only */}
                {visibility.showConfidence && (
                  <>
                    <span className="text-gray-800">|</span>
                    <span className="text-sm text-cyan-400/80">{Math.round((pairing.confidence || 0) * 100)}%</span>
                  </>
                )}
              </div>
            ))}
            
            {/* Footnote showing plan limits */}
            {!pairingsLoading && visiblePairings.length > 0 && (
              <div className="pt-3 flex items-center justify-between">
                <p className="text-[10px] text-gray-600 font-mono">
                  {getPlanFootnote(plan, totalPairingsCount)}
                </p>
                {upgradeCTA.show && (
                  <Link 
                    to="/pricing" 
                    className="text-[10px] text-amber-500/60 hover:text-amber-400 font-mono transition-colors"
                  >
                    See all →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOUNDERS' TRUST LINE + INVESTOR HOOK */}
        <div className={`mt-6 transition-all duration-500 ${showPairings ? 'opacity-100' : 'opacity-0'}`}>
          {/* Trust line - small but visible */}
          <p className="text-xs text-gray-500 mb-4 italic">
            Pythh doesn't help you raise money.<br />
            It helps you avoid wasting time raising money.
          </p>
          
          {/* Ongoing value line */}
          <p className="text-xs text-gray-600 mb-4">
            Investor attention changes. Pythh updates as it does.
          </p>
          
          {/* Investor hook */}
          <Link to="/investor/signup" className="text-[11px] text-gray-600 hover:text-amber-500/80 transition-colors font-mono">
            I'm an Investor →
          </Link>
        </div>
      </div>
      
      {/* CTA pulse animation */}
      <style>{`
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 28px rgba(56,189,248,0.08), 0 0 28px rgba(168,85,247,0.08); }
          50%      { box-shadow: 0 0 36px rgba(56,189,248,0.14), 0 0 36px rgba(168,85,247,0.12); }
        }
      `}</style>
    </div>
  );
};

export default SplitScreenHero;
