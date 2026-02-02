import React, { useMemo, useState } from "react";
import { ChannelState, SurfaceMode } from "../types";

function dirGlyph(d: ChannelState["direction"]) {
  if (d === "up") return "↑";
  if (d === "down") return "↓";
  return "→";
}

// Lane definitions for grouping channels
const LANES = {
  TEAM: ["talent", "hiring", "grit"],
  PRODUCT: ["product", "velocity"],
  MARKET: ["customers", "opportunity", "media"],
  CAPITAL: ["alignment", "capital_flow", "fomo", "goldilocks"],
} as const;

function getChannelLane(channelId: string): keyof typeof LANES | null {
  const id = channelId.toLowerCase();
  for (const [lane, ids] of Object.entries(LANES)) {
    if (ids.some((laneId) => id.includes(laneId))) {
      return lane as keyof typeof LANES;
    }
  }
  return null;
}

export default function ChannelStack({
  channels,
  pulseSeq,
  mode,
}: {
  channels: ChannelState[];
  pulseSeq: number;
  mode: SurfaceMode;
}) {
  const [showAll, setShowAll] = useState(false);

  const jitter = useMemo(() => {
    const j = (pulseSeq % 6) / 100;
    return j;
  }, [pulseSeq]);

  const topMovers = useMemo(() => {
    const sorted = [...channels].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return sorted.slice(0, 8);
  }, [channels]);

  // Group channels by lane
  const groupedChannels = useMemo(() => {
    const list = showAll ? channels : topMovers;
    const groups: Record<string, ChannelState[]> = {
      TEAM: [],
      PRODUCT: [],
      MARKET: [],
      CAPITAL: [],
      OTHER: [],
    };

    list.forEach((c) => {
      const lane = getChannelLane(c.id);
      if (lane) {
        groups[lane].push(c);
      } else {
        groups.OTHER.push(c);
      }
    });

    return groups;
  }, [channels, showAll, topMovers]);

  const renderChannelRow = (c: ChannelState) => {
    const signed = c.delta === 0 ? "0" : `${c.delta > 0 ? "+" : ""}${c.delta}`;
    const wobble = mode === "injecting" ? 0 : Math.round((Math.random() - 0.5) * 2);

    return (
      <div key={c.id} className="channelRow" style={{ transform: `translateX(${wobble * jitter}px)` }}>
        <div className="channelLabel">{c.label}</div>

        <div className={`delta ${c.direction}`}>
          <span className="deltaNum">{signed}</span>
          <span className="deltaGlyph">{dirGlyph(c.direction)}</span>
        </div>

        <div className="barWrap" aria-label={`${c.label} ${c.value}`}>
          <div className="barBg" />
          <div className="barFill" style={{ width: `${c.value}%` }} />
          <div className="barTick" style={{ left: `${Math.min(95, Math.max(5, c.value))}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className={`channels ${mode === "injecting" ? "freeze" : ""}`}>
      <div className="channelsHeader">
        <div className="channelsTitle">{showAll ? "All channels" : "Top movers by lane"}</div>
        <div className="channelsSub">{showAll ? "Full observatory" : "Grouped by signal type"}</div>

        <button className="channelsToggle" onClick={() => setShowAll((v) => !v)} type="button">
          {showAll ? "Show top movers" : "View all"}
        </button>
      </div>

      {Object.entries(groupedChannels).map(
        ([lane, laneChannels]) =>
          laneChannels.length > 0 && (
            <div key={lane} className="channelLane">
              <div className="laneLabel">{lane}</div>
              {laneChannels.map(renderChannelRow)}
            </div>
          )
      )}
    </div>
  );
}
