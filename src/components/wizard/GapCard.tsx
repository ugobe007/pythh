/**
 * GAP CARD
 * Displays a single gap-closing task during the commitment wizard flow.
 * Shows: component, current score, projected score after completion, task details.
 */

import { CheckCircle, SkipForward, TrendingUp, Zap } from 'lucide-react';

const COMPONENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  team:     { bg: 'rgba(168,85,247,0.08)',  text: '#c084fc', border: 'rgba(168,85,247,0.25)' },
  traction: { bg: 'rgba(16,185,129,0.08)',  text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  market:   { bg: 'rgba(251,146,60,0.08)',  text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  product:  { bg: 'rgba(56,189,248,0.08)',  text: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  vision:   { bg: 'rgba(250,204,21,0.08)',  text: '#facc15', border: 'rgba(250,204,21,0.25)' },
};

const COMPONENT_LABELS: Record<string, string> = {
  team: 'Team Score',
  traction: 'Traction Score',
  market: 'Market Score',
  product: 'Product Score',
  vision: 'Vision Score',
};

export interface GapTask {
  task_key: string;
  component: string;
  component_score: number;
  title: string;
  description: string;
  impact_points: number;
  proof_type: 'text' | 'names_list' | 'count' | 'url';
  proof_label: string;
  priority: number;
  existing_status?: string | null;
}

interface GapCardProps {
  task: GapTask;
  taskIndex: number;
  totalTasks: number;
  onAcknowledge: () => void;
  onSkip: () => void;
  isLast: boolean;
}

function ScoreBar({ score, projected, color }: { score: number; projected: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Current</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>After completing</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {/* Current score */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: 'rgba(255,255,255,0.15)' }}
        />
        {/* Projected score */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, projected)}%`,
            background: color,
            opacity: 0.7,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-mono">
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{score}/100</span>
        <span style={{ color }}>~{Math.min(100, projected)}/100</span>
      </div>
    </div>
  );
}

export default function GapCard({
  task,
  taskIndex,
  totalTasks,
  onAcknowledge,
  onSkip,
  isLast,
}: GapCardProps) {
  const colors = COMPONENT_COLORS[task.component] || COMPONENT_COLORS.team;
  const projectedScore = Math.min(100, task.component_score + task.impact_points);

  return (
    <div className="w-full max-w-lg mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Header pill */}
      <div className="flex items-center justify-between mb-6">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <Zap className="w-3 h-3" />
          {COMPONENT_LABELS[task.component] || task.component}
        </span>
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {taskIndex + 1} of {totalTasks}
        </span>
      </div>

      {/* Score bar */}
      <div
        className="rounded-xl p-4 mb-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <ScoreBar score={task.component_score} projected={projectedScore} color={colors.text} />
      </div>

      {/* Task content */}
      <div className="mb-6">
        <h2
          className="text-xl font-bold text-white mb-3 leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}
        >
          {task.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {task.description}
        </p>
      </div>

      {/* Impact callout */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: colors.text }} />
        <p className="text-sm" style={{ color: colors.text }}>
          Completing this adds approximately{' '}
          <span className="font-bold">+{task.impact_points} GOD points</span>
          {' '}— improving your investor match quality.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onAcknowledge}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm text-black transition-all duration-200 active:scale-95"
          style={{ background: colors.text }}
        >
          <CheckCircle className="w-4 h-4" />
          I'll do this — set my deadline
        </button>

        <button
          onClick={onSkip}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            color: 'rgba(255,255,255,0.35)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip for now
        </button>
      </div>

      {isLast && (
        <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Last gap — after this you'll see your commitment doc
        </p>
      )}
    </div>
  );
}
