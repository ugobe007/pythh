import React, { useMemo } from "react";
import { SurfaceMode } from "../types";

export default function ActionBar({
  mode,
  rawUrl,
  setRawUrl,
  onSubmit,
  onReset,
}: {
  mode: SurfaceMode;
  rawUrl: string;
  setRawUrl: (v: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  const cta = useMemo(() => {
    if (mode === "global") return "Inject into radar";
    if (mode === "injecting") return "Injecting…";
    if (mode === "reveal") return "Track my signals";
    return "Track my signals";
  }, [mode]);

  return (
    <div className="actionBar">
      <div className="actionCopy">
        <div className="actionTitle">ENTER YOUR STARTUP URL</div>
        <div className="actionSub">See your window, alignment, and next 3 moves</div>
      </div>

      <div className="actionControls">
        <input
          className="urlInput"
          value={rawUrl}
          onChange={(e) => setRawUrl(e.target.value)}
          placeholder="autoops.ai"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          disabled={mode === "injecting"}
        />

        <button className="ctaBtn" onClick={onSubmit} disabled={mode === "injecting"}>
          {cta} <span className="ctaArrow">→</span>
        </button>

        <button className="ghostBtn" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}
