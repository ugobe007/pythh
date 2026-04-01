/**
 * FounderSignalsPage — /signals for Pythh
 * 
 * Layout:
 * - Header with nav
 * - Signal Flow Bars (7 animated horizontal bars)
 * - Expandable "What are signals?" blurb
 * - Sector signals table
 * - Recent movements
 * - Floating URL bar at bottom
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import SignalFlowBars from '../components/SignalFlowBars';
import { SignalLeaderboard } from '../components/pythh/SignalLeaderboard';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface SectorSignal {
  id: string;
  sector: string;
  state: 'heating' | 'stable' | 'cooling';
  strength: number;
  delta: number;
  age: string;
  count: number;
}

interface RecentMovement {
  text: string;
  time: string;
  signalClass: string;
}

// ── Signal class → readable label ───────────────────────────────────────────
const SIGNAL_CLASS_LABELS: Record<string, string> = {
  product_signal: 'Product Launches',
  fundraising_signal: 'Fundraising Activity',
  acquisition_signal: 'M&A Signals',
  growth_signal: 'Growth Velocity',
  market_position_signal: 'Market Positioning',
  revenue_signal: 'Revenue Traction',
  partnership_signal: 'Partnerships',
  hiring_signal: 'Talent Signals',
  enterprise_signal: 'Enterprise GTM',
  expansion_signal: 'Market Expansion',
  exploratory_signal: 'Exploratory Intent',
  distress_signal: 'Distress',
  efficiency_signal: 'Efficiency Moves',
  buyer_signal: 'Buyer Intent',
  buyer_pain_signal: 'Buyer Pain',
  exit_signal: 'Exit Signals',
  demand_signal: 'Demand Signals',
  gtm_signal: 'GTM Buildout',
};

const SIGNAL_CLASS_ORDER = [
  'fundraising_signal', 'product_signal', 'hiring_signal', 'growth_signal',
  'expansion_signal', 'enterprise_signal', 'revenue_signal', 'acquisition_signal',
  'partnership_signal', 'market_position_signal', 'exit_signal', 'distress_signal',
];

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return '<1h';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FounderSignalsPage() {
  const [sectors, setSectors]               = useState<SectorSignal[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [timeWindow, setTimeWindow]         = useState<'24h' | '7d' | '30d'>('7d');
  const [totalSignals, setTotalSignals]     = useState(0);
  const [loading, setLoading]               = useState(true);
  const [url, setUrl]                       = useState('');
  const [urlError, setUrlError]             = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [showExplainer, setShowExplainer]   = useState(false);

  useEffect(() => { loadSignals(timeWindow); }, [timeWindow]);

  async function loadSignals(window: '24h' | '7d' | '30d') {
    setLoading(true);
    try {
      const windowMs: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };
      const days = windowMs[window];
      const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const prevWindowStart = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch signals for current window
      const [{ data: current }, { data: previous }, { data: latest }] = await Promise.all([
        supabase
          .from('pythh_signal_events')
          .select('primary_signal, detected_at')
          .gte('detected_at', windowStart)
          .limit(5000),
        supabase
          .from('pythh_signal_events')
          .select('primary_signal')
          .gte('detected_at', prevWindowStart)
          .lt('detected_at', windowStart)
          .limit(5000),
        // Latest 5 signal events for "recent movements"
        supabase
          .from('pythh_signal_events')
          .select('primary_signal, detected_at, raw_sentence')
          .not('primary_signal', 'is', null)
          .order('detected_at', { ascending: false })
          .limit(5),
      ]);

      // Aggregate current window counts per class
      const currCounts: Record<string, { count: number; latest: string }> = {};
      (current || []).forEach(s => {
        if (!s.primary_signal) return;
        if (!currCounts[s.primary_signal]) currCounts[s.primary_signal] = { count: 0, latest: s.detected_at };
        currCounts[s.primary_signal].count++;
        if (s.detected_at > currCounts[s.primary_signal].latest)
          currCounts[s.primary_signal].latest = s.detected_at;
      });

      // Aggregate previous window counts
      const prevCounts: Record<string, number> = {};
      (previous || []).forEach(s => {
        if (!s.primary_signal) return;
        prevCounts[s.primary_signal] = (prevCounts[s.primary_signal] || 0) + 1;
      });

      const total = Object.values(currCounts).reduce((s, v) => s + v.count, 0);
      setTotalSignals(total || 0);
      const maxCount = Math.max(...Object.values(currCounts).map(v => v.count), 1);

      // Build sector rows ordered by priority list then by count
      const allClasses = [...new Set([
        ...SIGNAL_CLASS_ORDER,
        ...Object.keys(currCounts),
      ])].filter(cls => currCounts[cls]?.count);

      const rows: SectorSignal[] = allClasses.slice(0, 10).map((cls, i) => {
        const curr = currCounts[cls]?.count || 0;
        const prev = prevCounts[cls] || 0;
        const strength = curr / maxCount;
        // Delta = normalized change from previous window
        const delta = prev > 0 ? (curr - prev) / maxCount : curr > 0 ? 0.05 : 0;
        const state: SectorSignal['state'] =
          delta > 0.05 ? 'heating' : delta < -0.05 ? 'cooling' : 'stable';
        return {
          id: cls,
          sector: SIGNAL_CLASS_LABELS[cls] ?? cls.replace(/_/g, ' '),
          state,
          strength: Math.min(strength, 1),
          delta: parseFloat(delta.toFixed(3)),
          age: currCounts[cls]?.latest ? relativeAge(currCounts[cls].latest) : '—',
          count: curr,
        };
      });

      setSectors(rows);

      // Real recent movements from latest signal events
      const movements: RecentMovement[] = (latest || []).map(s => ({
        text: s.raw_sentence
          ? s.raw_sentence.slice(0, 80) + (s.raw_sentence.length > 80 ? '…' : '')
          : `${SIGNAL_CLASS_LABELS[s.primary_signal ?? ''] ?? s.primary_signal} signal detected`,
        time: s.detected_at ? relativeAge(s.detected_at) : '—',
        signalClass: s.primary_signal ?? '',
      }));
      setRecentMovements(movements);
    } catch {
      // Keep whatever data we have
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setUrlError('');

    try {
      // Navigate to signal analysis page
      window.location.href = `/signal-matches?url=${encodeURIComponent(trimmed)}`;
    } catch (err) {
      setUrlError('Failed to process URL');
      setIsSubmitting(false);
    }
  }

  const heating = sectors.filter(s => s.state === 'heating').length;
  const stable  = sectors.filter(s => s.state === 'stable').length;
  const cooling = sectors.filter(s => s.state === 'cooling').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-sm pb-24">
      {/* HEADER - consistent with PythhMain */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-white font-semibold">pythh.ai</Link>
            <span className="text-zinc-500 text-xs tracking-widest uppercase hidden sm:inline">Signal Science</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <span className="text-white">Signals</span>
            <Link to="/matches" className="hover:text-white">Engine</Link>
            <Link to="/rankings" className="hover:text-white">Rankings</Link>
            <Link to="/how-it-works" className="hover:text-white">How it works</Link>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">Sign up</Link>
          </nav>
          <nav className="flex md:hidden items-center gap-3 text-sm text-zinc-400">
            <span className="text-white text-xs">Signals</span>
            <Link to="/matches" className="hover:text-white text-xs">Engine</Link>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 text-xs">Sign up</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* PAGE HEADLINE - like Matches page */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2">signals</div>
          <h1 className="text-[32px] font-semibold text-zinc-100 leading-tight mb-2">
            Live investor belief shifts
          </h1>
          <p className="text-base text-zinc-400">Observed behavior, not stated intent.</p>
        </div>

        {/* SIGNAL FLOW BARS */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider">Signal Flow</h2>
              <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                Live
              </span>
            </div>
            <div className="text-xs text-zinc-600">Updates every 3s</div>
          </div>
          
          <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
            <SignalFlowBars />
          </div>
        </section>

        {/* WHAT ARE SIGNALS? - Expandable */}
        <section className="mb-6">
          <button
            onClick={() => setShowExplainer(!showExplainer)}
            className="w-full flex items-center justify-between px-4 py-3 border border-zinc-800 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 transition text-left"
          >
            <span className="text-xs text-zinc-400">What are signals?</span>
            {showExplainer ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          
          {showExplainer && (
            <div className="mt-2 px-4 py-4 border border-zinc-800 rounded-lg bg-zinc-900/20 space-y-3 text-xs text-zinc-400">
              <p>
                <span className="text-white font-medium">Signals</span> are live indicators of investor intent derived from observed behavior — not stated preferences.
              </p>
              <p>
                We track 7 signal types: <span className="text-cyan-400">Funding Activity</span>, <span className="text-cyan-400">Hiring Velocity</span>, <span className="text-cyan-400">Market Momentum</span>, <span className="text-cyan-400">Social Proof</span>, <span className="text-cyan-400">Competition Heat</span>, <span className="text-cyan-400">Revenue Signals</span>, and <span className="text-cyan-400">Product Velocity</span>.
              </p>
              <p>
                Each bar shows a 0-1 score and its recent change (Δ). <span className="text-emerald-400">Green</span> = tailwind (raises your odds). <span className="text-red-400">Red</span> = headwind (hurts odds). Bigger Δ = stronger signal.
              </p>
              <p>
                When you submit your startup URL, we calculate which signals matter most for <em>your</em> specific sector and stage — then match you with investors whose behavior aligns.
              </p>
            </div>
          )}
        </section>

        {/* STATS + TIME WINDOW */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs">
            {loading ? (
              <span className="text-zinc-600 animate-pulse">Loading signal data…</span>
            ) : (
              <>
                <span className="text-zinc-400 tabular-nums">{totalSignals.toLocaleString()} signals</span>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400">{heating} heating</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">{stable} stable</span>
                <span className="text-zinc-600">·</span>
                <span className="text-red-400">{cooling} cooling</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {(['24h', '7d', '30d'] as const).map(w => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-3 py-1.5 text-xs rounded transition ${
                  timeWindow === w 
                    ? 'bg-zinc-800 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* SIGNAL TYPE TABLE */}
        <section className="mb-6">
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            {/* Header — desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_60px_100px] gap-2 px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <span>Signal Type</span>
              <span className="text-center">Trend</span>
              <span className="text-right">Score</span>
              <span className="text-right">Δ</span>
              <span className="text-right">Age</span>
              <span className="text-center">Activity</span>
            </div>
            {/* Header — mobile */}
            <div className="grid sm:hidden grid-cols-[1fr_auto_3.5rem] gap-2 px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <span>Signal Type</span>
              <span className="text-center">Trend</span>
              <span className="text-right">Str</span>
            </div>

            {/* Loading skeleton */}
            {loading && [1,2,3,4,5].map(i => (
              <div key={i} className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_60px_100px] gap-2 px-4 py-2.5 border-b border-zinc-800/50">
                <div className="h-3 bg-zinc-800 rounded w-32 animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-16 mx-auto animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-10 ml-auto animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-10 ml-auto animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-8 ml-auto animate-pulse" />
              </div>
            ))}
            
            {/* Rows */}
            {!loading && sectors.map(s => (
              <div key={s.id}>
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_60px_100px] gap-2 px-4 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-900/30 transition items-center">
                  <span className="text-white font-medium text-xs">{s.sector}</span>
                  <span className="text-center">
                    <StateTag state={s.state} />
                  </span>
                  <span className="text-right font-mono text-xs text-white">
                    {s.strength.toFixed(2)}
                  </span>
                  <span className={`text-right font-mono text-xs ${
                    s.delta > 0 ? 'text-emerald-400' : s.delta < 0 ? 'text-red-400' : 'text-zinc-500'
                  }`}>
                    {s.delta > 0 ? '+' : ''}{s.delta.toFixed(2)}
                  </span>
                  <span className="text-right text-xs text-zinc-500">{s.age}</span>
                  <span className="flex justify-center">
                    <ActivityBars value={s.strength} />
                  </span>
                </div>
                {/* Mobile row */}
                <div className="grid sm:hidden grid-cols-[1fr_auto_3.5rem] gap-2 px-4 py-2.5 border-b border-zinc-800/50 items-center">
                  <span className="text-white font-medium text-xs truncate">{s.sector}</span>
                  <span className="text-center">
                    <StateTag state={s.state} />
                  </span>
                  <span className="text-right font-mono text-xs text-white">
                    {s.strength.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {!loading && sectors.length === 0 && (
              <div className="px-4 py-8 text-center text-zinc-600 text-xs">
                No signal data for this window yet.
              </div>
            )}
          </div>
        </section>

        {/* RECENT SIGNAL EVENTS */}
        <section>
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Latest signals detected</h3>
          <div className="space-y-2">
            {loading && [1,2,3].map(i => (
              <div key={i} className="flex items-center justify-between text-xs gap-4">
                <div className="h-3 bg-zinc-800 rounded flex-1 animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-8 animate-pulse" />
              </div>
            ))}
            {!loading && recentMovements.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-zinc-400 flex-1 leading-relaxed">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 mb-0.5 align-middle ${
                    m.signalClass.includes('fundrais') ? 'bg-emerald-400' :
                    m.signalClass.includes('product') ? 'bg-blue-400' :
                    m.signalClass.includes('hiring') ? 'bg-sky-400' :
                    m.signalClass.includes('distress') ? 'bg-red-400' :
                    m.signalClass.includes('acqui') ? 'bg-amber-400' : 'bg-cyan-400'
                  }`} />
                  {m.text}
                </span>
                <span className="text-zinc-600 shrink-0">{m.time}</span>
              </div>
            ))}
            {!loading && recentMovements.length === 0 && (
              <div className="text-zinc-600 text-xs">No recent signals.</div>
            )}
          </div>
        </section>
      </main>

      {/* FLOATING URL BAR — matches the Matches page exactly */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/98 backdrop-blur-lg border-t-2 border-cyan-500/60 shadow-[0_-4px_20px_rgba(6,182,212,0.15)]">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setUrlError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="yourstartup.com"
                className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-cyan-500/50 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 sm:px-8 py-3 sm:py-3.5 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm sm:text-base whitespace-nowrap"
            >
              {isSubmitting ? 'Analyzing…' : 'Find Signals →'}
            </button>
          </div>
          {urlError && <p className="text-red-400 text-sm mt-2">{urlError}</p>}
        </div>
      </div>

      {/* SIGNAL VELOCITY LEADERBOARD */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 mt-8">
        <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 p-6">
          <SignalLeaderboard
            limit={15}
            hoursAgo={168}
            showViewAll={false}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StateTag({ state }: { state: 'heating' | 'stable' | 'cooling' }) {
  const colors = {
    heating: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    stable: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    cooling: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const arrows = {
    heating: '▲',
    stable: '→',
    cooling: '▼',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border ${colors[state]}`}>
      <span>{arrows[state]}</span>
      <span>{state}</span>
    </span>
  );
}

function ActivityBars({ value }: { value: number }) {
  // 6 bars based on value (0-1)
  const filled = Math.round(value * 6);
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm transition-all duration-500 ${
            i <= filled ? 'bg-cyan-400' : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  );
}
