/**
 * /submit — Founder intelligence report
 * After URL analysis: inline GOD score breakdown, focus areas,
 * top investor matches, meeting success forecast, and next steps.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Globe, ChevronRight } from 'lucide-react';
import { submitStartup } from '../services/submitStartup';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import InvestorReadinessReport, { type ReportData } from '../components/pythh/InvestorReadinessReport';
import { supabase } from '../lib/supabase';
import { fetchPlatformStats } from '../lib/platformStats';
import { fetchPreviewReport, fetchTimeoutSignal } from '../lib/apiConfig';
import { isUuidString } from '../lib/isUuid';
import { Stage1Questions, Stage2Questions, type Stage1Answers, type Stage2Answers } from '../components/submit/ProgressiveQuestions';
import MatchAccuracyBanner from '../components/submit/MatchAccuracyBanner';

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

type Step = 'form' | 'loading' | 'qualify' | 'refine' | 'report' | 'error';

export default function SubmitStartupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startupInUrl = searchParams.get('startup');
  const shouldDeepLoad = useMemo(() => isUuidString(startupInUrl), [startupInUrl]);

  const [step, setStep] = useState<Step>(() => (shouldDeepLoad ? 'loading' : 'form'));
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });

  // Progressive refinement state
  const [pendingStartupId, setPendingStartupId] = useState<string | null>(null);
  const [stage1Answers, setStage1Answers] = useState<Stage1Answers | null>(null);
  const [stage2Answers, setStage2Answers] = useState<Stage2Answers | null>(null);
  const [stage1Accuracy, setStage1Accuracy] = useState<number | null>(null);

  // Keep URL in sync when we have a loaded report (bookmarkable deep link)
  useEffect(() => {
    if (step !== 'report' || !report?.startup.id) return;
    const cur = searchParams.get('startup');
    if (cur === report.startup.id) return;
    navigate(`/submit?startup=${encodeURIComponent(report.startup.id)}`, { replace: true });
  }, [step, report?.startup.id, searchParams, navigate]);

  // Restore report from ?startup=UUID (bookmark, back from investor profile, shared link)
  useEffect(() => {
    const sid = searchParams.get('startup');
    if (!isUuidString(sid)) return;
    if (report?.startup.id === sid) return;

    let cancelled = false;
    (async () => {
      setStep('loading');
      setError('');
      try {
        const res = await fetchPreviewReport(sid, {
          signal: fetchTimeoutSignal(60_000),
        });
        if (!res.ok) {
          const detail =
            res.status === 404
              ? 'Report not ready yet — try again in a moment.'
              : `Could not load report (${res.status}).`;
          throw new Error(detail);
        }
        const data: ReportData = await res.json();
        if (cancelled) return;
        setReport(data);
        setStep('report');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setStep('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, report?.startup.id]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const p = await fetchPlatformStats();
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
      // Route through qualification questions before showing the report
      setPendingStartupId(result.startup_id);
      setStep('qualify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  };

  // Map Stage 1 answers to startup_uploads columns and load report
  const handleStage1Complete = async (answers: Stage1Answers) => {
    if (!pendingStartupId) return;
    setStage1Answers(answers);

    // Map radio answers → DB fields
    const update: Record<string, unknown> = {};
    if (answers.revenue_stage === 'pre_revenue') { update.has_revenue = false; }
    else if (answers.revenue_stage === 'revenue') { update.has_revenue = true; }
    else if (answers.revenue_stage === 'scaling') { update.has_revenue = true; update.growth_rate_monthly = update.growth_rate_monthly ?? 15; }

    if (answers.team_size === 'solo') update.team_size = 1;
    else if (answers.team_size === 'small') update.team_size = 3;
    else if (answers.team_size === 'larger') update.team_size = 8;

    if (answers.raised === 'none') { update.raise_amount = null; update.raise_type = 'bootstrapped'; }
    else if (answers.raised === 'angel_preseed') { update.raise_type = 'pre_seed'; }
    else if (answers.raised === 'seed_plus') { update.raise_type = 'seed'; }

    // Save to DB (best-effort — don't block the report load on failure)
    await supabase.from('startup_uploads').update(update).eq('id', pendingStartupId).catch(() => null);

    // Re-score matches with the updated DB fields, then load the report
    setStep('loading');
    try {
      // Re-compute GOD score + regenerate matches with the updated has_revenue / team_size fields
      await fetch(`/api/instant/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startup_id: pendingStartupId }),
      }).catch(() => null);

      const res = await fetchPreviewReport(pendingStartupId, { signal: fetchTimeoutSignal(60_000) });
      if (!res.ok) throw new Error(`Could not load report (${res.status}).`);
      const data: ReportData = await res.json();
      // Compute and store the stage-1 accuracy so we can show the improvement delta
      const acc = Math.min(65 + Math.round((data.startup.god_score / 100) * 10), 75);
      setStage1Accuracy(acc);
      setReport(data);
      setStep('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  };

  // Map Stage 2 answers and reload for refined matches
  const handleStage2Complete = async (answers: Stage2Answers) => {
    if (!pendingStartupId) return;
    setStage2Answers(answers);

    const update: Record<string, unknown> = {
      fundraising_timeline: answers.fundraising_timing,
      current_priority: answers.primary_focus,
    };
    // Map business_type to sectors (merge with existing)
    const sectorMap: Record<string, string> = {
      software: 'SaaS', ai: 'AI/ML', robotics: 'Robotics',
      energy: 'Energy', marketplace: 'Marketplace',
    };
    if (answers.business_type && answers.business_type !== 'other') {
      const currentSectors = report?.startup?.sectors ?? [];
      const newSector = sectorMap[answers.business_type];
      if (newSector && !currentSectors.includes(newSector)) {
        update.sectors = [newSector, ...currentSectors.slice(0, 3)];
      }
    }

    await supabase.from('startup_uploads').update(update).eq('id', pendingStartupId).catch(() => null);

    setStep('loading');
    try {
      // Re-score with updated sectors (Stage 2's key field — worth up to 40 pts in match scoring)
      await fetch(`/api/instant/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startup_id: pendingStartupId }),
      }).catch(() => null);

      const res = await fetchPreviewReport(pendingStartupId, { signal: fetchTimeoutSignal(60_000) });
      if (!res.ok) throw new Error(`Could not load report (${res.status}).`);
      const data: ReportData = await res.json();
      setReport(data);
      setStep('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('form');
    setUrl('');
    setError('');
    setReport(null);
    setPendingStartupId(null);
    setStage1Answers(null);
    setStage2Answers(null);
    setStage1Accuracy(null);
    navigate('/submit', { replace: true });
  };

  // ── Stage 1: qualification questions ─────────────────────────────────────
  if (step === 'qualify') {
    return (
      <Stage1Questions
        onComplete={handleStage1Complete}
        onBack={() => setStep('form')}
      />
    );
  }

  // ── Stage 2: refinement questions ─────────────────────────────────────────
  if (step === 'refine') {
    return (
      <Stage2Questions
        onComplete={handleStage2Complete}
        onBack={() => setStep('report')}
      />
    );
  }

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
    const isRefined = stage2Answers != null;
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col" style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(62,207,142,0.08) 0%, transparent 55%)' }}>
        <PythhUnifiedNav />
        <div className="flex-1 px-4 pt-12 pb-24">
          <div className="max-w-5xl mx-auto w-full">
            {/* Accuracy banner — only when questions were answered (not deep-linked) */}
            {stage1Answers && (
              <MatchAccuracyBanner
                godScore={report.startup.god_score}
                isRefined={isRefined}
                previousAccuracy={isRefined ? (stage1Accuracy ?? undefined) : undefined}
                onImprove={!isRefined ? () => setStep('refine') : undefined}
              />
            )}
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
