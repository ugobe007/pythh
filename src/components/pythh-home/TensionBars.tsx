import type { Heat } from "@/components/pythh-home/LiveMatchesTable";

function accentFor(heat: Heat) {
  if (heat === "hot") return "rgba(251,146,60,0.9)";
  if (heat === "warm") return "rgba(34,197,94,0.9)";
  if (heat === "warming") return "rgba(34,211,238,0.9)";
  return "rgba(156,163,175,0.75)";
}

export default function TensionBars(props: { tier: number; heat: Heat }) {
  const t = Math.max(1, Math.min(5, Math.round(props.tier || 3)));
  const on = accentFor(props.heat);

  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= t;
        return (
          <div
            key={i}
            className="h-[10px] w-[6px]"
            style={{
              background: active ? on : "rgba(255,255,255,0.12)",
              boxShadow: active ? `0 0 10px ${on}22` : "none",
            }}
          />
        );
      })}
    </div>
  );
}
