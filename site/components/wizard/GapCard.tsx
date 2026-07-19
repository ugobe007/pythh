/**
 * GAP CARD — Act 2 unlock framing
 * Each card surfaces an advantage to commit to, not a failure to fix.
 */

import { CheckCircle, SkipForward, Unlock, Users, Shield, TrendingUp, Zap } from 'lucide-react';

const COMPONENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  team:     { bg: 'rgba(168,85,247,0.08)',  text: '#c084fc', border: 'rgba(168,85,247,0.25)' },
  traction: { bg: 'rgba(16,185,129,0.08)',  text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  market:   { bg: 'rgba(251,146,60,0.08)',  text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  product:  { bg: 'rgba(56,189,248,0.08)',  text: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  vision:   { bg: 'rgba(250,204,21,0.08)',  text: '#facc15', border: 'rgba(250,204,21,0.25)' },
};

const COMPONENT_LABELS: Record<string, string> = {
  team: 'Team',
  traction: 'Traction',
  market: 'Market',
  product: 'Product',
  vision: 'Vision',
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
  /** Act 2 unlock fields (from API) */
  partner_objection?: string;
  objection_removed?: string;
  investors_unlocked_estimate?: number;
  projected_god_score?: number;
  projected_component_score?: number;
}

interface GapCardProps {
  task: GapTask;
  taskIndex: number;
  totalTasks: number;
  totalAvailable?: number;
  godScore?: number | null;
  onAcknowledge: () => void;
  onSkip: () => void;
  onSkipToOutreach?: () => void;
  isLast: boolean;
}

function ScoreBar({ score, projected, color }: { score: number; projected: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: 'oklch(0.45 0.01 264)' }}>Today</span>
        <span style={{ color: 'oklch(0.45 0.01 264)' }}>After unlock</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'oklch(0.18 0.01 264)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: 'oklch(0.28 0.01 264)' }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, projected)}%`, background: color, opacity: 0.75 }}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-mono">
        <span style={{ color: 'oklch(0.5 0.01 264)' }}>{score}/100</span>
        <span style={{ color }}>~{Math.min(100, projected)}/100</span>
      </div>
    </div>
  );
}

export default function GapCard({
  task,
  taskIndex,
  totalTasks,
  totalAvailable,
  godScore,
  onAcknowledge,
  onSkip,
  onSkipToOutreach,
  isLast,
}: GapCardProps) {
  const colors = COMPONENT_COLORS[task.component] || COMPONENT_COLORS.team;
  const projectedComponent = task.projected_component_score ?? Math.min(100, task.component_score + task.impact_points);
  const investorsUnlocked = task.investors_unlocked_estimate ?? Math.max(8, Math.round(task.impact_points * 1.2));

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <Unlock className="w-3 h-3" />
          {COMPONENT_LABELS[task.component] || task.component} unlock
        </span>
        <span className="text-xs font-mono" style={{ color: 'oklch(0.38 0.01 264)' }}>
          {taskIndex + 1} of {totalTasks}
          {totalAvailable != null && totalAvailable > totalTasks
            ? ` (${totalAvailable} total — optional)`
            : ''}
        </span>
      </div>

      {/* Unlock metrics strip */}
      <div
        className="grid grid-cols-3 gap-2 mb-5 rounded-xl p-3"
        style={{ background: 'oklch(0.12 0.01 264)', border: '1px solid oklch(0.2 0.01 264)' }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp size={11} style={{ color: colors.text }} />
            <span className="text-sm font-bold font-mono" style={{ color: colors.text }}>+{task.impact_points}</span>
          </div>
          <p className="text-[9px] tracking-widest uppercase" style={{ color: 'oklch(0.4 0.01 264)' }}>GOD pts</p>
        </div>
        <div className="text-center" style={{ borderLeft: '1px solid oklch(0.2 0.01 264)', borderRight: '1px solid oklch(0.2 0.01 264)' }}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Users size={11} style={{ color: '#22d3ee' }} />
            <span className="text-sm font-bold font-mono" style={{ color: '#22d3ee' }}>~{investorsUnlocked}</span>
          </div>
          <p className="text-[9px] tracking-widest uppercase" style={{ color: 'oklch(0.4 0.01 264)' }}>Investors</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Zap size={11} style={{ color: '#eab308' }} />
            <span className="text-sm font-bold font-mono" style={{ color: '#eab308' }}>
              {godScore != null && task.projected_god_score != null
                ? `${godScore}→${task.projected_god_score}`
                : `+${task.impact_points}`}
            </span>
          </div>
          <p className="text-[9px] tracking-widest uppercase" style={{ color: 'oklch(0.4 0.01 264)' }}>GOD total</p>
        </div>
      </div>

      {/* Component score bar */}
      <div
        className="rounded-xl p-4 mb-5"
        style={{ background: 'oklch(0.11 0.01 264)', border: '1px solid oklch(0.2 0.01 264)' }}
      >
        <ScoreBar score={task.component_score} projected={projectedComponent} color={colors.text} />
      </div>

      {/* Task content */}
      <div className="mb-5">
        <h2
          className="text-xl font-bold mb-3 leading-tight"
          style={{ color: 'oklch(0.94 0.005 264)', letterSpacing: '-0.02em' }}
        >
          {task.title}
        </h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'oklch(0.55 0.01 264)' }}>
          {task.description}
        </p>
        {task.proof_label && (
          <div
            className="rounded-lg px-3 py-2.5 text-xs"
            style={{ background: 'oklch(0.11 0.01 264)', border: '1px solid oklch(0.2 0.01 264)' }}
          >
            <p className="font-semibold mb-0.5" style={{ color: '#22d3ee' }}>When you prove this later, you&apos;ll provide:</p>
            <p style={{ color: 'oklch(0.6 0.01 264)' }}>{task.proof_label}</p>
            <p className="mt-1.5" style={{ color: 'oklch(0.42 0.01 264)' }}>
              Right now you&apos;re only picking a deadline — not filling this in yet.
            </p>
          </div>
        )}
      </div>

      {/* Partner objection → removed */}
      {(task.partner_objection || task.objection_removed) && (
        <div className="space-y-2 mb-5">
          {task.partner_objection && (
            <div
              className="rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)' }}
            >
              <Shield size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#fb923c' }} />
              <div>
                <p className="text-[10px] font-semibold tracking-widest mb-0.5" style={{ color: '#fb923c' }}>TODAY IN PARTNER MEETING</p>
                <p className="text-xs italic leading-snug" style={{ color: 'oklch(0.55 0.01 264)' }}>{task.partner_objection}</p>
              </div>
            </div>
          )}
          {task.objection_removed && (
            <div
              className="rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <Unlock size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#34d399' }} />
              <div>
                <p className="text-[10px] font-semibold tracking-widest mb-0.5" style={{ color: '#34d399' }}>AFTER YOU UNLOCK</p>
                <p className="text-xs leading-snug" style={{ color: 'oklch(0.6 0.01 264)' }}>{task.objection_removed}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onAcknowledge}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm text-black transition-all duration-200 active:scale-[0.98]"
          style={{ background: '#22c55e' }}
        >
          <CheckCircle className="w-4 h-4" />
          Commit to this — pick a deadline
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ color: 'oklch(0.42 0.01 264)', border: '1px solid oklch(0.22 0.01 264)' }}
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip this suggestion
        </button>

        {onSkipToOutreach && (
          <button
            type="button"
            onClick={onSkipToOutreach}
            className="w-full py-2.5 rounded-xl text-xs font-semibold"
            style={{ color: '#22d3ee', border: '1px solid #22d3ee40' }}
          >
            Skip all → go to my investor outreach →
          </button>
        )}
      </div>

      {isLast && (
        <p className="text-center text-xs mt-4" style={{ color: 'oklch(0.35 0.01 264)' }}>
          Last of today&apos;s suggestions — next you&apos;ll see outreach drafts for your matches
        </p>
      )}
    </div>
  );
}
