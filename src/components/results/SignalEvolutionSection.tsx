import { TrendingUp } from "lucide-react";
import type { SignalDelta } from "../../lib/discoveryAPI";
import { PythhTokens } from "../../lib/designTokens";

interface Props {
  delta: SignalDelta;
}

export default function SignalEvolutionSection({ delta }: Props) {
  const phasePct = Math.abs(delta.phaseDelta * 100).toFixed(0);

  return (
    <div className="mb-10 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 backdrop-blur-md p-6">
      <div className="flex items-center gap-3 mb-5">
        <TrendingUp className="h-5 w-5 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white">
          Your Signal Movement (Last 7 Days)
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {/* Phase */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60 mb-2">Phase</div>
          <div className="text-2xl font-bold text-white">
            {delta.phaseDelta >= 0 ? (
              <span className="text-green-400">↑ {phasePct}%</span>
            ) : (
              <span className="text-orange-400">↓ {phasePct}%</span>
            )}
          </div>
        </div>

        {/* Band */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60 mb-2">Band</div>
          {delta.bandChanged ? (
            <div className="text-2xl font-bold text-cyan-400">
              {delta.bandFrom} → {delta.bandTo}
            </div>
          ) : (
            <div className="text-2xl font-bold text-white/60">
              {delta.bandTo} (stable)
            </div>
          )}
        </div>

        {/* Matches */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60 mb-2">Matches</div>
          <div className="text-2xl font-bold text-white">
            {delta.matchCountDelta > 0 ? (
              <span className="text-green-400">+{delta.matchCountDelta}</span>
            ) : delta.matchCountDelta < 0 ? (
              <span className="text-orange-400">
                {delta.matchCountDelta}
              </span>
            ) : (
              <span className="text-white/60">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Narrative bullets */}
      <div className="space-y-2">
        {delta.investorsGained > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <span>🔺</span>
            <span>
              {delta.investorsGained} new investors entered your range
            </span>
          </div>
        )}

        {delta.investorsLost > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <span>🔻</span>
            <span>
              {delta.investorsLost} investors dropped (signals weakened)
            </span>
          </div>
        )}

        {delta.alignmentDelta !== undefined &&
          delta.alignmentDelta !== null &&
          delta.alignmentDelta !== 0 && (
            <div className="flex items-center gap-2 text-sm text-cyan-400">
              <span>⚡</span>
              <span>
                Alignment score{" "}
                {delta.alignmentDelta > 0
                  ? "increased"
                  : "decreased"}{" "}
                {Math.abs(delta.alignmentDelta).toFixed(1)}%
              </span>
            </div>
          )}
      </div>

      {/* Narrative paragraph */}
      {delta.narrative && (
        <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/70">
          {delta.narrative}
        </div>
      )}
    </div>
  );
}
