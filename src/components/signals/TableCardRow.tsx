import FitBars from "@/components/signals/FitBars";
import type { SignalRow } from "@/components/signals/SignalTableCardList";

export default function TableCardRow(props: {
  row: SignalRow;
  skeleton?: boolean;
}) {
  const { row, skeleton } = props;

  const signal = Number.isFinite(row.signalScore) ? row.signalScore : 0;
  const delta = row.signalDelta;

  const deltaDir =
    delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  // Glow semantics (keep thin, no borders)
  const glow = skeleton
    ? "0 0 0 1px rgba(255,255,255,0.06)"
    : row.fitTier >= 4
    ? "0 0 0 1px rgba(255,255,255,0.06), 0 0 18px rgba(34,197,94,0.10)" // green warm
    : row.fitTier === 3
    ? "0 0 0 1px rgba(255,255,255,0.06), 0 0 18px rgba(34,211,238,0.09)" // cyan warming
    : "0 0 0 1px rgba(255,255,255,0.06)";

  const actionLabel = skeleton ? "…" : row.isLocked ? "Unlock" : "View";
  const actionColor = row.isLocked ? "rgba(34,211,238,0.9)" : "rgba(34,197,94,0.85)";

  return (
    <div
      className="h-[44px] w-full flex items-center px-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        boxShadow: glow,
      }}
    >
      {/* Grid: ENTITY 32% | CONTEXT 44% | SIGNAL 12% | FIT 12% */}
      <div className="w-[32%] pr-4">
        <div className="text-[13px] font-semibold text-white/90 truncate">
          {skeleton ? "Loading…" : row.investorName}
        </div>
        <div className="text-[11px] text-white/40 truncate">
          {skeleton ? "—" : row.firmName}
        </div>
      </div>

      <div className="w-[44%] pr-4">
        <div className="text-[13px] text-white/55 truncate">
          {skeleton ? "—" : row.context}
        </div>
      </div>

      <div className="w-[12%] pr-3 text-right">
        <div className="text-[13px] font-semibold text-cyan-200/90 tabular-nums">
          {skeleton ? "—" : signal.toFixed(1)}{" "}
          {!skeleton && (
            <span
              className="text-[12px]"
              style={{
                color:
                  deltaDir === "up"
                    ? "rgba(34,211,238,0.9)"
                    : deltaDir === "down"
                    ? "rgba(248,113,113,0.85)"
                    : "rgba(255,255,255,0.30)",
              }}
            >
              {deltaDir === "up" ? "▲" : deltaDir === "down" ? "▼" : "▬"}
            </span>
          )}
        </div>
      </div>

      <div className="w-[12%] flex items-center justify-end gap-4">
        <FitBars tier={row.fitTier} />
        <button
          className="text-[13px] font-medium"
          style={{ color: skeleton ? "rgba(255,255,255,0.35)" : actionColor }}
          disabled={skeleton}
          onClick={() => {
            // Wire later: unlock RPC or route
            // For now: do nothing (keeps UI honest until RPC is wired)
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
