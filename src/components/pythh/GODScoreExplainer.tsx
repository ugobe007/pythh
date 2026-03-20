// ============================================================================
// GODScoreExplainer — Founder-friendly explanation of the GOD score
// ============================================================================
// Frames the score around tier 1 VC investment criteria so founders understand
// what it means and why it matters. Used wherever GOD score is rendered.
// ============================================================================

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export const GOD_SCORE_COPY = {
  /** One-line summary (for tooltips, inline) */
  tagline:
    'Your investment readiness based on the same criteria tier 1 VCs use: team, traction, market, product, and vision.',
  /** Full founder-facing explanation */
  full: `Your score reflects how strong your startup looks on the same criteria tier 1 VCs use when evaluating deals: team, traction, market, product, and vision.

It's not a prediction—it's a snapshot of your current investment readiness. Think of it as "how would a top fund assess us today?"

Higher scores indicate stronger fundamentals. Components: Team (founder fit, execution), Traction (growth, revenue signals), Market (size, timing), Product (differentiation), Vision (clarity, roadmap).`,
  /** VC criteria framing */
  vcCriteria: [
    { label: 'Team', desc: 'Founder fit, experience, cohesion' },
    { label: 'Traction', desc: 'Growth, revenue, milestones' },
    { label: 'Market', desc: 'Size, timing, dynamics' },
    { label: 'Product', desc: 'Differentiation, execution' },
    { label: 'Vision', desc: 'Strategy, roadmap, storytelling' },
  ],
};

// -----------------------------------------------------------------------------
// Inline tooltip trigger (info icon) — use next to "GOD" label
// -----------------------------------------------------------------------------

interface GODScoreExplainerProps {
  variant?: 'icon' | 'inline' | 'full';
  className?: string;
}

export function GODScoreExplainer({ variant = 'icon', className = '' }: GODScoreExplainerProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="text-zinc-500 hover:text-cyan-400 transition-colors focus:outline-none focus:ring-0"
        title={GOD_SCORE_COPY.tagline}
        aria-label="What is GOD score?"
      >
        {variant === 'icon' ? (
          <HelpCircle className="w-3.5 h-3.5" />
        ) : (
          <span className="text-xs text-zinc-500 hover:text-cyan-400 underline decoration-dotted cursor-help">
            What's this?
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="absolute z-50 left-0 top-6 w-80 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 text-left"
            role="dialog"
            aria-labelledby="god-explainer-title"
          >
            <h4 id="god-explainer-title" className="text-sm font-semibold text-white mb-2">
              GOD Score — Investment Readiness
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed mb-3">
              {GOD_SCORE_COPY.tagline}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              It's not a prediction—it's a snapshot of how top VCs would assess you today on the
              criteria that matter most.
            </p>
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                Built from (what VCs evaluate)
              </p>
              <ul className="text-xs text-zinc-400 space-y-1">
                {GOD_SCORE_COPY.vcCriteria.map(({ label, desc }) => (
                  <li key={label} className="flex gap-2">
                    <span className="text-cyan-400/80 font-medium w-14">{label}</span>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

export default GODScoreExplainer;
