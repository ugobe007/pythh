import LiveStreamHeader from "@/components/signals/LiveStreamHeader";
import SignalTableCardList, { SignalRow } from "@/components/signals/SignalTableCardList";
import SubmitBar from "@/components/signals/SubmitBar";
import SystemLine, { SystemLineState } from "@/components/signals/SystemLine";

export default function FindInvestorSignalsBlock(props: {
  url: string;
  onUrlChange: (v: string) => void;
  onSubmit: () => void;
  systemState: SystemLineState;
  lastUpdatedAt: number | null;
  rows: SignalRow[];
  isLoading: boolean;
  onRefetch: () => void;
  previewNamesCount: number;
}) {
  const {
    url,
    onUrlChange,
    onSubmit,
    systemState,
    lastUpdatedAt,
    rows,
    isLoading,
    onRefetch,
    previewNamesCount,
  } = props;

  const showStream = true; // always show tape + table skeleton; keeps page feeling alive

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div
          className="text-[30px] font-semibold tracking-[0.08em]"
          style={{
            // Strong glow so you can visually confirm you're editing the live component
            textShadow:
              "0 0 12px rgba(34,211,238,0.22), 0 0 28px rgba(34,211,238,0.14), 0 0 60px rgba(34,211,238,0.08)",
          }}
        >
          FIND INVESTOR SIGNALS
        </div>

        <div className="text-[14px] text-white/60 mt-1">
          Discover which investors are aligned with you — now
        </div>

        <div className="text-[12px] text-white/38 mt-2">
          Preview includes {previewNamesCount} investor names. Unlock reveals the rest.
        </div>
      </div>

      {/* SubmitBar */}
      <SubmitBar
        value={url}
        onChange={onUrlChange}
        onSubmit={onSubmit}
        isLoading={systemState === "loading"}
      />

      <div className="mt-[10px]">
        <SystemLine state={systemState} lastUpdatedAt={lastUpdatedAt} />
      </div>

      <div className="mt-4 h-px w-full bg-white/10" />

      {/* Live stream */}
      {showStream && (
        <div className="mt-4">
          <LiveStreamHeader
            state={
              systemState === "loading"
                ? "BUSY"
                : systemState === "stale"
                ? "STALE"
                : "LIVE"
            }
            lastUpdatedAt={lastUpdatedAt}
            onRefetch={onRefetch}
          />

          <div className="mt-[10px]">
            <SignalTableCardList
              rows={rows}
              isLoading={isLoading}
              emptyText="No strong investor signals detected yet. Monitoring continues…"
            />
          </div>

          <div className="mt-6 text-center text-[12px] text-white/30">
            Signal = timing · GOD = position · VC++ = investor optics
          </div>
        </div>
      )}
    </div>
  );
}
