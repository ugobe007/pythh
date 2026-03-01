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

function godBadgeColor(score: number) {
  if (score >= 85) return '#00e5a0';
  if (score >= 70) return '#ff6600';
  return '#888';
}

function statusChip(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:      { label: 'Active',      bg: '#0a2a0a', color: '#00e5a0' },
    acquired:    { label: 'Acquired 🎯', bg: '#1a1a00', color: '#ffd700' },
    ipo:         { label: 'IPO 🚀',      bg: '#0a001a', color: '#a78bfa' },
    exited:      { label: 'Exited',      bg: '#111',    color: '#888' },
    written_off: { label: 'Written Off', bg: '#1a0000', color: '#ef4444' },
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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '20px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#ff6600', letterSpacing: '-1px' }}>Pythh</span>
          </Link>
          <nav style={{ display: 'flex', gap: 24, fontSize: 14, color: '#888' }}>
            <Link to="/rankings" style={{ color: '#888', textDecoration: 'none' }}>Rankings</Link>
            <Link to="/explore" style={{ color: '#888', textDecoration: 'none' }}>Explore</Link>
            <span style={{ color: '#ff6600' }}>Portfolio</span>
          </nav>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {/* ── Hero ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Award size={20} color="#ff6600" />
            <span style={{ fontSize: 13, color: '#ff6600', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>
              Virtual Portfolio
            </span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, margin: 0, lineHeight: 1.1, letterSpacing: '-2px' }}>
            Our best startup picks.
          </h1>
          <p style={{ color: '#888', fontSize: 16, marginTop: 12, maxWidth: 540, lineHeight: 1.6 }}>
            Every startup that crosses a GOD score of 70 gets added to the Pythh virtual fund.
            We track them like YC — watching for funding rounds, acquisitions, and IPOs.
          </p>
        </div>

        {/* ── Metrics Bar ── */}
        {metrics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            marginBottom: 48,
          }}>
            {[
              { icon: <Target size={16} />, label: 'Total Picks', value: String(metrics.total_picks ?? 0), sub: `${metrics.active_picks ?? 0} active` },
              { icon: <TrendingUp size={16} />, label: 'Win Rate', value: metrics.win_rate_pct ? `${metrics.win_rate_pct}%` : '—', sub: 'funded or exited' },
              { icon: <Star size={16} />, label: 'Avg MOIC', value: metrics.avg_moic ? `${metrics.avg_moic}×` : '—', sub: `best: ${metrics.best_moic ? `${metrics.best_moic}×` : '—'}` },
              { icon: <DollarSign size={16} />, label: 'Virtual Capital', value: formatUSD(metrics.total_virtual_deployed_usd), sub: '$100K / pick' },
              { icon: <Award size={16} />, label: 'Exits', value: String(metrics.successful_exits ?? 0), sub: `${metrics.acquisitions ?? 0} acq · ${metrics.ipos ?? 0} IPO` },
            ].map((m) => (
              <div key={m.label} style={{
                background: '#111',
                border: '1px solid #1e1e1e',
                borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff6600', marginBottom: 8 }}>
                  {m.icon}
                  <span style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>{m.value}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['all', 'active', 'exited'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: filter === f ? '1px solid #ff6600' : '1px solid #2a2a2a',
                background: filter === f ? '#ff660022' : 'transparent',
                color: filter === f ? '#ff6600' : '#666',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {f} {f === 'all' ? `(${entries.length})` : f === 'active' ? `(${entries.filter(e => e.status === 'active').length})` : `(${exits.length})`}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#444' }}>
            <Activity size={28} style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }} />
            Loading portfolio…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#ef4444' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#444' }}>No entries yet. Portfolio builds automatically as startups cross GOD 70.</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {filtered.map((entry) => (
              <PortfolioCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* ── How We Pick ── */}
        <div style={{
          marginTop: 80,
          padding: '40px',
          background: '#111',
          border: '1px solid #1e1e1e',
          borderRadius: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Zap size={18} color="#ff6600" />
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>How the Pythh Fund works</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {[
              { step: '01', title: 'GOD Score ≥ 70', desc: 'Every approved startup that scores 70 or higher on the proprietary GOD algorithm is automatically added.' },
              { step: '02', title: '$100K virtual check', desc: 'We log a $100,000 virtual investment at the estimated entry valuation at time of picking.' },
              { step: '03', title: 'We track everything', desc: 'Funding rounds, lead investors, post-money valuations, acquisitions, and IPOs are all logged.' },
              { step: '04', title: 'MOIC + IRR', desc: 'As valuations update we compute unrealised MOIC and annualised IRR just like a real fund.' },
            ].map((s) => (
              <div key={s.step}>
                <div style={{ fontSize: 11, color: '#ff6600', fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>STEP {s.step}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{s.desc}</div>
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
  const scoreColor = godBadgeColor(entry.entry_god_score);
  const isExit = ['acquired', 'ipo', 'exited'].includes(entry.status);
  const moicDelta = entry.moic ? entry.moic - 1 : 0;

  return (
    <div style={{
      background: '#111',
      border: '1px solid #1e1e1e',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 24,
      alignItems: 'center',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{entry.startup_name}</span>

          {/* Status chip */}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
            background: chip.bg, color: chip.color, border: `1px solid ${chip.color}44`,
          }}>{chip.label}</span>

          {/* GOD badge */}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
            background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}44`,
          }}>GOD {entry.entry_god_score}</span>

          {/* Round badge */}
          {entry.latest_round_type && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
              background: '#0a1a2a', color: '#60a5fa', border: '1px solid #1e3a5266',
            }}>{entry.latest_round_type} {entry.latest_round_post_money ? `· ${formatUSD(entry.latest_round_post_money)}` : ''}</span>
          )}
        </div>

        {/* Tagline */}
        {entry.tagline && (
          <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.4 }}>{entry.tagline}</p>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: '#555' }}>
            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Picked {formatDate(entry.entry_date)}
          </span>
          <span style={{ fontSize: 12, color: '#555' }}>Entry val: {formatUSD(entry.entry_valuation_usd)}</span>
          {entry.total_rounds_tracked ? (
            <span style={{ fontSize: 12, color: '#555' }}>{entry.total_rounds_tracked} round{entry.total_rounds_tracked > 1 ? 's' : ''} tracked</span>
          ) : null}
          {entry.latest_lead_investor && (
            <span style={{ fontSize: 12, color: '#555' }}>Lead: {entry.latest_lead_investor}</span>
          )}
          {isExit && entry.exit_acquirer && (
            <span style={{ fontSize: 12, color: '#ffd700' }}>Acquired by {entry.exit_acquirer}</span>
          )}
        </div>
      </div>

      {/* Right side — MOIC */}
      <div style={{ textAlign: 'right', minWidth: 100 }}>
        {entry.moic ? (
          <>
            <div style={{
              fontSize: 26, fontWeight: 900, letterSpacing: '-1px',
              color: moicDelta > 0 ? '#00e5a0' : moicDelta < 0 ? '#ef4444' : '#fff',
            }}>
              {entry.moic.toFixed(2)}×
            </div>
            <div style={{ fontSize: 11, color: '#555' }}>MOIC</div>
            {entry.irr_annualized != null && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                IRR {(entry.irr_annualized * 100).toFixed(1)}%
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 22, fontWeight: 800, color: '#333' }}>1.00×</div>
        )}

        {entry.website && (
          <a
            href={entry.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: '#555', textDecoration: 'none' }}
          >
            <ExternalLink size={11} /> Visit
          </a>
        )}
      </div>
    </div>
  );
}
