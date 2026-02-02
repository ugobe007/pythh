import React, { useMemo } from "react";
import { ChannelState, FeedItem } from "@/types/signals";
import { SIGNAL_DEFS } from "./signalsDictionary";
import { interpretFeedItem } from "./interpretEvent";

function timeAgo(ts?: string) {
  if (!ts) return "";
  const t = new Date(ts).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function deltaColor(delta: number) {
  if (delta > 0) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (delta < 0) return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-white/10 bg-white/5 text-white/70";
}

export default function SignalTapeCenter({
  channels,
  feed,
  selectedSignalId,
  onSelectSignalId,
}: {
  channels: ChannelState[];
  feed: FeedItem[];
  selectedSignalId: string | null;
  onSelectSignalId: (id: string | null) => void;
}) {
  const byId = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const tapeSignals = useMemo(() => {
    // Show only key signals: Grit, Capital Flow, Goldilocks, Customers, Competition
    const keyIds = ["grit", "capital_flow", "goldilocks", "customers", "competition"];
    return keyIds
      .map((id) => {
        const def = SIGNAL_DEFS.find((d) => d.id === id);
        if (!def) return null;
        const ch = byId.get(id);
        const delta = (ch as any)?.delta ?? 0;
        const value = (ch as any)?.value ?? null;
        return { ...def, delta, value };
      })
      .filter(Boolean) as any[];
  }, [byId]);

  const latest = feed?.[0] ?? null;
  const interp = interpretFeedItem(latest);

  const filteredFeed = useMemo(() => {
    if (!selectedSignalId) return feed.slice(0, 10);
    return feed
      .filter((f) => (f.impacts ?? []).some((i) => i.channelId === selectedSignalId))
      .slice(0, 10);
  }, [feed, selectedSignalId]);

  return (
    <div className="space-y-4">
      {/* HOW TO READ - condensed */}
      <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
        <div className="text-xs font-semibold text-white/60 mb-1">HOW TO READ SIGNALS</div>
        <div className="flex gap-4 text-xs text-white/50">
          <span>↑ Green = tailwind (raises odds)</span>
          <span>↓ Red = headwind (hurts odds)</span>
          <span>Bigger Δ = stronger signal</span>
        </div>
      </div>

      {/* Signal tape - redesigned as slim data bars */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-white/80">LIVE SIGNALS</div>
          <div className="text-xs text-white/50">
            Click to filter
          </div>
        </div>

        <div className="space-y-2">
          {tapeSignals.map((s) => {
            const isSelected = selectedSignalId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSignalId(isSelected ? null : s.id)}
                className={[
                  "w-full flex items-center justify-between rounded-lg border p-3 text-left transition",
                  isSelected ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:bg-white/5",
                ].join(" ")}
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{s.label}</div>
                  <div className="text-xs text-white/55 mt-0.5">{s.meaning}</div>
                </div>
                <div className="flex items-center gap-3">
                  {s.value !== null && (
                    <div className="text-lg font-bold text-white">{s.value}</div>
                  )}
                  <div className={["text-sm px-3 py-1 rounded-full border font-semibold", deltaColor(s.delta)].join(" ")}>
                    {s.delta > 0 ? `+${s.delta}` : `${s.delta}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* What moved just now */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">What moved your odds</div>
          <div className="text-xs text-white/50">{timeAgo(latest?.timestamp)}</div>
        </div>

        <div className="mt-2 text-sm text-white/85">
          {latest ? `• ${latest.text}` : "• No events yet — the observatory will populate automatically."}
        </div>

        {latest && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(latest.impacts ?? []).slice(0, 4).map((imp) => (
              <span
                key={`${imp.channelId}_${imp.delta}`}
                className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70"
              >
                {imp.channelId.replace(/_/g, " ")} {imp.delta > 0 ? `+${imp.delta}` : imp.delta}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-white/60">
          {interp.why}
        </div>

        {/* Feed list */}
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="text-[11px] text-white/50 mb-2">
            Live feed {selectedSignalId ? `(filtered: ${selectedSignalId})` : ""}
          </div>
          <div className="space-y-2">
            {filteredFeed.map((f) => (
              <div key={f.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-xs text-white/80">• {f.text}</div>
                <div className="text-[11px] text-white/45 mt-1">{timeAgo(f.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
