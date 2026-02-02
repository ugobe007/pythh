/**
 * Matches Header Row - Binding divider between startup signal and investor cards
 * Creates psychological ownership: "Your matches responding to YOUR signal"
 */
import React from "react";
import { Sparkles } from "lucide-react";

export type MatchesHeaderData = {
  industry: string;
  stageLabel: string;
  stageFitLabel: string;
  checkFitLabel: string;
  matchCount: number;
};

function ContextChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
      {children}
    </span>
  );
}

export function MatchesHeaderRow({ data }: { data: MatchesHeaderData }) {
  return (
    <div className="relative my-6">
      {/* Horizontal divider line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Header content */}
      <div className="relative mx-auto w-fit rounded-2xl border border-white/12 bg-black/70 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-white/60" />
          <span className="text-sm font-medium tracking-tight text-white">
            Your Matches Responding to Your Signal
          </span>
        </div>

        {/* Context chips */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ContextChip>
            <span className="text-white/50">Industry:</span>
            <span className="font-medium text-white/90">{data.industry}</span>
          </ContextChip>
          <ContextChip>
            <span className="text-white/50">Stage fit:</span>
            <span className="font-medium text-white/90">{data.stageFitLabel}</span>
          </ContextChip>
          <ContextChip>
            <span className="text-white/50">Check fit:</span>
            <span className="font-medium text-white/90">{data.checkFitLabel}</span>
          </ContextChip>
          <ContextChip>
            <span className="text-white/50">Matches:</span>
            <span className="font-medium text-white/90">{data.matchCount}</span>
          </ContextChip>
        </div>
      </div>
    </div>
  );
}
