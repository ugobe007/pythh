/**
 * ALIGNMENT BREAKDOWN PANEL - Signal explainability
 * =================================================
 */

import type { AlignmentBreakdown } from '../../types/convergence';

interface Props {
  alignment: AlignmentBreakdown;
}

export function AlignmentBreakdownPanel({ alignment }: Props) {
  const dimensions = [
    { name: 'Team Signal Alignment', score: alignment.team_0_1 },
    { name: 'Market Velocity', score: alignment.market_0_1 },
    { name: 'Execution Tempo', score: alignment.execution_0_1 },
    { name: 'Portfolio Adjacency', score: alignment.portfolio_0_1 },
    { name: 'Phase Change Correlation', score: alignment.phase_change_0_1 }
  ];
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <h3 className="text-lg font-bold mb-4">Signal Alignment Breakdown</h3>
      
      <div className="space-y-4">
        {dimensions.map((dim, i) => (
          <DimensionBar key={i} name={dim.name} score={dim.score} />
        ))}
      </div>
      
      <ThresholdHint message={alignment.message} />
    </div>
  );
}

function DimensionBar({ name, score }: { name: string; score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="text-gray-300">{name}</span>
        <span className="text-cyan-400 font-mono">{score.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-700"
          style={{ width: `${score * 100}%` }}
        ></div>
      </div>
    </div>
  );
}

function ThresholdHint({ message }: { message: string }) {
  return (
    <p className="text-xs text-gray-400 mt-4 italic">
      {message}
    </p>
  );
}
