export default function SignalLegend() {
  return (
    <div className="mt-2 flex items-center gap-4 text-[12px] text-white/45">
      <LegendDot color="rgba(34,211,238,0.9)" label="Warming (early movement)" />
      <LegendDot color="rgba(34,197,94,0.9)" label="Warm (strong alignment)" />
      <LegendDot color="rgba(251,146,60,0.95)" label="Hot (high urgency)" />
      <span className="text-white/25">•</span>
      <span className="text-white/35">σ = surface tension</span>
    </div>
  );
}

function LegendDot(props: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-[8px] h-[8px]"
        style={{
          background: props.color,
          boxShadow: `0 0 14px ${props.color}55`,
        }}
      />
      <span>{props.label}</span>
    </div>
  );
}
