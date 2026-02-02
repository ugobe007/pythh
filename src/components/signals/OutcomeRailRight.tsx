import React from "react";
import { SurfaceMode, SurfaceViewModel } from "@/types/signals";

export default function OutcomeRailRight({
  mode,
  vm,
}: {
  mode: SurfaceMode;
  vm: SurfaceViewModel;
}) {
  const isPersonal = mode !== "global";
  const p = (vm as any).panels;

  const windowState = p?.fundraising_window?.state ?? (isPersonal ? "—" : "MARKET BASELINE");
  const windowRange = p?.fundraising_window ? `~${p.fundraising_window.startDays ?? p.fundraising_window.start_days ?? "?"}–${p.fundraising_window.endDays ?? p.fundraising_window.end_days ?? "?"} days` : "";

  const alignmentCount = p?.alignment?.count ?? (isPersonal ? "—" : "—");
  const alignmentDelta = p?.alignment?.delta ?? 0;

  const powerScore = p?.power?.score ?? (isPersonal ? "—" : "—");
  const powerDelta = p?.power?.delta ?? 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/60">{isPersonal ? "We found you" : "Market view"}</div>
        <div className="text-sm font-bold mt-1">
          {isPersonal ? (vm.startup?.name ?? "—") : "Live capital alignment"}
        </div>
        <div className="text-xs text-white/50 mt-1">
          {isPersonal
            ? `${vm.startup?.category ?? ""}${vm.startup?.stage ? ` • ${vm.startup.stage}` : ""}`
            : "Inject your URL to compute your fundraising window + investor alignment."}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-xs text-white/60">Fundraising window</div>
        <div className="text-lg font-bold mt-1">{String(windowState).toUpperCase()}</div>
        {windowRange && <div className="text-xs text-white/50 mt-1">{windowRange}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-xs text-white/60">Investors aligning</div>
        <div className="text-lg font-bold mt-1">
          {alignmentCount}{" "}
          <span className="text-xs text-white/50">
            {alignmentDelta ? `(${alignmentDelta >= 0 ? "+" : ""}${alignmentDelta})` : ""}
          </span>
        </div>
        <div className="text-xs text-white/50 mt-1">
          {isPersonal ? "Your current thesis match set." : "Baseline alignment in the market."}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-xs text-white/60">Power score</div>
        <div className="text-lg font-bold mt-1">
          {powerScore}{" "}
          <span className="text-xs text-white/50">
            {powerDelta ? `${powerDelta >= 0 ? "↑" : "↓"} ${Math.abs(powerDelta)}` : ""}
          </span>
        </div>
        <div className="text-xs text-white/50 mt-1">
          {isPersonal ? "How investable you look right now." : "Market momentum composite."}
        </div>
      </div>

      {(mode === "tracking" || mode === "reveal") && (
        <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4">
          <div className="text-sm font-bold">Track my signals</div>
          <div className="text-xs text-white/60 mt-1">
            Get notified when your odds move.
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/35"
              placeholder="email@company.com"
            />
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold">
              Notify
            </button>
          </div>
          <div className="text-[11px] text-white/45 mt-2">
            Wire real capture later.
          </div>
        </div>
      )}
    </div>
  );
}
