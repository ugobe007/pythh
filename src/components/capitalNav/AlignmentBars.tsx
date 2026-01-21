import React, { useMemo } from "react";
import type { AlignmentMetric } from "@/types/capitalNavigation";

function clamp01(x: number) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function AlignmentBars({
  metrics,
  alignment01,
  nextBestMove,
}: {
  metrics: AlignmentMetric[];
  alignment01: number; // 0..1
  nextBestMove: string;
}) {
  const alignmentPct = useMemo(() => Math.round(clamp01(alignment01) * 100), [alignment01]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-white/50">Alignment Breakdown</div>
          <div className="mt-1 text-[12px] text-white/60">
            Signals represent intent. Alignment measures whether you belong in this movement.
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/75">
          Alignment: {alignmentPct}%
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {metrics.map((m) => {
          const v = clamp01(m.value01);
          return (
            <div key={m.key}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] text-white/80">{m.label}</div>
                <div className="text-[12px] text-white/50">{v.toFixed(2)}</div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white/45" style={{ width: `${Math.round(v * 100)}%` }} />
              </div>
              {m.why ? <div className="mt-1 text-[11px] text-white/45">{m.why}</div> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-[12px] uppercase tracking-wider text-white/50">Next Best Move</div>
        <div className="mt-2 text-[13px] text-white/85">{nextBestMove}</div>
        <div className="mt-2 text-[12px] text-white/55">
          Reposition to move deeper into the path of capital.
        </div>
      </div>
    </div>
  );
}
