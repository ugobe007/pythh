/**
 * /s/:shareId — PUBLIC SHARE SURFACE (CANONICAL v1)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Public page that renders shared snapshots.
 * 
 * Supports:
 * - score_snapshot: Frozen startup snapshot (score, rank, drivers, breakdown, evidence)
 * - investor_brief: Investor behavioral pattern + signals
 * - market_slice: Live rankings with lens/sector switching (Option A)
 * 
 * Shared scope rules:
 * - NO user notes, NO private data, NO contact actions
 * - NO browsing beyond shared scope (no clickable startup names)
 * - Lens switching allowed (candy)
 * - Sector toggle allowed for market_slice
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type ShareType = 'score_snapshot' | 'investor_brief' | 'market_slice';

interface ShareData {
  share_type: ShareType;
  payload: Record<string, any>;
  created_at: string;
  expires_at: string | null;
}

interface RankingItem {
  rank: number;
  id: string;
  name: string;
  sector?: string;
  score: number;
  delta: number;
  velocity?: string;
}

interface TopDriver {
  key?: string;
  label: string;
  pct: number;
}

interface BreakdownItem {
  factor: string;
  label: string;
  contribution: number;
}

interface EvidenceItem {
  claim: string;
  source: string;
  confidence: string;
  visibility: string;
}

// ═══════════════════════════════════════════════════════════════
// LENS CONFIG
// ═══════════════════════════════════════════════════════════════

const LENS_OPTIONS = [
  { id: 'god', name: 'GOD', accent: '#22d3ee' },
  { id: 'yc', name: 'YC', accent: '#f97316' },
  { id: 'sequoia', name: 'Sequoia', accent: '#ef4444' },
  { id: 'foundersfund', name: 'Founders Fund', accent: '#22c55e' },
  { id: 'a16z', name: 'a16z', accent: '#a855f7' },
  { id: 'greylock', name: 'Greylock', accent: '#3b82f6' },
];

// ═══════════════════════════════════════════════════════════════
// SHARED SCORE SNAPSHOT (Frozen at creation time)
// ═══════════════════════════════════════════════════════════════

function SharedScoreSnapshot({ payload, token }: { payload: Record<string, any>; token: string }) {
  const [activeLens, setActiveLens] = useState(payload.lens_id || 'god');
  const [currentSnapshot, setCurrentSnapshot] = useState(payload.snapshot || {});
  const [isLoadingLens, setIsLoadingLens] = useState(false);
  
  const startupName = payload.startup_name || currentSnapshot.startup_name || 'Startup';
  const window = payload.window || '24h';
  const activeLensConfig = LENS_OPTIONS.find(l => l.id === activeLens) || LENS_OPTIONS[0];
  
  // Top drivers (3 max)
  const topDrivers: TopDriver[] = currentSnapshot.top_drivers || [];
  
  // Breakdown table
  const breakdown: BreakdownItem[] = currentSnapshot.breakdown || [];
  
  // Evidence (public-safe only)
  const evidence = payload.evidence || [];

  // Try lens switching (server generates public-safe snapshot)
  const handleLensSwitch = async (newLensId: string) => {
    if (newLensId === activeLens) return;
    
    setActiveLens(newLensId);
    setIsLoadingLens(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/share-links/${token}/snapshot?lens_id=${newLensId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.snapshot) {
          setCurrentSnapshot(data.snapshot);
        }
      }
    } catch (err) {
      console.error('Failed to fetch lens snapshot:', err);
    } finally {
      setIsLoadingLens(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="pb-4 border-b border-[#2e2e2e]">
        <div className="text-xs text-[#5f5f5f] mb-1">Startup Snapshot (Shared)</div>
        <h1 className="text-xl text-white font-medium mb-2">{startupName}</h1>
        <div className="flex items-center gap-2 text-sm text-[#8f8f8f]">
          <span>Lens: <span className="text-white">{activeLensConfig.name}</span></span>
          <span className="text-[#5f5f5f]">·</span>
          <span>Window: <span className="text-white">{window}</span></span>
        </div>
      </div>

      {/* Try This Lens Strip (candy) */}
      <div className="flex items-center gap-1 bg-[#232323] rounded-lg p-1 border border-[#2e2e2e] overflow-x-auto">
        {LENS_OPTIONS.map(lens => (
          <button
            key={lens.id}
            onClick={() => handleLensSwitch(lens.id)}
            disabled={isLoadingLens}
            className={`
              px-3 py-1.5 rounded text-sm font-medium transition-all whitespace-nowrap
              ${activeLens === lens.id 
                ? 'text-white' 
                : 'text-[#5f5f5f] hover:text-[#8f8f8f]'
              }
              ${isLoadingLens ? 'opacity-50' : ''}
            `}
            style={{
              backgroundColor: activeLens === lens.id ? `${lens.accent}15` : 'transparent',
              borderBottom: activeLens === lens.id ? `2px solid ${lens.accent}` : '2px solid transparent',
            }}
          >
            {lens.name}
          </button>
        ))}
      </div>

      {/* Score Strip (calm but prominent) */}
      <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[#5f5f5f] text-xs block mb-1">Score</span>
            <span className="text-2xl font-mono text-white">
              {isLoadingLens ? '...' : (currentSnapshot.score ?? '—')}
            </span>
          </div>
          <div>
            <span className="text-[#5f5f5f] text-xs block mb-1">Rank</span>
            <span className="text-2xl font-mono text-white">
              #{isLoadingLens ? '...' : (currentSnapshot.rank ?? '—')}
            </span>
          </div>
          <div>
            <span className="text-[#5f5f5f] text-xs block mb-1">Δ</span>
            <span className={`text-xl font-mono ${
              currentSnapshot.rank_delta > 0 ? 'text-[#3ECF8E]' : 
              currentSnapshot.rank_delta < 0 ? 'text-red-400' : 
              'text-[#5f5f5f]'
            }`}>
              {isLoadingLens ? '...' : (
                currentSnapshot.rank_delta > 0 ? `+${currentSnapshot.rank_delta}` : 
                currentSnapshot.rank_delta < 0 ? `${currentSnapshot.rank_delta}` : 
                '—'
              )}
            </span>
          </div>
          <div>
            <span className="text-[#5f5f5f] text-xs block mb-1">Timing</span>
            <span className="text-lg text-[#8f8f8f] capitalize">
              {isLoadingLens ? '...' : (currentSnapshot.velocity || '—')}
            </span>
          </div>
        </div>
      </div>

      {/* Top Drivers (3 lines max) */}
      {topDrivers.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Top drivers</h2>
          <div className="space-y-2">
            {topDrivers.slice(0, 3).map((driver, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-[#c0c0c0]">•</span>
                <span className="text-[#c0c0c0] flex-1">{driver.label}</span>
                <span className="text-[#8f8f8f] font-mono">{driver.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Breakdown Table (dense) */}
      {breakdown.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Score breakdown</h2>
          <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2e2e2e]">
                  <th className="text-left text-xs text-[#5f5f5f] px-4 py-2">Factor</th>
                  <th className="text-right text-xs text-[#5f5f5f] px-4 py-2 w-28">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item, i) => (
                  <tr key={i} className="border-b border-[#2e2e2e]/50 last:border-0">
                    <td className="text-[#c0c0c0] px-4 py-2 text-sm">{item.label}</td>
                    <td className={`text-right px-4 py-2 text-sm font-mono ${
                      item.contribution >= 0 ? 'text-[#3ECF8E]' : 'text-red-400'
                    }`}>
                      {item.contribution >= 0 ? `+${item.contribution.toFixed(1)}` : item.contribution.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evidence (public-safe, max 3 factors × 2 items) */}
      {evidence.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Evidence (public-safe)</h2>
          <div className="space-y-4">
            {evidence.slice(0, 3).map((factor: any, i: number) => (
              <div key={i}>
                <div className="text-xs text-[#8f8f8f] mb-2">{factor.factor}</div>
                <div className="space-y-1.5">
                  {(factor.items || []).slice(0, 2).map((item: EvidenceItem, j: number) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <span className="text-[#5f5f5f]">•</span>
                      {item.visibility === 'redacted' ? (
                        <span className="text-[#5f5f5f] italic">Evidence available after signup</span>
                      ) : (
                        <span className="text-[#8f8f8f]">
                          {item.claim}
                          {item.source && (
                            <span className="text-[#5f5f5f]">
                              {' — '}{item.source}
                              {item.confidence && ` · ${item.confidence}`}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED INVESTOR BRIEF (Frozen snapshot)
// ═══════════════════════════════════════════════════════════════

function SharedInvestorBrief({ payload }: { payload: Record<string, any> }) {
  const snapshot = payload.snapshot || payload;
  
  // Extract all fields with fallbacks
  const investorName = payload.investor_name || snapshot.investor_name || 'Investor';
  const focus = snapshot.focus || payload.focus || '';
  const stage = snapshot.stage || payload.stage || '';
  const timingState = snapshot.timing_state || payload.timing_state || 'stable';
  const behavioralPattern = snapshot.behavioral_pattern || payload.behavioral_pattern || [];
  const recentBehavior = snapshot.recent_behavior || payload.recent_behavior || [];
  const signalsRespondTo = snapshot.signals_respond_to || payload.signals_respond_to || [];
  const competitiveContext = snapshot.competitive_context || payload.competitive_context || [];

  // Timing state color mapping
  const getTimingColor = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'active':
      case 'warming':
        return 'text-[#3ECF8E]';
      case 'cooling':
        return 'text-amber-400';
      case 'dormant':
        return 'text-red-400';
      default:
        return 'text-[#8f8f8f]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Strip (Identity) */}
      <div className="pb-4 border-b border-[#2e2e2e]">
        <div className="text-xs text-[#5f5f5f] mb-1">Investor Brief (Shared)</div>
        <h1 className="text-xl text-white font-medium mb-2">{investorName}</h1>
        <div className="text-sm text-[#8f8f8f] space-y-1">
          {focus && <p>Focus: {focus}</p>}
          {stage && <p>Stage: {stage}</p>}
        </div>
      </div>

      {/* Timing State (prominent) */}
      <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] p-4">
        <span className="text-xs text-[#5f5f5f] block mb-1">Current timing</span>
        <span className={`text-lg font-medium capitalize ${getTimingColor(timingState)}`}>
          {timingState}
        </span>
      </div>

      {/* Behavioral Pattern (3 bullets max) */}
      {behavioralPattern.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Behavioral pattern</h2>
          <div className="space-y-2">
            {behavioralPattern.slice(0, 3).map((pattern: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#5f5f5f]">•</span>
                <span className="text-[#c0c0c0]">{pattern}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Behavior (≤30d, 3 max) */}
      {recentBehavior.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Recent behavior</h2>
          <div className="space-y-2">
            {recentBehavior.slice(0, 3).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#5f5f5f]">•</span>
                <span className="text-[#8f8f8f]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signals They Respond To (3-5) */}
      {signalsRespondTo.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Signals they respond to</h2>
          <div className="space-y-2">
            {signalsRespondTo.slice(0, 5).map((signal: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#5f5f5f]">•</span>
                <span className="text-[#8f8f8f]">{signal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitive Context (optional, 2 max) */}
      {competitiveContext.length > 0 && (
        <div>
          <h2 className="text-xs text-[#5f5f5f] mb-3">Competitive context</h2>
          <div className="space-y-2">
            {competitiveContext.slice(0, 2).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#5f5f5f]">•</span>
                <span className="text-[#8f8f8f]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED MARKET SLICE (Option A: live server data)
// ═══════════════════════════════════════════════════════════════

function SharedMarketSlice({ payload, token }: { payload: Record<string, any>; token: string }) {
  const [activeLens, setActiveLens] = useState(payload.lens_id || 'god');
  const [activeMode, setActiveMode] = useState<'sector' | 'all'>(payload.filters?.mode || 'all');
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const sector = payload.filters?.sector;
  const window = payload.window || '24h';
  const topN = payload.top_n || 50;

  const activeLensConfig = LENS_OPTIONS.find(l => l.id === activeLens) || LENS_OPTIONS[0];

  // Fetch live rankings from server (Option A)
  const fetchRankings = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const params = new URLSearchParams({
        lens_id: activeLens,
        mode: activeMode,
        ...(activeMode === 'sector' && sector ? { sector } : {}),
      });
      
      const response = await fetch(`${apiUrl}/api/share-links/${token}/rankings?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch rankings');
      
      const data = await response.json();
      setRankings(data.rankings || []);
    } catch (err) {
      console.error('Failed to fetch rankings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, activeLens, activeMode, sector]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);
  
  return (
    <div className="space-y-6">
      {/* Header Strip (thin) */}
      <div className="pb-4 border-b border-[#2e2e2e]">
        <div className="text-xs text-[#5f5f5f] mb-1">Market Rankings (Shared)</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#8f8f8f]">
          <span>Lens: <span className="text-white">{activeLensConfig.name}</span></span>
          <span className="text-[#5f5f5f]">·</span>
          <span>Window: <span className="text-white">{window}</span></span>
          <span className="text-[#5f5f5f]">·</span>
          <span>View: <span className="text-white">
            {activeMode === 'sector' && sector ? `Sector (${sector})` : 'All'}
          </span></span>
        </div>
      </div>

      {/* Try This Lens Strip (candy) */}
      <div className="flex items-center gap-1 bg-[#232323] rounded-lg p-1 border border-[#2e2e2e] overflow-x-auto">
        {LENS_OPTIONS.map(lens => (
          <button
            key={lens.id}
            onClick={() => setActiveLens(lens.id)}
            className={`
              px-3 py-1.5 rounded text-sm font-medium transition-all whitespace-nowrap
              ${activeLens === lens.id 
                ? 'text-white' 
                : 'text-[#5f5f5f] hover:text-[#8f8f8f]'
              }
            `}
            style={{
              backgroundColor: activeLens === lens.id ? `${lens.accent}15` : 'transparent',
              borderBottom: activeLens === lens.id ? `2px solid ${lens.accent}` : '2px solid transparent',
            }}
          >
            {lens.name}
          </button>
        ))}
      </div>

      {/* Sector Toggle (only if sector was in payload) */}
      {sector && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMode('sector')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              activeMode === 'sector' 
                ? 'bg-[#3ECF8E]/10 text-[#3ECF8E]' 
                : 'text-[#5f5f5f] hover:text-[#8f8f8f]'
            }`}
          >
            {sector}
          </button>
          <button
            onClick={() => setActiveMode('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              activeMode === 'all' 
                ? 'bg-[#3ECF8E]/10 text-[#3ECF8E]' 
                : 'text-[#5f5f5f] hover:text-[#8f8f8f]'
            }`}
          >
            All
          </button>
        </div>
      )}

      {/* Rankings Table (dense) */}
      <div className="bg-[#232323] rounded-lg border border-[#2e2e2e] overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[#5f5f5f]">Loading rankings...</div>
        ) : rankings.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2e2e2e]">
                <th className="text-left text-xs text-[#5f5f5f] px-4 py-2.5 w-12">#</th>
                <th className="text-left text-xs text-[#5f5f5f] px-4 py-2.5">Startup</th>
                <th className="text-right text-xs text-[#5f5f5f] px-4 py-2.5 w-20">Score</th>
                <th className="text-right text-xs text-[#5f5f5f] px-4 py-2.5 w-14">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rankings.slice(0, topN).map((item, i) => (
                <tr key={item.id || i} className="border-b border-[#2e2e2e]/50 last:border-0">
                  <td className="text-[#5f5f5f] px-4 py-2 text-sm">{item.rank}</td>
                  <td className="text-[#c0c0c0] px-4 py-2 text-sm">{item.name}</td>
                  <td className="text-white font-mono text-right px-4 py-2 text-sm">{item.score}</td>
                  <td className={`text-right px-4 py-2 text-sm font-mono ${
                    item.delta > 0 ? 'text-[#3ECF8E]' : 
                    item.delta < 0 ? 'text-red-400' : 
                    'text-[#5f5f5f]'
                  }`}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-center text-[#5f5f5f]">No rankings data available</div>
        )}
      </div>

      {/* Row count */}
      <div className="text-xs text-[#5f5f5f] text-center">
        Showing top {Math.min(rankings.length, topN)} startups
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ERROR STATES
// ═══════════════════════════════════════════════════════════════

function RevokedState() {
  return (
    <div className="text-center py-16">
      <h1 className="text-lg text-white font-medium">This share link has been revoked.</h1>
    </div>
  );
}

function ExpiredState() {
  return (
    <div className="text-center py-16">
      <h1 className="text-lg text-white font-medium">This share link has expired.</h1>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="text-center py-16">
      <h1 className="text-lg text-white font-medium">Share link not found.</h1>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SharedSurfacePage() {
  const { shareId } = useParams();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!shareId) {
      setError('not_found');
      setIsLoading(false);
      return;
    }

    const fetchShareData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/share-links/${shareId}`);
        
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'not_found');
          return;
        }
        
        const data = await response.json();
        setShareData(data);
      } catch (err) {
        console.error('Failed to fetch share data:', err);
        setError('not_found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchShareData();
  }, [shareId]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-[#2e2e2e] rounded w-1/3" />
          <div className="h-4 bg-[#2e2e2e] rounded w-1/2" />
          <div className="h-32 bg-[#2e2e2e] rounded" />
        </div>
      );
    }

    if (error === 'revoked') return <RevokedState />;
    if (error === 'expired') return <ExpiredState />;
    if (error || !shareData) return <NotFoundState />;

    switch (shareData.share_type) {
      case 'score_snapshot':
        return <SharedScoreSnapshot payload={shareData.payload} token={shareId!} />;
      case 'investor_brief':
        return <SharedInvestorBrief payload={shareData.payload} />;
      case 'market_slice':
        return <SharedMarketSlice payload={shareData.payload} token={shareId!} />;
      default:
        return <NotFoundState />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="border-b border-[#2e2e2e]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-white font-medium">pythh</Link>
          <span className="text-xs text-[#5f5f5f]">Read-only snapshot</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {renderContent()}
      </main>

      {/* Footer (quiet) */}
      {!error && (
        <footer className="border-t border-[#2e2e2e] mt-12">
          <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link 
              to="/"
              className="text-sm text-[#5f5f5f] hover:text-[#8f8f8f] transition-colors"
            >
              Get your own signals →
            </Link>
            <Link 
              to="/"
              className="text-sm text-[#8f8f8f] hover:text-white transition-colors"
            >
              Open Pythh
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
