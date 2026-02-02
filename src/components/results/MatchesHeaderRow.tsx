import React from "react";

export default function MatchesHeaderRow(props: {
  industry: string;
  stageFit: string;
  checkFit: string;
  matches: number;
}) {
  const { industry, stageFit, checkFit, matches } = props;

  return (
    <div className="mt-5 md:mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-semibold text-white">
            Your signal is attracting these investors right now.
          </div>
          <div className="mt-1 text-xs md:text-sm text-white/65">
            Ranked by alignment + intent • {industry} • {stageFit} • {checkFit}
          </div>
        </div>
        <div className="shrink-0 text-xs text-white/70 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          {matches} matches
        </div>
      </div>

      <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}
