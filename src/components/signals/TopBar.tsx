import React from "react";
import { SurfaceMode } from "@/types/signals";

export default function TopBar({
  mode,
  startupName,
}: {
  mode: SurfaceMode;
  startupName?: string;
}) {
  const badge =
    mode === "tracking" ? "TRACKING" :
    mode === "reveal" ? "REVEAL" :
    mode === "injecting" ? "INJECTING" : "LIVE";

  return (
    <div className="sticky top-0 z-30 bg-black/80 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold tracking-wide">
            PYTHH <span className="text-white/50">•</span> SIGNALS
          </div>
          <div className="text-xs px-2 py-1 rounded-full border border-cyan-400/30 text-cyan-200 bg-cyan-400/10">
            {badge}
          </div>
          {startupName && (
            <div className="text-xs text-white/60">
              {startupName}
            </div>
          )}
        </div>

        <div className="text-xs text-white/50">
          Capital alignment observatory
        </div>
      </div>
    </div>
  );
}
