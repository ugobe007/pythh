import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TopBar from "./components/TopBar";
import MacroShiftCard from "./components/MacroShiftCard";
import { buildMacroShifts, type MacroShift } from "./signalsContextEngine";
import type { SurfaceViewModel } from "./types";
import { makeInitialVM, tick } from "./fakeEngine";
import "./pithh.css";

type NavState = {
  startup_id?: string;
  cursor?: string;
  power?: any;
  window?: any;
};

export default function SignalsContextPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? {}) as NavState;

  const [vm, setVm] = useState<SurfaceViewModel>(() => {
    // Start with the same VM baseline so it visually matches Radar
    const base = makeInitialVM();
    // Context screen should feel calmer: fewer radar arcs; keep it clean
    base.radar.arcs = [];
    base.radar.events = [];
    base.radar.phaseChange = null;
    base.mode = "tracking";
    return base;
  });

  const [shifts, setShifts] = useState<MacroShift[]>(() => buildMacroShifts(vm, navState.startup_id ?? "global"));
  const [missingContext, setMissingContext] = useState(false);

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // If user lands here without coming from Radar, show graceful "go back" state
  useEffect(() => {
    if (!navState?.startup_id) {
      setMissingContext(true);
    }
  }, [navState?.startup_id]);

  // Fake-alive loop (Phase B: replace with DataSource.pollTracking + merge)
  useEffect(() => {
    const iv = window.setInterval(() => {
      setVm((prev) => tick({ ...prev }));
    }, 1200);
    return () => window.clearInterval(iv);
  }, []);

  // Re-derive macro shifts from live VM motion
  useEffect(() => {
    setShifts(buildMacroShifts(vm, navState.startup_id ?? "global"));
  }, [vm.channels, vm.feed, vm.panels?.power?.score, vm.pulseSeq, navState.startup_id]);

  const title = useMemo(() => {
    return missingContext
      ? "Signals context"
      : "What changed that moved your odds";
  }, [missingContext]);

  const subtitle = useMemo(() => {
    if (missingContext) return "This view appears after your Signal Radar reveal.";
    const last = vm.feed?.[0]?.timestamp ? new Date(vm.feed[0].timestamp).toLocaleTimeString() : "moments ago";
    return `Since your last scan (${last}), these belief shifts contributed to your alignment.`;
  }, [missingContext, vm.feed]);

  return (
    <div className="pithh context">
      <TopBar status={"CONTEXT"} subtitle={subtitle} />

      <div className="contextHero">
        <div className="contextHeroInner">
          <div className="contextKicker">PYTHH • SIGNAL CONTEXT</div>
          <div className="contextTitle">{title}</div>

          {!missingContext && (
            <div className="contextStats">
              <div className="contextStat">
                <div className="contextStatLabel">Power Score</div>
                <div className="contextStatValue">
                  {vm.panels?.power?.score ?? "—"}{" "}
                  <span className="contextStatDelta">
                    {vm.panels?.power?.delta != null ? `${vm.panels.power.delta >= 0 ? "↑" : "↓"} ${Math.abs(vm.panels.power.delta)} this week` : ""}
                  </span>
                </div>
              </div>

              <div className="contextStat">
                <div className="contextStatLabel">Investors aligning</div>
                <div className="contextStatValue">
                  {vm.panels?.alignment?.count ?? "—"}{" "}
                  <span className="contextStatDelta">
                    {vm.panels?.alignment?.delta != null ? `(+${Math.max(0, vm.panels.alignment.delta)} this week)` : ""}
                  </span>
                </div>
              </div>

              <div className="contextStat">
                <div className="contextStatLabel">Fundraising window</div>
                <div className="contextStatValue">
                  {(vm.panels?.fundraisingWindow?.state ?? "—").toString().toUpperCase()}{" "}
                  <span className="contextStatDelta">
                    {vm.panels?.fundraisingWindow ? `~${vm.panels.fundraisingWindow.startDays}–${vm.panels.fundraisingWindow.endDays} days` : ""}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="contextActions">
            <button className="ghostBtn" onClick={() => navigate("/signals-radar")} type="button">
              ← Back to my Signal Radar
            </button>

            {!missingContext && (
              <button
                className="ctaBtn"
                onClick={() => {
                  // Later: jump to "evidence trail" section
                  const el = document.getElementById("context-evidence");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                type="button"
              >
                Show evidence trail <span className="ctaArrow">→</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="contextSection">
        <div className="contextSectionHeader">
          <div className="contextSectionTitle">Market belief shifts</div>
          <div className="contextSectionSub">Zoomed out — but tied to your alignment deltas.</div>
        </div>

        <div className="contextGrid">
          {shifts.slice(0, 3).map((s) => (
            <MacroShiftCard key={s.id} shift={s} onClick={() => { /* Phase B: drilldown */ }} />
          ))}
        </div>
      </div>

      <div className="contextSection" id="context-evidence">
        <div className="contextSectionHeader">
          <div className="contextSectionTitle">Evidence trail</div>
          <div className="contextSectionSub">The last signals that pushed the needle (newest first).</div>
        </div>

        <div className="contextEvidence">
          {(vm.feed ?? []).slice(0, 10).map((f) => (
            <div className="contextEvidenceRow" key={f.id}>
              <div className="contextEvidenceDot" />
              <div className="contextEvidenceText">{f.text}</div>
              <div className="contextEvidenceMeta">
                {new Date(f.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}

          {(vm.feed ?? []).length === 0 && (
            <div className="feedEmpty">No evidence yet — the observatory will populate automatically.</div>
          )}
        </div>

        {missingContext && (
          <div className="contextMissing">
            <div className="panel hero">
              <div className="panelTitle">This page is post-reveal</div>
              <div className="panelValue">Run Signal Radar first, then return here.</div>
              <div className="panelMeta">We'll bind this view to your startup_id + cursor.</div>
              <div style={{ marginTop: 10 }}>
                <button className="ctaBtn" onClick={() => navigate("/signals-radar")} type="button">
                  Go to Signal Radar <span className="ctaArrow">→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
