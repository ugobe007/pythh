import { useEffect, useMemo, useState } from "react";
import type { PublicSignalPulse } from "../../types/publicPulse";

function clamp0_100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function displayName(p: PublicSignalPulse): string {
  if (p.displayName && !p.isAnonymized) return p.displayName;
  return "Anonymized startup";
}

function toneForMomentum(m: PublicSignalPulse["momentum"]): "good" | "mid" | "bad" {
  if (m === "Surge") return "good";
  if (m === "Warming") return "mid";
  if (m === "Stable") return "mid";
  return "bad";
}

function toneForTiming(t: PublicSignalPulse["timingWindow"]): "good" | "mid" | "bad" {
  if (t === "Active") return "good";
  if (t === "Opening") return "mid";
  if (t === "Closing") return "mid";
  return "bad";
}

export default function LiveAlignmentTape({ pulses }: { pulses: PublicSignalPulse[] }) {
  const items = useMemo(() => (pulses || []).slice(0, 10), [pulses]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setIdx((v) => (v + 1) % items.length), 2600);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div>
          <div className="text-sm font-semibold text-white">Live Alignment</div>
          <div className="text-xs text-white/50">Public-signal deltas showing windows opening in real time</div>
        </div>
        <div className="text-xs text-white/40 italic">Last 24h</div>
      </div>

      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-max">
          {items.map((p, i) => {
            const active = i === idx;

            const aBefore = clamp0_100(p.alignmentBefore);
            const aAfter = clamp0_100(p.alignmentAfter);
            const dAlign = aAfter - aBefore;

            return (
              <div
                key={p.pulseId}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-all ${
                  active ? "bg-blue-500/10 border-blue-500/30" : "bg-white/5 border-white/10"
                }`}
              >
                <div className="text-xs text-white/70">
                  <span className="font-semibold text-white">{displayName(p)}</span>
                  <span className="text-white/40"> · {p.category}</span>
                </div>

                <Pill tone={toneForMomentum(p.momentum)} value={p.momentum} />
                <Pill tone={toneForTiming(p.timingWindow)} value={p.timingWindow} />

                <div className="text-xs text-white/60">
                  Alignment{" "}
                  <span className="font-semibold text-white">{Math.round(aBefore)}</span>
                  <span className="text-white/40">→</span>
                  <span className="font-semibold text-white">{Math.round(aAfter)}</span>{" "}
                  <span className={dAlign >= 0 ? "text-green-400" : "text-red-400"}>
                    ({dAlign >= 0 ? "+" : ""}
                    {Math.round(dAlign)})
                  </span>
                </div>

                {p.triggerSignals?.[0] && (
                  <div className="text-xs text-white/40">
                    Trigger: <span className="text-white/60">{p.triggerSignals[0]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Pill({ value, tone }: { value: string; tone: "good" | "mid" | "bad" }) {
  const cls =
    tone === "good"
      ? "text-green-400 bg-green-500/10"
      : tone === "mid"
      ? "text-yellow-400 bg-yellow-500/10"
      : "text-white/60 bg-white/10";
  return <span className={`text-xs px-2 py-1 rounded ${cls}`}>{value}</span>;
}
