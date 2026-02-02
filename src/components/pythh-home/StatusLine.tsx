export default function StatusLine(props: {
  state: "LIVE" | "BUSY" | "STALE";
  lastUpdatedAtMs: number | null;
  mode: "global" | "tracking" | string;
  bufferState: "cold" | "warm" | "hot" | string;
  refreshMins: number;
}) {
  const { state, lastUpdatedAtMs, mode, bufferState, refreshMins } = props;

  const ageSec =
    lastUpdatedAtMs == null
      ? null
      : Math.max(0, Math.floor((Date.now() - lastUpdatedAtMs) / 1000));

  const dot =
    state === "LIVE"
      ? "rgba(34,211,238,0.9)"
      : state === "BUSY"
      ? "rgba(251,191,36,0.9)"
      : "rgba(156,163,175,0.9)";

  return (
    <div className="text-[12.5px] text-white/45 tabular-nums flex items-center gap-2">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-[7px] h-[7px]" style={{ background: dot }} />
        <span className="text-white/55 tracking-[0.10em]">{state}</span>
      </span>

      <span className="text-white/25">·</span>

      <span>
        updated{" "}
        {ageSec == null ? "recently" : ageSec <= 5 ? "moments ago" : `${ageSec}s ago`}
      </span>

      <span className="text-white/25">·</span>

      <span>mode: {mode}</span>

      <span className="text-white/25">·</span>

      <span>buffer: {bufferState}</span>

      <span className="text-white/25">·</span>

      <span>refresh: {refreshMins}m</span>
    </div>
  );
}
