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
}

// ═══════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════════════

const DEMO_SECTORS: SectorSignal[] = [
  { id: '1', sector: 'AI Infra', state: 'heating', strength: 0.81, delta: 0.12, age: '2h' },
  { id: '2', sector: 'FinTech Infra', state: 'heating', strength: 0.73, delta: 0.05, age: '6h' },
  { id: '3', sector: 'Security', state: 'heating', strength: 0.71, delta: 0.08, age: '4h' },
  { id: '4', sector: 'Dev Tooling', state: 'stable', strength: 0.66, delta: 0.01, age: '3d' },
  { id: '5', sector: 'HealthTech', state: 'heating', strength: 0.58, delta: 0.03, age: '8h' },
  { id: '6', sector: 'Data Infra', state: 'stable', strength: 0.54, delta: 0, age: '2d' },
  { id: '7', sector: 'Climate SaaS', state: 'cooling', strength: 0.42, delta: -0.15, age: '1d' },
  { id: '8', sector: 'Commerce', state: 'cooling', strength: 0.39, delta: -0.09, age: '5d' },
];

const RECENT_MOVEMENTS = [
  { text: 'AI Infra crossed 0.80 threshold', time: '2h ago' },
  { text: 'Security entered heating state', time: '4h ago' },
  { text: 'Climate SaaS dropped below 0.50', time: '1d ago' },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FounderSignalsPage() {
  const [sectors, setSectors] = useState<SectorSignal[]>(DEMO_SECTORS);
  const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);

  // Load real data
  useEffect(() => {
    loadSignals();
  }, []);

  async function loadSignals() {
    try {
      const { data } = await supabase
        .from('startup_signal_scores')
        .select('id, sector, created_at, signals_total, metadata')
        .not('sector', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const mapped: SectorSignal[] = data.slice(0, 8).map((s: any, i: number) => ({
          id: s.id,
          sector: s.sector || 'Unknown',
          state: (s.signals_total || 0) > 6 ? 'heating' : (s.signals_total || 0) < 4 ? 'cooling' : 'stable',
          strength: s.metadata?.strength ?? (0.9 - i * 0.07),
          delta: s.metadata?.delta ?? (Math.random() - 0.3) * 0.2,
          age: '—',
        }));
        setSectors(mapped);
      }
    } catch {
      // Use demo data
    }
  }

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setUrlError('');

    try {
      // Navigate to matches with URL
      window.location.href = `/matches?url=${encodeURIComponent(trimmed)}`;
    } catch (err) {
      setUrlError('Failed to process URL');
      setIsSubmitting(false);
    }
  }

  // Stats
  const heating = sectors.filter(s => s.state === 'heating').length;
  const stable = sectors.filter(s => s.state === 'stable').length;
  const cooling = sectors.filter(s => s.state === 'cooling').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-sm pb-24">
      {/* HEADER - consistent with PythhMain */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800/30">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-white font-semibold">pythh.ai</Link>
            <span className="text-zinc-500 text-xs tracking-widest uppercase">Signal Science</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-zinc-400">
            <span className="text-white">Signals</span>
            <Link to="/matches" className="hover:text-white">Engine</Link>
            <Link to="/signal-trends" className="hover:text-white">Trends</Link>
            <Link to="/how-it-works" className="hover:text-white">How it works</Link>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">Sign up</Link>
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
            <span className="text-emerald-400">{heating} heating</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400">{stable} stable</span>
            <span className="text-zinc-500">·</span>
            <span className="text-red-400">{cooling} cooling</span>
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

        {/* SECTOR TABLE */}
        <section className="mb-6">
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_70px_70px_60px_100px] gap-2 px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <span>Sector</span>
              <span className="text-center">State</span>
              <span className="text-right">Strength</span>
              <span className="text-right">Δ</span>
              <span className="text-right">Age</span>
              <span className="text-center">Activity</span>
            </div>
            
            {/* Rows */}
            {sectors.map(s => (
              <div 
                key={s.id}
                className="grid grid-cols-[1fr_80px_70px_70px_60px_100px] gap-2 px-4 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-900/30 transition items-center"
              >
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
            ))}
          </div>
        </section>

        {/* RECENT MOVEMENTS */}
        <section>
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Recent movements</h3>
          <div className="space-y-2">
            {RECENT_MOVEMENTS.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">
                  <span className="text-cyan-400 mr-2">●</span>
                  {m.text}
                </span>
                <span className="text-zinc-600">{m.time}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FLOATING URL BAR — matches the Matches page exactly */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/98 backdrop-blur-lg border-t-2 border-cyan-500/60 shadow-[0_-4px_20px_rgba(6,182,212,0.15)]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
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
              className="px-8 py-3.5 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-base whitespace-nowrap"
            >
              {isSubmitting ? 'Analyzing…' : 'Find Signals →'}
            </button>
          </div>
          {urlError && <p className="text-red-400 text-sm mt-2">{urlError}</p>}
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
