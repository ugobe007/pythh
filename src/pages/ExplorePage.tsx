/**
 * /explore — PYTHH STARTUP EXPLORER
 * 
 * Search the Pythh database by name, sector, or stage.
 * Returns startups ranked by GOD score with live filtering.
 * 
 * Design: Same Supabase inline-text style as Rankings/HowItWorks.
 * No panels, no cards — dense table, chip filters, text-first.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { searchStartups, stageLabel, type StartupSearchResult, type StartupSearchFilters } from '../services/startupSearchService';
import ScoreDrilldownDrawer from '../components/ScoreDrilldownDrawer';
import { generateDrilldownData, type DrilldownPayload } from '../utils/scoreDrilldown';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const SECTORS = [
  'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech',
  'Cybersecurity', 'EdTech', 'Developer Tools', 'Consumer', 'Marketplace',
];

const STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];

const SORT_OPTIONS: { value: StartupSearchFilters['sortBy']; label: string }[] = [
  { value: 'total_god_score', label: 'GOD Score' },
  { value: 'enhanced_god_score', label: 'Enhanced Score' },
  { value: 'created_at', label: 'Newest' },
  { value: 'name', label: 'A → Z' },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ExplorePage() {
  // Search state
  const [query, setQuery] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [sortBy, setSortBy] = useState<StartupSearchFilters['sortBy']>('total_god_score');

  // Results
  const [results, setResults] = useState<StartupSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // Drilldown drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drilldownData, setDrilldownData] = useState<DrilldownPayload | null>(null);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── Execute search ───────────────────────────────────────
  const executeSearch = useCallback(async () => {
    setIsLoading(true);
    const { data, count, error } = await searchStartups({
      query,
      sectors: selectedSectors,
      stage: selectedStage,
      sortBy,
      limit: 50,
    });

    if (!error && data) {
      setResults(data);
      setTotalCount(count);
    }
    setHasSearched(true);
    setIsLoading(false);
  }, [query, selectedSectors, selectedStage, sortBy]);

  // Load on mount
  useEffect(() => {
    executeSearch();
  }, []);

  // Debounced search on filter changes
  useEffect(() => {
    if (!hasSearched) return; // skip initial (handled above)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(executeSearch, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selectedSectors, selectedStage, sortBy]);

  // ─── Sector toggle ────────────────────────────────────────
  const toggleSector = (sector: string) => {
    setSelectedSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    );
  };

  // ─── Stage toggle ─────────────────────────────────────────
  const toggleStage = (stage: string) => {
    setSelectedStage(prev => (prev === stage ? '' : stage));
  };

  // ─── Clear all filters ────────────────────────────────────
  const clearFilters = () => {
    setQuery('');
    setSelectedSectors([]);
    setSelectedStage('');
    setSortBy('total_god_score');
  };

  const hasActiveFilters = query || selectedSectors.length > 0 || selectedStage;

  // ─── Score drilldown ──────────────────────────────────────
  const handleScoreClick = (startup: StartupSearchResult, rank: number) => {
    const data = generateDrilldownData(
      {
        id: startup.id,
        name: startup.name || 'Unknown',
        sector: startup.sectors?.[0] || 'General',
        sectors: startup.sectors || [],
        team_score: startup.team_score ?? 50,
        traction_score: startup.traction_score ?? 50,
        market_score: startup.market_score ?? 25,
        product_score: startup.product_score ?? 25,
        vision_score: startup.vision_score ?? 25,
      },
      { id: 'god', label: 'GOD', accent: '#22d3ee', weights: { team: 0.25, traction: 0.25, market: 0.2, product: 0.15, vision: 0.15 } },
      rank,
      0
    );
    setDrilldownData(data);
    setDrawerOpen(true);
  };

  // ─── Score bar helper ─────────────────────────────────────
  const scoreBar = (score: number | null, max = 100) => {
    const val = score ?? 0;
    const pct = Math.min((val / max) * 100, 100);
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: val >= 70 ? '#22d3ee' : val >= 50 ? '#a1a1aa' : '#52525b',
            }}
          />
        </div>
        <span className="text-xs tabular-nums" style={{ color: val >= 70 ? '#22d3ee' : '#a1a1aa' }}>
          {val.toFixed(0)}
        </span>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <PythhUnifiedNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ═══════════════════════════════════════════════════════════════
            TITLE
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            explore
          </div>
          <h1 className="text-[32px] font-semibold leading-tight mb-2">
            <span className="text-white">Search </span>
            <span className="text-cyan-400" style={{ textShadow: '0 0 30px rgba(34,211,238,0.3)' }}>Startups</span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
            Query the Pythh database by name, industry, or stage. Results ranked by GOD score — the same scoring system that powers investor matching.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SEARCH INPUT
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-5">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, tagline, or description..."
            autoComplete="off"
            className="w-full max-w-xl px-4 py-3 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-600 focus:border-cyan-800/60 focus:outline-none transition-colors"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            FILTER CHIPS — Sector
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Sector</div>
          <div className="flex flex-wrap gap-1.5">
            {SECTORS.map(sector => (
              <button
                key={sector}
                onClick={() => toggleSector(sector)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedSectors.includes(sector)
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            FILTER CHIPS — Stage
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Stage</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map(stage => (
              <button
                key={stage}
                onClick={() => toggleStage(stage)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedStage === stage
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RESULTS BAR — count + sort + clear
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">
              {isLoading ? 'Searching...' : `${totalCount} startup${totalCount !== 1 ? 's' : ''}`}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">Sort</span>
            <div className="flex gap-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    sortBy === opt.value
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RESULTS TABLE
        ═══════════════════════════════════════════════════════════════ */}
        <div
          className="bg-zinc-900/30 rounded-lg border border-cyan-800/20 overflow-hidden"
          style={{ boxShadow: '0 0 15px rgba(34,211,238,0.05)' }}
        >
          {/* Table header */}
          <div className="grid grid-cols-[50px_1fr_140px_90px_90px_90px_90px_90px] gap-3 px-4 py-3 border-b border-zinc-800/60 text-[10px] font-medium uppercase tracking-wider text-white/40">
            <div>#</div>
            <div>Startup</div>
            <div>Sector</div>
            <div className="text-cyan-400" style={{ textShadow: '0 0 20px rgba(34,211,238,0.4)' }}>GOD</div>
            <div>Team</div>
            <div>Traction</div>
            <div>Market</div>
            <div>Product</div>
          </div>

          {/* Table body */}
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-zinc-600 text-sm">Searching Pythh database...</div>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <div className="text-zinc-500 text-sm">
                  {hasActiveFilters ? 'No startups match your filters' : 'No approved startups found'}
                </div>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              results.map((startup, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                const godScore = startup.total_god_score ?? 0;
                const sectorDisplay = startup.sectors?.slice(0, 2).join(', ') || '—';

                return (
                  <div
                    key={startup.id}
                    className={`
                      grid grid-cols-[50px_1fr_140px_90px_90px_90px_90px_90px] gap-3 px-4 py-3
                      border-b border-zinc-800/30 transition-colors duration-200
                      hover:bg-zinc-800/20 cursor-default
                      ${isTop3 ? 'bg-cyan-500/[0.02]' : ''}
                    `}
                    style={isTop3 ? { borderLeft: '2px solid rgba(34,211,238,0.3)' } : undefined}
                  >
                    {/* Rank */}
                    <div className={`text-sm font-mono ${isTop3 ? 'text-cyan-400' : 'text-zinc-600'}`}>
                      {rank}
                    </div>

                    {/* Name + tagline + signals */}
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{startup.name || 'Unnamed'}</div>
                      {startup.tagline && (
                        <div className="text-[11px] text-zinc-600 truncate mt-0.5">{startup.tagline}</div>
                      )}
                      {/* Psychological signals */}
                      {(startup.is_oversubscribed || startup.has_followon || startup.has_social_proof_cascade || startup.is_repeat_founder) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {startup.is_oversubscribed && <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded" title="Oversubscribed">🚀</span>}
                          {startup.has_followon && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded" title="Follow-on">💎</span>}
                          {startup.is_competitive && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded" title="Competitive">⚡</span>}
                          {startup.has_social_proof_cascade && <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded" title="Social Proof">🌊</span>}
                          {startup.is_repeat_founder && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded" title="Repeat Founder">🔁</span>}
                        </div>
                      )}
                    </div>

                    {/* Sector */}
                    <div className="text-xs text-zinc-500 truncate self-center">{sectorDisplay}</div>

                    {/* GOD Score — clickable, shows enhanced if available */}
                    <div
                      className="self-center cursor-pointer"
                      onClick={() => handleScoreClick(startup, rank)}
                      title="Click for score breakdown"
                    >
                      {startup.enhanced_god_score && startup.enhanced_god_score > godScore ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-zinc-600 line-through">{godScore.toFixed(0)}</span>
                          <span
                            className="text-sm font-semibold tabular-nums"
                            style={{
                              color: startup.enhanced_god_score >= 70 ? '#22d3ee' : startup.enhanced_god_score >= 50 ? '#a1a1aa' : '#52525b',
                              textShadow: startup.enhanced_god_score >= 70 ? '0 0 15px rgba(34,211,238,0.3)' : 'none',
                            }}
                          >
                            {startup.enhanced_god_score.toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{
                            color: godScore >= 70 ? '#22d3ee' : godScore >= 50 ? '#a1a1aa' : '#52525b',
                            textShadow: godScore >= 70 ? '0 0 15px rgba(34,211,238,0.3)' : 'none',
                          }}
                        >
                          {godScore.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Sub-scores */}
                    <div className="self-center">{scoreBar(startup.team_score)}</div>
                    <div className="self-center">{scoreBar(startup.traction_score)}</div>
                    <div className="self-center">{scoreBar(startup.market_score)}</div>
                    <div className="self-center">{scoreBar(startup.product_score)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Result count footer */}
        {!isLoading && results.length > 0 && totalCount > results.length && (
          <div className="text-center py-4">
            <span className="text-xs text-zinc-600">
              Showing {results.length} of {totalCount} startups
            </span>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════ */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 border-t border-zinc-800/30 mt-8">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>pythh.ai — startup signal intelligence</span>
          <div className="flex items-center gap-4">
            <Link to="/rankings" className="hover:text-zinc-400 transition-colors">Rankings</Link>
            <Link to="/how-it-works" className="hover:text-zinc-400 transition-colors">How it works</Link>
            <Link to="/pricing" className="hover:text-zinc-400 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>

      {/* Score drilldown drawer */}
      {drilldownData && (
        <ScoreDrilldownDrawer
          isOpen={drawerOpen}
          onClose={() => { setDrawerOpen(false); setDrilldownData(null); }}
          data={drilldownData}
          isLoading={false}
        />
      )}
    </div>
  );
}
