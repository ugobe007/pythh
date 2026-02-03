import React, { useMemo, useState } from "react";
import { SurfaceMode, SurfaceViewModel } from "../types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Deterministic placement based on event id (no jitter, no random)
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295; // 0..1
}

function polarFromEvent(eventId: string, magnitude: number) {
  const a = hash01(eventId + "_a") * Math.PI * 2;
  // magnitude controls radius: bigger magnitude = further out
  const r = 10 + clamp(magnitude, 0.1, 1) * 32;
  return { a, r };
}

export default function RadarField({
  radar,
  mode,
  pulseSeq,
  onHoverEventId,
  hoveredEventId,
}: {
  radar: SurfaceViewModel["radar"];
  mode: SurfaceMode;
  pulseSeq: number;
  onHoverEventId?: (id: string | null) => void;
  hoveredEventId?: string | null;
}) {
  const [localHover, setLocalHover] = useState<string | null>(null);

  const sweepDur = useMemo(() => {
    const base = 3.2;
    const speed = radar.sweepSpeed || 1.0;
    return Math.max(1.1, base / speed);
  }, [radar.sweepSpeed]);

  const you = radar.you;
  const youX = 50 + Math.sin(pulseSeq / 4) * 7;
  const youY = 52 + Math.cos(pulseSeq / 5) * 9;

  const arcs = radar.arcs ?? [];
  const phase = radar.phaseChange;

  const activeHover = hoveredEventId ?? localHover;

  // ✅ Real dots from radar.events (newest first)
  const eventDots = useMemo(() => {
    const evs = (radar.events ?? []).slice(0, 14);
    return evs.map((e, idx) => {
      const { a, r } = polarFromEvent(e.id, e.magnitude ?? 0.5);
      const x = 50 + Math.cos(a) * r;
      const y = 50 + Math.sin(a) * r;

      // brightness scales with magnitude; newest gets a little boost
      const intensity = clamp((e.magnitude ?? 0.5) + (idx === 0 ? 0.25 : 0), 0.2, 1.0);

      return {
        id: e.id,
        type: e.type,
        x,
        y,
        intensity,
        magnitude: e.magnitude ?? 0.5,
      };
    });
  }, [radar.events]);

  const hint =
    mode === "global"
      ? "Global observatory — inject your URL to compute YOUR odds"
      : mode === "injecting"
      ? "Injecting… resolving startup + scanning signals"
      : mode === "reveal"
      ? "Reveal… your window + alignment + next moves"
      : "Tracking… new events update your odds in real time";

  // Find hovered event details
  const hoveredEvent = useMemo(() => {
    if (!activeHover) return null;
    return (radar.events ?? []).find((e) => e.id === activeHover);
  }, [activeHover, radar.events]);

  return (
    <div className={`radar ${mode}`}>
      <div className="radarContext">
        <b>How to read this:</b> dots = events • brighter = stronger evidence • arcs = new alignment • ring = phase change
      </div>

      <div className="radarFrame">
        <svg viewBox="0 0 100 100" className="radarSvg" role="img" aria-label="Radar field">
          <defs>
            <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* rings */}
          <circle cx="50" cy="50" r="42" className="ring" />
          <circle cx="50" cy="50" r="28" className="ring" />
          <circle cx="50" cy="50" r="14" className="ring" />
          {/* crosshair */}
          <line x1="50" y1="8" x2="50" y2="92" className="cross" />
          <line x1="8" y1="50" x2="92" y2="50" className="cross" />

          {/* sweep */}
          <g className="sweep" style={{ animationDuration: `${sweepDur}s` }}>
            <path
              d="M50 50 L50 6 A44 44 0 0 1 92 50 Z"
              className="sweepWedge"
              fill="rgba(70,255,170,0.14)"
              stroke="rgba(70,255,170,0.65)"
              strokeWidth="1.4"
            />
            <line x1="50" y1="50" x2="50" y2="6" className="sweepLine" />
          </g>

          {/* ✅ real event dots */}
          {eventDots.map((d) => {
            const isHot = activeHover === d.id;
            const r = isHot ? 5.2 : 3.6;

            const fill =
              d.type === "phase_change"
                ? "rgba(255,95,125,0.95)"
                : d.type === "alignment"
                ? "rgba(70,255,170,0.95)"
                : "rgba(70,210,255,0.95)";

            const opacity = isHot ? 1 : clamp(0.35 + d.intensity * 0.65, 0.35, 0.98);

            return (
              <g key={d.id}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={r}
                  fill={fill}
                  opacity={opacity}
                  filter="url(#dotGlow)"
                  className="dot"
                  onMouseEnter={() => {
                    setLocalHover(d.id);
                    onHoverEventId?.(d.id);
                  }}
                  onMouseLeave={() => {
                    setLocalHover(null);
                    onHoverEventId?.(null);
                  }}
                />
                {isHot && (
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={9.5}
                    fill="none"
                    stroke="rgba(70,210,255,0.55)"
                    strokeWidth="1.2"
                    opacity="0.9"
                  />
                )}
              </g>
            );
          })}

          {/* arcs on alignment */}
          {arcs.slice(0, 6).map((a, idx) => {
            const r = 18 + idx * 4;
            const start = 0.9 + idx * 0.25;
            const end = start + 0.65;
            const x1 = 50 + Math.cos(start) * r;
            const y1 = 50 + Math.sin(start) * r;
            const x2 = 50 + Math.cos(end) * r;
            const y2 = 50 + Math.sin(end) * r;
            return (
              <path
                key={a.id}
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                className="arc"
                style={{ opacity: Math.min(0.9, 0.25 + a.strength) }}
              />
            );
          })}

          {/* YOU blip */}
          {you && (
            <g>
              <circle cx={youX} cy={youY} r={4.1} fill="rgba(70,255,170,0.95)" filter="url(#dotGlow)" className="youDot" />
              <circle cx={youX} cy={youY} r={7 + (you.intensity ?? 0.6) * 6} className="youHalo" />
              <text x={youX + 3.5} y={youY - 3.2} className="youText">
                {you.initials}
              </text>
            </g>
          )}

          {/* phase change ring */}
          {phase && <circle cx="50" cy="50" r={12 + phase.magnitude * 22} className="phaseRing" />}
        </svg>

        {/* Event details overlay on hover */}
        {hoveredEvent && (
          <div className="eventDetails">
            <div className="eventType">
              {hoveredEvent.type === "alignment" ? "Alignment" : hoveredEvent.type === "phase_change" ? "Phase Change" : "Event"}
            </div>
            <div className="eventMagnitude">Magnitude: {(hoveredEvent.magnitude * 100).toFixed(0)}%</div>
            <div className="eventTime">
              {(() => {
                const t = new Date(hoveredEvent.timestamp).getTime();
                const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
                if (s < 60) return `${s}s ago`;
                const m = Math.floor(s / 60);
                if (m < 60) return `${m}m ago`;
                const h = Math.floor(m / 60);
                return `${h}h ago`;
              })()}
            </div>
          </div>
        )}

        <div className="radarHint">{hint}</div>
      </div>
    </div>
  );
}
