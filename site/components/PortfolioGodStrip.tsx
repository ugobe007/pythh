import { useEffect, useState } from "react";
import { Link } from "wouter";
import { G, MUTED, DIM, BORDER, CARD, godScoreColor, signalScoreColor } from "@/lib/designTokens";

interface PortfolioPick {
  id: string;
  startup_name: string;
  entry_god_score?: number;
  signal_score?: number;
  tier?: string;
}

export default function PortfolioGodStrip({ className = "" }: { className?: string }) {
  const [picks, setPicks] = useState<PortfolioPick[]>([]);

  useEffect(() => {
    fetch("/api/portfolio?limit=8&lite=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPicks(d?.entries ?? []))
      .catch(() => {});
  }, []);

  if (!picks.length) {
    return (
      <div
        className={`h-28 rounded-lg animate-pulse border ${className}`}
        style={{ backgroundColor: CARD, borderColor: BORDER }}
      />
    );
  }

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
          Oracle portfolio · GOD at entry
        </p>
        <Link href="/portfolio">
          <span className="text-[10px] font-mono cursor-pointer" style={{ color: G }}>
            full scoreboard →
          </span>
        </Link>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: "thin" }}
      >
        {picks.map((pick) => {
          const god = pick.entry_god_score ?? 0;
          const signal = pick.signal_score;
          return (
            <div
              key={pick.id}
              className="snap-start shrink-0 w-[168px] p-3 border rounded-lg"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              <p className="text-xs font-semibold text-white truncate mb-2">{pick.startup_name}</p>
              <div className="mb-2">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[9px] font-mono uppercase" style={{ color: DIM }}>GOD</span>
                  <span
                    className="text-xl font-display font-bold tabular-nums leading-none"
                    style={{ color: godScoreColor(god) }}
                  >
                    {god}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.14 0.01 264)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${god}%`, backgroundColor: godScoreColor(god) }}
                  />
                </div>
              </div>
              {signal != null && (
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span style={{ color: DIM }}>Signal</span>
                  <span style={{ color: signalScoreColor(signal) }}>{signal}/10</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
