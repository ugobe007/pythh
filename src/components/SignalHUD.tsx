import { useEffect, useMemo, useState } from "react";

type Direction = "Outbound" | "Stable" | "Incoming" | "Strongly Incoming";
type Confidence = "Low" | "Medium" | "High";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// deterministic pseudo-random 0..1 from a string (stable per URL)
function hash01(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function directionToAngle(dir: Direction) {
  switch (dir) {
    case "Outbound": return -140;
    case "Stable": return -90;
    case "Incoming": return -40;
    case "Strongly Incoming": return -15;
    default: return -90;
  }
}

export function SignalHUD({
  url,
  direction,
  confidence,
  observers7d,
  isScanning,
}: {
  url: string;
  direction: Direction;
  confidence: Confidence;
  observers7d: number;
  isScanning: boolean;
}) {
  const seed = useMemo(() => hash01(url || "demo"), [url]);

  const [scanT, setScanT] = useState(0);
  const [tick, setTick] = useState(0);

  // Animation ticker (keeps motion alive)
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Scan progress feel
  useEffect(() => {
    let raf = 0;
    let start = performance.now();

    function tickScan(now: number) {
      const elapsed = now - start;
      const next = isScanning ? clamp01(elapsed / 1400) : Math.max(0, scanT - 0.06);
      setScanT(next);
      raf = requestAnimationFrame(tickScan);
    }

    raf = requestAnimationFrame(tickScan);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  const conf01 = confidence === "High" ? 0.92 : confidence === "Medium" ? 0.68 : 0.38;

  const spark = useMemo(() => {
    const base = 0.25 + seed * 0.25;
    const slope =
      direction === "Strongly Incoming" ? 0.018 :
      direction === "Incoming" ? 0.012 :
      direction === "Stable" ? 0.002 : -0.010;

    const arr: number[] = [];
    for (let i = 0; i < 30; i++) {
      const wobble = Math.sin((i + seed * 10) * 0.55) * 0.03;
      const val = clamp01(base + i * slope + wobble);
      arr.push(val);
    }
    return arr;
  }, [seed, direction]);

  const observersNorm = clamp01(Math.log10(Math.max(1, observers7d)) / 2);
  const liveFill = clamp01(observersNorm * 0.75 + scanT * 0.25);

  const angle = directionToAngle(direction);
  const t = tick * 16.7;
  const liveAngle = angle + (isScanning ? (Math.sin(t / 180) * 6) : 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white/5 border border-white/10 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/60 uppercase">Capital Vector</div>
          <div className="text-[11px] text-white/40">
            Latest intent trace: <span className="text-white/70">{isScanning ? "live" : "6h ago"}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <div className="relative w-28 h-28">
            <div
              className="absolute inset-0 rounded-full border border-white/10"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), rgba(255,255,255,0.00) 70%)",
              }}
            />
            <div
              className="absolute inset-[6px] rounded-full"
              style={{
                background: `conic-gradient(rgba(255,255,255,0.0) 0deg, rgba(255,255,255,0.0) ${Math.round(360*(1-conf01))}deg, rgba(255,255,255,0.22) ${Math.round(360*(1-conf01))}deg, rgba(255,255,255,0.22) 360deg)`,
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 w-1 h-10 origin-bottom"
              style={{
                transform: `translate(-50%, -100%) rotate(${liveAngle}deg)`,
              }}
            >
              <div className="w-1 h-10 rounded bg-white/80" />
              <div className="w-2 h-2 rounded-full bg-white absolute -left-0.5 -bottom-1" />
            </div>
            <div className="absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-full bg-white/70 -translate-x-1/2 -translate-y-1/2" />
          </div>

          <div className="flex-1">
            <div className="text-2xl font-bold text-white leading-tight">{direction}</div>
            <div className="mt-1 text-sm text-white/50">
              Confidence: <span className="text-white/80 font-semibold">{confidence}</span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-white/45">
                <span>Observer accumulation</span>
                <span className="text-white/70">{observers7d} / 7d</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white/40 transition-all duration-500"
                  style={{ width: `${Math.round(liveFill * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/60 uppercase">Momentum</div>
          <div className="text-[11px] text-white/40">30d</div>
        </div>

        <div className="mt-4 h-20 flex items-end gap-1">
          {spark.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(6, Math.round(v * 80))}%`,
                backgroundColor: "rgba(255,255,255,0.28)",
                opacity: 0.35 + v * 0.65,
              }}
            />
          ))}
        </div>

        <div className="mt-3 text-xs text-white/50">Intent clusters → momentum.</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/60 uppercase">Intent Pulse</div>
          <div className="text-[11px] text-white/40">{isScanning ? "scanning" : "stable"}</div>
        </div>

        <div className="mt-4 h-20 relative overflow-hidden rounded bg-white/5 border border-white/10">
          <div
            className="absolute inset-y-0 left-0 w-[40%]"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.22), rgba(255,255,255,0.0))",
              transform: `translateX(${(t / 8) % 240}px)`,
              opacity: isScanning ? 0.9 : 0.35,
            }}
          />
          <div className="absolute left-3 bottom-2 text-[11px] text-white/55">
            Signals represent intent.
          </div>
        </div>

        <div className="mt-3 text-xs text-white/50">Direction updates when confidence is earned.</div>
      </div>
    </div>
  );
}
