import React, { useMemo } from "react";
import { SurfaceViewModel } from "../types";

function timeAgo(ts: string) {
  const t = new Date(ts).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function interpretEvent(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("hire") || lower.includes("talent")) {
    return "Signals execution capacity; increases investor confidence.";
  }
  if (lower.includes("press") || lower.includes("media") || lower.includes("coverage")) {
    return "Raises awareness; increases inbound probability.";
  }
  if (lower.includes("customer") || lower.includes("client")) {
    return "Validates demand + pricing power; increases round velocity.";
  }
  if (lower.includes("funding") || lower.includes("capital")) {
    return "Validates traction; creates competitive urgency.";
  }
  if (lower.includes("product") || lower.includes("launch") || lower.includes("feature")) {
    return "Demonstrates execution momentum; strengthens competitive position.";
  }
  if (lower.includes("alignment") || lower.includes("investor")) {
    return "Increases fundraising probability; signals market validation.";
  }

  return "Signals momentum; increases market confidence.";
}

export default function RightRail({
  vm,
  onExplainAlignmentChanges,
  highlightEventId,
}: {
  vm: SurfaceViewModel;
  onExplainAlignmentChanges?: () => void;
  highlightEventId?: string | null;
}) {
  const showPanels = vm.mode === "reveal" || vm.mode === "tracking";
  const panels = vm.panels;

  const identityLine = useMemo(() => {
    if (!vm.startup) return null;
    const s = vm.startup;
    return `${s.name}${s.category ? ` | ${s.category}` : ""}${s.stage ? ` | ${s.stage}` : ""}`;
  }, [vm.startup]);

  const feedTitle = vm.mode === "tracking" ? "What moved your odds" : "What's happening";
  const latestFeed = vm.feed[0] ?? null;

  return (
    <div className="rightRail">
      {showPanels && (
        <div className="panelStack">
          <div className="panel hero">
            <div className="panelTitle">We found you</div>
            <div className="panelValue">{identityLine ?? "—"}</div>
          </div>

          {/* ✅ Last change - dominant panel */}
          {latestFeed && (
            <div className="panel lastChange">
              <div className="panelTitle">Last change</div>
              <div className="panelValue">{latestFeed.text}</div>
              <div className="panelMeta">
                Moved:{" "}
                {(latestFeed.impacts ?? [])
                  .slice(0, 2)
                  .map((i) => `${i.channelId.replace(/_/g, " ")} ${i.delta > 0 ? "+" : ""}${i.delta}`)
                  .join(", ")}
              </div>
              <div className="panelMeta">Confidence: {((latestFeed.confidence ?? 0.8) * 100).toFixed(0)}%</div>
              <div className="panelWhy">{interpretEvent(latestFeed.text)}</div>
            </div>
          )}

          <div className="panel">
            <div className="panelTitle">Your Fundraising Window</div>
            <div className="panelValue">{panels?.fundraisingWindow?.state?.toUpperCase() ?? "—"}</div>
            {panels?.fundraisingWindow && (
              <div className="panelMeta">
                ~{panels.fundraisingWindow.startDays}–{panels.fundraisingWindow.endDays} days
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panelTitle">Investors aligning</div>
            <div className="panelValue">
              {panels?.alignment?.count ?? "—"}{" "}
              <span className="panelDelta">
                {panels?.alignment ? `(+${Math.max(0, panels.alignment.delta)} this week)` : ""}
              </span>
            </div>
          </div>

          <div className="panel">
            <div className="panelTitle">Power Score</div>
            <div className="panelValue">
              {panels?.power?.score ?? "—"}{" "}
              <span className="panelDelta">
                {panels?.power ? `${panels.power.delta >= 0 ? "↑" : "↓"} ${Math.abs(panels.power.delta)} this week` : ""}
              </span>
            </div>
          </div>

          <div className="panel">
            <div className="panelTitle">Next 3 moves</div>
            <ul className="moves">
              {(vm.nextMoves?.items ?? []).slice(0, 3).map((m, i) => (
                <li key={`${m.text}_${i}`}>
                  <span className="moveText">{m.text}</span>
                  <span className="moveImpacts">
                    {(m.impacts ?? []).slice(0, 2).map((imp) => (
                      <span key={`${imp.channelId}_${imp.delta}`} className="impact">
                        {imp.channelId.replace(/_/g, " ")} {imp.delta > 0 ? `+${imp.delta}` : imp.delta}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={`feed ${vm.mode === "tracking" ? "tracking" : ""}`}>
        <div className="feedHeader">
          <div className="feedTitle">{feedTitle}</div>
          <div className="feedLegend">
            <span className="legendDot cyan" /> event
            <span className="legendDot green" /> alignment
            <span className="legendDot red" /> phase
          </div>
        </div>

        {vm.feed.slice(0, 10).map((f) => {
          const hot = highlightEventId && f.id === highlightEventId;
          return (
            <div key={f.id} className={`feedItem ${hot ? "hot" : ""}`}>
              <div className="feedText">• {f.text}</div>
              <div className="feedMeta">{timeAgo(f.timestamp)} ago</div>
            </div>
          );
        })}

        {vm.feed.length === 0 && <div className="feedEmpty">No events yet — the observatory will populate automatically.</div>}
      </div>

      {(vm.mode === "tracking" || vm.mode === "reveal") && (
        <div className="emailInline">
          <div className="emailTitle">Track my signals</div>
          <div className="emailRow">
            <input className="emailInput" placeholder="email@company.com" />
            <button className="emailBtn">Notify me</button>
          </div>
          <div className="emailHint">Appears after reveal. (Wire real capture later.)</div>

          {vm.mode === "tracking" && onExplainAlignmentChanges && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <button onClick={onExplainAlignmentChanges} className="emailBtn" style={{ width: "100%", fontSize: 12 }}>
                Why did my odds move?
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
