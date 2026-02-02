/**
 * Startup Signal Card - Control panel with gauges and instrumentation
 * Shows startup as the signal source, not just another card
 */
import React from "react";
import { Zap, TrendingUp, Compass } from "lucide-react";

export type StartupSignal = {
  name: string;
  stageLabel: string;
  industry: string;
  signalScore: number;
  signalMax: number;
  phase: number;
  velocityLabel: string;
  tierLabel: string;
  observers7d: number;
  matches: number;
  signalBand: "low" | "med" | "high";
  heat: "cool" | "warming" | "hot";
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85">
      {children}
    </span>
  );
}

function MetricTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">{label}</div>
        {icon ? <div className="text-white/60">{icon}</div> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-white/60">{sub}</div> : null}
    </div>
  );
}

function SegmentedMeter({ value, max }: { value: number; max: number }) {
  const segments = 10;
  const filled = Math.round((value / max) * segments);
  return (
    <div className="mt-2 flex gap-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={[
            "h-2 w-full rounded-sm border border-white/10",
            i < filled ? "bg-white/35" : "bg-white/5",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export function StartupSignalCard({ s }: { s: StartupSignal }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/35 p-5 sm:p-6">
      {/* Header label */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/85">
          <span className="h-2 w-2 rounded-full bg-white/50" />
          Your Signal Snapshot
        </div>

        <div className="flex items-center gap-2">
          <div 
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 cursor-help hover:border-cyan-400/50 transition-all"
            title="Signal band (low/med/high) reflects alignment strength + activity + investor fit. Higher band = better matches."
          >
            <span className="text-xs text-white/60">Band:</span>
            <span className="text-2xl font-bold text-cyan-400">{s.signalBand}</span>
          </div>
          <Pill>{s.heat}</Pill>
          <Pill>Velocity: {s.velocityLabel}</Pill>
        </div>
      </div>

      {/* Identity row */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-white">
            {s.name}
            <span className="ml-3 text-sm font-medium text-white/60">
              {s.stageLabel}
            </span>
          </div>
          <div className="mt-1 text-sm text-white/60">
            Industry <span className="text-white/85 font-medium">{s.industry}</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-white/60">
          <Zap className="h-4 w-4" />
          Live signal state
        </div>
      </div>

      {/* Signal console row (Gauges / Instrumentation) */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/60">Signal Strength</div>
            <TrendingUp className="h-4 w-4 text-white/60" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {s.signalScore.toFixed(1)} <span className="text-white/50">/ {s.signalMax}</span>
          </div>
          <SegmentedMeter value={s.signalScore} max={s.signalMax} />
          <div className="mt-2 text-xs text-white/60">
            Strength reflects alignment + activity + fit.
          </div>
        </div>

        <div 
          className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-help transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5"
          title="Phase position shows how close you are to investor pull. 0% = discovery phase, 100% = strong pull. Your position affects match quality."
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/60">Phase</div>
            <Compass className="h-4 w-4 text-white/60" />
          </div>
          <div className="mt-2 text-4xl font-bold text-cyan-400">
            {Math.round(s.phase * 100)}%
          </div>
          <div className="mt-1 text-xs text-white/60">0 → discovery, 1 → pull</div>
        </div>

        <div 
          className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-help transition-all hover:border-orange-500/30 hover:bg-orange-500/5"
          title="Live match count: investors currently aligned with your signal state. See your top 5 ranked matches below. Number updates as your signals change."
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/60">Matches</div>
            <Zap className="h-4 w-4 text-white/60" />
          </div>
          <div className="mt-2 text-4xl font-bold text-orange-400">
            {s.matches}
          </div>
          <div className="mt-1 text-xs text-white/60">Investors matching your signal</div>
        </div>
      </div>

      {/* Context ribbon - binds to matches below */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
        <span className="text-white/90 font-medium">{s.matches} aligned investors</span>{" "}
        are responding to your current signal state. Your strongest matches are below.
        <span className="ml-3 text-xs text-white/50">
          Tier: {s.tierLabel} · Observers (7d): {s.observers7d}
        </span>
      </div>
    </div>
  );
}
