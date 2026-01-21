/**
 * IMPROVE ODDS SECTION - Coaching layer
 * =====================================
 */

import type { ImproveAction } from '../../types/convergence';
import { TrendingUp } from 'lucide-react';

interface Props {
  actions: ImproveAction[];
}

export function ImproveOddsSection({ actions }: Props) {
  if (!actions.length) return null;
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold">How To Improve Investor Alignment</h3>
      </div>
      
      <p className="text-xs text-gray-400 mb-4">
        Actions correlated with increased investor convergence for startups like yours.
      </p>
      
      <div className="space-y-4">
        {actions.map((action, i) => (
          <ImproveActionCard key={i} action={action} />
        ))}
      </div>
    </div>
  );
}

function ImproveActionCard({ action }: { action: ImproveAction }) {
  return (
    <div className="border-l-2 border-cyan-400/30 pl-4">
      <h4 className="font-bold text-white mb-1">{action.title}</h4>
      <p className="text-xs text-green-400 mb-2">Impact: +{action.impact_pct}% match probability</p>
      
      <ul className="space-y-1">
        {action.steps.map((step, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
