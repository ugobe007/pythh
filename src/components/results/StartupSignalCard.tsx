import React from "react";
import type { StartupSignal } from "../../types/results.types";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function Meter({ value01 }: { value01: number }) {
  const v = clamp01(value01);
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-white/40"
        style={{ width: `${Math.round(v * 100)}%` }}
      />
    </div>
  );
}

function Pill({ children, glow = false }: { children: React.ReactNode; glow?: boolean }) {
  if (glow) {
    return (
      <span 
        className="text-[11px] px-2.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-medium"
        style={{
          boxShadow: "0 0 12px rgba(34, 211, 238, 0.2)",
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
      {children}
    </span>
  );
}

export default function StartupSignalCard({ s }: { s: StartupSignal }) {
  const score01 = s.signalMax > 0 ? s.signalScore / s.signalMax : 0;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5">
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xl md:text-2xl font-semibold tracking-tight text-white">
              {s.name}
            </div>
            <div className="mt-1 text-sm text-white/70">
              {s.industry} • {s.stageLabel}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill glow>Heat: {s.heat}</Pill>
              <Pill glow>Velocity: {s.velocityLabel}</Pill>
              <Pill glow>Tier: {s.tierLabel}</Pill>
              <Pill glow>Observers (7d): {s.observers7d}</Pill>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xs text-white/60">Signal Score</div>
            <div 
              className="mt-1 text-4xl md:text-5xl font-bold text-emerald-300"
              style={{
                textShadow: "0 0 24px rgba(34, 197, 94, 0.4), 0 0 48px rgba(34, 197, 94, 0.2)",
              }}
            >
              {s.signalScore.toFixed(1)}
              <span className="text-white/40 text-xl md:text-2xl">/{s.signalMax}</span>
            </div>
            <div className="mt-3 w-36">
              <Meter value01={score01} />
            </div>
          </div>
        </div>

        {/* tiles: concise, non-negotiable "odometer" */}
        <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-xl border border-white/10 bg-white/4 p-3">
            <div className="text-[11px] text-white/60">Phase</div>
            <div className="mt-1 text-sm font-medium text-white">{Math.round(clamp01(s.phase) * 100)}%</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/4 p-3">
            <div className="text-[11px] text-white/60">Band</div>
            <div className="mt-1 text-sm font-medium text-white">{s.signalBand}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/4 p-3">
            <div className="text-[11px] text-white/60">Matches</div>
            <div className="mt-1 text-sm font-medium text-white">{s.matches}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
