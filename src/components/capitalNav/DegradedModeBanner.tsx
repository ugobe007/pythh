import React from "react";
import type { DegradedStatus } from "@/types/capitalNavigation";

export function DegradedModeBanner({
  status,
  onRetry,
}: {
  status: DegradedStatus;
  onRetry?: () => void;
}) {
  if (!status?.isDegraded) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-1 text-[12px] text-amber-200">
              Matching: Degraded
            </span>
            {status.reasonCode ? (
              <span className="text-[12px] text-white/50">code: {status.reasonCode}</span>
            ) : null}
          </div>

          <div className="mt-2 text-[14px] text-white/90">
            {status.message ||
              "We're collecting intent traces normally. Investor identity resolution is delayed."}
          </div>

          <div className="mt-1 text-[12px] text-white/60">
            {typeof status.retryHintSeconds === "number"
              ? `Try again in ~${status.retryHintSeconds}s.`
              : "Retry identity resolution to reveal named investors."}
          </div>
        </div>

        {onRetry ? (
          <button
            onClick={onRetry}
            className="rounded-lg bg-white/10 px-3 py-2 text-[12px] text-white hover:bg-white/15"
          >
            Retry resolution
          </button>
        ) : null}
      </div>
    </div>
  );
}
