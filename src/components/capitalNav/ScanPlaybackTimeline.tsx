import React, { useEffect, useState } from "react";
import type { ScanPlaybackData, ScanStepState } from "@/types/capitalNavigation";

function StepIcon({ state }: { state: ScanStepState }) {
  if (state === "done") return <span className="text-emerald-300">✓</span>;
  if (state === "degraded") return <span className="text-amber-200">!</span>;
  if (state === "active") return <span className="text-white/80">●</span>;
  return <span className="text-white/30">○</span>;
}

export function ScanPlaybackTimeline({
  data,
  autoPlay = true,
  stepIntervalMs = 700,
}: {
  data: ScanPlaybackData;
  autoPlay?: boolean;
  stepIntervalMs?: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!autoPlay) return;
    setActiveIndex(0);
    const t = setInterval(() => {
      setActiveIndex((i) => {
        const next = i + 1;
        if (next >= data.steps.length) return i;
        return next;
      });
    }, stepIntervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.domainLabel]);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-white/50">Scan Playback</div>
          <div className="mt-1 text-[16px] font-semibold text-white">
            Scanning <span className="text-white/80">{data.domainLabel}</span>
          </div>
          <div className="mt-1 text-[12px] text-white/55">
            Signals represent investor intent. Clusters reveal where capital is going.
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/70">
          {activeIndex + 1}/{data.steps.length}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        {data.steps.map((s, idx) => {
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;

          const state: ScanStepState =
            s.state === "degraded"
              ? "degraded"
              : isPast
              ? "done"
              : isActive
              ? "active"
              : "pending";

          return (
            <div
              key={s.id}
              className={`rounded-xl border p-4 ${
                state === "degraded"
                  ? "border-amber-500/25 bg-amber-500/5"
                  : isActive
                  ? "border-white/20 bg-white/5"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider text-white/55">{s.title}</div>
                <StepIcon state={state} />
              </div>
              <div className="mt-2 text-[12px] text-white/70">{s.detail}</div>

              {isActive ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-white/35" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {data.summaryLines?.length ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[12px] uppercase tracking-wider text-white/50">Activity</div>
          <ul className="mt-2 space-y-1 text-[12px] text-white/70">
            {data.summaryLines.slice(0, 6).map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
