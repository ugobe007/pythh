/**
 * Pythh Virtual Portfolio — public page at /portfolio
 *
 * Shows the Pythh team's YC-style virtual picks:
 *  - Headline metrics bar (picks, win rate, avg MOIC, capital deployed)
 *  - Active portfolio grid
 *  - Exits + milestone events feed
 *  - "How we pick" explainer
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Award, DollarSign, Clock, Target, ChevronRight,
  Zap, ExternalLink, Star, ArrowUpRight, Activity
} from 'lucide-react';
import { apiUrl } from '../lib/apiConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  tagline?: string;
  website?: string;
  sectors?: string[];
  current_stage?: string;
  entry_date: string;
  entry_stage?: string;
  entry_god_score: number;
  current_god_score?: number;
  entry_valuation_usd?: number;
  current_valuation_usd?: number;
  virtual_check_usd: number;
  status: string;
  exit_date?: string;
  exit_type?: string;
  exit_valuation_usd?: number;
  exit_acquirer?: string;
  moic?: number;
  irr_annualized?: number;
  holding_days?: number;
  entry_rationale?: string;
  latest_round_type?: string;
  latest_round_post_money?: number;
  latest_lead_investor?: string;
  total_rounds_tracked?: number;
}

interface PortfolioMetrics {
  total_picks: number;
  active_picks: number;
  successful_exits: number;
  acquisitions: number;
  ipos: number;
  win_rate_pct: number;
  avg_moic: number | null;
  best_moic: number | null;
  total_virtual_deployed_usd: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatUSD(n?: number | null) {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function godBadgeColor(score: number): string {
  if (score >= 85) return 'text-emerald-400 border-emerald-400/50';
  if (score >= 70) return 'text-cyan-400 border-cyan-400/50';
  return 'text-white/50 border-white/20';
}

function statusChip(status: string) {
  const map: Record<string, { label: string; color: string; border: string }> = {
    active:      { label: 'Active',      color: 'text-emerald-400', border: 'border-emerald-400/50' },
    acquired:    { label: 'Acquired 🎯', color: 'text-cyan-400', border: 'border-cyan-400/50' },
    ipo:         { label: 'IPO 🚀',      color: 'text-cyan-400', border: 'border-cyan-400/50' },
    exited:      { label: 'Exited',      color: 'text-white/50', border: 'border-white/20' },
    written_off: { label: 'Written Off', color: 'text-red-400', border: 'border-red-400/50' },
  };
  return map[status] ?? map.active;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PortfolioPage() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'exited'>('all');
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [listRes, metricsRes] = await Promise.all([
        fetch(apiUrl('/api/portfolio')),
        fetch(apiUrl('/api/portfolio/metrics')),
      ]);

      if (!listRes.ok || !metricsRes.ok) throw new Error('Failed to load portfolio');

      const listData = await listRes.json();
      const metricsData = await metricsRes.json();

      setEntries(listData.entries ?? []);
      setMetrics(metricsData.metrics ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = entries.filter((e) => {
    if (filter === 'active') return e.status === 'active';
    if (filter === 'exited') return ['acquired', 'ipo', 'exited'].includes(e.status);
    return true;
  });

  const exits = entries.filter((e) => ['acquired', 'ipo', 'exited'].includes(e.status));
  
  // Collapse to 10, expand to 50
  const displayedEntries = showAll ? filtered.slice(0, 50) : filtered.slice(0, 10);
  const hasMore = filtered.length > (showAll ? 50 : 10);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Header ── */}
      <div className="border-b border-white/10 py-5">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2" aria-label="pythh.ai home">
            <img
              src="/images/pythh_oracle.png"
              alt=""
              className="h-9 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <span className="text-xs tracking-[0.25em] text-white/40 group-hover:text-white/60 hidden sm:inline">
              SIGNAL SCIENCE
            </span>
          </Link>
          <nav className="flex gap-6 text-sm text-white/50">
            <Link to="/rankings" className="hover:text-white transition-colors">Rankings</Link>
            <Link to="/explore" className="hover:text-white transition-colors">Explore</Link>
            <span className="text-cyan-400">Portfolio</span>
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* ── Hero ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Award size={20} className="text-emerald-400" />
            <span className="text-xs text-emerald-400 uppercase tracking-wider font-semibold">
              Virtual Portfolio
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            The Oracle's Picks
          </h1>
          <p className="text-white/60 text-base max-w-2xl leading-relaxed">
            Every startup that crosses a GOD score of 70 gets added to the Pythh virtual fund.
            We track them like YC — watching for funding rounds, acquisitions, and IPOs.
          </p>
        </div>

        {/* ── Metrics Bar ── */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            {[
              { icon: <Target size={16} />, label: 'Total Picks', value: String(metrics.total_picks ?? 0), sub: `${metrics.active_picks ?? 0} active` },
              { icon: <TrendingUp size={16} />, label: 'Win Rate', value: metrics.win_rate_pct ? `${metrics.win_rate_pct}%` : '—', sub: 'funded or exited' },
              { icon: <Star size={16} />, label: 'Avg MOIC', value: metrics.avg_moic ? `${metrics.avg_moic}×` : '—', sub: `best: ${metrics.best_moic ? `${metrics.best_moic}×` : '—'}` },
              { icon: <DollarSign size={16} />, label: 'Virtual Capital', value: formatUSD(metrics.total_virtual_deployed_usd), sub: '$100K / pick' },
              { icon: <Award size={16} />, label: 'Exits', value: String(metrics.successful_exits ?? 0), sub: `${metrics.acquisitions ?? 0} acq · ${metrics.ipos ?? 0} IPO` },
            ].map((m) => (
              <div key={m.label} className="border border-white/10 rounded-lg p-5">
                <div className="flex items-center gap-2 text-cyan-400 mb-2">
                  {m.icon}
                  <span className="text-xs text-white/50 uppercase tracking-wider">{m.label}</span>
                </div>
                <div className="text-2xl font-bold tracking-tight">{m.value}</div>
                <div className="text-xs text-white/50 mt-1">{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'exited'] as const).map((f) => {
            const count = f === 'all' ? entries.length : f === 'active' ? entries.filter(e => e.status === 'active').length : exits.length;
            return (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setShowAll(false); // Reset to collapsed when changing filter
                }}
                className={`px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-colors ${
                  filter === f
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-white/20 text-white/50 hover:text-white hover:border-white/40'
                }`}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="text-center py-20 text-white/40">
            <Activity size={28} className="mx-auto mb-3 animate-spin" />
            Loading portfolio…
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/40">No entries yet. Portfolio builds automatically as startups cross GOD 70.</div>
        ) : (
          <>
            <div className="space-y-4">
              {displayedEntries.map((entry) => (
                <PortfolioCard key={entry.id} entry={entry} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-6 py-2 border border-cyan-400/50 text-cyan-400 rounded-lg hover:border-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold"
                >
                  {showAll ? 'Show Less' : `Show All (${filtered.length})`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── How We Pick ── */}
        <div className="mt-20 border border-white/10 rounded-lg p-10">
          <div className="flex items-center gap-2 mb-6">
            <Zap size={18} className="text-emerald-400" />
            <h2 className="text-xl font-bold">How the Pythh Fund works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'GOD Score ≥ 70', desc: 'Every approved startup that scores 70 or higher on the proprietary GOD algorithm is automatically added.' },
              { step: '02', title: '$100K virtual check', desc: 'We log a $100,000 virtual investment at the estimated entry valuation at time of picking.' },
              { step: '03', title: 'We track everything', desc: 'Funding rounds, lead investors, post-money valuations, acquisitions, and IPOs are all logged.' },
              { step: '04', title: 'MOIC + IRR', desc: 'As valuations update we compute unrealised MOIC and annualised IRR just like a real fund.' },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-xs text-cyan-400 font-bold tracking-wider mb-2">STEP {s.step}</div>
                <div className="text-base font-semibold mb-2">{s.title}</div>
                <div className="text-sm text-white/60 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio Card
// ---------------------------------------------------------------------------
function PortfolioCard({ entry }: { entry: PortfolioEntry }) {
  const chip = statusChip(entry.status);
  const scoreColorClass = godBadgeColor(entry.entry_god_score);
  const isExit = ['acquired', 'ipo', 'exited'].includes(entry.status);
  const moicDelta = entry.moic ? entry.moic - 1 : 0;

  return (
    <div className="border border-white/10 rounded-lg p-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center hover:border-cyan-400/30 transition-colors">
      <div className="flex flex-col gap-2">
        {/* Name row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg font-semibold">{entry.startup_name}</span>

          {/* Status chip */}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${chip.color} ${chip.border}`}>
            {chip.label}
          </span>

          {/* GOD badge */}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreColorClass}`}>
            GOD {entry.entry_god_score}
          </span>

          {/* Round badge */}
          {entry.latest_round_type && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-cyan-400/50 text-cyan-400">
              {entry.latest_round_type} {entry.latest_round_post_money ? `· ${formatUSD(entry.latest_round_post_money)}` : ''}
            </span>
          )}
        </div>

        {/* Tagline */}
        {entry.tagline && (
          <p className="text-sm text-white/60 m-0 leading-relaxed">{entry.tagline}</p>
        )}

        {/* Meta row */}
        <div className="flex gap-5 flex-wrap mt-1">
          <span className="text-xs text-white/50 flex items-center gap-1">
            <Clock size={11} />
            Picked {formatDate(entry.entry_date)}
          </span>
          <span className="text-xs text-white/50">Entry val: {formatUSD(entry.entry_valuation_usd)}</span>
          {entry.total_rounds_tracked ? (
            <span className="text-xs text-white/50">{entry.total_rounds_tracked} round{entry.total_rounds_tracked > 1 ? 's' : ''} tracked</span>
          ) : null}
          {entry.latest_lead_investor && (
            <span className="text-xs text-white/50">Lead: {entry.latest_lead_investor}</span>
          )}
          {isExit && entry.exit_acquirer && (
            <span className="text-xs text-cyan-400">Acquired by {entry.exit_acquirer}</span>
          )}
        </div>
      </div>

      {/* Right side — MOIC */}
      <div className="text-right min-w-[100px]">
        {entry.moic ? (
          <>
            <div className={`text-2xl font-bold tracking-tight ${
              moicDelta > 0 ? 'text-emerald-400' : moicDelta < 0 ? 'text-red-400' : 'text-white'
            }`}>
              {entry.moic.toFixed(2)}×
            </div>
            <div className="text-xs text-white/50">MOIC</div>
            {entry.irr_annualized != null && (
              <div className="text-xs text-white/50 mt-1">
                IRR {(entry.irr_annualized * 100).toFixed(1)}%
              </div>
            )}
          </>
        ) : (
          <div className="text-xl font-bold text-white/30">1.00×</div>
        )}

        {entry.website && (
          <a
            href={entry.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-white/50 hover:text-cyan-400 transition-colors"
          >
            <ExternalLink size={11} /> Visit
          </a>
        )}
      </div>
    </div>
  );
}
