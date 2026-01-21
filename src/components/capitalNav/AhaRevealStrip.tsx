import React, { useEffect, useMemo, useState } from "react";
import type { NavigationTriadData } from "../../types/capitalNavigation";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function directionLabel(d: NavigationTriadData["directionState"]) {
  switch (d) {
    case "strongly_incoming":
      return "Strongly Incoming";
    case "incoming":
      return "Incoming";
    case "stable":
      return "Stable";
    case "outbound":
      return "Outbound";
    default:
      return "Stable";
  }
}

export function AhaRevealStrip({
  triad,
  estimatedSignalsProcessed,
}: {
  triad: NavigationTriadData;
  estimatedSignalsProcessed?: number;
}) {
  const target = useMemo(() => {
    if (typeof estimatedSignalsProcessed === "number") return clampInt(estimatedSignalsProcessed, 0, 9999);
    const base = Math.round(((triad.flowScore01 ?? 0.35) * 300) + ((triad.alignment01 ?? 0.5) * 200));
    return clampInt(base, 24, 720);
  }, [estimatedSignalsProcessed, triad.flowScore01, triad.alignment01]);

  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [showDirection, setShowDirection] = useState(false);
  const [showSubline, setShowSubline] = useState(false);

  useEffect(() => {
    setCount(0);
    setShowDirection(false);
    setShowSubline(false);

    const start = Date.now();
    const durationMs = 900;
    const tick = setInterval(() => {
      const t = Date.now() - start;
      const p = Math.min(1, t / durationMs);
      setCount(Math.round(target * p));
      if (p >= 1) clearInterval(tick);
    }, 24);

    const d1 = setTimeout(() => setPulse(true), 220);
    const d2 = setTimeout(() => setShowDirection(true), 1050);
    const d3 = setTimeout(() => setShowSubline(true), 1450);

    return () => {
      clearInterval(tick);
      clearTimeout(d1);
      clearTimeout(d2);
      clearTimeout(d3);
    };
  }, [triad.url, triad.startupName, target]);

  const latestTraceText = useMemo(() => {
    const h = triad.latestIntentTraceHours;
    if (h === null || typeof h === "undefined") return "Latest intent trace: —";
    if (h === 0) return "Latest intent trace: just now";
    if (h === 1) return "Latest intent trace: 1 hour ago";
    return `Latest intent trace: ${h} hours ago`;
  }, [triad.latestIntentTraceHours]);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/6 to-white/3 p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[12px] uppercase tracking-wider text-white/50">Signals processed</div>
          <div className="mt-2 text-[34px] font-semibold text-white tabular-nums">{count}</div>
          <div className="mt-1 text-[12px] text-white/55">
            Evidence is accumulating — even before investor identities resolve.
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[12px] uppercase tracking-wider text-white/50">Heartbeat</div>
          <div className="mt-3 flex items-center gap-3">
            <span className={`inline-block h-3 w-3 rounded-full ${pulse ? "bg-white/70" : "bg-white/30"} transition`} />
            <div className="text-[14px] text-white/85">{latestTraceText}</div>
          </div>
          <div className="mt-2 text-[12px] text-white/55">
            Signals represent investor intent. Fresh traces = active discovery.
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[12px] uppercase tracking-wider text-white/50">Direction</div>
          <div className={`mt-2 text-[22px] font-semibold text-white transition-all duration-500 ${showDirection ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
            {directionLabel(triad.directionState)}
          </div>
          <div className={`mt-2 text-[12px] text-white/60 transition-opacity duration-700 ${showSubline ? "opacity-100" : "opacity-0"}`}>
            Projected capital movement detected.
          </div>
        </div>
      </div>
    </div>
  );
}
