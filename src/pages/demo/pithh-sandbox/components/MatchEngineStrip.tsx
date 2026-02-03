import React, { useRef, useEffect } from "react";
import { MatchRecord } from "../types";

interface MatchEngineStripProps {
  matches: MatchRecord[];
  totalCount: number;
  loading: boolean;
  onViewAll?: () => void;
}

export default function MatchEngineStrip({
  matches,
  totalCount,
  loading,
  onViewAll,
}: MatchEngineStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (loading && matches.length === 0) {
    return (
      <div className="matchEngineStrip">
        <div className="stripHeader">
          <div className="stripTitle">
            <span className="matchCount">Loading matches...</span>
            <span className="timestamp">• live</span>
          </div>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="matchEngineStrip">
      <div className="stripHeader">
        <div className="stripTitle">
          <span className="matchCount">{totalCount} investors aligned</span>
          <span className="timestamp">• updated seconds ago</span>
          {onViewAll && (
            <button onClick={onViewAll} className="viewAllLink">
              View all →
            </button>
          )}
        </div>
      </div>

      <div className="stripScroll" ref={scrollRef}>
        <div className="investorCards">
          {matches.map((match) => (
            <div key={match.id} className="investorCard">
              {/* Investor photo/initials */}
              <div className="investorPhoto">
                {match.investor.photo_url ? (
                  <img
                    src={match.investor.photo_url}
                    alt={match.investor.name}
                    className="investorImage"
                  />
                ) : (
                  <div className="investorInitials">
                    {match.investor.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                )}
              </div>

              {/* Investor details */}
              <div className="investorInfo">
                <div className="investorName">{match.investor.name}</div>
                {match.investor.firm && (
                  <div className="investorFirm">{match.investor.firm}</div>
                )}

                {/* Key details */}
                <div className="investorMeta">
                  {match.investor.stage && (
                    <span className="investorStage">
                      {match.investor.stage.join(", ")}
                    </span>
                  )}
                </div>

                {/* Check size */}
                {(match.investor.check_size_min || match.investor.check_size_max) && (
                  <div className="investorCheckSize">
                    {formatCheckSize(
                      match.investor.check_size_min,
                      match.investor.check_size_max
                    )}
                  </div>
                )}

                {/* Why match */}
                {match.why_you_match && match.why_you_match.length > 0 && (
                  <div className="investorReason">
                    {humanizeReason(match.why_you_match[0])}
                  </div>
                )}
              </div>

              {/* Match score badge */}
              <div className="matchScore">
                <span className="scoreValue">{Math.round(match.match_score)}</span>
                <span className="scoreLabel">% fit</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatCheckSize(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (!min && !max) return "Undisclosed";

  const formatNum = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(0)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n}`;
  };

  if (min && max) return `${formatNum(min)}–${formatNum(max)}`;
  if (min) return `${formatNum(min)}+`;
  return `Up to ${formatNum(max!)}`;
}

function humanizeReason(reason: string): string {
  const map: Record<string, string> = {
    sector_match: "Sector Match",
    stage_match: "Stage Match",
    industry_match: "Industry Match",
    check_size_match: "Check Size Match",
    geography_match: "Geography Match",
  };
  return map[reason] || reason;
}
