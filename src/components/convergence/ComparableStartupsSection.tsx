/**
 * COMPARABLE STARTUPS SECTION - Social proof layer
 * ================================================
 */

import type { ComparableStartup } from '../../types/convergence';

interface Props {
  startups: ComparableStartup[];
}

export function ComparableStartupsSection({ startups }: Props) {
  if (!startups.length) return null;
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Startups With Similar Signal Profiles</h2>
        <p className="text-gray-400 text-sm">
          Companies whose behavioral and phase-change patterns currently resemble yours.
        </p>
      </div>

      <div className="space-y-3">
        {startups.map((startup) => (
          <SimilarStartupCard key={startup.startup_id} startup={startup} />
        ))}
      </div>
    </div>
  );
}

function SimilarStartupCard({ startup }: { startup: ComparableStartup }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-400/30 transition">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-bold text-white">{startup.name}</h4>
          <p className="text-xs text-gray-400">
            {startup.industry || startup.sector} • {startup.stage}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-cyan-400">{startup.god_score_0_10.toFixed(1)}</div>
          <div className="text-xs text-gray-400">GOD Score</div>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs mb-2">
        <FOMOBadge state={startup.fomo_state} />
        <span className="text-gray-400">{startup.matched_investors} matched investors</span>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2">
        {startup.reason_tags.map((tag, i) => (
          <span 
            key={i}
            className="text-xs text-cyan-400/70 bg-cyan-400/5 px-2 py-1 rounded"
          >
            {formatReasonTag(tag)}
          </span>
        ))}
      </div>
    </div>
  );
}

function FOMOBadge({ state }: { state: string }) {
  const config = {
    breakout: { emoji: '🚀', label: 'Breakout' },
    surge: { emoji: '🔥', label: 'Surge' },
    warming: { emoji: '🌡', label: 'Warming' },
    watch: { emoji: '👀', label: 'Watch' }
  };
  
  const cfg = config[state as keyof typeof config] || config.watch;
  return <span className="text-gray-500">{cfg.emoji} {cfg.label}</span>;
}

function formatReasonTag(tag: string): string {
  return tag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
