import React from "react";
import type { ConvergenceArchetypeCard } from "@/types/capitalNavigation";

function stateLabel(s: string) {
  if (s === "breakout") return "Breakout";
  if (s === "surge") return "Surge";
  if (s === "warming") return "Warming";
  return "Watch";
}

export function ConvergencePreviewArchetypes({
  cards,
  totalHiddenCount,
  onUnlock,
}: {
  cards: ConvergenceArchetypeCard[];
  totalHiddenCount?: number | null;
  onUnlock?: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-white/50">
            Capital is moving — identities are resolving
          </div>
          <div className="mt-1 text-[12px] text-white/60">
            While identity resolution is delayed, here's the convergence profile forming around you.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof totalHiddenCount === "number" ? (
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/75">
              +{totalHiddenCount} more detected
            </div>
          ) : null}
          {onUnlock ? (
            <button
              onClick={onUnlock}
              className="rounded-lg bg-white/10 px-3 py-2 text-[12px] text-white hover:bg-white/15"
            >
              Unlock Full Signal Map
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        {cards.slice(0, 5).map((c, i) => (
          <div key={i} className="group relative rounded-xl border border-white/10 bg-black/20 p-4 overflow-hidden">
            {/* Locked shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
                 style={{
                   backgroundSize: '200% 100%',
                   animation: 'shimmer 2s infinite',
                 }}
            />
            
            <div className="relative z-10">
              <div className="text-[12px] text-white/70">{c.title}</div>
              
              {/* Progress meter */}
              <div className="mt-2 flex items-center gap-3">
                <div className="text-[20px] font-semibold text-white">{c.fitScore}</div>
                <div className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400"
                      style={{ width: `${c.fitScore}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[9px] text-white/40">Fit: {c.fitScore}/100</div>
                </div>
              </div>

              {/* Evidence pills */}
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] text-blue-300 border border-blue-500/20">
                  phase_change
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-300 border border-emerald-500/20">
                  adjacency
                </span>
                <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] text-purple-300 border border-purple-500/20">
                  timing
                </span>
              </div>

              {/* Momentum state badge */}
              <div className="mt-3 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 inline-block">
                {stateLabel(c.state)}
              </div>

              {/* Evidence bullets (compact) */}
              <ul className="mt-2 space-y-1 text-[10px] text-white/50">
                {c.evidence.slice(0, 2).map((e, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-[4px] inline-block h-1 w-1 rounded-full bg-white/30" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 text-[10px] text-white/35 italic">{c.lockedReason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
