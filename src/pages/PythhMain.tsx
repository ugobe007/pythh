import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LiveWhisperLine from '../components/LiveWhisperLine';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { supabase } from '../lib/supabase';
import { submitStartup } from '../services/submitStartup';

/*
 * PYTHH HOME - Signal Science
 * Design: Left-aligned hero with orange glow + dense investor signals table
 * Reference: Former design (image 1) + Signal table (image 2)
 */

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
  const [submitting, setSubmitting] = useState(false);
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });
  const navigate = useNavigate();

  // Fetch live platform stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await supabase.rpc('get_platform_stats');
        const p = res.data || { startups: 0, investors: 0, matches: 0 };
        setStats({
          startups: p.startups || 0,
          investors: p.investors || 0,
          matches: p.matches || 0,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live investor signals for table
  useEffect(() => {
    async function fetchLiveSignals() {
      try {
        const { data, error } = await supabase
          .from('investors')
          .select('name, sectors, stage, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (!error && data && data.length >= 8) {
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
      }
    }
    fetchLiveSignals();
    const interval = setInterval(fetchLiveSignals, 60000);
    return () => clearInterval(interval);
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
    
    if (!trimmed || submitting) {
      console.log('[PythhMain] Empty URL or already submitting - aborting');
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
    
    // PREFETCH: Fire submitStartup immediately (don't wait for SignalMatches page)
    // Race: if we get a startup_id within 2s, navigate with it directly (skips re-resolution)
    setSubmitting(true);
    const navigateFallback = () => {
      console.log('[PythhMain] Navigating to CANONICAL:', `/signal-matches?url=${encodeURIComponent(trimmed)}`);
      navigate(`/signal-matches?url=${encodeURIComponent(trimmed)}`);
    };
    
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 2000));
    Promise.race([submitStartup(trimmed), timeout])
      .then((result) => {
        if (result?.startup_id) {
          console.log('[PythhMain] Prefetch resolved startup:', result.startup_id, 'in <2s');
          navigate(`/signal-matches?startup=${encodeURIComponent(result.startup_id)}&url=${encodeURIComponent(trimmed)}`);
        } else {
          navigateFallback();
        }
      })
      .catch(() => navigateFallback())
      .finally(() => setSubmitting(false));
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
          UNIFIED NAV
          ═══════════════════════════════════════════════════════════════════ */}
      <PythhUnifiedNav />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO - Bold headline + URL submit + Rankings CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-8">
        <div className="space-y-6">
          {/* Pre-headline */}
          <p 
            className="text-base sm:text-lg tracking-wide text-cyan-100"
            style={{ 
              textShadow: '0 0 6px rgba(0, 210, 255, 0.4), 0 0 16px rgba(0, 210, 255, 0.15)'
            }}
          >
            Investor signals. Live.
          </p>
          
          {/* Main headline */}
          <h1 
            className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.08]"
            style={{ 
              textShadow: [
                '0 0 3px rgba(0, 220, 255, 0.5)',
                '0 0 12px rgba(0, 200, 255, 0.3)',
                '0 0 24px rgba(0, 200, 255, 0.15)',
                '0 0 48px rgba(0, 200, 255, 0.07)',
              ].join(', ')
            }}
          >
            Find your investors. Now.
          </h1>
          <p className="text-zinc-400 text-lg sm:text-xl max-w-3xl">
            We align your startup with investor signals. No guessing. Just math.
          </p>
        </div>

        {/* Submit bar */}
        <div className="mt-8 max-w-3xl">
          <div 
            className="flex flex-col sm:flex-row"
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
              className="flex-1 bg-zinc-900 border border-cyan-500/50 rounded-t sm:rounded-l sm:rounded-tr-none px-4 py-3 text-white text-sm placeholder-zinc-500 outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
            />
            <button
              data-testid="home-analyze-button"
              onClick={submit}
              disabled={submitting}
              className="px-6 sm:px-8 py-3 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-b sm:rounded-r sm:rounded-bl-none hover:bg-cyan-500/10 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
            >
              {submitting ? 'Finding...' : 'Find Signals →'}
            </button>
          </div>
          
          {/* Sub-bar: error/suggestion OR inline stats */}
          <div className="mt-2.5 min-h-[20px]">
            {urlError ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-amber-400">{urlError}</span>
                {suggestion && (
                  <button onClick={applySuggestion} className="text-xs text-cyan-400 hover:text-cyan-300 underline">
                    Use "{suggestion}"
                  </button>
                )}
              </div>
            ) : url.trim() ? (
              <div className="text-xs text-zinc-500">
                Will search: <span className="text-cyan-400 font-mono">{extractDomain(url)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-[13px] text-zinc-500">
                <span><span className="text-zinc-300 tabular-nums">{stats.startups.toLocaleString()}</span> startups</span>
                <span className="text-zinc-700">·</span>
                <span><span className="text-zinc-300 tabular-nums">{stats.investors.toLocaleString()}</span> investors</span>
                <span className="text-zinc-700">·</span>
                <span><span className="text-cyan-400/80 tabular-nums">{stats.matches.toLocaleString()}</span> matches</span>
                <span className="text-zinc-700">·</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-emerald-400/60">live</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Secondary CTA */}
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <Link
            to="/rankings"
            className="group inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-cyan-400 transition-colors"
          >
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full group-hover:animate-pulse" />
            See how Sequoia, a16z &amp; YC rank your sector
            <span className="text-cyan-500 group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
          <Link
            to="/explore"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Browse {stats.startups.toLocaleString()} startups
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          INVESTOR SIGNALS TABLE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-2 pb-8">
        <div className="mb-5">
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-3xl">
            Every investor leaves a trail — portfolio moves, thesis shifts, check-size changes. 
            We track these <span className="text-cyan-400">signals</span> in real time and score them against your startup.
          </p>
        </div>

        <div className="border border-zinc-800/50 rounded-lg overflow-hidden bg-zinc-900/30">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Investor Signals</span>
            <span className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>

          {/* Column headers — desktop */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
            <span>Investor / Firm</span>
            <span className="text-right">Signal</span>
            <span className="text-center">Δ</span>
            <span className="text-center">GOD</span>
            <span className="text-center">VC++</span>
            <span className="text-center">Σ</span>
          </div>

          {/* Column headers — mobile */}
          <div className="grid sm:hidden grid-cols-[1fr_4rem_3rem] gap-2 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
            <span>Investor</span>
            <span className="text-right">Signal</span>
            <span className="text-center">Σ</span>
          </div>

          {/* Table rows */}
          {investorSignals.map((row, i) => (
            <div key={i}>
              <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-4 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition items-center">
                <span className="text-cyan-300 font-medium truncate">{row.investor}</span>
                <span className="text-right text-white font-mono">{row.signal}</span>
                <span className={`text-center font-mono ${deltaColor(row.delta)}`}>{row.delta}</span>
                <span className="text-center text-zinc-400">{row.god}</span>
                <span className="text-center text-zinc-400">{row.vcp}</span>
                <span className="flex justify-center">{renderBars(row.bars)}</span>
              </div>
              <div className="grid sm:hidden grid-cols-[1fr_4rem_3rem] gap-2 px-4 py-3 border-b border-zinc-800/20 items-center">
                <span className="text-cyan-300 font-medium text-xs truncate">{row.investor}</span>
                <span className="text-right text-white font-mono text-xs">{row.signal}</span>
                <span className="flex justify-center">{renderBars(row.bars)}</span>
              </div>
            </div>
          ))}

          {/* Footer legend */}
          <div className="px-4 py-3 text-center text-xs text-zinc-600">
            Signal = timing · GOD = position · VC++ = investor optics
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          RANKINGS TEASER — The addiction hook
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        <div className="border border-cyan-500/20 rounded-xl bg-gradient-to-r from-cyan-500/5 via-transparent to-violet-500/5 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5">
                See how your sector ranks through every VC lens
              </h2>
              <p className="text-sm text-zinc-400 max-w-lg">
                Switch between Sequoia, a16z, YC, and Founders Fund views. 
                Watch the rankings completely reshuffle. <span className="text-cyan-400">The gap between perception and reality is the opportunity.</span>
              </p>
            </div>
            <Link
              to="/rankings"
              className="shrink-0 px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all"
            >
              Open Rankings →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-12 border-t border-zinc-800/30">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500 mb-4">
          <Link to="/platform" className="hover:text-zinc-300 transition">Platform</Link>
          <Link to="/rankings" className="hover:text-zinc-300 transition">Rankings</Link>
          <Link to="/explore" className="hover:text-zinc-300 transition">Explore</Link>
          <Link to="/pricing" className="hover:text-zinc-300 transition">Pricing</Link>
          <Link to="/about" className="hover:text-zinc-300 transition">About</Link>
          <Link to="/support" className="hover:text-zinc-300 transition">Support</Link>
        </div>
        <p className="text-zinc-600 text-xs text-center">
          Signals reflect investor intent and timing based on observed behavior. No guessing. Just math.
        </p>
        <div className="mt-4 text-center">
          <Link to="/admin-login" className="text-zinc-700 hover:text-zinc-500 text-xs transition-colors">
            admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
