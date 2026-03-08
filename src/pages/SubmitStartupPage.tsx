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

  // ── Form view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col" style={{
      backgroundImage: [
        'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(62,207,142,0.09) 0%, transparent 60%)',
        'radial-gradient(ellipse 60% 30% at 80% 60%, rgba(6,182,212,0.05) 0%, transparent 50%)',
        'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
      ].join(', '),
      backgroundSize: 'auto, auto, 48px 48px, 48px 48px',
    }}>
      <PythhUnifiedNav />
      <div className="flex-1 px-4 pt-16 pb-24">
        <div className="max-w-2xl mx-auto">

          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(62,207,142,1)]" />
            <span className="text-xs font-mono tracking-[0.2em] text-zinc-500 uppercase">Free Investor Readiness Report</span>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
              <span className="text-white">Score your startup.</span><br />
              <span style={{ background: 'linear-gradient(90deg, #cbd5e1 0%, #e2e8f0 50%, #67e8f9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Find your investors.
              </span>
            </h1>
            <p className="text-zinc-500 text-lg leading-relaxed max-w-md mx-auto">
              Drop your URL. Get a free report: GOD score breakdown, top investor matches, focus areas, and your estimated meeting response rate.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl blur-2xl opacity-20" style={{ background: 'linear-gradient(90deg, rgba(62,207,142,0.4), rgba(6,182,212,0.3))' }} />
            <div className="relative flex flex-col sm:flex-row gap-3 p-2 border border-zinc-800/80 rounded-2xl bg-zinc-950/70 backdrop-blur-sm"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.5)' }}>
              <div className="flex-1 relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                <input type="text" value={url} onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="yourcompany.com" autoFocus
                  className="w-full pl-11 pr-4 py-4 bg-transparent text-white placeholder-zinc-700 text-base focus:outline-none disabled:opacity-50" />
              </div>
              <button type="submit" disabled={!url.trim()}
                className="flex items-center justify-center gap-2 px-7 py-4 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 hover:bg-orange-500/5 disabled:opacity-30 disabled:cursor-not-allowed font-semibold rounded-xl transition text-sm whitespace-nowrap"
                style={{ boxShadow: '0 0 24px rgba(249,115,22,0.15)' }}>
                <>Get Report <ChevronRight className="w-4 h-4" /></>
              </button>
            </div>
            {(error || step === 'error') && (
              <div className="mt-3 text-center">
                <p className="text-red-400/80 text-xs font-mono">{error || 'Something went wrong. Please try again.'}</p>
                {step === 'error' && (
                  <button type="button" onClick={reset} className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 underline transition">Try again</button>
                )}
              </div>
            )}
          </form>

          <p className="text-center text-zinc-700 text-xs mb-16">Free · No account required · Results in &lt;60 seconds</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
            {[
              { icon: Flame,      color: 'text-orange-400', border: 'border-orange-500/15', label: 'GOD Score',        desc: '0–100 investor-readiness rating' },
              { icon: Target,     color: 'text-amber-400',  border: 'border-amber-500/15',  label: 'Focus Areas',      desc: 'What to fix before outreach' },
              { icon: Users,      color: 'text-cyan-400',   border: 'border-cyan-500/15',   label: 'Top Matches',      desc: 'Ranked by fit & thesis' },
              { icon: TrendingUp, color: 'text-emerald-400',border: 'border-emerald-500/15',label: 'Success Forecast', desc: 'Estimated meeting response rate' },
            ].map(({ icon: Icon, color, border, label, desc }) => (
              <div key={label} className={`flex flex-col gap-2 px-4 py-3 border ${border} rounded-xl bg-zinc-950/40`}>
                <Icon className={`w-4 h-4 ${color}`} />
                <div className="text-white text-xs font-semibold">{label}</div>
                <div className="text-zinc-600 text-[11px] leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>

          <p className="text-zinc-600 text-sm text-center mb-12">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-500 hover:text-cyan-400 transition inline-flex items-center gap-1">
              Sign in to track your score history <ArrowRight className="w-3 h-3" />
            </Link>
          </p>

          <div className="pt-8 border-t border-zinc-900/80 text-center">
            <p className="text-zinc-800 text-xs">
              The GOD Algorithm evaluates team, traction, market, product &amp; vision — the same dimensions top VCs use to evaluate deals.
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
