export function CapitalField({ active }: { active: boolean }) {
  return (
    <div className="relative">
      <div className="relative h-2 overflow-hidden bg-white/5 border-b border-white/10">
        <div
          className="absolute inset-y-0 left-0 w-[35%]"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.0), rgba(120,200,255,0.35), rgba(255,255,255,0.0))",
            animation: active ? "capital-flow 3s linear infinite" : "none",
            opacity: active ? 0.8 : 0.25,
          }}
        />
      </div>
      <div className="absolute right-6 top-0 -translate-y-full pb-1">
        <div className="text-[9px] text-white/40 font-mono tracking-wider uppercase">
          Capital field
        </div>
      </div>
    </div>
  );
}
