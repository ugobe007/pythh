/**
 * MATCH ACCURACY BANNER
 *
 * Shown above the investor report to surface match quality and prompt Stage 2.
 *
 * Stage 1 only:  shows ~65–75% accuracy + "Improve Your Matches" CTA
 * Stage 1+2:     shows ~80–91% accuracy + "Refined" pill, no CTA
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, TrendingUp } from 'lucide-react';

interface MatchAccuracyBannerProps {
  godScore: number;
  isRefined: boolean;
  previousAccuracy?: number;
  onImprove?: () => void;
  startupId?: string | null;
}

function computeAccuracy(godScore: number, refined: boolean): number {
  // Stage 1: 65–75% (based on GOD score)
  // Stage 2: 80–91% (meaningful jump after strategic questions)
  const base = refined ? 80 : 65;
  const bonus = Math.round((godScore / 100) * (refined ? 11 : 10));
  return Math.min(base + bonus, refined ? 91 : 75);
}

export default function MatchAccuracyBanner({
  godScore,
  isRefined,
  previousAccuracy,
  onImprove,
  startupId,
}: MatchAccuracyBannerProps) {
  const navigate = useNavigate();
  const accuracy = computeAccuracy(godScore, isRefined);
  const improved = isRefined && previousAccuracy != null;

  return (
    <div
      className="w-full rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
      style={{
        background: isRefined
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 100%)'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isRefined ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* Left: accuracy meter */}
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="22"
              fill="none"
              stroke={isRefined ? '#34d399' : '#22d3ee'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - accuracy / 100)}`}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-sm font-bold"
            style={{ color: isRefined ? '#34d399' : '#22d3ee' }}
          >
            {accuracy}%
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white">Match Accuracy</span>
            {isRefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                <Sparkles className="w-2.5 h-2.5" /> Refined
              </span>
            )}
          </div>
          {improved ? (
            <p className="text-xs text-zinc-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>
                Up from <span className="text-zinc-300">{previousAccuracy}%</span>
                {' '}— your answers narrowed the field
              </span>
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              Based on your URL + 3 qualifying answers
            </p>
          )}
        </div>
      </div>

      {/* Right: CTA or refined actions */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {!isRefined && onImprove && (
          <button
            onClick={onImprove}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-all duration-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Improve Your Matches
          </button>
        )}

        {isRefined && startupId && (
          <button
            onClick={() => navigate(`/app/wizard/${startupId}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              background: 'rgba(52,211,153,0.1)',
              color: '#34d399',
              border: '1px solid rgba(52,211,153,0.25)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Build Your Readiness Doc
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {isRefined && !startupId && (
          <p className="text-xs text-zinc-500 text-right max-w-[180px]">
            Matches updated with your strategic profile
          </p>
        )}
      </div>
    </div>
  );
}
