// src/components/InvestorAlignmentCard.tsx
import React from "react";
import {
  ExternalLink,
  EyeOff,
  Building2,
  Target,
  TrendingUp,
  Zap,
  Lock,
} from "lucide-react";
import { getScoreStyle, formatCheckSize } from "@/hooks/useMatches";

type ConfidenceLevel = "high" | "medium" | "low" | string;

export interface InvestorAlignmentCardVisibility {
  showCheckSize: boolean;
  showReason: boolean;
  showConfidence: boolean;
  showNotableInvestments: boolean;
}

export interface InvestorAlignmentCardData {
  investor_id: string;
  investor_name?: string | null;
  investor_name_masked?: boolean;
  firm?: string | null;
  type?: string | null;
  stage?: string[] | string | null;
  sectors?: string[] | null;
  photo_url?: string | null;
  linkedin_url?: string | null;

  check_size_min?: number | null;
  check_size_max?: number | null;

  match_score: number;

  // Elite-only
  reasoning?: string | null;
  confidence_level?: ConfidenceLevel | null;

  // Pro+
  notable_investments?: string[] | string | null;
}

function stageText(stage?: string[] | string | null) {
  if (!stage) return null;
  if (Array.isArray(stage)) return stage.slice(0, 2).join(", ");
  return stage;
}

export default function InvestorAlignmentCard({
  match,
  index,
  visibility,
  onClick,
}: {
  match: InvestorAlignmentCardData;
  index: number;
  visibility: InvestorAlignmentCardVisibility;
  onClick?: () => void;
}) {
  const isMasked = !!match.investor_name_masked;

  const displayName = isMasked
    ? match.firm
      ? `Investor at ${match.firm}`
      : `Investor #${index + 1}`
    : match.investor_name || "Unknown Investor";

  const rankBg =
    index === 0
      ? "bg-amber-500/20 border border-amber-500/30"
      : index === 1
      ? "bg-gray-400/20 border border-gray-400/30"
      : index === 2
      ? "bg-orange-700/20 border border-orange-700/30"
      : "bg-violet-500/20 border border-violet-500/30";

  const rankText =
    index === 0
      ? "text-amber-400"
      : index === 1
      ? "text-gray-300"
      : index === 2
      ? "text-orange-400"
      : "text-violet-400";

  return (
    <div
      onClick={isMasked ? undefined : onClick}
      className={`p-4 bg-gradient-to-r from-[#0f0f0f] via-[#131313] to-[#0f0f0f] border rounded-xl transition-all ${
        isMasked
          ? "border-gray-700/30 cursor-default"
          : "border-gray-700/50 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Rank + Photo */}
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden ${rankBg}`}
            >
              {match.photo_url ? (
                <img
                  src={match.photo_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className={rankText}>#{index + 1}</span>
              )}
            </div>

            {isMasked && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500/80 rounded-full flex items-center justify-center">
                <EyeOff className="w-2.5 h-2.5 text-black" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="flex items-center gap-2 mb-1">
              <h4
                className={`text-base font-semibold ${
                  isMasked ? "text-gray-400" : "text-white"
                }`}
              >
                {displayName}
              </h4>

              {isMasked && (
                <span className="px-1.5 py-0.5 text-[9px] bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                  Upgrade to reveal
                </span>
              )}

              {!isMasked && match.linkedin_url && (
                <a
                  href={match.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-500 hover:text-cyan-400" />
                </a>
              )}
            </div>

            {/* Firm */}
            {match.firm && (
              <p className="text-sm text-gray-400 mb-2">{match.firm}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-3">
              {match.type && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {match.type}
                </span>
              )}

              {visibility.showCheckSize &&
                (match.check_size_min || match.check_size_max) && (
                  <span className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    {formatCheckSize(
                      match.check_size_min || undefined,
                      match.check_size_max || undefined
                    )}
                  </span>
                )}

              {stageText(match.stage) && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {stageText(match.stage)}
                </span>
              )}
            </div>

            {/* Sectors */}
            {match.sectors && match.sectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {match.sectors.slice(0, 4).map((sector, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded-full"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            )}

            {/* Elite-only reasoning */}
            {visibility.showReason && match.reasoning && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Why this investor is aligned
                  </span>

                  {visibility.showConfidence && match.confidence_level && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 text-[9px] rounded ${
                        match.confidence_level === "high"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : match.confidence_level === "medium"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {String(match.confidence_level)} confidence
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-300/90">{match.reasoning}</p>
              </div>
            )}

            {/* Pro lock hint */}
            {!visibility.showReason && !isMasked && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-amber-400">
                  Alignment reasons available in Elite
                </span>
              </div>
            )}

            {/* Pro+ notable investments */}
            {visibility.showNotableInvestments &&
              match.notable_investments &&
              (Array.isArray(match.notable_investments)
                ? match.notable_investments.length > 0
                : String(match.notable_investments).length > 0) && (
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Portfolio:{" "}
                  {Array.isArray(match.notable_investments)
                    ? match.notable_investments.slice(0, 3).join(", ")
                    : match.notable_investments}
                </p>
              )}
          </div>
        </div>

        {/* Alignment Score */}
        <div
          className={`px-2.5 py-1.5 rounded-lg border shrink-0 ${getScoreStyle(
            match.match_score
          )}`}
        >
          <div className="text-lg font-bold">{match.match_score}%</div>
          <div className="text-[8px] uppercase tracking-wider opacity-70">
            Alignment
          </div>
          <div className="text-[7px] text-gray-500 mt-0.5 opacity-80">
            to your signals
          </div>
        </div>
      </div>
    </div>
  );
}
