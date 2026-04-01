/**
 * INVESTOR MATCH FEED — Pythh Signal Intelligence
 * ══════════════════════════════════════════════════════════════════════════
 * An investor sets their thesis (sector, stage, geography, check size) and
 * sees a personalized feed of startups ranked by signal strength, trajectory
 * alignment, and urgency — powered by the Pythh Signal Intelligence engine.
 *
 * Route: /investor/signal-matches
 * ══════════════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { InvestorSignalAlertStrip } from '../components/pythh/InvestorSignalAlertStrip';
import {
  DollarSign, TrendingUp, Target, AlertTriangle, Activity,
  Filter, Search, RefreshCw, ArrowLeft, Zap, Users, Globe,
  ChevronRight, Flame, CheckCircle2, Radio, Building,
  Rocket, GitBranch, BookmarkPlus, X, SlidersHorizontal,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MatchRow {
  id:                  string;
  entity_name?:        string;
  entity_stage?:       string;
  entity_sectors?:     string[];
  candidate_name?:     string;
  candidate_type?:     string;
  match_type:          string;
  match_score:         number;
  timing_score?:       number;
  confidence?:         number;
  urgency?:            string;
  trajectory_used?:    string;
  predicted_need?:     string[];
  supporting_signals?: string[];
  explanation?:        string[];
  recommended_action?: string;
  dimension_scores?:   Record<string, number>;
  matched_at:          string;
}

interface InvestorPrefs {
  sectors:    string[];
  stages:     string[];
  geography:  string[];
  checkMin:   number | null;
  checkMax:   number | null;
  urgency:    string;
  sortBy:     string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_SECTORS = [
  'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech', 'Enterprise Software',
  'Developer Tools', 'Cybersecurity', 'Logistics', 'Robotics', 'B2B', 'Consumer',
  'Marketplace', 'EdTech', 'Biotech', 'Climate', 'Data Infrastructure', 'Web3',
  'Space Tech', 'Defense Tech', 'Hardware', 'Automation', 'E-Commerce',
];
const ALL_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage'];
const ALL_GEO    = ['US', 'Europe', 'UK', 'APAC', 'India', 'LATAM', 'MENA', 'Africa', 'Global'];

const TRAJ_META: Record<string, { label: string; color: string }> = {
  fundraising_active: { label: 'Fundraising',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  gtm_expansion:      { label: 'GTM Expansion', color: 'text-amber-400   border-amber-500/30   bg-amber-500/10'   },
  growth:             { label: 'Growth',         color: 'text-teal-400    border-teal-500/30    bg-teal-500/10'    },
  product_maturation: { label: 'Product Build',  color: 'text-sky-400     border-sky-500/30     bg-sky-500/10'     },
  exit_preparation:   { label: 'Exit Prep',      color: 'text-violet-400  border-violet-500/30  bg-violet-500/10'  },
  distress_survival:  { label: 'Distress',       color: 'text-red-400     border-red-500/30     bg-red-500/10'     },
  repositioning:      { label: 'Repositioning',  color: 'text-orange-400  border-orange-500/30  bg-orange-500/10'  },
  expansion:          { label: 'Expansion',      color: 'text-teal-400    border-teal-500/30    bg-teal-500/10'    },
  unknown:            { label: 'Unknown',        color: 'text-zinc-500    border-zinc-600       bg-zinc-800'       },
};

const SIGNAL_LABELS: Record<string, string> = {
  fundraising_signal: 'Fundraising', acquisition_signal: 'Acquisition',
  exit_signal: 'Exit Prep', distress_signal: 'Distress', revenue_signal: 'Revenue',
  hiring_signal: 'Hiring', enterprise_signal: 'Enterprise', expansion_signal: 'Expansion',
  gtm_signal: 'GTM Build', demand_signal: 'Demand', growth_signal: 'Growth',
  product_signal: 'Product', partnership_signal: 'Partnership', buyer_signal: 'Buying',
};

const URGENCY_COLOR: Record<string, string> = {
  high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-zinc-500',
};

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function TagPill({
  label, selected, onToggle,
}: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
        selected
          ? 'bg-amber-500 text-black border-amber-500'
          : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────
function InvestorMatchCard({ row, onAct }: { row: MatchRow; onAct: (row: MatchRow, action: string) => void }) {
  const traj     = TRAJ_META[row.trajectory_used ?? 'unknown'] ?? TRAJ_META.unknown;
  const scorePct = Math.round((row.match_score || 0) * 100);
  const scoreBar = scorePct >= 75 ? 'bg-emerald-500' : scorePct >= 55 ? 'bg-amber-500' : 'bg-orange-500';
  const isHot    = row.urgency === 'high';

  return (
    <div className={`relative bg-white/[0.03] border rounded-2xl overflow-hidden transition-all hover:bg-white/[0.05] ${
      isHot ? 'border-orange-500/30 ring-1 ring-orange-500/10' : 'border-white/8'
    }`}>
      {isHot && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 z-10">
          <Flame className="w-2.5 h-2.5" /> Hot signal
        </div>
      )}

      <div className="p-5">
        {/* Startup identity */}
        <div className="mb-3">
          <div className="flex items-start gap-2 flex-wrap mb-1.5">
            <span className="text-white font-bold text-lg">{row.entity_name || '—'}</span>
            {row.entity_stage && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-zinc-400 border border-white/10 mt-0.5">
                {row.entity_stage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(row.entity_sectors || []).slice(0, 3).map(s => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {s}
              </span>
            ))}
            {row.trajectory_used && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${traj.color}`}>
                <TrendingUp className="w-2.5 h-2.5" />
                {traj.label}
              </span>
            )}
          </div>
        </div>

        {/* Match score bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-zinc-500">Match strength</span>
            <span className="text-white font-bold text-sm">{scorePct}%</span>
          </div>
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBar}`} style={{ width: `${scorePct}%` }} />
          </div>
        </div>

        {/* Signal evidence */}
        {(row.supporting_signals || []).length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Signals detected</p>
            <div className="flex flex-wrap gap-1">
              {(row.supporting_signals || []).slice(0, 4).map(s => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/8">
                  {SIGNAL_LABELS[s] ?? s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Why this match */}
        {(row.explanation || []).length > 0 && (
          <div className="mb-4 space-y-1">
            {(row.explanation || []).slice(0, 2).map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                <CheckCircle2 className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Dimension scores */}
        {row.dimension_scores && Object.keys(row.dimension_scores).length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            {Object.entries(row.dimension_scores).slice(0, 6).map(([key, val]) => (
              <div key={key} className="text-center bg-white/[0.02] rounded-lg py-1.5 border border-white/5">
                <div className="text-[12px] text-white font-semibold">{Math.round((val as number) * 100)}%</div>
                <div className="text-[9px] text-zinc-600 capitalize">{key.replace(/_fit|_/g, ' ').trim()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/5">
          <button
            onClick={() => onAct(row, 'reach_out')}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-colors"
          >
            Reach Out
          </button>
          <button
            onClick={() => onAct(row, 'monitor')}
            className="py-2 px-3 text-sm rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 transition-colors"
            title="Add to watchlist"
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAct(row, 'pass')}
            className="py-2 px-3 text-sm rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
            title="Pass"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 24;

export default function InvestorMatchFeedPage() {
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState<InvestorPrefs>({
    sectors:   [],
    stages:    [],
    geography: [],
    checkMin:  null,
    checkMax:  null,
    urgency:   'all',
    sortBy:    'score',
  });
  const [showPrefs, setShowPrefs]     = useState(true);
  const [allMatches, setAllMatches]   = useState<MatchRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(0);
  const [acted, setActed]             = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pythh_top_matches')
        .select('*')
        .eq('match_type', 'capital_match')
        .order('match_score', { ascending: false })
        .limit(500);

      const { data, error } = await query;
      if (error) throw error;
      setAllMatches((data || []) as MatchRow[]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Match load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);
  useEffect(() => { setPage(0); }, [prefs, search]);

  // ── Client-side preference filtering ────────────────────────────────────
  const filtered = allMatches
    .filter(m => {
      // Sector filter
      if (prefs.sectors.length > 0) {
        const matchSectors = (m.entity_sectors || []).map(s => s.toLowerCase());
        const hit = prefs.sectors.some(p => matchSectors.some(s => s.includes(p.toLowerCase())));
        if (!hit) return false;
      }
      // Stage filter
      if (prefs.stages.length > 0) {
        const entityStage = (m.entity_stage || '').toLowerCase();
        const hit = prefs.stages.some(s => entityStage.includes(s.toLowerCase()));
        if (!hit) return false;
      }
      // Urgency filter
      if (prefs.urgency !== 'all' && m.urgency !== prefs.urgency) return false;
      // Search
      if (search) {
        const q = search.toLowerCase();
        if (!(m.entity_name || '').toLowerCase().includes(q) &&
            !(m.candidate_name || '').toLowerCase().includes(q)) return false;
      }
      // Hide passed items
      if (acted[m.id] === 'pass') return false;
      return true;
    })
    .sort((a, b) => {
      if (prefs.sortBy === 'urgency') {
        const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (rank[b.urgency ?? ''] ?? 0) - (rank[a.urgency ?? ''] ?? 0);
      }
      if (prefs.sortBy === 'confidence') return (b.confidence ?? 0) - (a.confidence ?? 0);
      return (b.match_score ?? 0) - (a.match_score ?? 0);
    });

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const pageSlice   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hotCount    = filtered.filter(m => m.urgency === 'high').length;

  function toggleSector(s: string) {
    setPrefs(p => ({
      ...p, sectors: p.sectors.includes(s) ? p.sectors.filter(x => x !== s) : [...p.sectors, s],
    }));
  }
  function toggleStage(s: string) {
    setPrefs(p => ({
      ...p, stages: p.stages.includes(s) ? p.stages.filter(x => x !== s) : [...p.stages, s],
    }));
  }

  function handleAct(row: MatchRow, action: string) {
    setActed(prev => ({ ...prev, [row.id]: action }));
    if (action === 'reach_out') {
      const text = `Pythh Match: ${row.entity_name}\nMatch score: ${Math.round((row.match_score || 0) * 100)}%\n${(row.explanation || []).slice(0, 2).join('\n')}`;
      navigator.clipboard?.writeText(text);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <LogoDropdownMenu />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-amber-400">[pyth]</span>
                <span className="text-white"> Investor Match Feed</span>
              </h1>
              <p className="text-zinc-500 mt-1 text-sm">
                Signal-driven startup matches — ranked by trajectory, urgency, and thesis fit.
                {lastUpdated && (
                  <span className="text-zinc-600 ml-2">Updated {lastUpdated.toLocaleTimeString()}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPrefs(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all ${
                showPrefs
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {prefs.sectors.length + prefs.stages.length > 0
                ? `${prefs.sectors.length + prefs.stages.length} filters`
                : 'Set Thesis'
              }
            </button>
            <button
              onClick={loadMatches}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Thesis preference panel */}
        {showPrefs && (
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Your Investment Thesis
              </h2>
              {(prefs.sectors.length + prefs.stages.length) > 0 && (
                <button
                  onClick={() => setPrefs(p => ({ ...p, sectors: [], stages: [], geography: [] }))}
                  className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Building className="w-3 h-3" /> Sectors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SECTORS.map(s => (
                    <TagPill key={s} label={s} selected={prefs.sectors.includes(s)} onToggle={() => toggleSector(s)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Rocket className="w-3 h-3" /> Stage
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STAGES.map(s => (
                    <TagPill key={s} label={s} selected={prefs.stages.includes(s)} onToggle={() => toggleStage(s)} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/5">
                <div>
                  <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Urgency</p>
                  <div className="flex gap-1.5">
                    {[
                      { v: 'all',    l: 'All' },
                      { v: 'high',   l: '🔴 High' },
                      { v: 'medium', l: '🟡 Medium' },
                    ].map(({ v, l }) => (
                      <button key={v} onClick={() => setPrefs(p => ({ ...p, urgency: v }))}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                          prefs.urgency === v
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                        }`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Sort by</p>
                  <div className="flex gap-1.5">
                    {[
                      { v: 'score',      l: 'Score' },
                      { v: 'urgency',    l: 'Urgency' },
                      { v: 'confidence', l: 'Confidence' },
                    ].map(({ v, l }) => (
                      <button key={v} onClick={() => setPrefs(p => ({ ...p, sortBy: v }))}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                          prefs.sortBy === v
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                        }`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Search</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                    <input
                      type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Company name…"
                      className="pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signal Alert Strip — high-velocity startups in investor's thesis */}
        <div className="mb-8">
          <InvestorSignalAlertStrip
            sectors={prefs.sectors}
            stages={prefs.stages}
            maxAlerts={4}
            onSelectStartup={(id) => navigate(`/lookup/startup/${id}`)}
          />
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Investor Matches',  value: allMatches.length.toLocaleString(),  icon: <Target className="w-4 h-4" />,     color: 'text-amber-400'   },
            { label: 'After Your Thesis', value: filtered.length.toLocaleString(),    icon: <Filter className="w-4 h-4" />,     color: 'text-cyan-400'    },
            { label: 'Hot Signals',       value: hotCount.toLocaleString(),            icon: <Flame className="w-4 h-4" />,      color: 'text-orange-400'  },
            { label: 'Actioned',          value: Object.keys(acted).length,            icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className={color}>{icon}</span>
              <div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-zinc-600 text-[11px]">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Thesis hint when no filters set */}
        {prefs.sectors.length === 0 && prefs.stages.length === 0 && !search && (
          <div className="mb-4 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[12px] text-amber-400/70 flex items-start gap-2">
            <Target className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Showing all {allMatches.length.toLocaleString()} investor matches. Set your thesis above to filter by sector, stage, and urgency.
            </span>
          </div>
        )}

        {/* Results + pagination header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-zinc-500">
            <span className="text-white font-medium">{filtered.length.toLocaleString()}</span> matches
            {hotCount > 0 && (
              <span className="ml-2 text-orange-400 font-medium">· {hotCount} hot</span>
            )}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">←</button>
              <span className="text-zinc-600 text-sm">{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">→</button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Radio className="w-8 h-8 text-amber-400 animate-pulse" />
            <span className="text-zinc-400 ml-3">Loading signal intelligence…</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24 text-zinc-600">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No matches for this thesis.</p>
            <p className="text-sm mt-1">Try broadening your sector or stage filters.</p>
          </div>
        )}

        {/* Match grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageSlice.map(m => (
              <InvestorMatchCard key={m.id} row={m} onAct={handleAct} />
            ))}
          </div>
        )}

        {/* Footer pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-8">
            <button disabled={page === 0}
              onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm">
              ← Prev
            </button>
            <span className="text-zinc-600 text-sm">{page + 1} of {totalPages}</span>
            <button disabled={page >= totalPages - 1}
              onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm">
              Next →
            </button>
          </div>
        )}

        {/* Signal legend */}
        <div className="mt-12 p-5 bg-white/[0.02] border border-white/8 rounded-2xl">
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> How Pythh Match Scoring Works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
            {[
              { icon: <Radio className="w-3.5 h-3.5 text-amber-400" />,   label: 'Signal Detection',   desc: 'Language extracted from startup news, blogs, and press releases — 6–18 months before major events.' },
              { icon: <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />, label: 'Trajectory Engine', desc: 'Signal sequences build a company trajectory (fundraising → GTM → scale) for predictive matching.' },
              { icon: <Target className="w-3.5 h-3.5 text-emerald-400" />, label: 'Match Scoring',      desc: 'Six dimensions: sector, stage, need, trajectory, geography, and signal alignment.' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                {icon}
                <div>
                  <div className="text-zinc-300 font-medium mb-0.5">{label}</div>
                  <div className="text-zinc-600 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
