/**
 * /submit — Self-serve startup intake form
 * ════════════════════════════════════════════
 * Founders submit their startup for GOD scoring + investor matching.
 * Wraps the existing submitStartup() service.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, Globe, CheckCircle, ChevronRight, Flame, Star, Zap, ArrowRight } from 'lucide-react';
import { submitStartup } from '../services/submitStartup';

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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(62,207,142,0.06) 0%, transparent 60%)' }}>
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-full border border-emerald-500/40 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: '0 0 32px rgba(62,207,142,0.15)' }}>
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <p className="text-xs font-mono tracking-widest text-emerald-500/70 uppercase mb-3">Pipeline confirmed</p>
          <h1 className="text-2xl font-semibold text-white mb-3">
            {resultName ? `${resultName} is in the queue.` : "You're in the queue."}
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed mb-10">
            The GOD Algorithm is scoring your startup and surfacing matched investors.<br />
            Usually completes in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {resultId && (
              <button
                onClick={() => navigate(`/matches/preview/${resultId}`)}
                className="flex items-center gap-2 px-5 py-2.5 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 font-medium rounded-lg transition text-sm"
              >
                <Flame className="w-4 h-4" />
                See Your Matches
              </button>
            )}
            <button
              onClick={() => { setStep('form'); setUrl(''); setResultId(null); setResultName(null); }}
              className="px-5 py-2.5 border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 rounded-lg transition text-sm"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] px-4 py-20"
      style={{
        backgroundImage: [
          'radial-gradient(circle at 50% -10%, rgba(62,207,142,0.07) 0%, transparent 55%)',
          'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: 'auto, 40px 40px, 40px 40px',
      }}
    >
      <div className="max-w-xl mx-auto">

        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(62,207,142,0.8)]" />
          <span className="text-xs font-mono tracking-widest text-zinc-500 uppercase">GOD Score + Investor Matching</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.1] mb-4">
          Get scored.<br />
          <span className="text-zinc-400">Get matched.</span>
        </h1>
        <p className="text-zinc-500 text-base leading-relaxed mb-12 max-w-sm">
          Drop your URL. Pythh's GOD Algorithm scores your startup 0–100 and surfaces the investors most aligned to your thesis.
        </p>

        {/* What you get — inline list */}
        <div className="flex flex-col gap-3 mb-12">
          {[
            { icon: Flame,  color: 'text-orange-400', border: 'border-orange-500/20', label: 'GOD Score',       desc: 'Composite 0–100 investor-readiness rating' },
            { icon: Star,   color: 'text-cyan-400',   border: 'border-cyan-500/20',   label: 'Top Investors',   desc: 'Ranked by fit, thesis & check size' },
            { icon: Rocket, color: 'text-emerald-400',border: 'border-emerald-500/20',label: 'Signal Insights', desc: 'Why you match — and what to strengthen' },
          ].map(({ icon: Icon, color, border, label, desc }) => (
            <div key={label} className={`flex items-center gap-4 px-4 py-3 border ${border} rounded-xl`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg border ${border} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <span className="text-white text-sm font-medium">{label}</span>
                <span className="text-zinc-600 text-sm"> — {desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="border border-zinc-800/80 rounded-2xl p-6 sm:p-8 bg-zinc-950/50 backdrop-blur-sm">
          <label className="block text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Startup Website URL
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); }}
                placeholder="yourcompany.com"
                disabled={step === 'loading'}
                className="w-full pl-9 pr-4 py-3 bg-transparent border border-zinc-800 rounded-xl text-white placeholder-zinc-700 text-sm focus:outline-none focus:border-emerald-500/60 focus:shadow-[0_0_0_3px_rgba(62,207,142,0.08)] transition disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={step === 'loading' || !url.trim()}
              className="flex items-center gap-2 px-5 py-3 border border-orange-500/50 text-orange-400 hover:border-orange-400 hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed font-medium rounded-xl transition text-sm"
            >
              {step === 'loading' ? (
                <>
                  <span className="w-3.5 h-3.5 border border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  Analyze
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-red-400/80 text-xs font-mono">{error}</p>
          )}

          <p className="mt-4 text-zinc-700 text-xs">
            Free to run. No account required. Results appear in &lt;60 seconds.
          </p>
        </form>

        {/* Sign in */}
        <p className="mt-6 text-zinc-600 text-sm text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-500 hover:text-cyan-400 transition inline-flex items-center gap-1">
            Sign in to track your score history <ArrowRight className="w-3 h-3" />
          </Link>
        </p>

        {/* Divider + trust */}
        <div className="mt-12 pt-8 border-t border-zinc-900 text-center">
          <p className="text-zinc-700 text-xs">
            The GOD Algorithm evaluates team, traction, market, product & vision —<br className="hidden sm:block" /> the same dimensions top VCs use to evaluate deals.
          </p>
        </div>

      </div>
    </div>
  );
}
