import TensionBars from "@/components/pythh-home/TensionBars";

export type Heat = "warming" | "warm" | "hot" | "neutral";

export type LiveMatchRow = {
  id: string;
  investorName: string;
  firm?: string;
  signal: number; // 0–10
  delta: number | null; // signed
  god: number; // 0–100
  vc: number; // 0–100
  tension: number; // 1–5
  heat: Heat;
  actionLabel?: string; // View / Unlock / etc
};

function glowFor(heat: Heat) {
  // halo only, no borders
  if (heat === "hot") return "0 0 22px rgba(251,146,60,0.14)";
  if (heat === "warm") return "0 0 22px rgba(34,197,94,0.12)";
  if (heat === "warming") return "0 0 22px rgba(34,211,238,0.12)";
  return "0 0 0 rgba(0,0,0,0)";
}

function accentFor(heat: Heat) {
  if (heat === "hot") return "rgba(251,146,60,0.95)";
  if (heat === "warm") return "rgba(34,197,94,0.95)";
  if (heat === "warming") return "rgba(34,211,238,0.95)";
  return "rgba(156,163,175,0.85)";
}

export default function LiveMatchesTable(props: {
  rows: LiveMatchRow[];
  onAction: (row: LiveMatchRow) => void;
}) {
  const { rows, onAction } = props;

  return (
    <div>
      {/* Column heads */}
      <div className="h-[34px] w-full flex items-center px-4 text-[12px] tracking-[0.18em] text-white/45">
        <div className="w-[26%] pr-3">INVESTOR</div>
        <div className="w-[12%] pr-3 text-right">SIGNAL</div>
        <div className="w-[8%] pr-3 text-right">Δ</div>
        <div className="w-[12%] pr-3 text-right">GOD</div>
        <div className="w-[12%] pr-3 text-right">VC++</div>
        <div className="w-[14%] pr-3 text-right">σ</div>
        <div className="w-[16%] text-right">ACTION</div>
      </div>

      {/* Rows */}
      <div className="space-y-[10px]">
        {rows.map((r) => {
          const halo = glowFor(r.heat);
          const accent = accentFor(r.heat);

          const deltaDir =
            r.delta == null ? "flat" : r.delta > 0 ? "up" : r.delta < 0 ? "down" : "flat";

          const deltaText =
            r.delta == null
              ? "—"
              : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)}`;

          return (
            <div
              key={r.id}
              className="h-[44px] w-full flex items-center px-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                boxShadow: `0 0 0 1px rgba(255,255,255,0.06), ${halo}`,
              }}
            >
              {/* Investor */}
              <div className="w-[26%] pr-3">
                <div className="text-[13.5px] font-semibold text-white/90 truncate">
                  {r.investorName}
                </div>
                {r.firm && (
                  <div className="text-[12px] text-white/35 truncate -mt-[2px]">
                    {r.firm}
                  </div>
                )}
              </div>

              {/* Signal */}
              <div className="w-[12%] pr-3 text-right">
                <div className="text-[13px] font-semibold tabular-nums" style={{ color: accent }}>
                  {Number.isFinite(r.signal) ? r.signal.toFixed(1) : "—"}
                </div>
              </div>

              {/* Delta */}
              <div className="w-[8%] pr-3 text-right">
                <div
                  className="text-[12.5px] tabular-nums"
                  style={{
                    color:
                      deltaDir === "up"
                        ? "rgba(34,211,238,0.9)"
                        : deltaDir === "down"
                        ? "rgba(248,113,113,0.85)"
                        : "rgba(255,255,255,0.35)",
                  }}
                >
                  {deltaText}
                </div>
              </div>

              {/* GOD */}
              <div className="w-[12%] pr-3 text-right">
                <div className="text-[12.5px] tabular-nums text-white/70">
                  {Number.isFinite(r.god) ? r.god : "—"}
                </div>
              </div>

              {/* VC++ */}
              <div className="w-[12%] pr-3 text-right">
                <div className="text-[12.5px] tabular-nums text-white/70">
                  {Number.isFinite(r.vc) ? r.vc : "—"}
                </div>
              </div>

              {/* σ */}
              <div className="w-[14%] pr-3 flex justify-end">
                <TensionBars tier={r.tension} heat={r.heat} />
              </div>

              {/* Action */}
              <div className="w-[16%] text-right">
                <button
                  onClick={() => onAction(r)}
                  className="text-[12.5px] font-semibold tracking-[0.08em] px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 16px ${accent}22`,
                  }}
                >
                  {(r.actionLabel ?? "View").toUpperCase()}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
