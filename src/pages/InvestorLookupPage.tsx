/**
 * /lookup — TOP 10 INVESTORS BY INDUSTRY (Founder teaser)
 *
 * Founders can generate Top 10 "most active" investors for one selected industry.
 * Free users: 2 industry queries per browser session. Then signup gate.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const SESSION_QUERY_KEY = 'pythh_top10_industry_queries_v1';
const FREE_QUERY_LIMIT = 2;

const INDUSTRIES = [
  'AI/ML',
  'Fintech',
  'HealthTech',
  'Robotics',
  'SpaceTech',
  'DeepTech',
  'Defense',
  'Developer Tools',
  'SaaS',
  'Cybersecurity',
] as const;

type InvestorRow = {
  id: string;
  name: string;
  firm: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  investor_score: number | null;
  investment_pace_per_year: number | null;
  total_investments: number | null;
  linkedin_url: string | null;
  investment_thesis: string | null;
};

function getSessionQueryCount(): number {
  try {
    return Number(localStorage.getItem(SESSION_QUERY_KEY) || '0');
  } catch {
    return 0;
  }
}

function incrementSessionQueryCount(): number {
  const next = getSessionQueryCount() + 1;
  try {
    localStorage.setItem(SESSION_QUERY_KEY, String(next));
  } catch {}
  return next;
}

export default function InvestorLookupPage() {
  const { isLoggedIn } = useAuth();
  const [selectedIndustry, setSelectedIndustry] = useState<string>('SpaceTech');
  const [results, setResults] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sessionQueriesUsed, setSessionQueriesUsed] = useState<number>(() => getSessionQueryCount());

  const queriesRemaining = Math.max(0, FREE_QUERY_LIMIT - sessionQueriesUsed);
  const isBlocked = !isLoggedIn && sessionQueriesUsed >= FREE_QUERY_LIMIT;

  async function generateTop10() {
    if (!selectedIndustry) return;
    if (!isLoggedIn && isBlocked) return;

    setLoading(true);
    setSearchError(null);
    try {
      const { data, error } = await supabase
        .from('investors')
        .select(
          'id, name, firm, sectors, stage, investor_score, investment_pace_per_year, total_investments, linkedin_url, investment_thesis'
        )
        .overlaps('sectors', [selectedIndustry])
        .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
        .order('total_investments', { ascending: false, nullsFirst: false })
        .order('investor_score', { ascending: false, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      setResults((data || []) as InvestorRow[]);

      if (!isLoggedIn) {
        const used = incrementSessionQueryCount();
        setSessionQueriesUsed(used);
      }
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : 'Could not generate list');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <PythhUnifiedNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            founder investor lookup
          </div>
          <h1 className="text-[32px] font-semibold leading-tight mb-2">
            <span className="text-white">Top 10 investors by industry. </span>
            <span className="text-cyan-400" style={{ textShadow: '0 0 30px rgba(34,211,238,0.3)' }}>
              Instant.
            </span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-3xl">
            Pick your industry and we will generate a straightforward Top 10 list of the most active investors.
            This is a teaser list, not personalized matching.
          </p>
        </div>

        <div className="mb-6 p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Choose industry</div>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((industry) => (
              <button
                key={industry}
                onClick={() => setSelectedIndustry(industry)}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  selectedIndustry === industry
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {industry}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={generateTop10}
              disabled={loading || (!isLoggedIn && isBlocked)}
              className="px-4 py-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : `Generate Top 10 — ${selectedIndustry}`}
            </button>
            {!isLoggedIn && (
              <span className="text-xs text-zinc-500">
                Free queries this session: <span className="text-zinc-300">{queriesRemaining}</span> / {FREE_QUERY_LIMIT}
              </span>
            )}
            {isLoggedIn && (
              <span className="text-xs text-emerald-400/80">Signed in: unlimited lookups</span>
            )}
          </div>
        </div>

        {!isLoggedIn && isBlocked && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            You used your 2 free Top 10 queries for this session.
            <Link to="/signup" className="ml-1 text-amber-200 underline hover:text-white">
              Sign up to unlock unlimited industries, deeper matching, and outreach timing playbooks.
            </Link>
          </div>
        )}

        {searchError && (
          <div className="mb-4 px-4 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {searchError}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-zinc-500">
            {results.length > 0
              ? `Top 10 most active investors in ${selectedIndustry}`
              : 'Generate a list to begin'}
          </span>
        </div>

        <div
          className="bg-zinc-900/30 rounded-lg border border-cyan-800/20 overflow-hidden"
          style={{ boxShadow: '0 0 15px rgba(34,211,238,0.05)' }}
        >
          <div className="grid grid-cols-[40px_1fr_130px_120px_80px_120px] gap-3 px-4 py-3 border-b border-zinc-800/60 text-[10px] font-medium uppercase tracking-wider text-white/40">
            <div>#</div>
            <div>Investor</div>
            <div>Firm</div>
            <div>Activity</div>
            <div className="text-cyan-400">Score</div>
            <div className="text-right">Action</div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Generating Top 10...</div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500 text-sm">
                No list generated yet.
              </div>
            ) : (
              results.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[40px_1fr_130px_120px_80px_120px] gap-3 px-4 py-3 border-b border-zinc-800/30 hover:bg-zinc-800/20 items-center"
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
                  <div className="text-xs text-zinc-500">
                    {row.investment_pace_per_year != null
                      ? `${row.investment_pace_per_year}/yr`
                      : row.total_investments != null
                        ? `${row.total_investments} total`
                        : 'active'}
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

        <div className="mt-5 p-4 rounded-lg border border-zinc-800 bg-zinc-900/20">
          <p className="text-sm text-zinc-400">
            Want personalized investor matching, more than Top 10, and timing + outreach guidance?
            <Link to="/signup" className="ml-1 text-cyan-400 hover:text-cyan-300 underline">
              Sign up to unlock the full Pythh engine.
            </Link>
          </p>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-4 border-t border-zinc-800/30 mt-8">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>pythh.ai — founder investor lookup</span>
        </div>
      </footer>
    </div>
  );
}
