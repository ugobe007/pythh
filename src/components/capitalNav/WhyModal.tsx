import React from "react";

export function WhyModal({
  open,
  title,
  bullets,
  onClose,
}: {
  open: boolean;
  title: string;
  bullets: string[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-wider text-white/50">Why?</div>
            <div className="mt-1 text-[18px] font-semibold text-white">{title}</div>
            <div className="mt-1 text-[12px] text-white/55">
              Signals represent intent. This shows the top drivers for this badge.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-2 text-[12px] text-white hover:bg-white/15"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <ul className="space-y-2 text-[13px] text-white/80">
            {bullets.slice(0, 6).map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 text-[12px] text-white/55">
          Tip: Improving your "Next Best Move" typically raises alignment and trajectory confidence.
        </div>
      </div>
    </div>
  );
}
