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

// ─── Steps ────────────────────────────────────────────────────────────────────

type Step = 'form' | 'loading' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

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
    // Basic URL check
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {resultName ? `${resultName} is in the pipeline!` : "You're in the pipeline!"}
          </h1>
          <p className="text-zinc-400 text-sm mb-8">
            We're scoring your startup with the GOD Algorithm and matching you with investors.
            This usually takes under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {resultId && (
              <button
                onClick={() => navigate(`/matches/preview/${resultId}`)}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-medium rounded-lg transition"
              >
                <Flame className="w-4 h-4" />
                See Your Matches
              </button>
            )}
            <button
              onClick={() => { setStep('form'); setUrl(''); setResultId(null); setResultName(null); }}
              className="px-5 py-2.5 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 transition text-sm"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="max-w-2xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-medium rounded-full mb-4">
            <Zap className="w-3.5 h-3.5" />
            GOD Score + Investor Matching
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Get Your Startup Scored &amp; Matched
          </h1>
          <p className="text-zinc-400 text-base max-w-lg mx-auto">
            Enter your website URL. Pythh's GOD Algorithm will score your startup 0–100 and match you with the investors most aligned to your thesis.
          </p>
        </div>

        {/* What you get */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', title: 'GOD Score', desc: 'Composite 0–100 investor-readiness rating' },
            { icon: Star, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', title: 'Top Investors', desc: 'Ranked matches based on fit, thesis & check size' },
            { icon: Rocket, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', title: 'Signal Insights', desc: 'Why investors match — and what to improve' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className={`p-4 rounded-xl border ${bg} text-center`}>
              <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
              <div className="text-white font-semibold text-sm">{title}</div>
              <div className="text-zinc-500 text-xs mt-1">{desc}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Startup Website URL
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); }}
                placeholder="yourcompany.com"
                disabled={step === 'loading'}
                className="w-full pl-9 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={step === 'loading' || !url.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition text-sm"
            >
              {step === 'loading' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
            <p className="mt-3 text-red-400 text-sm">{error}</p>
          )}

          <p className="mt-3 text-zinc-600 text-xs">
            Free to run. No account required. Results appear in &lt;60 seconds.
          </p>
        </form>

        {/* Already on Pythh? */}
        <div className="mt-8 text-center text-zinc-600 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-400 hover:text-orange-300 transition">
            Sign in to track your score history
            <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
          </Link>
        </div>

        {/* Trust bar */}
        <div className="mt-10 pt-8 border-t border-zinc-800/50 text-center">
          <p className="text-zinc-600 text-xs mb-3">Used by founders at</p>
          <p className="text-zinc-500 text-xs">
            The GOD Algorithm evaluates team, traction, market, product & vision — the same dimensions top VCs use to evaluate deals.
          </p>
        </div>
      </div>
    </div>
  );
}
