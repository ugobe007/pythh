/**
 * Oracle decision card — founder authority required before execution.
 */

import { CheckCircle2, Clock, Lock } from 'lucide-react';
import type { OracleDecision } from '@/lib/oracleRaisePlan';

type Props = {
  decision: OracleDecision;
  locked?: boolean;
  onApprove?: () => void;
  onDefer?: () => void;
  onView?: () => void;
};

export default function OracleDecisionCard({
  decision,
  locked = false,
  onApprove,
  onDefer,
  onView,
}: Props) {
  const resolved = decision.status === 'approved' || decision.status === 'deferred';

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: 'oklch(0.12 0.01 264)',
        borderColor: resolved ? 'oklch(0.696 0.17 162.48 / 0.35)' : 'oklch(0.22 0.01 264)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {locked ? (
            <Lock size={14} style={{ color: 'oklch(0.45 0.01 264)' }} />
          ) : decision.status === 'approved' ? (
            <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
          ) : (
            <Clock size={14} style={{ color: '#eab308' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-widest mb-1" style={{ color: '#22d3ee' }}>
            DECISION NEEDED
          </p>
          <p className="text-sm font-semibold mb-1" style={{ color: 'oklch(0.94 0.005 264)' }}>
            {decision.title}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.55 0.01 264)' }}>
            {decision.body}
          </p>
        </div>
      </div>

      {!resolved && !locked && (
        <div className="flex flex-wrap gap-2 mt-4">
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-black"
              style={{ background: '#22c55e' }}
            >
              Approve
            </button>
          )}
          {onDefer && (
            <button
              type="button"
              onClick={onDefer}
              className="px-4 py-2 rounded-lg text-xs font-medium border"
              style={{ color: 'oklch(0.55 0.01 264)', borderColor: 'oklch(0.25 0.01 264)' }}
            >
              Not now
            </button>
          )}
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="px-4 py-2 rounded-lg text-xs font-medium"
              style={{ color: 'oklch(0.696 0.17 162.48)' }}
            >
              Review details →
            </button>
          )}
        </div>
      )}

      {decision.status === 'approved' && (
        <p className="text-[11px] mt-3" style={{ color: '#22c55e' }}>Approved — Oracle will proceed</p>
      )}
      {decision.status === 'deferred' && (
        <p className="text-[11px] mt-3" style={{ color: 'oklch(0.45 0.01 264)' }}>Deferred — Oracle continues other work</p>
      )}
      {locked && (
        <p className="text-[11px] mt-3" style={{ color: 'oklch(0.45 0.01 264)' }}>
          Authorize your raise plan to unlock this decision
        </p>
      )}
    </div>
  );
}
