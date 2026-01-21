/**
 * Fundraising Readiness Panel
 * 
 * The Rocket: Collapses all capital signals into one founder decision
 * 
 * Displays:
 * - Current fundraising state (WINDOW_FORMING, TOO_EARLY, COOLING_RISK, SHIFTING_AWAY)
 * - Primary action (what founder should do now)
 * - Why we believe this (drivers)
 * - Action checklist
 * - Risk monitor
 */

import type { FundraisingReadinessPayload } from '../types/fundraisingReadiness';
import { STATE_METADATA } from '../types/fundraisingReadiness';

interface Props {
  readiness: FundraisingReadinessPayload;
  lastUpdated?: string;
}

export function FundraisingReadinessPanel({ readiness, lastUpdated = '4 hours ago' }: Props) {
  const metadata = STATE_METADATA[readiness.fundraising_state];

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-6">
      {/* Top Panel - Always First */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
            Fundraising Readiness
          </h2>
          <div className="text-[10px] text-white/40 font-mono">
            Updated: {lastUpdated}
          </div>
        </div>

        <div className={`p-6 rounded-lg border ${metadata.bgColor} ${metadata.borderColor}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{metadata.emoji}</span>
                <h3 className={`text-xl font-bold ${metadata.color}`}>
                  {metadata.label}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-white/60">
                  Confidence: <span className={`font-semibold ${metadata.color}`}>{readiness.confidence}</span>
                </div>
                {readiness.time_estimate !== 'Not applicable' && readiness.time_estimate !== 'Pause recommended' && (
                  <div className="text-white/60">
                    Window: <span className="text-white font-semibold">{readiness.time_estimate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                Recommended Action
              </div>
              <div className="text-white font-semibold text-lg leading-tight">
                {readiness.primary_action}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="text-sm text-white/70">
                {readiness.explanation}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why Panel - Drivers */}
      <div>
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
          Why We Believe This
        </h3>
        <div className="space-y-2">
          {readiness.drivers.map((driver, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-sm text-white/80"
            >
              <span className="text-blue-400 mt-0.5">•</span>
              <span>{driver}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Checklist */}
      <div>
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
          Action Checklist
        </h3>
        <div className="space-y-2">
          {readiness.checklist.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-2 bg-white/5 rounded border border-white/10"
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-white/30"
              />
              <span className="text-sm text-white/90">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Monitor */}
      <div className="pt-4 border-t border-white/10">
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
          Risk Monitor
        </h3>
        {readiness.risk_flags.length === 0 ? (
          <div className="space-y-1 text-sm">
            <div className="text-green-400">✓ No cooling detected</div>
            <div className="text-green-400">✓ No attention shift detected</div>
            <div className="text-white/60">
              Position: Top {Math.round((1 - (readiness.prediction.first_inbound_probability || 0)) * 100)}% in segment
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {readiness.risk_flags.map((flag, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm text-red-400"
              >
                <span>⚠</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prediction Panel */}
      {readiness.prediction.first_inbound_probability > 0.1 && (
        <div className="pt-4 border-t border-white/10">
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
            Prediction
          </h3>
          <div className="text-sm space-y-1">
            <div className="text-white/80">
              First inbound probability:{' '}
              <span className="font-bold text-blue-400">
                {(readiness.prediction.first_inbound_probability * 100).toFixed(0)}%
              </span>
            </div>
            {readiness.prediction.partner_diligence_window !== 'Not applicable' &&
              readiness.prediction.partner_diligence_window !== 'Not recommended' && (
                <div className="text-white/60">
                  Partner diligence window: {readiness.prediction.partner_diligence_window}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
