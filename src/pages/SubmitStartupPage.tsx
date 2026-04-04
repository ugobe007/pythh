/**
 * /submit — Founder intelligence report
 * After URL analysis: inline GOD score breakdown, focus areas,
 * top investor matches, meeting success forecast, and next steps.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ChevronRight } from 'lucide-react';
import { submitStartup } from '../services/submitStartup';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import InvestorReadinessReport, { type ReportData } from '../components/pythh/InvestorReadinessReport';
import { supabase } from '../lib/supabase';

function Counter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <>{val > 0 ? val.toLocaleString() : '…'}</>;
}

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

// Types are now imported from InvestorReadinessReport

// ─── Loading stages ───────────────────────────────────────────────────────

const LOADING_STAGES = [
  { label: 'Scraping your website…',        sublabel: 'Reading public signals and content' },
  { label: 'Extracting team & traction…',   sublabel: 'Parsing founder data and growth metrics' },
  { label: 'Calibrating GOD score…',        sublabel: 'Running team · traction · market · product · vision' },
  { label: 'Scanning 12,600+ investors…',   sublabel: 'Matching thesis, stage, and sector fit' },
  { label: 'Building your report…',         sublabel: 'Almost there — compiling insights' },
] as const;

// ─── Main component ────────────────────────────────────────────────────────

type Step = 'form' | 'loading' | 'report' | 'error';

export default function SubmitStartupPage() {
  const [step, setStep] = useState<Step>('form');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });

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
      } catch { /* keep zeros */ }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Cycle through loading stages while step === 'loading'
  useEffect(() => {
    if (step !== 'loading') { setLoadingStage(0); return; }
    setLoadingStage(0);
    const delays = [0, 3000, 7000, 11000, 16000];
    const timers = delays.map((ms, i) =>
      setTimeout(() => setLoadingStage(i), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) { setError('Enter your startup website URL.'); return; }
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setError('');
    setStep('loading');
    try {
      const result = await submitStartup(candidate);
      if (result.status === 'error' || result.status === 'not_found' || !result.startup_id) {
        setError(result.error || 'We could not process that URL. Please double-check and try again.');
        setStep('error');
        return;
      }
      const res = await fetch(`${API_BASE}/api/preview/${result.startup_id}`);
      if (!res.ok) throw new Error('Could not load report.');
      const data: ReportData = await res.json();
      setReport(data);
      setStep('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  };

  const reset = () => { setStep('form'); setUrl(''); setError(''); setReport(null); };

  // ── Loading view ─────────────────────────────────────────────────────────
  if (step === 'loading') {
    const stage = LOADING_STAGES[loadingStage];
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center"
        style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(62,207,142,0.07) 0%, transparent 55%)' }}>
        <div className="w-full max-w-sm px-6 text-center">
          {/* Pulsing orb */}
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-black text-emerald-400 font-mono">G</span>
            </div>
          </div>

          {/* Current stage */}
          <p className="text-white font-semibold text-lg mb-1 transition-all duration-500">{stage.label}</p>
          <p className="text-zinc-500 text-sm mb-8">{stage.sublabel}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {LOADING_STAGES.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-500 ${
                i < loadingStage ? 'w-2 h-2 bg-emerald-500' :
                i === loadingStage ? 'w-3 h-3 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                'w-2 h-2 bg-zinc-700'
              }`} />
            ))}
          </div>

          {/* Step list */}
          <div className="text-left space-y-2">
            {LOADING_STAGES.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                i < loadingStage ? 'text-emerald-500/60' :
                i === loadingStage ? 'text-white' :
                'text-zinc-700'
              }`}>
                <span className={`w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center text-[9px] transition-colors duration-300 ${
                  i < loadingStage ? 'border-emerald-600 bg-emerald-900/40 text-emerald-400' :
                  i === loadingStage ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400' :
                  'border-zinc-700 text-zinc-700'
                }`}>
                  {i < loadingStage ? '✓' : i + 1}
                </span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-zinc-700 font-mono">
            {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </p>
        </div>
      </div>
    );
  }

  // ── Report view ──────────────────────────────────────────────────────────
  if (step === 'report' && report) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col" style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(62,207,142,0.08) 0%, transparent 55%)' }}>
        <PythhUnifiedNav />
        <div className="flex-1 px-4 pt-12 pb-24">
          <div className="max-w-2xl mx-auto">
            <InvestorReadinessReport report={report} showFooter={true} onReset={reset} />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view — aligned with home “What you get” (stroke UI, no emoji grid) ─
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#000000', fontFamily: "'Inter', sans-serif" }}>
      <PythhUnifiedNav />
      <div className="flex-1 px-4 pt-6 pb-10">
        <div className="max-w-2xl mx-auto">

          <span className="pythh-label-caps block text-center mb-2" style={{ color: '#64748b' }}>
            Free investor readiness report
          </span>

          <div className="text-center mb-5">
            <h1
              className="tracking-tight leading-[1.12] mb-2"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(1.5rem, 3.8vw, 2.35rem)',
                color: '#fafafa',
                letterSpacing: '-0.03em',
              }}
            >
              From URL to top{' '}
              <span style={{ color: '#10b981' }}>investors</span>
              {' '}in 30 seconds.
            </h1>
            <p className="text-sm leading-snug max-w-lg mx-auto m-0" style={{ color: '#64748b' }}>
              We scrape your site to build a full startup signal profile then match you with top investors.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mb-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
              <div
                className="flex-1 min-w-0 flex items-center rounded-lg border relative"
                style={{
                  borderColor: 'rgba(16, 185, 129, 0.35)',
                  background: 'rgba(255,255,255,0.02)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                }}
              >
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#475569' }} />
                <input
                  type="text"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="yourcompany.com"
                  autoFocus
                  className="w-full pl-10 pr-3 py-3 bg-transparent border-0 outline-none text-sm rounded-lg disabled:opacity-50"
                  style={{ fontFamily: "'Geist Mono', monospace", color: '#e2e8f0' }}
                />
              </div>
              <button
                type="submit"
                disabled={!url.trim()}
                className="pythh-btn-outline inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Get Report <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div
              className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {[
                { n: stats.startups, label: 'startups' },
                { n: stats.matches, label: 'matches' },
                { n: stats.investors, label: 'investors' },
              ].map(({ n, label }) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <span className="pythh-score-number text-[0.9375rem]" style={{ color: '#e2e8f0' }}>
                    <Counter target={n} />
                  </span>
                  <span className="text-[0.75rem]" style={{ color: '#2e3d4a' }}>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="pythh-live-dot h-1.5 w-1.5" />
                <span className="pythh-score-number text-[0.7rem] tracking-wide text-emerald-500">live</span>
              </div>
            </div>

            <p className="text-center mt-2 text-[0.7rem]" style={{ color: '#2e3d4a' }}>
              Free · No account required · Results in &lt;60 seconds
            </p>

            {(error || step === 'error') && (
              <div className="mt-4 text-center">
                <p className="text-red-400/90 text-xs font-mono">{error || 'Something went wrong. Please try again.'}</p>
                {step === 'error' && (
                  <button type="button" onClick={reset} className="mt-2 text-xs underline transition" style={{ color: '#64748b' }}>
                    Try again
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6 mt-5">
            {[
              { step: '01', title: 'GOD score', body: '0–100 readiness across dimensions VCs use.' },
              { step: '02', title: 'Top matches', body: 'Ranked by thesis fit, timing, and stage.' },
              { step: '03', title: 'Focus + forecast', body: 'Gaps to fix and meeting response outlook.' },
            ].map(({ step: sn, title, body }) => (
              <div
                key={sn}
                className="rounded-lg px-3 py-2.5"
                style={{
                  border: '1px solid rgba(255,255,255,0.09)',
                  background: 'transparent',
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="pythh-number-badge">{sn}</span>
                  <span className="pythh-label-caps" style={{ color: '#64748b' }}>{title}</span>
                </div>
                <p className="text-[0.75rem] leading-snug m-0" style={{ color: '#475569' }}>{body}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-center mb-5" style={{ color: '#64748b' }}>
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-500/95 hover:text-emerald-400 transition inline-flex items-center gap-1 no-underline">
              Sign in <ChevronRight className="w-3 h-3" />
            </Link>
          </p>

          <div className="pt-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[0.7rem] leading-relaxed max-w-md mx-auto" style={{ color: '#2e3d4a' }}>
              The GOD model evaluates team, traction, market, product &amp; vision — aligned with how serious investors review deals.
            </p>
          </div>
        </div>
      </div>
      <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-zinc-700">
        <p>© {new Date().getFullYear()} pythh.ai — Signal science for founders.</p>
        <div className="mt-2"><Link to="/admin-login" className="text-zinc-800 hover:text-zinc-600 transition">admin</Link></div>
      </footer>
    </div>
  );
}
