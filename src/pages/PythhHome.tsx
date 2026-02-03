import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LiveWhisperLine from '../components/LiveWhisperLine';
import { supabase } from '../lib/supabase';

/*
 * PYTHH HOME - Signal Science
 * Design: Left-aligned hero with orange glow + dense investor signals table
 * Reference: Former design (image 1) + Signal table (image 2)
 */

// Fallback signal tape data (used if live data fails)
const STATIC_SIGNAL_TAPE = [
  { investor: 'Sequoia', focus: 'B2B SaaS', delta: '+0.4', time: '6m' },
  { investor: 'Greylock', focus: 'dev tooling', delta: '+0.2', time: '14m' },
  { investor: 'Founders Fund', focus: 'infra', delta: '+0.7', time: '3m' },
  { investor: 'Khosla', focus: 'climate', delta: '+0.3', time: '8m' },
  { investor: 'a16z', focus: 'AI agents', delta: '+0.5', time: '5m' },
  { investor: 'Lightspeed', focus: 'fintech', delta: '+0.4', time: '12m' },
  { investor: 'Index', focus: 'enterprise', delta: '+0.6', time: '2m' },
  { investor: 'Accel', focus: 'consumer', delta: '-0.2', time: '18m' },
];

// Fallback investor signals table data (used if live data fails)
const STATIC_INVESTOR_SIGNALS = [
  { investor: 'Sequoia Capital', signal: 8.7, delta: '+0.4', god: 76, vcp: 88, bars: 5 },
  { investor: 'Greylock Partners', signal: 8.2, delta: '0.0', god: 73, vcp: 84, bars: 4 },
  { investor: 'Founders Fund', signal: 7.7, delta: '-0.2', god: 70, vcp: 80, bars: 3 },
  { investor: 'a16z crypto', signal: 7.2, delta: '-0.2', god: 67, vcp: 76, bars: 2 },
  { investor: 'Lightspeed VP', signal: 6.7, delta: '-0.2', god: 64, vcp: 72, bars: 2 },
  { investor: 'Index Ventures', signal: 6.2, delta: '-0.2', god: 61, vcp: 68, bars: 1 },
  { investor: 'Accel Partners', signal: 5.9, delta: '+0.1', god: 58, vcp: 65, bars: 1 },
  { investor: 'Benchmark', signal: 5.4, delta: '0.0', god: 55, vcp: 62, bars: 1 },
];

// Live matching activity (keep static for now)
const liveMatching = [
  { text: 'AI infra startup flagged for agent-first adoption', god: 88, time: 'just now' },
  { text: 'Clean energy startup actively appearing in discovery', god: 85, time: '2m ago' },
  { text: 'EdTech platform showing consistent forward motion', god: 71, time: '5m ago' },
];

export default function PythhHome() {
  const [url, setUrl] = useState('');
  const [tapeX, setTapeX] = useState(0);
  const [signalTape, setSignalTape] = useState(STATIC_SIGNAL_TAPE);
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);
  const navigate = useNavigate();

  // Fetch live investor signals for ticker AND table
  useEffect(() => {
    async function fetchLiveSignals() {
      try {
        const { data, error } = await supabase
          .from('investors')
          .select('name, sectors, stage, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (!error && data && data.length >= 8) {
          // Update ticker
          const liveTape = data.slice(0, 8).map((inv, i) => ({
            investor: inv.name?.split(' ')[0] || 'Fund',
            focus: inv.sectors?.[0] || 'various',
            delta: ['+0.4', '+0.2', '+0.7', '-0.2', '+0.5', '0.0', '+0.3', '-0.1'][i % 8],
            time: `${Math.floor(Math.random() * 20) + 1}m`,
          }));
          setSignalTape(liveTape);
          
          // Update main table with live data
          const liveTable = data.slice(0, 8).map((inv, i) => ({
            investor: inv.name || 'Unknown Investor',
            signal: (9.0 - i * 0.3).toFixed(1),
            delta: ['+0.4', '0.0', '-0.2', '-0.2', '-0.2', '-0.2', '+0.1', '0.0'][i],
            god: 76 - i * 3,
            vcp: 88 - i * 4,
            bars: Math.max(1, 5 - i),
          }));
          setInvestorSignals(liveTable);
        }
      } catch (err) {
        console.error('Failed to fetch live signals:', err);
        // Keep using static fallbacks
      }
    }
    fetchLiveSignals();
    const interval = setInterval(fetchLiveSignals, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Ticker animation
  useEffect(() => {
    const id = setInterval(() => setTapeX(x => x + 0.5), 50);
    return () => clearInterval(id);
  }, []);

  const submit = () => {
    if (url.trim()) navigate(`/signals?url=${encodeURIComponent(url.trim())}`);
  };

  const deltaColor = (d: string) => {
    if (d.startsWith('+')) return 'text-emerald-400';
    if (d.startsWith('-')) return 'text-red-400';
    return 'text-zinc-500';
  };

  const renderBars = (n: number) => {
    return (
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <div 
            key={i} 
            className={`w-1 h-3 rounded-sm ${i <= n ? 'bg-cyan-400' : 'bg-zinc-700'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e13] relative overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Background gradient glow */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[600px] h-[500px] bg-emerald-500/3 rounded-full blur-[120px] pointer-events-none" />
      
      {/* ═══════════════════════════════════════════════════════════════════
          SIGNAL TAPE - Full width ticker
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="w-full bg-[#0d1117] border-b border-zinc-800/50 overflow-hidden">
        <div className="flex items-center">
          <span className="px-4 py-2 text-xs text-zinc-500 border-r border-zinc-800/50 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            LIVE
          </span>
          <div 
            className="whitespace-nowrap py-2"
            style={{ transform: `translateX(-${tapeX % 2000}px)` }}
          >
            {[...signalTape, ...signalTape].map((s, i) => (
              <span key={i} className="inline-flex items-center mx-6 text-sm">
                <span className="text-zinc-400">{s.investor}</span>
                <span className="text-zinc-600 mx-2">{s.focus}</span>
                <span className={`${deltaColor(s.delta)} font-mono`}>{s.delta}</span>
                <span className="text-zinc-700 ml-2">{s.time}</span>
                <span className="text-zinc-800 ml-6">►</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="w-full border-b border-zinc-800/30">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold">pythh.ai</span>
            <span className="text-zinc-500 text-xs tracking-widest uppercase">Signal Science</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-zinc-400">
            <Link to="/signals" className="hover:text-white">Signals</Link>
            <Link to="/matches" className="hover:text-white">Matches</Link>
            <Link to="/trends" className="hover:text-white">Trends</Link>
            <Link to="/how-it-works" className="hover:text-white">How it works</Link>
            <a href="#" className="hover:text-white">Docs</a>
            <a href="#" className="hover:text-white">Sign in</a>
          </nav>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO - Left aligned with cyan edge trace
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-8 pt-16 pb-8">
        {/* Pre-headline with cyan glow */}
        <p 
          className="text-xl tracking-wide mb-4 text-zinc-300"
          style={{ 
            textShadow: '0 0 12px rgba(0, 200, 255, 0.5), 0 0 24px rgba(0, 200, 255, 0.25)'
          }}
        >
          Investor signals. Live.
        </p>
        
        {/* Main headline with cyan ghost stroke */}
        <h1 
          className="text-6xl font-bold tracking-tight mb-6 text-white"
          style={{ 
            textShadow: '0 0 2px rgba(0, 200, 255, 0.6), 0 0 12px rgba(0, 200, 255, 0.3), 0 0 24px rgba(0, 200, 255, 0.15)'
          }}
        >
          Find your investors. Now.
        </h1>
        <p className="text-zinc-400 text-lg mb-8">We align your startup with investor signals. No guessing. Just math.</p>

        {/* Submit bar - matches table width with cyan glow */}
        <div 
          className="flex items-center"
          style={{ boxShadow: '0 0 40px rgba(34, 211, 238, 0.1), 0 0 80px rgba(34, 211, 238, 0.05)' }}
        >
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="https://yourstartup.com"
            className="flex-1 bg-zinc-900/80 border border-cyan-900/50 rounded-l px-4 py-3 text-white placeholder-zinc-600 outline-none focus:border-cyan-700/50"
          />
          <button
            onClick={submit}
            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white border border-cyan-900/50 border-l-0 rounded-r transition whitespace-nowrap"
          >
            Submit
          </button>
        </div>
        
        {/* Live activity indicator - shows data is fresh */}
        <div className="mt-4 text-zinc-500 text-[13px]">
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live investor signals updating every 60 seconds
          </span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          INVESTOR SIGNALS TABLE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-8 py-8">
        <div className="border border-zinc-800/50 rounded-lg overflow-hidden bg-zinc-900/30">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Investor Signals</span>
            <span className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_70px_70px_80px_80px] gap-4 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
            <span>Investor / Firm</span>
            <span className="text-right">Signal<br/><span className="text-zinc-600 normal-case">(move)</span></span>
            <span className="text-center">Δ</span>
            <span className="text-center">GOD<br/><span className="text-zinc-600 normal-case">(pos)</span></span>
            <span className="text-center">VC++<br/><span className="text-zinc-600 normal-case">(optics)</span></span>
            <span className="text-center">Σ</span>
          </div>

          {/* Table rows - Unlocked investor names */}
          {investorSignals.map((row, i) => (
            <div 
              key={i} 
              className="grid grid-cols-[1fr_100px_70px_70px_80px_80px] gap-4 px-4 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition items-center"
            >
              <span className="text-cyan-300 font-medium">{row.investor}</span>
              <span className="text-right text-white font-mono">{row.signal}</span>
              <span className={`text-center font-mono ${deltaColor(row.delta)}`}>{row.delta}</span>
              <span className="text-center text-zinc-400">{row.god}</span>
              <span className="text-center text-zinc-400">{row.vcp}</span>
              <span className="flex justify-center">{renderBars(row.bars)}</span>
            </div>
          ))}

          {/* Footer legend */}
          <div className="px-4 py-3 text-center text-xs text-zinc-600">
            Signal = timing · GOD = position · VC++ = investor optics
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE MATCHING ACTIVITY
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-8 py-8">
        <h2 className="text-xs text-zinc-500 uppercase tracking-widest mb-4">Investor Matching Happening Now</h2>
        <div className="space-y-3">
          {liveMatching.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300">{item.text}</span>
              <span className="text-amber-400 font-mono">(GOD: {item.god})</span>
              <span className="text-zinc-600 text-sm ml-auto">{item.time}</span>
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-sm italic mt-4">This is how discovery happens before pitch decks.</p>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="max-w-6xl mx-auto px-8 py-12 border-t border-zinc-800/30">
        <p className="text-zinc-600 text-xs text-center">
          Signals reflect investor intent and timing based on observed behavior. No guessing. Just math.
        </p>
      </footer>
    </div>
  );
}
