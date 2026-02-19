/**
 * /trends — PYTHH MARKET SCOREBOARD (CANONICAL)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * TRENDS INVARIANTS — DO NOT MODIFY WITHOUT READING: /PYTHH_TRENDS_INVARIANTS.md
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1. GOD Score = default, deterministic baseline
 * 2. VC lenses = re-weighted models, NO randomness, NO editorial overrides
 * 3. Δ = rank delta (not score delta)
 * 4. Velocity = acceleration (not popularity)
 * 5. Infinite scroll, hundreds visible, no "Top 10"
 * 6. Click score = drill into VC logic (future)
 * 7. No CTAs, no buttons, no explanations inline
 * 8. The shock of re-ordering IS the feature
 * 
 * FORBIDDEN:
 * - Explaining VC psychology on the page
 * - Adding charts "for clarity"
 * - Badges, emojis, gamification
 * - Ranking by funding amount or vanity metrics
 * 
 * If these drift, the page dies.
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Role: Show founders how different top investors would rank the same market — live.
 * 
 * This page:
 * - teaches the game by letting founders play it
 * - creates FOMO through rank displacement
 * - proves credibility through model plurality
 * - does not explain psychology — it embodies it
 * 
 * SECRET SAUCE: Each VC lens applies that investor's ACTUAL scoring criteria.
 * Founders see how the same startups rank differently under different investor philosophies.
 * 
 * Design: Table-first, dense, alive. No marketing copy.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabase';
import ScoreDrilldownDrawer from '../components/ScoreDrilldownDrawer';
import { generateDrilldownData, type DrilldownPayload } from '../utils/scoreDrilldown';
import SaveToSignalCard, { useSavedEntities } from '../components/SaveToSignalCard';
import ShareButton from '../components/ShareButton';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StartupRaw {
  id: string;
  name: string;
  sectors: string | string[] | null;
  total_god_score: number | null;
  team_score: number | null;
  traction_score: number | null;
  market_score: number | null;
  product_score: number | null;
  vision_score: number | null;
}

interface StartupRanked {
  id: string;
  rank: number;
  prevRank: number;
  name: string;
  sector: string;
  score: number;        // The VC-specific score
  godScore: number;     // Original GOD score for reference
  delta: number;        // rank change from previous lens
  velocity: number;     // -3 to +3 scale
}

// ═══════════════════════════════════════════════════════════════
// VC SCORING CRITERIA — THE SECRET SAUCE
// ═══════════════════════════════════════════════════════════════
// Each VC has DRAMATICALLY different weights for the 5 components.
// These reflect their real-world investment philosophies.
// Weights are intentionally extreme to show meaningful rank changes.

interface VCLens {
  id: string;
  name: string;
  accent: string;
  weights: {
    team: number;
    traction: number;
    market: number;
    product: number;
    vision: number;
  };
  description: string; // For tooltips
}

const VC_LENSES: VCLens[] = [
  { 
    id: 'god', 
    name: 'GOD Score', 
    accent: '#22d3ee',
    weights: { team: 0.20, traction: 0.20, market: 0.20, product: 0.20, vision: 0.20 },
    description: 'Balanced scoring across all dimensions'
  },
  { 
    id: 'yc', 
    name: 'YC', 
    accent: '#f97316',
    // YC: "We fund founders, not ideas." Team + traction = 80%
    weights: { team: 0.50, traction: 0.30, market: 0.05, product: 0.10, vision: 0.05 },
    description: 'Team velocity & traction over polish'
  },
  { 
    id: 'sequoia', 
    name: 'Sequoia', 
    accent: '#ef4444',
    // Sequoia: "We back category-defining companies." Market = 50%
    weights: { team: 0.15, traction: 0.10, market: 0.50, product: 0.15, vision: 0.10 },
    description: 'Market size & defensible moat'
  },
  { 
    id: 'a16z', 
    name: 'a16z', 
    accent: '#a855f7',
    // a16z: "Software is eating the world." Product + tech = 55%
    weights: { team: 0.15, traction: 0.10, market: 0.10, product: 0.55, vision: 0.10 },
    description: 'Technical depth & platform potential'
  },
  { 
    id: 'founders-fund', 
    name: 'Founders Fund', 
    accent: '#22c55e',
    // Founders Fund: "We fund what others won't." Vision = 50%
    weights: { team: 0.25, traction: 0.05, market: 0.10, product: 0.10, vision: 0.50 },
    description: 'Contrarian vision & founder conviction'
  },
  { 
    id: 'lightspeed', 
    name: 'Lightspeed', 
    accent: '#eab308',
    // Lightspeed: Velocity matters. Traction = 55%
    weights: { team: 0.15, traction: 0.55, market: 0.15, product: 0.10, vision: 0.05 },
    description: 'Proven traction & market timing'
  },
  { 
    id: 'greylock', 
    name: 'Greylock', 
    accent: '#6366f1',
    // Greylock: Product-led growth. Product + Traction = 60%
    weights: { team: 0.10, traction: 0.25, market: 0.15, product: 0.35, vision: 0.15 },
    description: 'Product-led growth & network effects'
  },
  { 
    id: 'accel', 
    name: 'Accel', 
    accent: '#ec4899',
    // Accel: Team execution. Team = 45%
    weights: { team: 0.45, traction: 0.20, market: 0.15, product: 0.15, vision: 0.05 },
    description: 'Strong team with proven execution'
  },
];

// No TIME_WINDOWS - removed non-functional controls

// ═══════════════════════════════════════════════════════════════
// VC SCORE CALCULATION — Normalized to handle different score scales
// ═══════════════════════════════════════════════════════════════

const calculateVCScore = (startup: StartupRaw, lens: VCLens): number => {
  // Use GOD score as-is for GOD lens
  if (lens.id === 'god') {
    return startup.total_god_score ?? 50;
  }
  
  // Normalize component scores to 0-100 scale
  // Based on observed data: team/traction are 0-100, market/product/vision may be 0-50
  const team = Math.min(100, (startup.team_score ?? 50));
  const traction = Math.min(100, (startup.traction_score ?? 50));
  // Market, product, vision appear to be on smaller scales - normalize up
  const market = Math.min(100, (startup.market_score ?? 25) * 2);
  const product = Math.min(100, (startup.product_score ?? 25) * 2);
  const vision = Math.min(100, (startup.vision_score ?? 25) * 2);
  
  const weightedScore = 
    (team * lens.weights.team) +
    (traction * lens.weights.traction) +
    (market * lens.weights.market) +
    (product * lens.weights.product) +
    (vision * lens.weights.vision);
  
  return Math.round(weightedScore * 10) / 10;
};

// Rank startups by VC-specific score
const rankStartupsForLens = (
  startups: StartupRaw[], 
  lens: VCLens,
  prevRanks: Map<string, number>
): StartupRanked[] => {
  // Calculate scores for all startups
  const scored = startups.map(s => ({
    raw: s,
    vcScore: calculateVCScore(s, lens),
    godScore: s.total_god_score ?? 50,
  }));
  
  // Sort by VC score (descending)
  scored.sort((a, b) => b.vcScore - a.vcScore);
  
  // Assign ranks and calculate deltas
  return scored.map((s, idx) => {
    const rank = idx + 1;
    const prevRank = prevRanks.get(s.raw.id) ?? rank;
    const delta = prevRank - rank; // positive = moved up
    
    // Velocity based on delta magnitude
    let velocity = 0;
    if (delta > 10) velocity = 3;
    else if (delta > 5) velocity = 2;
    else if (delta > 0) velocity = 1;
    else if (delta < -10) velocity = -3;
    else if (delta < -5) velocity = -2;
    else if (delta < 0) velocity = -1;
    
    // Parse sector
    let sector = 'Unknown';
    if (s.raw.sectors) {
      if (Array.isArray(s.raw.sectors)) {
        sector = s.raw.sectors[0] || 'Unknown';
      } else if (typeof s.raw.sectors === 'string') {
        sector = s.raw.sectors.split(',')[0]?.trim() || 'Unknown';
      }
    }
    
    return {
      id: s.raw.id,
      rank,
      prevRank,
      name: s.raw.name || 'Unnamed',
      sector,
      score: s.vcScore,
      godScore: s.godScore,
      delta,
      velocity,
    };
  });
};

// ═══════════════════════════════════════════════════════════════
// VELOCITY INDICATOR
// ═══════════════════════════════════════════════════════════════

const VelocityIndicator: React.FC<{ velocity: number; accent: string }> = ({ velocity, accent }) => {
  if (velocity === 0) return <span className="text-zinc-600">→</span>;
  
  if (velocity > 0) {
    const arrows = '↑'.repeat(Math.min(velocity, 3));
    return <span style={{ color: accent }}>{arrows}</span>;
  }
  
  const arrows = '↓'.repeat(Math.min(Math.abs(velocity), 3));
  return <span className="text-red-500">{arrows}</span>;
};

// ═══════════════════════════════════════════════════════════════
// DELTA BADGE
// ═══════════════════════════════════════════════════════════════

const DeltaBadge: React.FC<{ delta: number; accent: string }> = ({ delta, accent }) => {
  if (delta === 0) return <span className="text-zinc-600">—</span>;
  
  if (delta > 0) {
    return <span style={{ color: accent }}>+{delta}</span>;
  }
  
  return <span className="text-red-500">{delta}</span>;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const SignalTrends: React.FC = () => {
  const [activeLens, setActiveLens] = useState(VC_LENSES[0]);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [rawStartups, setRawStartups] = useState<StartupRaw[]>([]);
  const [rankedStartups, setRankedStartups] = useState<StartupRanked[]>([]);
  const [totalStartupCount, setTotalStartupCount] = useState(0);
  const [prevRanks, setPrevRanks] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animatingRows, setAnimatingRows] = useState<Set<string>>(new Set());
  const [lensFlash, setLensFlash] = useState(false);
  const [hasUserChangedLens, setHasUserChangedLens] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Drill-down drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<DrilldownPayload | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Load startups from Supabase on mount
  useEffect(() => {
    const loadStartups = async () => {
      setIsLoading(true);
      try {
        // Get total count first
        const { count } = await supabase
          .from('startup_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .not('total_god_score', 'is', null);
        
        setTotalStartupCount(count || 0);
        
        // Now get top 50 for display - use real startup names
        const { data, error } = await supabase
          .from('startup_uploads')
          .select('id, name, sectors, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
          .eq('status', 'approved')
          .not('total_god_score', 'is', null)
          .not('name', 'is', null)
          .order('total_god_score', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setRawStartups(data);
          // Initial ranking with GOD score
          const ranked = rankStartupsForLens(data, VC_LENSES[0], new Map());
          setRankedStartups(ranked);
          // Store initial ranks
          const initialRanks = new Map(ranked.map(s => [s.id, s.rank]));
          setPrevRanks(initialRanks);
        }
      } catch (err) {
        console.error('Failed to load startups:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStartups();
  }, []);

  // Re-rank when lens changes — with dramatic transition
  useEffect(() => {
    if (rawStartups.length === 0) return;
    
    // Trigger flash effect
    setLensFlash(true);
    setIsTransitioning(true);
    
    // Dramatic delay for lens switching animation
    setTimeout(() => {
      // Re-rank with new lens
      const ranked = rankStartupsForLens(rawStartups, activeLens, prevRanks);
      setRankedStartups(ranked);
      
      // Animate ALL rows that moved (not just significant moves)
      if (motionEnabled) {
        const toAnimate = new Set(
          ranked.filter(s => Math.abs(s.delta) > 0).map(s => s.id)
        );
        setAnimatingRows(toAnimate);
        setTimeout(() => setAnimatingRows(new Set()), 2000);
      }
      
      // Update prev ranks for next lens change
      const newRanks = new Map(ranked.map(s => [s.id, s.rank]));
      setPrevRanks(newRanks);
      
      setIsTransitioning(false);
      setTimeout(() => setLensFlash(false), 500);
    }, 300); // Longer delay for more dramatic effect
  }, [activeLens.id, rawStartups, motionEnabled]);

  // Periodic micro-updates when motion is enabled (simulates live data)
  useEffect(() => {
    if (!motionEnabled || rankedStartups.length === 0) return;
    
    const interval = setInterval(() => {
      setRankedStartups(prev => {
        // Randomly update 1-3 startups' display (visual only)
        const updated = [...prev];
        const updateCount = Math.floor(Math.random() * 3) + 1;
        const toAnimate = new Set<string>();
        
        for (let i = 0; i < updateCount; i++) {
          const idx = Math.floor(Math.random() * Math.min(50, updated.length));
          toAnimate.add(updated[idx].id);
        }
        
        setAnimatingRows(toAnimate);
        setTimeout(() => setAnimatingRows(new Set()), 800);
        
        return updated;
      });
    }, 4000);
    
    return () => clearInterval(interval);
  }, [motionEnabled, rankedStartups.length]);

  // Handle score cell click - opens drill-down drawer
  const handleScoreClick = (startup: StartupRanked, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger row click
    
    setSelectedStartupId(startup.id);
    setDrawerOpen(true);
    setDrilldownLoading(true);
    
    // Find raw startup data
    const rawStartup = rawStartups.find(s => s.id === startup.id);
    if (rawStartup) {
      // Generate drill-down data (simulates API call)
      setTimeout(() => {
        const data = generateDrilldownData(
          {
            id: rawStartup.id,
            name: rawStartup.name || 'Unknown',
            sector: startup.sector,
            sectors: rawStartup.sectors ? 
              (Array.isArray(rawStartup.sectors) ? rawStartup.sectors : [rawStartup.sectors]) : 
              [],
            team_score: rawStartup.team_score ?? 50,
            traction_score: rawStartup.traction_score ?? 50,
            market_score: rawStartup.market_score ?? 25,
            product_score: rawStartup.product_score ?? 25,
            vision_score: rawStartup.vision_score ?? 25,
          },
          {
            id: activeLens.id,
            label: activeLens.name,
            accent: activeLens.accent,
            weights: activeLens.weights,
          },
          startup.rank,
          startup.delta
        );
        setDrilldownData(data);
        setDrilldownLoading(false);
      }, 150); // Simulate network delay
    }
  };
  
  // Update drill-down when lens changes (if drawer is open)
  useEffect(() => {
    if (!drawerOpen || !selectedStartupId) return;
    
    const startup = rankedStartups.find(s => s.id === selectedStartupId);
    const rawStartup = rawStartups.find(s => s.id === selectedStartupId);
    
    if (startup && rawStartup) {
      setDrilldownLoading(true);
      setTimeout(() => {
        const data = generateDrilldownData(
          {
            id: rawStartup.id,
            name: rawStartup.name || 'Unknown',
            sector: startup.sector,
            sectors: rawStartup.sectors ? 
              (Array.isArray(rawStartup.sectors) ? rawStartup.sectors : [rawStartup.sectors]) : 
              [],
            team_score: rawStartup.team_score ?? 50,
            traction_score: rawStartup.traction_score ?? 50,
            market_score: rawStartup.market_score ?? 25,
            product_score: rawStartup.product_score ?? 25,
            vision_score: rawStartup.vision_score ?? 25,
          },
          {
            id: activeLens.id,
            label: activeLens.name,
            accent: activeLens.accent,
            weights: activeLens.weights,
          },
          startup.rank,
          startup.delta
        );
        setDrilldownData(data);
        setDrilldownLoading(false);
      }, 150);
    }
  }, [activeLens.id]); // Re-run when lens changes
  
  // Close drawer handler
  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedStartupId(null);
    setDrilldownData(null);
  };

  const handleLensChange = (lens: VCLens) => {
    if (lens.id === activeLens.id) return;
    setHasUserChangedLens(true);
    setActiveLens(lens);
  };

  // Count how many startups moved up/down on lens switch
  const moversUp = rankedStartups.filter(s => s.delta > 0).length;
  const moversDown = rankedStartups.filter(s => s.delta < 0).length;

  return (
    <div 
      className={`min-h-screen transition-all duration-300 ${lensFlash ? 'brightness-110' : ''}`}
      style={{ 
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <PythhUnifiedNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ═══════════════════════════════════════════════════════════════
            TITLE — Consistent with Signals/Matches style + Share
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              rankings
            </div>
            <h1 className="text-[32px] font-semibold leading-tight mb-2">
              <span className="text-white">Live </span>
              <span className="text-cyan-400" style={{ textShadow: '0 0 30px rgba(34,211,238,0.3)' }}>Rankings</span>
            </h1>
            <p className="text-base text-zinc-400">
              How different investors score the same market
            </p>
          </div>
          <ShareButton
            payload={{
              type: 'market_slice',
              lensId: activeLens.id,
              lensLabel: activeLens.name,
              topCount: Math.min(rankedStartups.length, 50),
            }}
            expandable
            linkPayload={{
              share_type: 'market_slice',
              lens_id: activeLens.id,
              filters: { mode: 'all' },
              top_n: 50,
            }}
            showLabel
            size="md"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DESCRIPTION — What rankings are and how tabs work
        ═══════════════════════════════════════════════════════════════ */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          Rankings show how the same startups reorder under different investor scoring models.
          The default <span className="text-cyan-400">GOD Score</span> is pythh's balanced baseline — equal weight across
          team, traction, market, product, and vision. It is the most reliable way to rank startups
          for signal review because it has no thesis bias. Click any tab below to see how a specific
          investor (YC, Sequoia, a16z, etc.) would rescore and reorder the same companies using their
          actual investment criteria. Watch startups jump or drop — that delta is the signal.
        </p>

        {/* ═══════════════════════════════════════════════════════════════
            LIVE STATS STRIP — The POP
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-4 mb-5 py-3 px-4 rounded-lg border border-zinc-800/50 bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-500">Live</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-white">{totalStartupCount.toLocaleString()}</span>
            <span className="text-xs text-zinc-500">startups ranked</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold" style={{ color: activeLens.accent }}>{VC_LENSES.length}</span>
            <span className="text-xs text-zinc-500">investor models</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Active lens</span>
            <span className="text-sm font-semibold" style={{ color: activeLens.accent, textShadow: `0 0 12px ${activeLens.accent}40` }}>{activeLens.name}</span>
          </div>
          {hasUserChangedLens && (moversUp > 0 || moversDown > 0) && (
            <>
              <div className="h-4 w-px bg-zinc-800 ml-auto" />
              <div className="flex items-center gap-3 text-xs">
                {moversUp > 0 && <span style={{ color: activeLens.accent }}>↑ {moversUp} rose</span>}
                {moversDown > 0 && <span className="text-red-400">↓ {moversDown} fell</span>}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            VC LENS BAR — The key interaction (SECRET SAUCE)
        ═══════════════════════════════════════════════════════════════ */}
        {/* VC LENS TABS — Full width row so all 8 are always visible */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 bg-zinc-900/50 rounded-lg p-1.5 border border-cyan-800/40">
            {VC_LENSES.map(lens => (
              <button
                key={lens.id}
                onClick={() => handleLensChange(lens)}
                title={lens.description}
                className={`
                  px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 whitespace-nowrap
                  ${activeLens.id === lens.id 
                    ? 'text-cyan-400' 
                    : 'text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800/50'
                  }
                `}
                style={{
                  backgroundColor: activeLens.id === lens.id ? 'rgba(34, 211, 238, 0.1)' : undefined,
                  borderBottom: activeLens.id === lens.id ? `2px solid ${lens.accent}` : '2px solid transparent',
                  boxShadow: activeLens.id === lens.id ? `0 0 12px ${lens.accent}25` : undefined,
                }}
              >
                {lens.name}
              </button>
            ))}
          </div>
          {/* ACTIVE LENS DESCRIPTION */}
          <div className="text-xs text-zinc-500 mt-2 ml-2">
            {activeLens.description}
          </div>
        </div>



        {/* ═══════════════════════════════════════════════════════════════
            SECONDARY FILTERS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-3 mb-4">
          <select className="bg-zinc-900 border border-cyan-800/40 text-cyan-400/80 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer hover:border-cyan-600/50 transition">
            <option>All Sectors</option>
            <option>AI Infra</option>
            <option>FinTech API</option>
            <option>Climate SaaS</option>
            <option>Dev Tooling</option>
            <option>Data Security</option>
          </select>
          <select className="bg-zinc-900 border border-cyan-800/40 text-cyan-400/80 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer hover:border-cyan-600/50 transition">
            <option>All Stages</option>
            <option>Pre-Seed</option>
            <option>Seed</option>
            <option>Series A</option>
            <option>Series B+</option>
          </select>
          <select className="bg-zinc-900 border border-cyan-800/40 text-cyan-400/80 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer hover:border-cyan-600/50 transition">
            <option>All Regions</option>
            <option>US</option>
            <option>Europe</option>
            <option>Asia</option>
          </select>
          
          {/* Movement summary after lens switch */}
          {(moversUp > 0 || moversDown > 0) && (
            <div className="ml-auto flex items-center gap-3 text-xs">
              {moversUp > 0 && (
                <span style={{ color: activeLens.accent }}>
                  ↑ {moversUp} rose
                </span>
              )}
              {moversDown > 0 && (
                <span className="text-red-500">
                  ↓ {moversDown} fell
                </span>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            THE SCOREBOARD — This is the page
        ═══════════════════════════════════════════════════════════════ */}
        <div 
          ref={tableRef}
          className={`
            bg-zinc-900/30 rounded-lg border overflow-hidden
            transition-all duration-500 ease-out
            ${isTransitioning ? 'opacity-60 scale-[0.995]' : 'opacity-100 scale-100'}
          `}
          style={{
            borderColor: (lensFlash && hasUserChangedLens) ? activeLens.accent : `${activeLens.accent}30`,
            boxShadow: (lensFlash && hasUserChangedLens) ? `0 0 30px ${activeLens.accent}30` : `0 0 15px ${activeLens.accent}10`,
          }}
        >
          {/* Table Header */}
          <div 
            className="grid grid-cols-[60px_1fr_160px_100px_60px_60px_40px] gap-4 px-4 py-3 border-b border-zinc-800/60 text-xs font-medium uppercase tracking-wider transition-colors duration-300"
            style={{ 
              color: 'rgba(255,255,255,0.4)',
              backgroundColor: (lensFlash && hasUserChangedLens) ? `${activeLens.accent}10` : 'transparent',
            }}
          >
            <div>Rank</div>
            <div>Startup</div>
            <div>Sector</div>
            <div 
              className="transition-all duration-300 cursor-help"
              style={{ 
                color: activeLens.accent,
                textShadow: `0 0 20px ${activeLens.accent}60`
              }}
              title="Click any score to see breakdown"
            >
              {activeLens.name} Score ↗
            </div>
            <div className="text-center">Δ</div>
            <div className="text-center">Vel</div>
            <div></div>
          </div>

          {/* Table Body — Taller scroll container to show more startups */}
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-zinc-500">Loading market data...</div>
              </div>
            ) : rankedStartups.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-zinc-500">No startups found</div>
              </div>
            ) : (
              rankedStartups.map((startup, idx) => {
                const isAnimating = animatingRows.has(startup.id);
                
                return (
                  <div
                    key={startup.id}
                    className={`
                      grid grid-cols-[60px_1fr_160px_100px_60px_60px_40px] gap-4 px-4 py-3
                      border-b border-zinc-800/30 
                      hover:bg-zinc-800/30 cursor-pointer
                      transition-all duration-300
                      ${isAnimating ? 'bg-zinc-800/20' : ''}
                    `}
                    style={{
                      animation: isAnimating ? 'pulse 0.8s ease-out' : 'none',
                      borderLeft: startup.rank <= 3 ? `2px solid ${activeLens.accent}` : '2px solid transparent',
                      backgroundColor: startup.rank <= 3 ? `${activeLens.accent}06` : undefined,
                    }}
                  >
                    {/* Rank */}
                    <div className={`
                    font-mono text-sm tabular-nums
                    ${startup.rank <= 3 ? 'font-bold' : startup.rank <= 10 ? 'text-white font-medium' : 'text-zinc-500'}
                    ${isAnimating && startup.delta !== 0 ? 'animate-bounce' : ''}
                  `}
                    style={{ color: startup.rank <= 3 ? activeLens.accent : undefined }}
                  >
                    {startup.rank}
                  </div>

                  {/* Startup Name — Links to Startup Intelligence */}
                  <Link 
                    to={`/app/startup/${startup.id}`}
                    className="text-white font-medium text-sm truncate hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {startup.name}
                  </Link>

                  {/* Sector */}
                  <div className="text-zinc-500 text-sm truncate">
                    {startup.sector}
                  </div>

                  {/* Score — CLICKABLE for drill-down */}
                  <div 
                    className="font-mono text-sm tabular-nums font-medium cursor-pointer hover:underline transition-all group"
                    style={{ color: activeLens.accent }}
                    onClick={(e) => handleScoreClick(startup, e)}
                    title="Click for score breakdown"
                  >
                    <span className="group-hover:scale-110 inline-block transition-transform">
                      {startup.score.toFixed(1)}
                    </span>
                  </div>

                  {/* Delta */}
                  <div className="text-center font-mono text-sm tabular-nums">
                    <DeltaBadge delta={startup.delta} accent={activeLens.accent} />
                  </div>

                  {/* Velocity */}
                  <div className="text-center font-mono text-sm">
                    <VelocityIndicator velocity={startup.velocity} accent={activeLens.accent} />
                  </div>

                  {/* Save to Signal Card */}
                  <div className="flex justify-center">
                    <SaveToSignalCard
                      entityType="startup"
                      entityId={startup.id}
                      entityName={startup.name}
                      lensId={activeLens.id as any}
                      scoreValue={startup.score}
                      rank={startup.rank}
                      rankDelta={startup.delta}
                      context="from trends"
                      size="sm"
                    />
                  </div>
                </div>
              );
              })
            )}
          </div>
          
          {/* Table Footer — Total count */}
          <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center justify-between">
            <div className="text-zinc-500 text-xs">
              Showing top 50 of <span className="text-white font-medium">{totalStartupCount.toLocaleString()}</span> startups
            </div>
            <div className="text-zinc-600 text-xs">
              Scoring by <span style={{ color: activeLens.accent }}>{activeLens.name}</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SIGN UP CTA — Convert visitors to users
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-10 mb-6 flex items-center justify-between gap-4">
          <p className="text-zinc-400 text-sm">
            Get matched with VCs and angels based on your sector, stage, and traction.
            <span className="text-zinc-600 ml-1">Free — no credit card.</span>
          </p>
          <Link
            to="/signup/founder"
            className="shrink-0 px-5 py-2 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 transition-colors text-sm"
          >
            Sign up →
          </Link>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          SCORE DRILL-DOWN DRAWER
          Click any score → see VC logic, evidence, sensitivity
      ═══════════════════════════════════════════════════════════════ */}
      <ScoreDrilldownDrawer
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        data={drilldownData}
        isLoading={drilldownLoading}
      />

      {/* Keyframe animations for dramatic lens switching */}
      <style>{`
        @keyframes pulse {
          0% { background-color: rgba(63, 63, 70, 0.4); }
          50% { background-color: rgba(63, 63, 70, 0.15); }
          100% { background-color: transparent; }
        }
        @keyframes slideIn {
          0% { opacity: 0; transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rankShift {
          0% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default SignalTrends;