import React, { useEffect, useMemo, useState } from "react";

type Point = { x: number; y: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function IntentVelocitySparkline({
  values,
  label = "Intent Velocity (24h)",
}: {
  values: number[]; // any length (e.g. 24 points hourly)
  label?: string;
}) {
  const w = 260;
  const h = 64;
  const pad = 6;

  const maxVal = useMemo(() => Math.max(1, ...values), [values]);

  const points: Point[] = useMemo(() => {
    if (!values.length) return [];
    return values.map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = h - pad - (clamp01(v / maxVal) * (h - pad * 2));
      return { x, y };
    });
  }, [values, maxVal]);

  const pathD = useMemo(() => {
    if (!points.length) return "";
    return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  }, [points]);

  // animate draw
  const [draw, setDraw] = useState(false);
  useEffect(() => {
    setDraw(false);
    const t = setTimeout(() => setDraw(true), 50);
    return () => clearTimeout(t);
  }, [pathD]);

  const last = points[points.length - 1];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-white/50">
          Intent Velocity (24h)
        </div>
        <div className={`h-2 w-2 rounded-full bg-emerald-400 transition-opacity ${pulse ? 'opacity-100' : 'opacity-40'}`} />
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Baseline */}
        <line
          x1="0"
          y1={height - 4}
          x2={width}
          y2={height - 4}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />

        {/* Animated path */}
        <path
          d={pathData}
          fill="none"
          stroke="rgba(16, 185, 129, 0.6)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1000"
          strokeDashoffset={progress === 100 ? 0 : 1000}
          style={{
            transition: "stroke-dashoffset 1.5s ease-out",
          }}
        />

        {/* Pulse dot at end */}
        <circle
          cx={width - step}
          cy={lastY}
          r="3"
          fill="rgba(16, 185, 129, 0.8)"
          className={`transition-opacity ${pulse ? 'opacity-100' : 'opacity-60'}`}
        />
      </svg>

      <div className="mt-1 text-[10px] text-white/40">
        Fresh traces = active discovery
      </div>
    </div>
  );
}
