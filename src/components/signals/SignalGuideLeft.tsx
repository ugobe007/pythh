import React, { useMemo, useState } from "react";
import { ChannelState } from "@/types/signals";
import { SIGNAL_DEFS, SignalLane } from "./signalsDictionary";

export default function SignalGuideLeft({
  channels,
  selectedSignalId,
  onSelectSignalId,
}: {
  channels: ChannelState[];
  selectedSignalId: string | null;
  onSelectSignalId: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(true);

  const byId = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const movers = useMemo(() => {
    const list = [...channels];
    list.sort((a, b) => Math.abs((b as any).delta ?? 0) - Math.abs((a as any).delta ?? 0));
    return list.slice(0, 6);
  }, [channels]);

  function laneTitle(lane: SignalLane) {
    return lane === "TEAM" ? "TEAM" :
           lane === "PRODUCT" ? "PRODUCT" :
           lane === "MARKET" ? "MARKET" : "CAPITAL";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold">How to read signals</div>
          <div className="text-xs text-white/60 mt-1">
            Signals are proofs that move investor attention.
            <span className="text-white/70"> Green = tailwind</span>,{" "}
            <span className="text-white/70">Red = headwind</span>.
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-black/30 text-white/70 hover:text-white"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-4">
            <div className="text-xs font-semibold text-white/70 mb-2">Signal definitions</div>
            <div className="space-y-2">
              {(["TEAM", "PRODUCT", "MARKET", "CAPITAL"] as SignalLane[]).map((lane) => (
                <div key={lane} className="border border-white/10 rounded-xl p-3 bg-black/20">
                  <div className="text-[11px] font-bold tracking-wide text-cyan-200">
                    {laneTitle(lane)}
                  </div>
                  <div className="mt-2 space-y-2">
                    {SIGNAL_DEFS.filter((d) => d.lane === lane).map((d) => {
                      const ch = byId.get(d.id);
                      const delta = (ch as any)?.delta ?? 0;
                      const isSelected = selectedSignalId === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => onSelectSignalId(isSelected ? null : d.id)}
                          className={[
                            "w-full text-left rounded-lg px-2 py-2 border transition",
                            isSelected
                              ? "border-cyan-400/40 bg-cyan-400/10"
                              : "border-white/10 bg-black/10 hover:bg-white/5",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold">{d.label}</div>
                            <div className="text-xs text-white/70">
                              Δ {delta > 0 ? `+${delta}` : `${delta}`}
                            </div>
                          </div>
                          <div className="text-[11px] text-white/55 mt-1">{d.meaning}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-white/70 mb-2">Top movers right now</div>
            <div className="space-y-2">
              {movers.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-xs text-white/80">{c.label ?? c.id}</div>
                  <div className="text-xs text-white/70">
                    {(c as any).delta > 0 ? `+${(c as any).delta}` : `${(c as any).delta ?? 0}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
