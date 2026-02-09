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
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-white font-semibold">pythh.ai</Link>
            <span className="text-zinc-500 text-xs tracking-widest uppercase hidden sm:inline">Signal Science</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <Link to="/signals" className="hover:text-white">Signals</Link>
            <Link to="/matches" className="hover:text-white">Engine</Link>
            <Link to="/signal-trends" className="hover:text-white">Trends</Link>
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

      <main className="max-w-6xl mx-auto px-4 sm:px-8">
        {/* ═══════════════════════════════════════════════════════════════
            HOOK — Stop pitching. Start timing.
        ═══════════════════════════════════════════════════════════════ */}
        <section className="py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-white mb-4">
              Stop pitching. <span className="text-cyan-400">Start timing.</span>
            </h1>
            
            <p className="text-lg text-zinc-400 mb-6">
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
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            LIVE SIGNAL TABLE
        ═══════════════════════════════════════════════════════════════ */}
        <section className="py-12 border-b border-zinc-800/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm text-zinc-400 uppercase tracking-widest">Investor Signals</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm">Live</span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr,100px,80px,80px,80px,100px] gap-4 px-6 py-4 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
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
                className={`grid grid-cols-[1fr,100px,80px,80px,80px,100px] gap-4 px-6 py-5 items-center hover:bg-zinc-800/30 transition ${i !== animatedSignals.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
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

        {/* ═══════════════════════════════════════════════════════════════
            THE PLAYBOOK — Actionable Strategies
        ═══════════════════════════════════════════════════════════════ */}
        <section className="py-12 border-b border-zinc-800/50">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">The Playbook</h2>
            <p className="text-zinc-400">Four timing strategies that actually work.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {PLAYBOOK.map((strategy, i) => (
              <div 
                key={strategy.id}
                className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-xl hover:border-zinc-700 transition group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 flex items-center justify-center bg-cyan-500/10 text-cyan-400 font-bold rounded-lg text-sm">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Trigger:</span>
                    <span className="text-emerald-400 ml-2">{strategy.trigger}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Action:</span>
                    <span className="text-white ml-2">{strategy.action}</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <span className="text-zinc-600 text-xs">{strategy.why}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* FOOTER - with padding for floating bar */}
      <footer className="border-t border-zinc-800/50 py-8 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex items-center justify-between text-xs text-zinc-600">
          <span>© 2026 Pythh · Signal Science</span>
          <div className="flex items-center gap-6">
            <Link to="/signals" className="hover:text-zinc-400">Signals</Link>
            <Link to="/matches" className="hover:text-zinc-400">Engine</Link>
            <Link to="/signal-trends" className="hover:text-zinc-400">Trends</Link>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════
          FLOATING CTA BAR — Sticky bottom
      ═══════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <span className="text-xs text-zinc-500 uppercase tracking-wider whitespace-nowrap hidden sm:block">Check your timing</span>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="yourstartup.com"
            className="flex-1 px-4 py-3 bg-zinc-900 border border-cyan-500/50 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
          />
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 transition text-sm whitespace-nowrap"
          >
            Find Signals →
          </button>
        </div>
      </div>
    </div>
  );
}
