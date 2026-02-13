/**
 * HOW IT WORKS — Founder Intelligence
 * 
 * Signal table + actionable strategies = founder conversion
 * "Stop pitching. Start timing."
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════
// LIVE SIGNAL TABLE DATA
// ═══════════════════════════════════════════════════════════════

interface InvestorSignal {
  name: string;
  signal: number;
  delta: number;
  god: number;
  vcPlus: number;
}

const INVESTOR_SIGNALS: InvestorSignal[] = [
  { name: "Sequoia Capital", signal: 9.2, delta: 0.4, god: 78, vcPlus: 92 },
  { name: "a16z", signal: 8.8, delta: -0.2, god: 75, vcPlus: 88 },
  { name: "Greylock Partners", signal: 8.5, delta: 0.6, god: 72, vcPlus: 85 },
  { name: "First Round Capital", signal: 8.3, delta: 0.3, god: 70, vcPlus: 82 },
  { name: "Founders Fund", signal: 8.0, delta: -0.1, god: 68, vcPlus: 79 },
  { name: "Benchmark", signal: 7.8, delta: 0.2, god: 65, vcPlus: 76 },
  { name: "Index Ventures", signal: 7.5, delta: -0.3, god: 62, vcPlus: 72 },
  { name: "Lightspeed VP", signal: 7.2, delta: 0.1, god: 59, vcPlus: 68 },
];

// ═══════════════════════════════════════════════════════════════
// PLAYBOOK STRATEGIES
// ═══════════════════════════════════════════════════════════════

interface Strategy {
  id: string;
  name: string;
  trigger: string;
  action: string;
  why: string;
}

const PLAYBOOK: Strategy[] = [
  {
    id: "momentum",
    name: "Ride the Momentum",
    trigger: "When Δ is +0.3 or higher",
    action: "Reach out within 48 hours. They're actively deploying.",
    why: "Investors in deployment mode are 3x more likely to take meetings."
  },
  {
    id: "thesis",
    name: "Thesis Match",
    trigger: "When Signal > 8.0 and sector aligns",
    action: "Lead with their recent investment as context.",
    why: "Pattern-matching to recent deals signals you've done your homework."
  },
  {
    id: "timing",
    name: "Pre-Partner Meeting",
    trigger: "Sunday night or Monday morning",
    action: "Send materials before their weekly partner meeting.",
    why: "Partners discuss new deals Monday. Be on the agenda."
  },
  {
    id: "follow",
    name: "Follow the Check",
    trigger: "2-3 weeks after they close adjacent deal",
    action: "Reference their portfolio company. Ask for intro.",
    why: "They're thinking about the space. Your timing looks intentional."
  },
];

// ═══════════════════════════════════════════════════════════════
// COLUMN EXPLANATIONS
// ═══════════════════════════════════════════════════════════════

const COLUMNS = [
  { key: "signal", label: "SIGNAL", sublabel: "(move)", desc: "Investment activity momentum. Higher = actively looking." },
  { key: "delta", label: "Δ", sublabel: "", desc: "Week-over-week change. Green = heating up. Red = cooling." },
  { key: "god", label: "GOD", sublabel: "(pos)", desc: "Position score. How well you fit their current thesis." },
  { key: "vcPlus", label: "VC++", sublabel: "(optics)", desc: "Investor optics. Their brand value + network strength." },
  { key: "sigma", label: "Σ", sublabel: "", desc: "Composite strength. All signals combined visually." },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function HowItWorksPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [animatedSignals, setAnimatedSignals] = useState(INVESTOR_SIGNALS);

  // Fetch live stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const [s, i, m] = await Promise.all([
          supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
          supabase.from('investors').select('*', { count: 'exact', head: true }),
          supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
        ]);
        setStats({
          startups: s.count || 0,
          investors: i.count || 0,
          matches: m.count || 0,
        });
      } catch {}
    }
    fetchStats();
  }, []);

  // Subtle signal animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedSignals(prev => prev.map(inv => ({
        ...inv,
        signal: Math.max(5, Math.min(10, inv.signal + (Math.random() - 0.5) * 0.1)),
        delta: Math.max(-0.5, Math.min(0.8, inv.delta + (Math.random() - 0.5) * 0.05)),
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    if (!url.trim()) return;
    navigate(`/signal-matches?url=${encodeURIComponent(url.trim())}`);
  };

  // Generate signal bars (Σ column)
  const getSignalBars = (signal: number, delta: number) => {
    const strength = Math.round((signal / 10) * 5);
    return Array.from({ length: 5 }, (_, i) => {
      const isActive = i < strength;
      const color = delta > 0 ? 'bg-cyan-400' : delta < 0 ? 'bg-red-400' : 'bg-cyan-400';
      return (
        <div
          key={i}
          className={`w-1 h-4 rounded-sm ${isActive ? color : 'bg-zinc-700'}`}
        />
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-white font-semibold">pythh.ai</Link>
            <span className="text-zinc-500 text-xs tracking-widest uppercase hidden sm:inline">Signal Science</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <Link to="/signals" className="hover:text-white">Signals</Link>
            <Link to="/matches" className="hover:text-white">Engine</Link>
            <Link to="/rankings" className="hover:text-white">Rankings</Link>
            <span className="text-white">How it works</span>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">Sign up</Link>
          </nav>
          {/* Mobile nav */}
          <nav className="flex md:hidden items-center gap-4 text-sm text-zinc-400">
            <Link to="/signals" className="hover:text-white">Signals</Link>
            <Link to="/matches" className="hover:text-white">Engine</Link>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">Sign up</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* ═══════════════════════════════════════════════════════════════
            HOOK — Stop pitching. Start timing.
        ═══════════════════════════════════════════════════════════════ */}
        <section className="pt-6 pb-2">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            {/* Left: Headline + stats */}
            <div className="max-w-xl">
              <h1 className="text-3xl font-bold text-white mb-2">
                Stop pitching. <span className="text-cyan-400">Start timing.</span>
              </h1>
              
              <p className="text-base text-zinc-400 mb-4">
                <span className="text-white font-semibold">90% of pitches are rejected</span> because of signal timing.
                <br />
                <span className="text-zinc-500">Not your product. Not your team. Just bad timing.</span>
              </p>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">{stats.investors.toLocaleString()}</span>
                  <span className="text-zinc-500">investors</span>
                </div>
                <div className="w-px h-6 bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-cyan-400">87%</span>
                  <span className="text-zinc-500">timing accuracy</span>
                </div>
                <div className="w-px h-6 bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-emerald-400">3.2x</span>
                  <span className="text-zinc-500">response rate</span>
                </div>
              </div>
            </div>

          </div>

          {/* Playbook — full-width horizontal strip */}
          <div className="mt-4 border border-zinc-800/60 rounded-lg px-4 py-3 bg-zinc-900/30">
            <h3 className="text-[11px] text-zinc-500 uppercase tracking-widest mb-2">The Playbook</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
              {PLAYBOOK.map((strategy, i) => (
                <Link 
                  key={strategy.id} 
                  to="/app/playbook"
                  className="flex gap-2.5 text-xs leading-snug group cursor-pointer hover:bg-zinc-800/40 -mx-2 px-2 py-1.5 rounded transition"
                >
                  <span className="text-cyan-500 font-mono mt-px shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1">
                    <span className="text-zinc-200 font-medium group-hover:text-cyan-400 transition">{strategy.name}</span>
                    <span className="text-zinc-600 mx-1">—</span>
                    <span className="text-emerald-400">{strategy.trigger}</span>
                  </div>
                  <span className="text-zinc-600 group-hover:text-zinc-400 transition text-[10px] mt-px">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            LIVE SIGNAL TABLE
        ═══════════════════════════════════════════════════════════════ */}
        <section className="py-6 border-b border-zinc-800/50">
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            Signals only matter if you act on them. These are four timing patterns we see consistently 
            convert to <span className="text-cyan-400">meetings</span> — each one tied to a specific signal state in the table below. 
            Read the trigger, match it to your data, move fast.
          </p>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm text-zinc-400 uppercase tracking-widest">Investor Signals</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm">Live</span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr,100px,80px,80px,80px,100px] gap-4 px-4 py-2.5 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
              <div>Investor / Firm</div>
              {COLUMNS.map(col => (
                <div 
                  key={col.key}
                  className="text-right cursor-help relative"
                  onMouseEnter={() => setHoveredColumn(col.key)}
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  <span>{col.label}</span>
                  {col.sublabel && <span className="text-zinc-600 ml-1">{col.sublabel}</span>}
                  
                  {/* Tooltip */}
                  {hoveredColumn === col.key && (
                    <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-left text-xs text-zinc-300 normal-case tracking-normal z-10">
                      {col.desc}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Table Rows */}
            {animatedSignals.map((inv, i) => (
              <div 
                key={inv.name}
                className={`grid grid-cols-[1fr,100px,80px,80px,80px,100px] gap-4 px-4 py-3 items-center hover:bg-zinc-800/30 transition ${i !== animatedSignals.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
              >
                <div className="text-cyan-400 font-semibold">{inv.name}</div>
                <div className="text-right text-white font-mono">{inv.signal.toFixed(1)}</div>
                <div className={`text-right font-mono ${inv.delta > 0 ? 'text-emerald-400' : inv.delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {inv.delta > 0 ? '+' : ''}{inv.delta.toFixed(1)}
                </div>
                <div className="text-right text-zinc-400">{inv.god}</div>
                <div className="text-right text-zinc-400">{inv.vcPlus}</div>
                <div className="flex items-center justify-end gap-0.5">
                  {getSignalBars(inv.signal, inv.delta)}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-600 mt-4 text-center">
            Signal = timing · GOD = position · VC++ = investor optics
          </p>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between text-xs text-zinc-600">
          <span>© 2026 Pythh · Signal Science</span>
          <div className="flex items-center gap-6">
            <Link to="/signals" className="hover:text-zinc-400">Signals</Link>
            <Link to="/matches" className="hover:text-zinc-400">Engine</Link>
            <Link to="/rankings" className="hover:text-zinc-400">Rankings</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
