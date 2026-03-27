/**
 * /lookup — FOUNDER INVESTOR LOOKUP
 *
 * Search investors by sector, stage, and thesis keywords.
 * Built for founders who want a targeted investor list quickly.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { supabase } from '../lib/supabase';

const SECTORS = [
  'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech',
  'Cybersecurity', 'EdTech', 'Developer Tools', 'Consumer', 'Marketplace',
  'Robotics', 'Defense', 'SpaceTech', 'DeepTech',
];

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c', label: 'Series C+' },
];

type InvestorRow = {
  id: string;
  name: string;
  firm: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  investor_score: number | null;
  investment_thesis: string | null;
  linkedin_url: string | null;
};

export default function InvestorLookupPage() {
  const [q, setQ] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [stage, setStage] = useState('');
  const [minScore, setMinScore] = useState<string>('50');
  const [results, setResults] = useState<InvestorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearchError(null);
    try {
      let query = supabase
        .from('investors')
        .select(
          'id, name, firm, sectors, stage, investor_score, investment_thesis, linkedin_url',
          { count: 'exact' }
        )
        .order('investor_score', { ascending: false })
        .limit(60);

      if (q.trim()) {
        const term = q.trim();
        query = query.or(
          `name.ilike.%${term}%,firm.ilike.%${term}%,investment_thesis.ilike.%${term}%`
        );
      }
      if (sectors.length) query = query.overlaps('sectors', sectors);
      if (stage) query = query.overlaps('stage', [stage]);
      if (minScore.trim()) query = query.gte('investor_score', Number(minScore.trim()));

      const { data, error, count } = await query;
      if (error) throw error;

      setResults((data || []) as InvestorRow[]);
      setTotal(count || 0);
    } catch (e) {
      setResults([]);
      setTotal(0);
      setSearchError(e instanceof Error ? e.message : 'Search failed');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [q, sectors, stage, minScore]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const toggleSector = (s: string) => {
    setSectors(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  };

  const clearFilters = () => {
    setQ('');
    setSectors([]);
    setStage('');
    setMinScore('50');
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
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            founder investor lookup
          </div>
          <h1 className="text-[32px] font-semibold leading-tight mb-2">
            <span className="text-white">Find the right investors. </span>
            <span className="text-cyan-400" style={{ textShadow: '0 0 30px rgba(34,211,238,0.3)' }}>
              Faster.
            </span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-2xl">
            Filter investors by sector, stage, and thesis keywords to build your target outreach list.
            This page is for founders.
          </p>
          <p className="text-xs text-zinc-600 mt-2">
            Need startup discovery for investor portfolios?{' '}
            <Link to="/lookup/portfolio" className="hover:text-zinc-400 underline">
              Open investor portfolio tools
            </Link>
            .
          </p>
        </div>

        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Sector</div>
          <div className="flex flex-wrap gap-1.5">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sectors.includes(s)
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Stage</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStage(s => (s === value ? '' : value))}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  stage === value
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="Search investor name, firm, or thesis keyword"
            autoComplete="off"
            className="w-full max-w-md px-4 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-600 focus:border-cyan-800/60 focus:outline-none"
          />
          <button
            onClick={runSearch}
            className="px-4 py-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors text-sm font-medium"
          >
            Search
          </button>
          <button onClick={clearFilters} className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-400">
            Clear
          </button>
          <span className="text-[10px] text-zinc-600">Min score</span>
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={e => setMinScore(e.target.value)}
            placeholder="50"
            className="w-16 px-2 py-1.5 bg-[#0a0a0a] border border-zinc-800 rounded text-white text-sm"
          />
        </div>

        {searchError && (
          <div className="mb-4 px-4 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {searchError}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-zinc-500">
            {loading ? 'Searching...' : `${total} investor${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div
          className="bg-zinc-900/30 rounded-lg border border-cyan-800/20 overflow-hidden"
          style={{ boxShadow: '0 0 15px rgba(34,211,238,0.05)' }}
        >
          <div className="grid grid-cols-[40px_1fr_130px_130px_80px_120px] gap-3 px-4 py-3 border-b border-zinc-800/60 text-[10px] font-medium uppercase tracking-wider text-white/40">
            <div>#</div>
            <div>Investor</div>
            <div>Firm</div>
            <div>Sector</div>
            <div className="text-cyan-400">Score</div>
            <div className="text-right">Action</div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Searching...</div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500 text-sm">
                No investors match these filters yet.
              </div>
            ) : (
              results.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[40px_1fr_130px_130px_80px_120px] gap-3 px-4 py-3 border-b border-zinc-800/30 hover:bg-zinc-800/20 items-center"
                >
                  <div className="text-sm text-zinc-600">{idx + 1}</div>
                  <div className="min-w-0">
                    <Link to={`/investor/${row.id}`} className="text-sm text-white truncate block hover:text-cyan-400">
                      {row.name || '—'}
                    </Link>
                    {row.investment_thesis && (
                      <div className="text-[11px] text-zinc-600 truncate">{row.investment_thesis}</div>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{row.firm || '—'}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {(row.sectors || []).slice(0, 2).join(', ') || '—'}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-cyan-400">
                    {typeof row.investor_score === 'number' ? row.investor_score.toFixed(1) : '—'}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/investor/${row.id}`}
                      className="px-2 py-1 rounded text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    >
                      View
                    </Link>
                    {row.linkedin_url && (
                      <a
                        href={row.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25"
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 border-t border-zinc-800/30 mt-8">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>pythh.ai — founder investor lookup</span>
        </div>
      </footer>
    </div>
  );
}
