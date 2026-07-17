/**
 * Peter intro concierge — ask for thesis framing + intro path without full signup.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { X, Send, CheckCircle2 } from 'lucide-react';
import { requestPeterIntroHelp } from '@/lib/peterIntro';
import type { GatedInvestorContext } from '@/lib/founderSignupGate';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';

type Props = {
  open: boolean;
  onClose: () => void;
  startupId: string;
  startupName: string;
  startupUrl?: string;
  investor?: GatedInvestorContext | null;
  source: string;
};

export default function PeterIntroPanel({
  open,
  onClose,
  startupId,
  startupName,
  startupUrl,
  investor,
  source,
}: Props) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDone(false);
  }, [open, investor?.id]);

  if (!open) return null;

  const investorLine = investor
    ? formatInvestorDisplayLabel(investor.name, investor.firm)
    : 'your top thesis-fit match';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await requestPeterIntroHelp({
      email,
      startupId,
      startupName,
      startupUrl,
      investor,
      note,
      source,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Something went wrong');
      return;
    }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="peter-intro-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-zinc-800">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-mono mb-1">
              Peter · Pythh
            </p>
            <h2 id="peter-intro-title" className="text-lg font-semibold text-white leading-snug">
              Why did this investor surface?
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Peter interprets conviction signals — thesis fit, timing, and framing. Not a warm intro broker.
              Reply with context and he&apos;ll walk through why this match appeared and whether it&apos;s worth a conversation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-white font-medium">Request received</p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Peter will email you within <strong className="text-zinc-300">2 business days</strong> with why{' '}
              {investorLine} surfaced — thesis angle, timing, and what to lead with.
            </p>
            <Link href="/signup/founder">
              <a className="inline-block text-sm text-emerald-400 hover:underline">
                Create free account to track your shortlist →
              </a>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="block w-full mt-2 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-5 space-y-4">
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800 px-3 py-2.5 text-xs text-zinc-400">
              <span className="text-zinc-500">Startup:</span> {startupName}
              <br />
              <span className="text-zinc-500">Target:</span> {investorLine}
            </div>

            <div>
              <label htmlFor="peter-intro-email" className="block text-xs text-zinc-400 mb-1.5">
                Your email
              </label>
              <input
                id="peter-intro-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@company.com"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label htmlFor="peter-intro-note" className="block text-xs text-zinc-400 mb-1.5">
                Context (optional)
              </label>
              <textarea
                id="peter-intro-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Stage, round size, any mutual connections, or what you tried so far…"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-sm font-semibold"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending…' : 'Ask Peter for intro help'}
            </button>

            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
              No deck required. Peter replies personally — not an automated intro.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Compact strip for preview pages */
export function PeterIntroStrip({
  onAskPeter,
  className = '',
  variant = 'default',
}: {
  onAskPeter: () => void;
  className?: string;
  variant?: 'default' | 'secondary';
}) {
  const secondary = variant === 'secondary';
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        secondary ? 'border-zinc-800 bg-zinc-900/40' : 'border-emerald-500/25 bg-emerald-500/5'
      } ${className}`}
    >
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-mono uppercase tracking-wide mb-0.5 ${
            secondary ? 'text-zinc-500' : 'text-emerald-500/90'
          }`}
        >
          Peter · optional
        </p>
        <p className="text-sm text-zinc-400 leading-snug">
          Need thesis framing before you reach out? Peter explains why each investor surfaced.
        </p>
      </div>
      <button
        type="button"
        onClick={onAskPeter}
        className={
          secondary
            ? 'shrink-0 text-sm text-zinc-400 hover:text-emerald-400 underline-offset-2 hover:underline whitespace-nowrap py-1'
            : 'shrink-0 px-4 py-2 rounded-lg border border-emerald-500/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/10 whitespace-nowrap'
        }
      >
        Ask Peter for intro help
      </button>
    </div>
  );
}
