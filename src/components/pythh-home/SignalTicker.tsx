type TickerHeat = "warming" | "warm" | "hot" | "neutral";

export type TickerItem = {
  label: string;
  delta: number;
  topic: string;
  ageMin: number;
  heat: TickerHeat;
};

function heatColor(heat: TickerHeat) {
  if (heat === "hot") return "rgba(251,146,60,0.95)";     // orange
  if (heat === "warm") return "rgba(34,197,94,0.95)";     // green
  if (heat === "warming") return "rgba(34,211,238,0.95)"; // cyan
  return "rgba(156,163,175,0.85)"; // gray
}

export default function SignalTicker(props: { items: TickerItem[] }) {
  const { items } = props;

  // Two copies for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      className="h-[32px] w-full overflow-hidden flex items-center"
      style={{
        background: "rgba(255,255,255,0.02)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* Inline keyframes so no Tailwind config needed */}
      <style>{`
        @keyframes pythhTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div
        className="whitespace-nowrap will-change-transform"
        style={{
          display: "inline-flex",
          alignItems: "center",
          animation: "pythhTicker 26s linear infinite",
        }}
      >
        {doubled.map((it, idx) => {
          const c = heatColor(it.heat);
          const sign = it.delta >= 0 ? "+" : "";
          return (
            <div key={`${it.label}-${idx}`} className="inline-flex items-center">
              <span className="px-3 text-[12.5px] text-white/60">
                <span className="text-white/85">{it.label}</span>{" "}
                <span style={{ color: c }} className="tabular-nums font-semibold">
                  {sign}
                  {it.delta.toFixed(1)}
                </span>{" "}
                <span className="text-white/45">{it.topic}</span>{" "}
                <span className="text-white/30 tabular-nums">{it.ageMin}m</span>
              </span>
              <span className="text-white/20 px-1">▸</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
