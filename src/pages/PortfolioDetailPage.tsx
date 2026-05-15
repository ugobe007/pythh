/**
 * Portfolio Company Detail Page — /portfolio/:startupId
 *
 * Shows the full dossier on a single portfolio pick:
 *   - Headline stats (GOD score, health tier, MOIC, exit propensity)
 *   - Pillar scorecard (Team / Traction / Market / Product)
 *   - Timeline of portfolio events
 *   - Goldilocks / maturity analysis
 *   - Deal positioning & investor matches
 *   - Outreach status
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Minus,
  Zap, Users, Target, Package, Activity, Clock, Award,
  ChevronRight, AlertTriangle, CheckCircle, Circle,
} from 'lucide-react';
import { apiUrl } from '../lib/apiConfig';
import { healthTierChipClass, healthTierLabel } from '../lib/portfolioHealth';
import { MATURITY_SHORT, maturityBadgeClass, normalizeMaturityLevel } from '../lib/maturityUi';

// ── Types ────────────────────────────────────────────────────────────────────
interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  tagline?: string;
  website?: string;
  sectors?: string[];
  entry_date: string;
  entry_stage?: string;
  entry_god_score: number;
  current_god_score?: number;
  entry_valuation_usd?: number;
  current_valuation_usd?: number;
  virtual_check_usd: number;
  status: string;
  moic?: number;
  irr_annualized?: number;
  holding_days?: number;
  entry_rationale?: string;
  notes?: string;
  health_tier?: string;
  god_delta?: number;
  sector_god_percentile?: number;
  pillar_spread?: number;
  pillar_min?: number;
  events_last_180d?: number;
  days_since_last_event?: number;
  maturity_level?: string;
  maturity_score?: number;
  maturity_gaps?: string[];
  goldilocks_alignment?: string;
  goldilocks_maturity_gap?: number;
  in_goldilocks_god_zone?: boolean;
  exit_propensity_score?: number;
  exit_propensity_tier?: string;
  exit_propensity_confidence?: number;
  exit_propensity_breakdown?: Record<string, unknown>;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  latest_round_type?: string;
  latest_round_post_money?: number;
  latest_lead_investor?: string;
  total_rounds_tracked?: number;
}

interface PortfolioEvent {
  id: string;
  event_type: string;
  event_date: string;
  amount_usd?: number;
  round_type?: string;
  lead_investor?: string;
  headline?: string;
  god_score_before?: number;
  god_score_after?: number;
  verified?: boolean;
}

interface DealPositioning {
  thesis_alignment: number;
  sector_fit: string;
  stage_fit: string;
  positioning_angle: string;
  key_signals: string[];
  signals_to_avoid: string[];
  suggested_subject: string;
  suggested_opening: string;
  investors?: { id: string; name: string; firm: string; url?: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtUSD(n?: number | null) {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PillarBar({ label, score, icon: Icon, color }: { label: string; score?: number; icon: React.ElementType; color: string }) {
  const s = score ?? 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-white/70"><Icon size={12} />{label}</span>
        <span className={`font-semibold ${s >= 70 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{s}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${s}%` }} />
      </div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    funding_round:    { label: '💰 Funding', cls: 'border-emerald-400/50 text-emerald-400' },
    god_score_change: { label: '📊 GOD Score', cls: 'border-cyan-400/50 text-cyan-400' },
    acquisition:      { label: '🏢 Acquisition', cls: 'border-purple-400/50 text-purple-400' },
    ipo:              { label: '📈 IPO', cls: 'border-amber-400/50 text-amber-400' },
    revenue_milestone:{ label: '💵 Revenue', cls: 'border-emerald-400/50 text-emerald-300' },
    product_launch:   { label: '🚀 Launch', cls: 'border-blue-400/50 text-blue-400' },
    team_milestone:   { label: '👥 Team', cls: 'border-white/30 text-white/70' },
    prediction_hit:   { label: '🎯 Prediction Hit', cls: 'border-amber-400/50 text-amber-300' },
  };
  const cfg = map[type] || { label: type, cls: 'border-white/20 text-white/50' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
  );
}

function AlignmentBadge({ align }: { align?: string }) {
  if (!align || align === 'aligned') return null;
  if (align === 'thin_signals') return (
    <div className="flex items-start gap-2 text-amber-300/90 text-xs border-l-2 border-amber-500/60 pl-3 py-1">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <span>Goldilocks: maturity signals thin vs. what this GOD score implies. Review traction data freshness.</span>
    </div>
  );
  if (align === 'ahead_of_god') return (
    <div className="flex items-start gap-2 text-cyan-300/90 text-xs border-l-2 border-cyan-500/40 pl-3 py-1">
      <Zap size={12} className="mt-0.5 shrink-0" />
      <span>Maturity trajectory runs ahead of raw GOD score — richer signal history than the headline number.</span>
    </div>
  );
  return null;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PortfolioDetailPage() {
  const { startupId } = useParams<{ startupId: string }>();
  const [entry, setEntry]         = useState<PortfolioEntry | null>(null);
  const [events, setEvents]       = useState<PortfolioEvent[]>([]);
  const [positioning, setPos]     = useState<DealPositioning[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [posExpanded, setPosExp]  = useState(false);

  useEffect(() => {
    if (!startupId) return;
    setLoading(true);

    Promise.all([
      fetch(apiUrl(`/api/portfolio/${startupId}`)).then(r => r.json()),
      fetch(apiUrl(`/api/intelligence/positioning/${startupId}`)).then(r => r.json()).catch(() => ({ positioning: [] })),
    ]).then(([detail, pos]) => {
      setEntry(detail.entry || null);
      setEvents(detail.events || []);
      setPos(pos.positioning || []);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [startupId]);

  if (loading) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-white/50">
        <Activity size={24} className="animate-pulse" />
        <span className="text-sm">Loading portfolio data...</span>
      </div>
    </div>
  );

  if (error || !entry) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error || 'Company not found'}</p>
        <Link to="/portfolio" className="text-cyan-400 hover:underline text-sm flex items-center gap-1 justify-center">
          <ArrowLeft size={14} /> Back to portfolio
        </Link>
      </div>
    </div>
  );

  const delta = entry.god_delta ?? 0;
  const tier  = entry.health_tier || 'core';
  const matKey = normalizeMaturityLevel(entry.maturity_level ?? undefined);
  const matMeta = matKey ? MATURITY_SHORT[matKey] : null;
  const moicDelta = (entry.moic || 1) - 1;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* ── Back nav ─────────────────────────────────────────────── */}
        <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-cyan-400 transition-colors">
          <ArrowLeft size={14} /> Portfolio
        </Link>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{entry.startup_name}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${healthTierChipClass(tier)}`}>
                {healthTierLabel(tier)}
              </span>
              {matMeta && matKey && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${maturityBadgeClass(matKey)}`} title={matMeta.hint}>
                  {matMeta.label}
                </span>
              )}
              {entry.entry_stage && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-white/20 text-white/60">
                  {entry.entry_stage}
                </span>
              )}
            </div>
            {entry.tagline && <p className="text-white/60 text-sm max-w-xl">{entry.tagline}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-white/50">
              {entry.website && (
                <a href={entry.website} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
                  <ExternalLink size={11} /> {entry.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span className="flex items-center gap-1"><Clock size={11} /> Picked {fmtDate(entry.entry_date)}</span>
              {(entry.sectors || []).map(s => <span key={s} className="text-cyan-400/70">{s}</span>)}
            </div>
          </div>

          {/* MOIC */}
          <div className="text-right shrink-0">
            <div className={`text-4xl font-bold tracking-tight ${moicDelta > 0.05 ? 'text-emerald-400' : moicDelta < -0.05 ? 'text-red-400' : 'text-white'}`}>
              {(entry.moic || 1).toFixed(2)}×
            </div>
            <div className="text-xs text-white/40 mt-1">MOIC</div>
            {entry.irr_annualized != null && (
              <div className="text-xs text-white/50 mt-0.5">IRR {(entry.irr_annualized * 100).toFixed(1)}%</div>
            )}
          </div>
        </div>

        {/* ── Alignment insight ────────────────────────────────────── */}
        <AlignmentBadge align={entry.goldilocks_alignment} />

        {/* ── Stats grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'GOD Score', value: entry.current_god_score ?? entry.entry_god_score, sub: delta !== 0 ? `${delta > 0 ? '+' : ''}${delta} since entry` : 'no change', color: delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white' },
            { label: 'Entry GOD', value: entry.entry_god_score, sub: `Entry: ${fmtUSD(entry.entry_valuation_usd)}`, color: 'text-white' },
            { label: 'Current Val', value: fmtUSD(entry.current_valuation_usd), sub: `Entry: ${fmtUSD(entry.entry_valuation_usd)}`, color: 'text-white' },
            { label: 'Exit Propensity', value: entry.exit_propensity_score ? `${entry.exit_propensity_score}/100` : '—', sub: entry.exit_propensity_tier || '—', color: entry.exit_propensity_score && entry.exit_propensity_score >= 80 ? 'text-emerald-400' : 'text-amber-400' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-white/50 mb-1">{label}</div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-white/40 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Pillar scores ─────────────────────────────────────────── */}
        {(entry.team_score != null || entry.traction_score != null) && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">Pillar Scorecard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PillarBar label="Team"     score={entry.team_score}     icon={Users}   color="bg-cyan-500" />
              <PillarBar label="Traction" score={entry.traction_score} icon={TrendingUp} color="bg-emerald-500" />
              <PillarBar label="Market"   score={entry.market_score}   icon={Target}  color="bg-amber-500" />
              <PillarBar label="Product"  score={entry.product_score}  icon={Package} color="bg-purple-500" />
            </div>
            {entry.pillar_spread != null && (
              <div className="mt-4 text-xs text-white/50 flex gap-4">
                <span>Pillar spread: <span className={entry.pillar_spread > 40 ? 'text-amber-400' : 'text-white/70'}>{entry.pillar_spread} pts</span></span>
                {entry.sector_god_percentile != null && <span>Sector rank: <span className="text-white/70">{entry.sector_god_percentile.toFixed(0)}th pct</span></span>}
                {entry.maturity_score != null && <span>Maturity score: <span className="text-white/70">{entry.maturity_score}</span></span>}
              </div>
            )}
          </div>
        )}

        {/* ── Portfolio events timeline ─────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4 flex items-center justify-between">
            <span>Signal Timeline</span>
            <span className="text-white/30 font-normal normal-case">{events.length} events</span>
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-white/40 italic">No portfolio events logged yet. Run <code className="text-zinc-400">npm run portfolio:refresh</code> to scan for signals.</p>
          ) : (
            <div className="space-y-4">
              {events.map(ev => (
                <div key={ev.id} className="flex gap-4 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <EventBadge type={ev.event_type} />
                      <span className="text-xs text-white/40">{fmtDate(ev.event_date)}</span>
                      {ev.verified && <span className="text-xs text-emerald-400/70">✓ verified</span>}
                    </div>
                    <p className="text-sm text-white/80 mt-1">{ev.headline || ev.round_type}</p>
                    <div className="flex gap-3 mt-0.5 text-xs text-white/40">
                      {ev.amount_usd && <span>{fmtUSD(ev.amount_usd)}</span>}
                      {ev.lead_investor && <span>Led by {ev.lead_investor}</span>}
                      {ev.god_score_before != null && ev.god_score_after != null && (
                        <span>GOD {ev.god_score_before} → {ev.god_score_after}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Deal Positioning ──────────────────────────────────────── */}
        {positioning.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                Deal Positioning — {positioning.length} investors profiled
              </h2>
              <button onClick={() => setPosExp(x => !x)} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                {posExpanded ? 'Show less' : 'Show all'}
              </button>
            </div>
            <div className="space-y-4">
              {(posExpanded ? positioning : positioning.slice(0, 3)).map((pos, i) => (
                <div key={i} className="border border-white/10 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-medium text-sm">
                      {(pos as DealPositioning & { investors?: { name: string; firm?: string } }).investors?.name || 'Investor'}
                      {(pos as DealPositioning & { investors?: { firm?: string } }).investors?.firm && (
                        <span className="text-white/40 font-normal ml-2 text-xs">
                          {(pos as DealPositioning & { investors?: { firm?: string } }).investors?.firm}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pos.thesis_alignment >= 70 ? 'border-emerald-400/50 text-emerald-400' : pos.thesis_alignment >= 50 ? 'border-amber-400/50 text-amber-400' : 'border-red-400/50 text-red-400'}`}>
                        {pos.thesis_alignment}% thesis match
                      </div>
                      <span className="text-xs text-white/40">{pos.sector_fit} / {pos.stage_fit}</span>
                    </div>
                  </div>
                  {pos.positioning_angle && (
                    <p className="text-sm text-cyan-300/90 italic">"{pos.positioning_angle}"</p>
                  )}
                  {pos.suggested_subject && (
                    <div className="text-xs">
                      <span className="text-white/40">Subject: </span>
                      <span className="text-white/80">{pos.suggested_subject}</span>
                    </div>
                  )}
                  {pos.key_signals?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {pos.key_signals.map((sig, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 bg-emerald-400/10 text-emerald-300/80 rounded-full">
                          ✓ {sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Entry rationale ───────────────────────────────────────── */}
        {(entry.entry_rationale || entry.notes) && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">Entry Rationale</h2>
            <p className="text-sm text-white/70">{entry.entry_rationale}</p>
            {entry.notes && <p className="text-xs text-white/40 mt-2">{entry.notes}</p>}
          </div>
        )}

        {/* ── Footer nav ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <Link to="/portfolio" className="text-sm text-white/50 hover:text-cyan-400 flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} /> Back to portfolio
          </Link>
          <Link to="/intelligence" className="text-sm text-white/50 hover:text-cyan-400 flex items-center gap-1 transition-colors">
            Intelligence dashboard <ChevronRight size={14} />
          </Link>
        </div>

      </div>
    </div>
  );
}
