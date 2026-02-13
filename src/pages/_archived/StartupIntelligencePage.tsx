/**
 * /app/startup/:id — STARTUP INTELLIGENCE (CANONICAL)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Role: "Show me this startup's position in the market under multiple VC lenses, and why."
 * 
 * Founders use it to:
 * - Compare themselves vs competitors
 * - Understand VC evaluation differences
 * - Learn what moves rankings (without being told)
 * 
 * Key behaviors:
 * - Lens rail = same as Trends (muscle memory)
 * - Score click = same drawer (consistency)
 * - Lens swap while drawer open = updates drawer live
 * - Competitive neighborhood = ±10 ranks, clickable
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ScoreDrilldownDrawer from '../components/ScoreDrilldownDrawer';
import { generateDrilldownData, type DrilldownPayload } from '../utils/scoreDrilldown';
import SaveToSignalCard from '../components/SaveToSignalCard';
import ScorecardBlockV2 from '../components/ScorecardBlockV2';
import EvidenceCenterV2 from '../components/EvidenceCenterV2';
import ActionIntakeModalV2 from '../components/ActionIntakeModalV2';
import { useStartupScorecardV2 } from '../hooks/useStartupScorecardV2';
import { useEvidenceCenterV2 } from '../hooks/useEvidenceCenterV2';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StartupRaw {
  id: string;
  name: string;
  sectors: string | string[] | null;
  stage?: string;
  total_god_score: number | null;
  team_score: number | null;
  traction_score: number | null;
  market_score: number | null;
  product_score: number | null;
  vision_score: number | null;
  updated_at?: string;
}

interface RankedStartup {
  id: string;
  name: string;
  sector: string;
  rank: number;
  score: number;
  delta: number;
  velocity: number;
}

// ═══════════════════════════════════════════════════════════════
// VC LENSES — Shared with Trends (canonical)
// ═══════════════════════════════════════════════════════════════

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
  description: string;
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
    weights: { team: 0.50, traction: 0.30, market: 0.05, product: 0.10, vision: 0.05 },
    description: 'Team velocity & traction over polish'
  },
  { 
    id: 'sequoia', 
    name: 'Sequoia', 
    accent: '#ef4444',
    weights: { team: 0.15, traction: 0.10, market: 0.50, product: 0.15, vision: 0.10 },
    description: 'Market size & defensible moat'
  },
  { 
    id: 'a16z', 
    name: 'a16z', 
    accent: '#a855f7',
    weights: { team: 0.15, traction: 0.10, market: 0.10, product: 0.55, vision: 0.10 },
    description: 'Technical depth & platform potential'
  },
  { 
    id: 'founders-fund', 
    name: 'Founders Fund', 
    accent: '#22c55e',
    weights: { team: 0.25, traction: 0.05, market: 0.10, product: 0.10, vision: 0.50 },
    description: 'Contrarian vision & founder conviction'
  },
  { 
    id: 'greylock', 
    name: 'Greylock', 
    accent: '#6366f1',
    weights: { team: 0.10, traction: 0.25, market: 0.15, product: 0.35, vision: 0.15 },
    description: 'Product-led growth & network effects'
  },
];

const FACTOR_LABELS: Record<string, string> = {
  team: 'Team credibility',
  traction: 'Traction quality',
  market: 'Market size & inevitability',
  product: 'Product strength',
  vision: 'Vision & narrative',
};

const TIME_WINDOWS = ['24h', '7d', '30d'];

// ═══════════════════════════════════════════════════════════════
// SCORE CALCULATION — Same as Trends
// ═══════════════════════════════════════════════════════════════

const calculateVCScore = (startup: StartupRaw, lens: VCLens): number => {
  if (lens.id === 'god') {
    return startup.total_god_score ?? 50;
  }
  
  const team = Math.min(100, (startup.team_score ?? 50));
  const traction = Math.min(100, (startup.traction_score ?? 50));
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

// Calculate factor contributions
const calculateContributions = (startup: StartupRaw, lens: VCLens) => {
  const scores = {
    team: Math.min(100, (startup.team_score ?? 50)),
    traction: Math.min(100, (startup.traction_score ?? 50)),
    market: Math.min(100, (startup.market_score ?? 25) * 2),
    product: Math.min(100, (startup.product_score ?? 25) * 2),
    vision: Math.min(100, (startup.vision_score ?? 25) * 2),
  };
  
  return Object.entries(lens.weights)
    .map(([factor, weight]) => ({
      factor,
      label: FACTOR_LABELS[factor] || factor,
      contribution: scores[factor as keyof typeof scores] * weight,
      weight,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
};

// ═══════════════════════════════════════════════════════════════
// EVIDENCE SNIPPETS (mock for now)
// ═══════════════════════════════════════════════════════════════

const generateEvidenceSnippets = (startup: StartupRaw) => {
  const snippets = [
    { claim: 'Hiring velocity increasing', source: 'jobs_activity', confidence: 'medium', age: '2d' },
    { claim: 'Enterprise keywords rising', source: 'web_diffs', confidence: 'medium', age: '5d' },
    { claim: 'Competitor density increasing', source: 'market_scan', confidence: 'medium', age: '7d' },
  ];
  
  // Customize based on scores
  if ((startup.team_score ?? 0) > 70) {
    snippets.unshift({ claim: 'Strong founding team detected', source: 'profile_analysis', confidence: 'high', age: '1d' });
  }
  if ((startup.traction_score ?? 0) > 70) {
    snippets.unshift({ claim: 'Growth acceleration detected', source: 'metrics_analysis', confidence: 'high', age: '1d' });
  }
  
  return snippets.slice(0, 5);
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

const StartupIntelligencePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [startup, setStartup] = useState<StartupRaw | null>(null);
  const [allStartups, setAllStartups] = useState<StartupRaw[]>([]);
  const [activeLens, setActiveLens] = useState(VC_LENSES[0]);
  const [activeWindow, setActiveWindow] = useState('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Drill-down drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<DrilldownPayload | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // V2 Verification Pipeline state
  const [showActionModal, setShowActionModal] = useState(false);
  const { data: scorecardV2, refresh: refreshScorecard } = useStartupScorecardV2(id);
  const { data: evidenceCenter, refresh: refreshEvidence } = useEvidenceCenterV2(id);

  // Handle action modal success - refresh both scorecard and evidence
  const handleActionSubmitted = useCallback(async (actionData: any) => {
    // Refresh data surfaces in the background
    // Don't await - let the modal show success state while refreshing
    Promise.all([refreshScorecard(), refreshEvidence()]).catch(console.error);
    // Modal will close itself after user clicks "Done"
  }, [refreshScorecard, refreshEvidence]);

  // Load startup and neighbors
  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError('No startup ID provided');
        setIsLoading(false);
        return;
      }
      
      console.log('🔍 Loading startup with ID:', id);
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch this startup - don't filter by status since we're viewing a specific one
        // Using maybeSingle() instead of single() to avoid PGRST116 errors
        const { data: startupData, error: startupError } = await supabase
          .from('startup_uploads')
          .select('id, name, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score, updated_at, status')
          .eq('id', id)
          .maybeSingle();
        
        console.log('📊 Startup query result:', { startupData, startupError });
        
        if (startupError) {
          console.error('❌ Supabase error:', startupError);
          console.error('❌ Error details:', JSON.stringify(startupError, null, 2));
          throw new Error(`Database error: ${startupError.message || startupError.code || 'Unknown error'}`);
        }
        if (!startupData) {
          console.error('❌ No data returned for ID:', id);
          throw new Error('Startup not found in database');
        }
        
        console.log('✅ Found startup:', startupData.name);
        setStartup(startupData);
        
        // Fetch all approved startups for neighborhood ranking
        const { data: allData, error: allError } = await supabase
          .from('startup_uploads')
          .select('id, name, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
          .eq('status', 'approved')
          .not('total_god_score', 'is', null)
          .order('total_god_score', { ascending: false })
          .limit(200);
        
        if (allError) {
          console.error('❌ Failed to load neighbors:', allError);
          // Don't throw - still show the startup even if neighbors fail
        }
        setAllStartups(allData || []);
        console.log('📊 Loaded', allData?.length || 0, 'startups for neighborhood');
        
      } catch (err) {
        console.error('❌ Failed to load startup:', err);
        setError(err instanceof Error ? err.message : 'Failed to load startup');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [id]);

  // Calculate current position and neighborhood
  const calculatePosition = () => {
    if (!startup || allStartups.length === 0) return { rank: 0, delta: 0, velocity: 0, neighbors: [] };
    
    // Score all startups with current lens
    const scored = allStartups.map(s => ({
      id: s.id,
      name: s.name || 'Unknown',
      sector: parseSector(s.sectors),
      score: calculateVCScore(s, activeLens),
      raw: s,
    }));
    
    // Sort by score
    scored.sort((a, b) => b.score - a.score);
    
    // Find this startup's position
    const myIndex = scored.findIndex(s => s.id === startup.id);
    const myRank = myIndex >= 0 ? myIndex + 1 : scored.length + 1;
    
    // Get neighbors (±10 ranks)
    const startIdx = Math.max(0, myIndex - 5);
    const endIdx = Math.min(scored.length, myIndex + 6);
    
    const neighbors: RankedStartup[] = scored.slice(startIdx, endIdx).map((s, idx) => {
      const rank = startIdx + idx + 1;
      const delta = Math.floor(Math.random() * 5) - 2; // Mock delta for now
      let velocity = 0;
      if (delta > 2) velocity = 2;
      else if (delta > 0) velocity = 1;
      else if (delta < -2) velocity = -2;
      else if (delta < 0) velocity = -1;
      
      return {
        id: s.id,
        name: s.name,
        sector: s.sector,
        rank,
        score: s.score,
        delta: s.id === startup.id ? Math.floor(Math.random() * 4) : delta,
        velocity: s.id === startup.id ? Math.max(1, velocity) : velocity,
      };
    });
    
    const myData = neighbors.find(n => n.id === startup.id);
    
    return {
      rank: myRank,
      delta: myData?.delta ?? 0,
      velocity: myData?.velocity ?? 0,
      neighbors,
    };
  };
  
  const parseSector = (sectors: string | string[] | null): string => {
    if (!sectors) return 'Technology';
    if (Array.isArray(sectors)) return sectors[0] || 'Technology';
    return sectors.split(',')[0]?.trim() || 'Technology';
  };

  const position = calculatePosition();
  const contributions = startup ? calculateContributions(startup, activeLens) : [];
  const evidenceSnippets = startup ? generateEvidenceSnippets(startup) : [];
  const currentScore = startup ? calculateVCScore(startup, activeLens) : 0;

  // Handle score click
  const handleScoreClick = (targetStartup: StartupRaw | RankedStartup, rank: number, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const targetId = targetStartup.id;
    setSelectedStartupId(targetId);
    setDrawerOpen(true);
    setDrilldownLoading(true);
    
    // Find raw data
    const rawStartup = allStartups.find(s => s.id === targetId) || (startup?.id === targetId ? startup : null);
    
    if (rawStartup) {
      setTimeout(() => {
        const data = generateDrilldownData(
          {
            id: rawStartup.id,
            name: rawStartup.name || 'Unknown',
            sector: parseSector(rawStartup.sectors),
            sectors: rawStartup.sectors ? 
              (Array.isArray(rawStartup.sectors) ? rawStartup.sectors : [rawStartup.sectors]) : [],
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
          rank,
          delta
        );
        setDrilldownData(data);
        setDrilldownLoading(false);
      }, 150);
    }
  };

  // Update drawer on lens change
  useEffect(() => {
    if (!drawerOpen || !selectedStartupId) return;
    
    const targetStartup = allStartups.find(s => s.id === selectedStartupId) || 
                          (startup?.id === selectedStartupId ? startup : null);
    const neighborData = position.neighbors.find(n => n.id === selectedStartupId);
    
    if (targetStartup) {
      setDrilldownLoading(true);
      setTimeout(() => {
        const data = generateDrilldownData(
          {
            id: targetStartup.id,
            name: targetStartup.name || 'Unknown',
            sector: parseSector(targetStartup.sectors),
            sectors: targetStartup.sectors ? 
              (Array.isArray(targetStartup.sectors) ? targetStartup.sectors : [targetStartup.sectors]) : [],
            team_score: targetStartup.team_score ?? 50,
            traction_score: targetStartup.traction_score ?? 50,
            market_score: targetStartup.market_score ?? 25,
            product_score: targetStartup.product_score ?? 25,
            vision_score: targetStartup.vision_score ?? 25,
          },
          {
            id: activeLens.id,
            label: activeLens.name,
            accent: activeLens.accent,
            weights: activeLens.weights,
          },
          neighborData?.rank ?? position.rank,
          neighborData?.delta ?? 0
        );
        setDrilldownData(data);
        setDrilldownLoading(false);
      }, 150);
    }
  }, [activeLens.id]);

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedStartupId(null);
    setDrilldownData(null);
  };

  // Format last updated
  const formatLastUpdated = (date: string | undefined) => {
    if (!date) return 'Unknown';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)' }}
      >
        <div className="text-zinc-500">Loading startup intelligence...</div>
      </div>
    );
  }

  if (error || !startup) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)' }}
      >
        <div className="text-red-400 text-lg">{error || 'Startup not found'}</div>
        <div className="text-zinc-600 text-sm">ID: {id}</div>
        <Link to="/trends" className="text-zinc-500 hover:text-white text-sm mt-4">
          ← Back to Trends
        </Link>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════
          0) HEADER STRIP — Thin, informational
      ═══════════════════════════════════════════════════════════════ */}
      <header className="border-b border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <nav className="flex items-center justify-between mb-4">
            <Link to="/" className="text-white font-semibold text-lg tracking-tight">
              pythh
            </Link>
            <div className="flex items-center gap-8 text-sm">
              <Link to="/signals" className="text-zinc-400 hover:text-white transition-colors">
                Signals
              </Link>
              <Link to="/matches" className="text-zinc-400 hover:text-white transition-colors">
                Matches
              </Link>
              <Link to="/trends" className="text-zinc-400 hover:text-white transition-colors">
                Trends
              </Link>
            </div>
          </nav>
          
          {/* Back link + Startup info strip */}
          <div className="flex items-center justify-between">
            <div>
              {/* Prominent back link */}
              <Link 
                to="/trends" 
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-3 transition-colors"
              >
                <span>←</span>
                <span>Back to Rankings</span>
              </Link>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                Startup Intelligence
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-white font-medium">{startup.name}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{parseSector(startup.sectors)}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">{startup.stage || 'Seed'}</span>
              </div>
            </div>
            <div className="text-xs text-zinc-600">
              Last updated: {formatLastUpdated(startup.updated_at)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ═══════════════════════════════════════════════════════════════
            1) LENS RAIL — Same as Trends (muscle memory)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-zinc-800/60 overflow-x-auto">
            {VC_LENSES.map(lens => (
              <button
                key={lens.id}
                onClick={() => setActiveLens(lens)}
                title={lens.description}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${activeLens.id === lens.id 
                    ? 'text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                  }
                `}
                style={{
                  backgroundColor: activeLens.id === lens.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderBottom: activeLens.id === lens.id ? `2px solid ${lens.accent}` : '2px solid transparent',
                }}
              >
                {lens.name}
              </button>
            ))}
          </div>
          
          {/* Window control */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600">Window:</span>
            {TIME_WINDOWS.map(w => (
              <button
                key={w}
                onClick={() => setActiveWindow(w)}
                className={`
                  px-2 py-1 rounded transition-colors
                  ${activeWindow === w 
                    ? 'text-white bg-zinc-800' 
                    : 'text-zinc-500 hover:text-zinc-300'
                  }
                `}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            2) SCOREBOARD STRIP — Big number, calm
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-zinc-900/30 rounded-lg border border-zinc-800/60 p-6 mb-8">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
            Current Position ({activeWindow})
          </div>
          <div className="flex items-end gap-12">
            {/* Score */}
            <div>
              <div className="text-zinc-500 text-sm mb-1">Score</div>
              <div 
                className="text-5xl font-mono font-bold tabular-nums cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: activeLens.accent }}
                onClick={(e) => handleScoreClick(startup, position.rank, position.delta, e)}
                title="Click for breakdown"
              >
                {currentScore.toFixed(1)}
              </div>
            </div>
            
            {/* Rank */}
            <div>
              <div className="text-zinc-500 text-sm mb-1">Rank</div>
              <div className="text-4xl font-mono font-semibold text-white tabular-nums">
                #{position.rank}
              </div>
            </div>
            
            {/* Delta */}
            <div>
              <div className="text-zinc-500 text-sm mb-1">Δ</div>
              <div className="text-3xl font-mono tabular-nums">
                <DeltaBadge delta={position.delta} accent={activeLens.accent} />
              </div>
            </div>
            
            {/* Velocity */}
            <div>
              <div className="text-zinc-500 text-sm mb-1">Velocity</div>
              <div className="text-3xl">
                <VelocityIndicator velocity={position.velocity} accent={activeLens.accent} />
              </div>
            </div>

            {/* Save to Signal Card */}
            <div className="ml-auto">
              <div className="text-zinc-500 text-sm mb-1">Save</div>
              <SaveToSignalCard
                entityType="startup"
                entityId={startup.id}
                entityName={startup.name}
                lensId={activeLens.id as any}
                window={activeWindow as any}
                scoreValue={currentScore}
                rank={position.rank}
                rankDelta={position.delta}
                context="from startup intelligence"
                size="lg"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* ═══════════════════════════════════════════════════════════════
              3) "WHY IT RANKS" TABLE — Factor contributions
          ═══════════════════════════════════════════════════════════════ */}
          <div className="bg-zinc-900/30 rounded-lg border border-zinc-800/60 p-6">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
              Top Drivers ({activeLens.name})
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_100px] gap-4 text-xs text-zinc-600 uppercase tracking-wider pb-2 border-b border-zinc-800/40">
                <div>Factor</div>
                <div className="text-right">Contribution</div>
              </div>
              {contributions.map((c) => (
                <div 
                  key={c.factor}
                  className="grid grid-cols-[1fr_100px] gap-4 text-sm cursor-pointer hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded transition-colors"
                  onClick={(e) => handleScoreClick(startup, position.rank, position.delta, e)}
                  title="Click for evidence"
                >
                  <div className="text-zinc-400">{c.label}</div>
                  <div 
                    className="text-right font-mono tabular-nums"
                    style={{ color: c.contribution >= 0 ? activeLens.accent : '#ef4444' }}
                  >
                    {c.contribution >= 0 ? '+' : ''}{c.contribution.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              4) RECENT SIGNAL EXCERPTS — Evidence, not narrative
          ═══════════════════════════════════════════════════════════════ */}
          <div className="bg-zinc-900/30 rounded-lg border border-zinc-800/60 p-6">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
              Recent Evidence
            </div>
            <div className="space-y-3">
              {evidenceSnippets.map((e, idx) => (
                <div key={idx} className="flex items-start justify-between gap-4 text-sm">
                  <div className="text-zinc-400">
                    • {e.claim} <span className="text-zinc-600">({e.source})</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs ${
                      e.confidence === 'high' ? 'text-emerald-400' : 
                      e.confidence === 'medium' ? 'text-amber-400' : 'text-zinc-500'
                    }`}>
                      {e.confidence}
                    </span>
                    <span className="text-zinc-600 text-xs">{e.age}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            V2 VERIFICATION PIPELINE — Scorecard + Evidence Center
        ═══════════════════════════════════════════════════════════════ */}
        {id && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* V2 Scorecard */}
            <ScorecardBlockV2
              startupId={id}
              mode="full"
              onReportAction={() => setShowActionModal(true)}
              onConnectSources={() => window.location.href = '/settings/connectors'}
              onViewEvidence={() => {
                // Scroll to evidence center
                document.getElementById('evidence-center-v2')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            
            {/* V2 Evidence Center */}
            <div id="evidence-center-v2">
              <EvidenceCenterV2
                startupId={id}
                onConnect={(provider) => window.location.href = `/settings/connectors?connect=${provider}`}
                onUpload={() => setShowActionModal(true)}
              />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            5) COMPETITIVE NEIGHBORHOOD — The "race"
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-zinc-900/30 rounded-lg border border-zinc-800/60 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-zinc-800/40">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">
              Competitive Neighborhood ({activeLens.name})
            </div>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_100px_60px_60px] gap-4 px-6 py-3 border-b border-zinc-800/40 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <div>Rank</div>
            <div>Startup</div>
            <div>Score</div>
            <div className="text-center">Δ</div>
            <div className="text-center">Vel</div>
          </div>
          
          {/* Table Body */}
          <div>
            {position.neighbors.map((neighbor) => {
              const isMe = neighbor.id === startup.id;
              
              return (
                <div
                  key={neighbor.id}
                  className={`
                    grid grid-cols-[60px_1fr_100px_60px_60px] gap-4 px-6 py-3
                    border-b border-zinc-800/20 
                    transition-colors
                    ${isMe 
                      ? 'bg-zinc-800/30' 
                      : 'hover:bg-zinc-800/20 cursor-pointer'
                    }
                  `}
                  onClick={() => {
                    if (!isMe) {
                      window.location.href = `/app/startup/${neighbor.id}`;
                    }
                  }}
                >
                  {/* Rank */}
                  <div className={`font-mono text-sm tabular-nums ${
                    isMe ? 'text-white font-semibold' : 'text-zinc-500'
                  }`}>
                    {neighbor.rank}
                  </div>
                  
                  {/* Name */}
                  <div className={`text-sm truncate ${
                    isMe ? 'text-white font-medium' : 'text-zinc-400 hover:text-white'
                  }`}>
                    {neighbor.name}
                    {isMe && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                  </div>
                  
                  {/* Score — clickable */}
                  <div 
                    className="font-mono text-sm tabular-nums cursor-pointer hover:underline"
                    style={{ color: activeLens.accent }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const raw = allStartups.find(s => s.id === neighbor.id) || startup;
                      if (raw) handleScoreClick(raw, neighbor.rank, neighbor.delta, e);
                    }}
                    title="Click for breakdown"
                  >
                    {neighbor.score.toFixed(1)}
                  </div>
                  
                  {/* Delta */}
                  <div className="text-center font-mono text-sm tabular-nums">
                    <DeltaBadge delta={neighbor.delta} accent={activeLens.accent} />
                  </div>
                  
                  {/* Velocity */}
                  <div className="text-center font-mono text-sm">
                    <VelocityIndicator velocity={neighbor.velocity} accent={activeLens.accent} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            6) CROSS-LINKS — Quiet exits
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-center gap-8 text-sm">
          <Link 
            to="/trends" 
            className="text-zinc-500 hover:text-white transition-colors"
          >
            → View market rankings
          </Link>
          <Link 
            to={`/matches?startup=${id}`} 
            className="text-zinc-500 hover:text-white transition-colors"
          >
            → View investor matches
          </Link>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          SCORE DRILL-DOWN DRAWER — Same as Trends
      ═══════════════════════════════════════════════════════════════ */}
      <ScoreDrilldownDrawer
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        data={drilldownData}
        isLoading={drilldownLoading}
      />

      {/* ═══════════════════════════════════════════════════════════════
          ACTION INTAKE MODAL V2 — Report new actions
      ═══════════════════════════════════════════════════════════════ */}
      {id && (
        <ActionIntakeModalV2
          isOpen={showActionModal}
          onClose={() => setShowActionModal(false)}
          startupId={id}
          startupName={startup?.name || 'Startup'}
          onSuccess={handleActionSubmitted}
        />
      )}
    </div>
  );
};

export default StartupIntelligencePage;
