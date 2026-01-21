import React, { useEffect, useMemo, useState } from "react";
import type {
  NavigationTriadData,
  ConfidenceLevel,
  PositionState,
  FlowState,
  DirectionState,
} from "@/types/capitalNavigation";

function pillColorForConfidence(c: ConfidenceLevel) {
  if (c === "high") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/25";
  if (c === "medium") return "bg-amber-500/15 text-amber-200 border-amber-500/25";
  return "bg-rose-500/15 text-rose-200 border-rose-500/25";
}

function labelForPosition(s: PositionState) {
  switch (s) {
    case "invisible":
      return "Invisible";
    case "emerging":
      return "Emerging";
    case "aligned":
      return "Aligned";
    case "hot":
      return "Hot";
    case "crowded":
      return "Crowded";
    default:
      return "Emerging";
  }
}

function labelForFlow(s: FlowState) {
  switch (s) {
    case "quiet":
      return "Quiet";
    case "forming":
      return "Forming";
    case "concentrating":
      return "Concentrating";
    case "surging":
      return "Surging";
    case "saturated":
      return "Saturated";
    default:
      return "Forming";
  }
}

function labelForDirection(s: DirectionState) {
  switch (s) {
    case "outbound":
      return "Outbound";
    case "stable":
      return "Stable";
    case "incoming":
      return "Incoming";
    case "strongly_incoming":
      return "Strongly Incoming";
    default:
      return "Stable";
  }
}

function clamp01(x: number | undefined) {
  if (typeof x !== "number" || Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function ProgressBar({ value01 }: { value01: number }) {
  const v = Math.round(clamp01(value01) * 100);
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-white/40" style={{ width: `${v}%` }} />
    </div>
  );
}

function GaugeArc({ value01 }: { value01: number }) {
  // Simple SVG arc gauge (semi-circle)
  const v = clamp01(value01);
  const strokeDasharray = 100;
  const strokeDashoffset = Math.round(strokeDasharray * (1 - v));
  return (
    <svg width="120" height="70" viewBox="0 0 120 70" className="mt-2">
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${strokeDasharray}`}
        strokeDashoffset={`${strokeDashoffset}`}
        pathLength="100"
      />
      <text x="60" y="38" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="14">
        {Math.round(v * 100)}
      </text>
      <text x="60" y="55" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">
        Trajectory
      </text>
    </svg>
  );
}

export function CapitalNavigationHeader({
  data,
  onWhy,
}: {
  data: NavigationTriadData;
  onWhy?: (column: "position" | "flow" | "trajectory") => void;
}) {
  // Heartbeat pulse animation (subtle)
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 1600);
    return () => clearInterval(t);
  }, []);

  const observersText = useMemo(() => {
    if (data.observers7d === null || typeof data.observers7d === "undefined") return "—";
    return `${data.observers7d}`;
  }, [data.observers7d]);

  const latestTraceText = useMemo(() => {
    if (data.latestIntentTraceHours === null || typeof data.latestIntentTraceHours === "undefined") {
      return "Latest intent trace: —";
    }
    if (data.latestIntentTraceHours === 0) return "Latest intent trace: just now";
    if (data.latestIntentTraceHours === 1) return "Latest intent trace: 1 hour ago";
    return `Latest intent trace: ${data.latestIntentTraceHours} hours ago`;
  }, [data.latestIntentTraceHours]);

  const alignmentPct = Math.round(clamp01(data.alignment01) * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-white/50">Capital Navigation</div>
          <div className="mt-1 text-[18px] font-semibold text-white">
            {data.startupName || "Your startup"}
          </div>
          {data.url ? <div className="text-[12px] text-white/50">{data.url}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-[12px] ${pillColorForConfidence(
              data.confidence
            )}`}
            title="Truthful uncertainty: confidence reflects signal quality and source diversity."
          >
            Confidence: {data.confidence.toUpperCase()}
          </span>

          <span
            className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/70 ${
              pulse ? "opacity-100" : "opacity-70"
            } transition-opacity`}
            title="Signals represent investor intent. Fresh traces = active discovery."
          >
            {latestTraceText}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Position */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] uppercase tracking-wider text-white/50">Your Position</div>
            {onWhy ? (
              <button
                onClick={() => onWhy("position")}
                className="text-[12px] text-white/60 hover:text-white"
              >
                Why?
              </button>
            ) : null}
          </div>
          <div className="mt-2 text-[16px] font-semibold text-white">
            Position: {labelForPosition(data.positionState)}
          </div>
          <div className="mt-1 text-[12px] text-white/60">
            Observers (7d): <span className="text-white/85">{observersText}</span>
          </div>

          <ProgressBar value01={clamp01(data.positionScore01)} />
          <div className="mt-2 text-[12px] text-white/45" title="Your current location in the capital landscape.">
            Where you are standing on the ice.
          </div>
        </div>

        {/* Flow */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] uppercase tracking-wider text-white/50">Capital Flow (Now)</div>
            {onWhy ? (
              <button
                onClick={() => onWhy("flow")}
                className="text-[12px] text-white/60 hover:text-white"
              >
                Why?
              </button>
            ) : null}
          </div>

          <div className="mt-2 text-[16px] font-semibold text-white">
            Flow: {labelForFlow(data.flowState)}
          </div>

          <div className="mt-1 text-[12px] text-white/60">
            Active investors:{" "}
            <span className="text-white/85">
              {data.activeInvestorsVisible ?? "—"} / {data.activeInvestorsTotal ?? "—"}
            </span>
          </div>

          <ProgressBar value01={clamp01(data.flowScore01)} />
          <div className="mt-2 text-[12px] text-white/45" title="Signals represent investor intent. Clusters reveal where capital is going.">
            What is happening around you right now.
          </div>
        </div>

        {/* Trajectory */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] uppercase tracking-wider text-white/50">Capital Trajectory (Next)</div>
            {onWhy ? (
              <button
                onClick={() => onWhy("trajectory")}
                className="text-[12px] text-white/60 hover:text-white"
              >
                Why?
              </button>
            ) : null}
          </div>

          <div className="mt-2 text-[16px] font-semibold text-white">
            Direction: {labelForDirection(data.directionState)}
          </div>

          <div className="mt-1 text-[12px] text-white/60">
            Alignment: <span className="text-white/85">{alignmentPct}%</span>{" "}
            <span className="text-white/45">("Do I belong in this movement?")</span>
          </div>

          <GaugeArc value01={clamp01(data.trajectoryScore01)} />
          <div className="mt-2 text-[12px] text-white/45" title="Projected direction based on acceleration, phase-change, and decay-adjusted momentum.">
            Where the puck is going.
          </div>
        </div>
      </div>
    </div>
  );
}
