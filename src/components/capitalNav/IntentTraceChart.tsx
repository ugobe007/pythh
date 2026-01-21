import React, { useMemo } from "react";
import type { IntentTraceSeries } from "@/types/capitalNavigation";

export function IntentTraceChart({
  series,
  height = 140,
}: {
  series: IntentTraceSeries;
  height?: number;
}) {
  const maxVal = useMemo(() => {
    return Math.max(1, ...series.points.map((p) => p.value));
  }, [series.points]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-white/50">{series.title}</div>
          <div className="mt-1 text-[12px] text-white/60">
            Capital flow in detectable patterns. Fresh intent traces = active discovery.
          </div>
        </div>
        <div className="text-[12px] text-white/50">Last 7 days</div>
      </div>

      <div className="mt-4">
        <div className="flex items-end gap-2" style={{ height }}>
          {series.points.map((p) => {
            const h = Math.round((p.value / maxVal) * (height - 10));
            return (
              <div key={p.label} className="flex w-full flex-col items-center gap-2">
                <div
                  className="w-full rounded-md bg-white/25"
                  style={{ height: `${Math.max(6, h)}px` }}
                  title={`${p.label}: ${p.value}`}
                />
                <div className="text-[10px] text-white/45">{p.label}</div>
              </div>
            );
          })}
        </div>

        {series.points.every((p) => p.value === 0) ? (
          <div className="mt-3 text-[12px] text-white/55">
            No intent traces yet. You're not in a capital flow zone — but you can move there.
          </div>
        ) : null}
      </div>
    </div>
  );
}
