/**
 * /s/:shareId — SHARED DASHBOARD VIEW
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Public, read-only view of shared dashboards.
 * Supports: founder_dashboard, investor_pipeline
 * Falls through to SharedSurfacePage for legacy types.
 *
 * Data is frozen in payload at share time — no live queries.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShareData {
  share_type: string;
  payload: Record<string, any>;
  created_at: string;
  expires_at: string | null;
}

// ─── Color helpers (matching dashboard tokens) ───────────────────────────────

function signalColor(value: number, max: number): string {
  const pct = value / max;
  if (pct >= 0.7) return 'text-emerald-400';
  if (pct >= 0.4) return 'text-cyan-400';
  if (pct >= 0.2) return 'text-amber-400';
  return 'text-zinc-500';
}

function barColor(pct: number): string {
  if (pct >= 0.7) return 'bg-emerald-500';
  if (pct >= 0.4) return 'bg-cyan-500';
  if (pct >= 0.2) return 'bg-amber-500';
  return 'bg-zinc-600';
}

function qualityColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-cyan-400';
  if (score >= 20) return 'text-amber-400';
  return 'text-zinc-500';
}

function qualityBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-cyan-500';
  if (score >= 20) return 'bg-amber-500';
  return 'bg-zinc-600';
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function SharedDashboardView() {
  const { shareId } = useParams<{ shareId: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/share-links/${shareId}`);
        if (res.status === 410) {
          const body = await res.json();
          setError(body.error === 'revoked' ? 'This link has been revoked.' : 'This link has expired.');
          return;
        }
        if (!res.ok) {
          setError('Share link not found.');
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load shared view.');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-xs">Loading shared view…</p>
        </div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-zinc-400 text-sm">{error || 'Something went wrong.'}</p>
          <Link to="/" className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
            Go to Pythh →
          </Link>
        </div>
      </div>
    );
  }

  // ─── Route to correct view ─────────────────────────────
  if (data.share_type === 'founder_dashboard') {
    return <SharedFounderDashboard payload={data.payload} createdAt={data.created_at} />;
  }
  if (data.share_type === 'investor_pipeline') {
    return <SharedInvestorPipeline payload={data.payload} createdAt={data.created_at} />;
  }

  // Fallback for legacy types — redirect to home
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-zinc-400 text-sm">Unsupported share type.</p>
        <Link to="/" className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
          Go to Pythh →
        </Link>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// SHARED FOUNDER DASHBOARD (read-only)
// ═════════════════════════════════════════════════════════════════════════════

function SharedFounderDashboard({ payload, createdAt }: { payload: Record<string, any>; createdAt: string }) {
  const p = payload;
  const sharedDate = new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const signals = p.signals || {};
  const god = p.god || {};
  const comparison = p.comparison || {};
  const matches = p.matches || [];
  const actions = p.actions || [];

  const GOD_MAX: Record<string, number> = { team: 25, traction: 25, market: 20, product: 15, vision: 15 };
  const SIGNAL_MAX: Record<string, number> = {
    investor_receptivity: 3, capital_convergence: 2,
    execution_velocity: 2, founder_language_shift: 1.5, news_momentum: 1.5,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      {/* Shared badge */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium">pythh.ai</Link>
            <span className="text-zinc-800">·</span>
            <span className="text-[11px] uppercase tracking-[1.5px] text-zinc-600">Shared dashboard</span>
          </div>
          <span className="text-[11px] text-zinc-700 tabular-nums hidden sm:inline">Snapshot from {sharedDate}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-20">

        {/* Identity */}
        <header className="mb-10">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500">founder dashboard</p>
            {p.plan && <span className="text-[11px] uppercase tracking-[1.5px] text-zinc-600">{p.plan} plan</span>}
          </div>
          <h1 className="text-[22px] sm:text-[28px] font-semibold text-zinc-100 leading-tight">{p.startup_name || 'Startup'}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {[p.display_name, comparison.sectors?.[0], comparison.percentile != null && `${comparison.percentile}th percentile`].filter(Boolean).join(' · ')}
          </p>
        </header>

        {/* Signal Health */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Signal health</h2>
            {signals.total != null && (
              <span className={`text-[22px] font-semibold tabular-nums ${signalColor(signals.total, 10)}`}>
                {Number(signals.total).toFixed(1)}
                <span className="text-zinc-600 text-xs font-normal ml-1">/ 10</span>
              </span>
            )}
          </div>

          {Object.keys(SIGNAL_MAX).some(k => signals[k] != null) ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {([
                ['Investor receptivity', signals.investor_receptivity, SIGNAL_MAX.investor_receptivity],
                ['Capital convergence', signals.capital_convergence, SIGNAL_MAX.capital_convergence],
                ['Execution velocity', signals.execution_velocity, SIGNAL_MAX.execution_velocity],
                ['Founder language', signals.founder_language_shift, SIGNAL_MAX.founder_language_shift],
                ['News momentum', signals.news_momentum, SIGNAL_MAX.news_momentum],
              ] as [string, number | undefined, number][]).map(([label, value, max]) => (
                value != null && (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-zinc-400">{label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor(value / max)}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
                      </div>
                      <span className={`text-xs tabular-nums w-8 text-right ${signalColor(value, max)}`}>{Number(value).toFixed(1)}</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">Signal data not included in this snapshot.</p>
            </div>
          )}

          {comparison.industry_avg != null && (
            <div className="flex gap-6 mt-3 text-xs text-zinc-500">
              <span>Industry avg <span className="text-zinc-400 tabular-nums">{Number(comparison.industry_avg).toFixed(1)}</span></span>
              {comparison.top_quartile != null && <span>Top quartile <span className="text-zinc-400 tabular-nums">{Number(comparison.top_quartile).toFixed(1)}</span></span>}
              {comparison.percentile != null && <span>Percentile <span className={`tabular-nums ${comparison.percentile >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{comparison.percentile}th</span></span>}
            </div>
          )}
        </section>

        {/* GOD Score */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">GOD score</h2>
            {god.total != null && (
              <span className={`text-[22px] font-semibold tabular-nums ${signalColor(god.total, 100)}`}>
                {god.total}
                <span className="text-zinc-600 text-xs font-normal ml-1">/ 100</span>
              </span>
            )}
          </div>

          {god.team != null ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {(['team', 'traction', 'market', 'product', 'vision'] as const).map(key => {
                const value = god[key];
                const max = GOD_MAX[key];
                if (value == null) return null;
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-zinc-400 capitalize">{key}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor(value / max)}`} style={{ width: `${(value / max) * 100}%` }} />
                      </div>
                      <span className={`text-xs tabular-nums w-10 text-right ${signalColor(value, max)}`}>
                        {value} <span className="text-zinc-700">/ {max}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">GOD score not included in this snapshot.</p>
            </div>
          )}
        </section>

        {/* Matched Investors */}
        {matches.length > 0 && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[15px] font-medium text-zinc-300">Matched investors</h2>
              <span className="text-xs text-zinc-500 tabular-nums">{matches.length} shown</span>
            </div>
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              <div className="grid grid-cols-[2rem_1fr_5rem_4rem] sm:grid-cols-[2rem_1fr_5rem_4rem] gap-2 px-3 sm:px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-600">
                <span>#</span><span>Investor</span><span className="text-right">Fit</span><span className="text-right">Signal</span>
              </div>
              {matches.map((m: any, i: number) => (
                <div key={i} className="grid grid-cols-[2rem_1fr_5rem_4rem] sm:grid-cols-[2rem_1fr_5rem_4rem] gap-2 px-3 sm:px-4 py-3">
                  <span className="text-xs text-zinc-600 tabular-nums">{m.rank || i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{m.investor_name || 'Investor'}</p>
                    {m.why_summary && <p className="text-[11px] text-zinc-600 truncate mt-0.5">{m.why_summary}</p>}
                  </div>
                  <span className="text-xs text-zinc-400 text-right self-center">{m.fit_bucket || '—'}</span>
                  <span className={`text-xs tabular-nums text-right self-center ${signalColor(m.signal_score || 0, 10)}`}>
                    {m.signal_score != null ? Number(m.signal_score).toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[15px] font-medium text-zinc-300">Recommended actions</h2>
              <span className="text-xs text-zinc-500">{actions.length} action{actions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {actions.map((a: any, i: number) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      a.priority === 'critical' ? 'bg-red-400' : a.priority === 'high' ? 'bg-amber-400' : a.priority === 'medium' ? 'bg-cyan-400' : 'bg-zinc-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200">{a.title}</p>
                      <p className="text-xs text-zinc-500 mt-1">{a.detail}</p>
                      {a.lift && <span className="text-[11px] text-zinc-600 mt-1 inline-block">Est. lift: <span className="text-zinc-400">{a.lift}</span></span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-zinc-800/50 pt-6 text-center">
          <p className="text-zinc-600 text-xs">
            Shared from <Link to="/" className="text-cyan-400/70 hover:text-cyan-400 transition-colors">pythh.ai</Link> · Read-only snapshot · {sharedDate}
          </p>
        </footer>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// SHARED INVESTOR PIPELINE (read-only)
// ═════════════════════════════════════════════════════════════════════════════

function SharedInvestorPipeline({ payload, createdAt }: { payload: Record<string, any>; createdAt: string }) {
  const p = payload;
  const sharedDate = new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const matches = p.matches || [];
  const summary = p.summary || {};

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      {/* Shared badge */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium">pythh.ai</Link>
            <span className="text-zinc-800">·</span>
            <span className="text-[11px] uppercase tracking-[1.5px] text-zinc-600">Shared pipeline</span>
          </div>
          <span className="text-[11px] text-zinc-700 tabular-nums hidden sm:inline">Snapshot from {sharedDate}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-20">

        {/* Identity */}
        <header className="mb-10">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500">deal flow pipeline</p>
          </div>
          <h1 className="text-[22px] sm:text-[28px] font-semibold text-zinc-100 leading-tight">{p.investor_name || 'Investor'}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {[p.firm, p.title].filter(Boolean).join(' · ')}
            {p.sectors?.length > 0 && <> · {p.sectors.slice(0, 3).join(', ')}</>}
          </p>
          {p.check_size && (
            <p className="text-zinc-600 text-xs mt-2">Check size: <span className="text-zinc-400">{p.check_size}</span></p>
          )}
        </header>

        {/* Pipeline summary */}
        {(summary.total_in_flow != null || summary.strong_alignment_count != null) && (
          <section className="mb-10">
            <h2 className="text-[15px] font-medium text-zinc-300 mb-4">Pipeline overview</h2>
            <div className="border border-zinc-800/50 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800/50">
                {summary.total_in_flow != null && (
                  <div className="px-4 py-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">In flow</p>
                    <p className="text-[22px] font-semibold tabular-nums text-zinc-100">{summary.total_in_flow}</p>
                  </div>
                )}
                {summary.new_this_week != null && (
                  <div className="px-4 py-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">New this week</p>
                    <p className="text-[22px] font-semibold tabular-nums text-cyan-400">{summary.new_this_week}</p>
                  </div>
                )}
                {summary.strong_alignment_count != null && (
                  <div className="px-4 py-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">Strong alignment</p>
                    <p className="text-[22px] font-semibold tabular-nums text-emerald-400">{summary.strong_alignment_count}</p>
                  </div>
                )}
                {summary.quality_trend && (
                  <div className="px-4 py-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">Quality trend</p>
                    <p className={`text-[22px] font-semibold ${summary.quality_trend === 'improving' ? 'text-emerald-400' : summary.quality_trend === 'declining' ? 'text-red-400' : 'text-zinc-500'}`}>
                      {summary.quality_trend === 'improving' ? '↑' : summary.quality_trend === 'declining' ? '↓' : '—'} {summary.quality_trend}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Matched Startups */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Deal flow</h2>
            <span className="text-xs text-zinc-500 tabular-nums">{matches.length} startups</span>
          </div>

          {matches.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {/* Header */}
              <div className="grid grid-cols-[1fr_4rem_4rem] gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-600">
                <span>Startup</span>
                <span className="text-right">GOD</span>
                <span className="text-right">Match</span>
              </div>

              {matches.map((m: any, i: number) => (
                <div key={i} className="grid grid-cols-[1fr_4rem_4rem] gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{m.name || 'Startup'}</p>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-600 mt-0.5">
                      {m.stage && <span>{m.stage}</span>}
                      {m.sectors?.length > 0 && (
                        <>
                          {m.stage && <span>·</span>}
                          <span className="truncate">{m.sectors.slice(0, 2).join(', ')}</span>
                        </>
                      )}
                    </div>
                    {m.reasons?.length > 0 && (
                      <p className="text-[11px] text-zinc-700 mt-0.5 truncate">{m.reasons[0]}</p>
                    )}
                  </div>
                  <span className={`text-xs tabular-nums text-right self-center ${qualityColor(m.god_score || 0)}`}>
                    {m.god_score ?? '—'}
                  </span>
                  <span className={`text-xs tabular-nums text-right self-center ${qualityColor(m.match_score || 0)}`}>
                    {m.match_score ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">No startups included in this pipeline snapshot.</p>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-800/50 pt-6 text-center">
          <p className="text-zinc-600 text-xs">
            Shared from <Link to="/" className="text-cyan-400/70 hover:text-cyan-400 transition-colors">pythh.ai</Link> · Read-only snapshot · {sharedDate}
          </p>
        </footer>
      </div>
    </div>
  );
}
