import { DIM, G, BORDER } from "@/lib/designTokens";

const SIGNAL_TYPES: Array<{ label: string; color: string; border: string; bg: string }> = [
  { label: "funding_round", color: "#22c55e", border: "#22c55e44", bg: "#22c55e12" },
  { label: "hiring_velocity", color: "#22d3ee", border: "#22d3ee44", bg: "#22d3ee12" },
  { label: "product_launch", color: "#a855f7", border: "#a855f744", bg: "#a855f712" },
  { label: "press_mention", color: "#22d3ee", border: "#22d3ee44", bg: "#22d3ee12" },
  { label: "executive_hire", color: "#22c55e", border: "#22c55e44", bg: "#22c55e12" },
  { label: "capital_convergence", color: "#eab308", border: "#eab30844", bg: "#eab30812" },
  { label: "founder_language", color: "#a855f7", border: "#a855f744", bg: "#a855f712" },
  { label: "news_momentum", color: "#22d3ee", border: "#22d3ee44", bg: "#22d3ee12" },
  { label: "execution_velocity", color: "#22c55e", border: "#22c55e44", bg: "#22c55e12" },
  { label: "investor_receptivity", color: "#eab308", border: "#eab30844", bg: "#eab30812" },
  { label: "revenue_milestone", color: "#22c55e", border: "#22c55e44", bg: "#22c55e12" },
  { label: "partnership", color: "#22d3ee", border: "#22d3ee44", bg: "#22d3ee12" },
  { label: "market_expansion", color: "#a855f7", border: "#a855f744", bg: "#a855f712" },
  { label: "github_activity", color: "#22d3ee", border: "#22d3ee44", bg: "#22d3ee12" },
  { label: "acquisition_signal", color: "#22c55e", border: "#22c55e44", bg: "#22c55e12" },
  { label: "team_milestone", color: "#eab308", border: "#eab30844", bg: "#eab30812" },
  { label: "gtm_shift", color: "#a855f7", border: "#a855f744", bg: "#a855f712" },
  { label: "diligence_cue", color: "#22d3ee", border: "#22d3ee44", bg: "#22d3ee12" },
  { label: "social_proof", color: "#22c55e", border: "#22c55e44", bg: "#22c55e12" },
  { label: "sector_pivot", color: "#eab308", border: "#eab30844", bg: "#eab30812" },
];

function TickerRow({ reverse = false }: { reverse?: boolean }) {
  const items = [...SIGNAL_TYPES, ...SIGNAL_TYPES];
  return (
    <div
      className="flex gap-2 shrink-0"
      style={{
        animation: `${reverse ? "signal-ticker-rev" : "signal-ticker"} 48s linear infinite`,
      }}
    >
      {items.map(({ label, color, border, bg }, i) => (
        <span
          key={`${label}-${i}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] whitespace-nowrap"
          style={{ border: `1px solid ${border}`, color, backgroundColor: bg }}
        >
          <span
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function HorizontalSignalTicker({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ borderColor: BORDER }}>
      <style>{`
        @keyframes signal-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes signal-ticker-rev {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
      <div className="flex items-center gap-3 px-3 py-2 border-b" style={{ borderColor: BORDER, backgroundColor: "oklch(0.085 0.01 264)" }}>
        <span className="text-[9px] font-mono uppercase tracking-widest shrink-0" style={{ color: DIM }}>
          40+ signal types · live
        </span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: G }} />
      </div>
      <div className="relative py-2.5" style={{ maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}>
        <div className="flex flex-col gap-2">
          <TickerRow />
          <TickerRow reverse />
        </div>
      </div>
    </div>
  );
}
