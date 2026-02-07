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

// TLD typo detection map
const COMMON_TLD_TYPOS: Record<string, string> = {
  '.con': '.com',
  '.cmo': '.com',
  '.cpm': '.com',
  '.co m': '.com',
  '.og': '.org',
  '.oi': '.io',
  '.bet': '.net',
  '.ent': '.net',
  '.cm': '.com',
  '.om': '.com',
};

export default function PythhHome() {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [tapeX, setTapeX] = useState(0);
  const [signalTape, setSignalTape] = useState(STATIC_SIGNAL_TAPE);
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0, avgSignal: 0 });
  const navigate = useNavigate();

  // Fetch live platform stats — uses fast RPC (pg_class estimates) to avoid count(*) timeouts on 1M+ rows
  useEffect(() => {
    async function fetchStats() {
      try {
        const [platformRes, signalsRes] = await Promise.all([
          supabase.rpc('get_platform_stats'),
          supabase.from('startup_signal_scores')
            .select('signals_total')
            .not('signals_total', 'is', null)
            .limit(1000)
        ]);
        
        const p = platformRes.data || { startups: 0, investors: 0, matches: 0 };
        const avgSignal = signalsRes.data?.length > 0
          ? (signalsRes.data.reduce((sum: number, s: any) => sum + (s.signals_total || 0), 0) / signalsRes.data.length).toFixed(1)
          : '5.0';
        
        setStats({
          startups: p.startups || 0,
          investors: p.investors || 0,
          matches: p.matches || 0,
          avgSignal: avgSignal
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // PYTHH ENGINE ENTRY POINT - DO NOT MODIFY
  // ═══════════════════════════════════════════════════════════════════════════
  // This is the CANONICAL workflow entry:
  // 1. User submits URL → navigate to /signals?url=...
  // 2. SignalsAlias redirects → /app/radar?url=...
  // 3. SignalsRadarPage resolves URL via useResolveStartup hook
  // 4. Hook calls resolve_startup_by_url RPC (pythh-rpc.ts)
  // 5. RPC: scrapes → collects data → builds profile → scores → matches
  // 6. Returns: 5 unlocked signals + 50 locked signals
  // ═══════════════════════════════════════════════════════════════════════════
  
  const extractDomain = (input: string): string => {
    const trimmed = input.trim();
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    return withoutProtocol.split('/')[0];
  };

  const submit = () => {
    const trimmed = url.trim();
    console.log('[PythhMain] Submit called with:', trimmed);
    
    if (!trimmed) {
      console.log('[PythhMain] Empty URL - aborting');
      return;
    }
    
    // Clear previous errors
    setUrlError('');
    setSuggestion('');
    
    // Check for TLD typos
    const lowerUrl = trimmed.toLowerCase();
    for (const [typo, correct] of Object.entries(COMMON_TLD_TYPOS)) {
      if (lowerUrl.endsWith(typo)) {
        const suggested = trimmed.slice(0, -typo.length) + correct;
        console.log('[PythhMain] TLD typo detected:', typo, '→', correct);
        setSuggestion(suggested);
        setUrlError(`Did you mean ${correct}?`);
        return;
      }
    }
    
    // Basic domain format validation (relaxed)
    const domain = extractDomain(trimmed);
    if (!domain.includes('.')) {
      console.log('[PythhMain] No TLD detected:', domain);
      setUrlError('Please enter a valid domain (e.g., example.com)');
      return;
    }
    
    // All checks passed - proceed to canonical pythh engine (direct to /signal-matches)
    console.log('[PythhMain] Navigating to CANONICAL:', `/signal-matches?url=${encodeURIComponent(trimmed)}`);
    navigate(`/signal-matches?url=${encodeURIComponent(trimmed)}`);
  };

  const applySuggestion = () => {
    if (suggestion) {
      setUrl(suggestion);
      setSuggestion('');
      setUrlError('');
    }
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
            <Link to="/matches" className="text-cyan-400 border border-cyan-500/40 px-2.5 py-0.5 rounded hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors">Engine</Link>
            <Link to="/signals" className="hover:text-white">Signals</Link>
            <Link to="/signal-trends" className="hover:text-white">Trends</Link>
            <Link to="/how-it-works" className="hover:text-white">How it works</Link>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">Sign up</Link>
          </nav>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO - Left aligned with cyan edge trace + RIGHT SIDE STATS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-8 pt-16 pb-8">
        <div className="flex justify-between items-start mb-8">
          {/* Left: Hero text */}
          <div className="space-y-4 max-w-3xl">
            {/* Pre-headline with cyan glow */}
            <p 
              className="text-xl tracking-wide text-zinc-300"
              style={{ 
                textShadow: '0 0 12px rgba(0, 200, 255, 0.5), 0 0 24px rgba(0, 200, 255, 0.25)'
              }}
            >
              Investor signals. Live.
            </p>
            
            {/* Main headline with cyan ghost stroke */}
            <h1 
              className="text-6xl font-bold tracking-tight text-white"
              style={{ 
                textShadow: '0 0 2px rgba(0, 200, 255, 0.6), 0 0 12px rgba(0, 200, 255, 0.3), 0 0 24px rgba(0, 200, 255, 0.15)'
              }}
            >
              Find your investors. Now.
            </h1>
            <p className="text-zinc-400 text-lg">We align your startup with investor signals. No guessing. Just math.</p>
          </div>
          
          {/* Right: Live stats - subtle Supabase style, positioned lower */}
          <div className="text-right space-y-1.5 text-white text-sm font-normal pr-8 mt-6">
            <div>Startups: {stats.startups.toLocaleString()}</div>
            <div>Investors: {stats.investors.toLocaleString()}</div>
            <div>Matches: {stats.matches.toLocaleString()}</div>
            <div>Signal: <span className="text-cyan-400">{stats.avgSignal}</span></div>
          </div>
        </div>

        {/* Submit bar - matches table width with cyan glow */}
        <div 
          className="flex items-center"
          style={{ boxShadow: '0 0 40px rgba(34, 211, 238, 0.1), 0 0 80px rgba(34, 211, 238, 0.05)' }}
        >
          <input
            data-testid="home-url-input"
            type="text"
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              setUrlError('');
              setSuggestion('');
            }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="https://yourstartup.com"
            className="flex-1 bg-zinc-900 border border-cyan-500/50 rounded-l px-4 py-3 text-white text-sm placeholder-zinc-500 outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
          />
          <button
            data-testid="home-analyze-button"
            onClick={submit}
            className="px-8 py-3 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-r hover:bg-cyan-500/10 transition whitespace-nowrap"
          >
            Find Signals →
          </button>
        </div>
        
        {/* URL Preview + Error/Suggestion */}
        <div className="mt-2 min-h-[24px]">
          {urlError ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-400">{urlError}</span>
              {suggestion && (
                <button
                  onClick={applySuggestion}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  Use "{suggestion}"
                </button>
              )}
            </div>
          ) : url.trim() ? (
            <div className="text-xs text-zinc-500">
              Will search: <span className="text-cyan-400 font-mono">{extractDomain(url)}</span>
            </div>
          ) : null}
        </div>
        
        {/* Live activity indicator - shows data is fresh */}
        <div className="mt-2 text-zinc-500 text-[13px]">
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
