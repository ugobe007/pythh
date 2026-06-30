/**
 * Post-signup Oracle activation — nudge to gap map + locked outreach preview.
 */

import { ArrowRight, Lock, Sparkles } from 'lucide-react';

type Props = {
  startupName?: string;
  gapCount?: number;
  onOpenRound: () => void;
  onDismiss: () => void;
};

export default function WizardActivationBanner({
  startupName,
  gapCount,
  onOpenRound,
  onDismiss,
}: Props) {
  return (
    <div className="mb-6 rounded-xl border border-violet-500/35 bg-gradient-to-r from-violet-600/10 to-zinc-900/80 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/30 shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[2px] text-violet-400/90 mb-1">Account created · Investor tracking on</p>
          <h2 className="text-base font-bold text-white mb-1">
            {startupName ? `${startupName} — ` : ''}track your top matches
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-3">
            {gapCount && gapCount > 0
              ? `Your shortlist is saved. Oracle found ${gapCount} readiness unlock${gapCount > 1 ? 's' : ''} — fix gap #1, then preview outreach to your tracked investors.`
              : 'Your shortlist is saved. Open the Round tab to track intro requests and preview PYTHIA outreach.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenRound}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              Open investor pipeline
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
