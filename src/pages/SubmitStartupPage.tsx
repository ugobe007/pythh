/**
 * /submit — Self-serve startup intake form
 * ════════════════════════════════════════════
 * Founders submit their startup for GOD scoring + investor matching.
 * Wraps the existing submitStartup() service.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, Globe, CheckCircle, ChevronRight, Flame, Star, ArrowRight } from 'lucide-react';
import { submitStartup } from '../services/submitStartup';
import PythhUnifiedNav from '../components/PythhUnifiedNav';

type Step = 'form' | 'loading' | 'done' | 'error';

export default function SubmitStartupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [resultId, setResultId] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) { setError('Enter your startup website URL.'); return; }
    const hasProto = /^https?:\/\//i.test(trimmed);
    const candidate = hasProto ? trimmed : `https://${trimmed}`;
    setError('');
    setStep('loading');
    try {
      const result = await submitStartup(candidate);
      if (result.status === 'error' || result.status === 'not_found') {
        setError(result.error || 'We could not process that URL. Please double-check and try again.');
        setStep('error');
        return;
      }
      setResultId(result.startup_id);
      setResultName(result.name);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  };

  // ── Done state ──
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col"
        style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(62,207,142,0.12) 0%, transparent 60%)' }}>
        <PythhUnifiedNav />
        <div className="flex-1 flex items-center justify-center px-4 py-20"
        style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(62,207,142,0.12) 0%, transparent 60%)' }}>
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-full border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: '0 0 60px rgba(62,207,142,0.2), inset 0 0 30px rgba(62,207,142,0.05)' }}>
            <CheckCircle className="w-9 h-9 text-emerald-400" />
          </div>
          <p className="text-xs font-mono tracking-[0.2em] text-emerald-500/60 uppercase mb-4">Pipeline confirmed</p>
          <h1 className="text-3xl font-semibold text-white mb-3">
            {resultName ? <>{resultName}<br /><span className="text-zinc-400">is in the queue.</span></> : "You're in the queue."}
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed mb-10">
            The GOD Algorithm is scoring your startup and surfacing matched investors.<br />
            Usually completes in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {resultId && (
              <button
                onClick={() => navigate(`/matches/preview/${resultId}`)}
                className="flex items-center gap-2 px-6 py-3 border border-orange-500/50 text-orange-400 hover:border-orange-400 hover:text-orange-300 font-medium rounded-xl transition text-sm"
                style={{ boxShadow: '0 0 20px rgba(249,115,22,0.1)' }}
              >
                <Flame className="w-4 h-4" />
                See Your Matches
              </button>
            )}
            <button
              onClick={() => { setStep('form'); setUrl(''); setResultId(null); setResultName(null); }}
              className="px-6 py-3 border border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 rounded-xl transition text-sm"
            >
              Submit Another
            </button>
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

  return (
    <div
      className="min-h-screen bg-[#080808] flex flex-col"
      style={{
        backgroundImage: [
          'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(62,207,142,0.09) 0%, transparent 60%)',
          'radial-gradient(ellipse 60% 30% at 80% 60%, rgba(6,182,212,0.05) 0%, transparent 50%)',
          'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: 'auto, auto, 48px 48px, 48px 48px',
      }}
    >
      <PythhUnifiedNav />
      <div className="flex-1 px-4 pt-16 pb-24">
      <div className="max-w-2xl mx-auto">

        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(62,207,142,1)]" />
          <span className="text-xs font-mono tracking-[0.2em] text-zinc-500 uppercase">GOD Score + Investor Matching</span>
        </div>

        {/* Headline */}
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
            <span className="text-white">Score your startup.</span><br />
            <span style={{
              background: 'linear-gradient(90deg, #cbd5e1 0%, #e2e8f0 50%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Find your investors.</span>
          </h1>
          <p className="text-zinc-500 text-lg leading-relaxed max-w-md mx-auto">
            Drop your URL. The GOD Algorithm scores you 0–100 and surfaces the investors built for your thesis.
          </p>
        </div>

        {/* ── URL FORM — HERO POSITION ── */}
        <form
          onSubmit={handleSubmit}
          className="relative mb-5"
        >
          {/* Glow behind the form */}
          <div className="absolute inset-0 rounded-2xl blur-2xl opacity-20"
            style={{ background: 'linear-gradient(90deg, rgba(62,207,142,0.4), rgba(6,182,212,0.3))' }} />

          <div className="relative flex flex-col sm:flex-row gap-3 p-2 border border-zinc-800/80 rounded-2xl bg-zinc-950/70 backdrop-blur-sm"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex-1 relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); }}
                placeholder="yourcompany.com"
                disabled={step === 'loading'}
                autoFocus
                className="w-full pl-11 pr-4 py-4 bg-transparent text-white placeholder-zinc-700 text-base focus:outline-none disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={step === 'loading' || !url.trim()}
              className="flex items-center justify-center gap-2 px-7 py-4 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 hover:bg-orange-500/5 disabled:opacity-30 disabled:cursor-not-allowed font-semibold rounded-xl transition text-sm whitespace-nowrap"
              style={{ boxShadow: '0 0 24px rgba(249,115,22,0.15)' }}
            >
              {step === 'loading' ? (
                <>
                  <span className="w-4 h-4 border border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  Analyze <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-red-400/80 text-xs font-mono text-center">{error}</p>
          )}
        </form>

        {/* Sub-form meta */}
        <p className="text-center text-zinc-700 text-xs mb-16">
          Free to run · No account required · Results in &lt;60 seconds
        </p>

        {/* What you get — 3 inline cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-14">
          {[
            { icon: Flame,  color: 'text-orange-400', glow: 'rgba(249,115,22,0.15)',  border: 'border-orange-500/15', label: 'GOD Score',       desc: 'Composite 0–100 investor-readiness rating' },
            { icon: Star,   color: 'text-cyan-400',   glow: 'rgba(6,182,212,0.15)',   border: 'border-cyan-500/15',   label: 'Top Investors',   desc: 'Ranked by fit, thesis & check size' },
            { icon: Rocket, color: 'text-emerald-400',glow: 'rgba(62,207,142,0.15)',  border: 'border-emerald-500/15',label: 'Signal Insights', desc: 'Why you match — and what to strengthen' },
          ].map(({ icon: Icon, color, glow, border, label, desc }) => (
            <div key={label}
              className={`flex flex-col gap-2 px-5 py-4 border ${border} rounded-xl bg-zinc-950/40 backdrop-blur-sm`}
              style={{ boxShadow: `0 0 30px ${glow}` }}>
              <Icon className={`w-5 h-5 ${color}`} />
              <div className="text-white text-sm font-semibold">{label}</div>
              <div className="text-zinc-600 text-xs leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        {/* Sign in */}
        <p className="text-zinc-600 text-sm text-center mb-12">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-500 hover:text-cyan-400 transition inline-flex items-center gap-1">
            Sign in to track your score history <ArrowRight className="w-3 h-3" />
          </Link>
        </p>

        {/* Trust footer */}
        <div className="pt-8 border-t border-zinc-900/80 text-center">
          <p className="text-zinc-800 text-xs">
            The GOD Algorithm evaluates team, traction, market, product & vision — the same dimensions top VCs use to evaluate deals.
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
