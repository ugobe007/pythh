import React from "react";
import type { InvestorMatch, StartupSignal } from "../../types/results.types";

export default function NextActionBar(props: {
  top?: InvestorMatch | null;
  startup: StartupSignal;
  onPrimary: () => void;     // open IntroStrategyModal for #1
  onSecondary: () => void;   // export
  onTertiary: () => void;    // refine
}) {
  const { top, startup, onPrimary, onSecondary, onTertiary } = props;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-semibold text-white">
            Next step
          </div>
          <div className="mt-1 text-xs md:text-sm text-white/65">
            Your responsibility is still the signal. Use the intro playbook, then improve signals to raise meeting odds.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onPrimary}
            className="rounded-xl border border-white/10 bg-white/12 hover:bg-white/16 px-4 py-2 text-sm font-medium text-white"
          >
            {top ? `Draft intro to ${top.name}` : "Draft intro to #1"}
          </button>
          <button
            onClick={onSecondary}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 px-3 py-2 text-sm text-white/90"
          >
            Export matches
          </button>
          <button
            onClick={onTertiary}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 px-3 py-2 text-sm text-white/90"
          >
            Refine signal
          </button>
        </div>
      </div>

      <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
        <span className="rounded-full border border-white/10 bg-white/4 px-2 py-1">
          Improve signals: PR wins
        </span>
        <span className="rounded-full border border-white/10 bg-white/4 px-2 py-1">
          Improve signals: new customers
        </span>
        <span className="rounded-full border border-white/10 bg-white/4 px-2 py-1">
          Improve signals: key hires
        </span>
        <span className="rounded-full border border-white/10 bg-white/4 px-2 py-1">
          Improve signals: product milestones
        </span>
      </div>
    </div>
  );
}
