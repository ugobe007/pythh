/**
 * Investor Match Card - Trophy-style investor cards with rank badges
 * Positions investors as prizes (full brightness, no dimming)
 */
import React from "react";
import { Trophy, TrendingUp, CheckCircle, DollarSign } from "lucide-react";

export type InvestorMatch = {
  id: string;
  rank: number;
  name: string;
  firm: string | null;
  focus: string | null;
  stage: string | null;
  checkMin: number | null;
  checkMax: number | null;
  matchScore: number;
  whyLine: string;
  chips: string[];
  isFeatured: boolean;
};

function MatchChip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
      {icon}
      {children}
    </span>
  );
}

export function InvestorMatchCard({ investor }: { investor: InvestorMatch }) {
  const getRankColor = (rank: number) => {
    if (rank === 1) return "from-yellow-400/20 via-yellow-500/10 to-transparent";
    if (rank === 2) return "from-gray-300/15 via-gray-400/8 to-transparent";
    if (rank === 3) return "from-orange-400/15 via-orange-500/8 to-transparent";
    return "from-white/5 via-white/3 to-transparent";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: "🏆", label: "#1 Match", color: "text-yellow-400" };
    if (rank === 2) return { icon: "🥈", label: "#2", color: "text-gray-300" };
    if (rank === 3) return { icon: "🥉", label: "#3", color: "text-orange-400" };
    return { icon: `#${rank}`, label: `#${rank}`, color: "text-white/60" };
  };

  const badge = getRankBadge(investor.rank);
  const checkLabel = investor.checkMin && investor.checkMax
    ? `$${investor.checkMin / 1000}K-${investor.checkMax / 1000}K`
    : investor.checkMin
    ? `$${investor.checkMin / 1000}K+`
    : "Undisclosed";

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border",
        investor.isFeatured ? "border-white/20" : "border-white/10",
        "bg-black/35",
        "transition-all duration-300",
        "hover:border-white/30 hover:shadow-[0_8px_32px_rgba(255,255,255,0.08)]",
      ].join(" ")}
    >
      {/* Gradient background based on rank */}
      <div
        className={[
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-40",
          getRankColor(investor.rank),
        ].join(" ")}
      />

      {/* Content */}
      <div className="relative p-5">
        {/* Rank badge + match score */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={["text-2xl font-bold", badge.color].join(" ")}>
              {badge.icon}
            </span>
            <span className={["text-sm font-semibold", badge.color].join(" ")}>
              {badge.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <TrendingUp className="h-3.5 w-3.5 text-white/60" />
            <span className="text-sm font-semibold text-white">
              {investor.matchScore.toFixed(1)}
            </span>
            <span className="text-xs text-white/50">score</span>
          </div>
        </div>

        {/* Identity + meta row */}
        <div className="mt-4">
          <div className="text-xl font-semibold tracking-tight text-white">
            {investor.name}
          </div>
          {investor.firm ? (
            <div className="mt-1 text-sm text-white/60">{investor.firm}</div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
            {investor.stage ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                {investor.stage}
              </span>
            ) : null}
            {investor.checkMin ? (
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                <DollarSign className="h-3 w-3" />
                {checkLabel}
              </span>
            ) : null}
          </div>
        </div>

        {/* "Why match" one-liner */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
          <div className="flex items-start gap-2">
            <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/60" />
            <span className="leading-relaxed">{investor.whyLine}</span>
          </div>
        </div>

        {/* Match strength chips */}
        {investor.chips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {investor.chips.map((chip, i) => (
              <MatchChip key={i} icon={<CheckCircle className="h-3.5 w-3.5 text-white/60" />}>
                {chip}
              </MatchChip>
            ))}
          </div>
        ) : null}

        {/* Action buttons */}
        {investor.isFeatured ? (
          <div className="mt-5 flex items-center gap-3">
            <button className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/15">
              Request Intro
            </button>
            <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 transition-all hover:bg-white/10">
              Pass
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <button className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition-all hover:bg-white/10">
              View Match
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
