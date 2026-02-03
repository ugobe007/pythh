import React, { useMemo } from "react";
import { ChannelState, SurfaceViewModel } from "../types";
import { getSignalDef } from "../signalsDictionary";

function dirGlyph(d: string) {
  if (d === "up") return "↑";
  if (d === "down") return "↓";
  return "→";
}

export default function SignalTape({
  channels,
  latestFeed,
  pulseSeq,
}: {
  channels: ChannelState[];
  latestFeed: any | null;
  pulseSeq: number;
}) {
  // Top movers by |delta|
  const topSignals = useMemo(() => {
    return [...channels]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 12);
  }, [channels]);

  return (
    <div className="signalTape">
      {/* How to read section */}
      <div className="tapeSection howToRead">
        <div className="sectionLabel">How to Read Signals</div>
        <div className="sectionContent">
          <span className="legend">
            <span className="legendItem">
              <span className="dot up">↑</span> Green = tailwind (raises odds)
            </span>
            <span className="legendItem">
              <span className="dot down">↓</span> Red = headwind (hurts odds)
            </span>
            <span className="legendItem">Bigger Δ = stronger signal</span>
          </span>
        </div>
      </div>

      {/* Signal cards (horizontal scroll) */}
      <div className="tapeSection signalCards">
        <div className="sectionLabel">Live Signals</div>
        <div className="cardsScroll">
          {topSignals.map((c) => {
            const def = getSignalDef(c.id);
            const signed = c.delta === 0 ? "0" : `${c.delta > 0 ? "+" : ""}${c.delta}`;
            const isUp = c.delta > 0;

            return (
              <div key={c.id} className={`signalCard ${isUp ? "up" : isUp === false ? "down" : "neutral"}`}>
                <div className="cardName">{c.label}</div>
                <div className={`cardDelta ${c.direction}`}>
                  {signed}
                  {dirGlyph(c.direction)}
                </div>
                <div className="cardMeaning">{def?.shortDef || "Signal"}</div>
                <div className="cardValue" style={{ width: `${Math.min(100, Math.max(5, c.value))}%` }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* What moved just now (dominant narrative) */}
      {latestFeed && (
        <div className="tapeSection whatMoved">
          <div className="sectionLabel">What Moved Just Now</div>
          <div className="movedCard">
            <div className="movedEvent">{latestFeed.text}</div>
            <div className="movedImpacts">
              Moves:{" "}
              {(latestFeed.impacts ?? [])
                .slice(0, 3)
                .map((i: any) => `${i.channelId.replace(/_/g, " ")} ${i.delta > 0 ? "+" : ""}${i.delta}`)
                .join(" • ")}
            </div>
            <div className="movedWhy">
              Why it matters:{" "}
              {(() => {
                const combined = (latestFeed.impacts ?? [])
                  .slice(0, 1)
                  .map((i: any) => {
                    const def = getSignalDef(i.channelId);
                    return def?.whatItSignals || "Signals momentum.";
                  })
                  .join("; ");
                return combined || "Signals market momentum.";
              })()}
            </div>
            {latestFeed.confidence && (
              <div className="movedConfidence">Confidence: {(latestFeed.confidence * 100).toFixed(0)}%</div>
            )}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="tapeSummary">
        <div className="summaryItem">
          <span className="label">Signals above baseline:</span>
          <span className="value">{topSignals.filter((c) => c.delta > 0).length}</span>
        </div>
        <div className="summaryItem">
          <span className="label">Strongest:</span>
          <span className="value">{topSignals[0]?.label || "—"}</span>
        </div>
        <div className="summaryItem">
          <span className="label">Updated:</span>
          <span className="value">live</span>
        </div>
      </div>
    </div>
  );
}
