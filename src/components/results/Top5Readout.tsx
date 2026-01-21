/**
 * TOP 5 READOUT — Results Spatial Contract
 * =========================================
 * 
 * Ranked list readout (not a grid).
 * Dominant. Immediate. High scan-ability.
 * 
 * MUST BE:
 * • Ranked list readout (not a grid)
 • One investor per row block
 * • Minimal ornamentation
 * • Score right-aligned
 * 
 * PER INVESTOR:
 * • Investor name
 * • Score
 * • Distance tag (warm/adjacent/cold) – subtle
 * • Why (1 line)
 * • Align (1 line)
 * • Expand affordance: "details" (small)
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Top5Match {
  rank: number;
  name: string;
  score: number;
  distance: "warm" | "adjacent" | "cold";
  why: string;
  align: string;
  website?: string;
  causalReasons?: string[];
  leverageActions?: string[];
}

interface Top5ReadoutProps {
  matches: Top5Match[];
}

export function Top5Readout({ matches }: Top5ReadoutProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function getDistanceColor(distance: string) {
    if (distance === "warm") return "text-emerald-400";
    if (distance === "adjacent") return "text-amber-400";
    return "text-gray-500";
  }

  return (
    <section className="mb-12">
      <h2 className="text-xl font-medium mb-6">TOP 5 INVESTOR MATCHES</h2>

      <div className="space-y-6">
        {matches.map((match, index) => (
          <div key={match.rank} className="border-l-2 border-neutral-800 pl-4">
            
            {/* Main row */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-neutral-600 text-sm">{match.rank}</span>
                  <span className="font-medium">{match.name}</span>
                </div>
                <div className="text-sm text-neutral-400 mb-1">
                  Why: {match.why}
                </div>
                <div className="text-sm text-neutral-400">
                  Align: {match.align}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-2xl font-light">{match.score}%</span>
                <span className={`text-xs ${getDistanceColor(match.distance)}`}>
                  [{match.distance}]
                </span>
              </div>
            </div>

            {/* Expand toggle */}
            {(match.causalReasons || match.leverageActions) && (
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="text-xs text-neutral-500 hover:text-neutral-300 mt-2 flex items-center gap-1"
              >
                {expandedIndex === index ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    details
                  </>
                )}
              </button>
            )}

            {/* Expanded view */}
            {expandedIndex === index && (
              <div className="mt-4 pl-4 border-l border-neutral-800 space-y-3">
                {match.causalReasons && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Causal reasons:</div>
                    <ul className="text-sm text-neutral-400 space-y-1">
                      {match.causalReasons.map((reason, i) => (
                        <li key={i}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {match.leverageActions && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Leverage actions:</div>
                    <ul className="text-sm text-neutral-400 space-y-1">
                      {match.leverageActions.map((action, i) => (
                        <li key={i}>• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>
        ))}
      </div>

      {/* Quiet CTA */}
      <div className="mt-8 text-center">
        <button className="text-sm text-neutral-500 hover:text-neutral-300 border border-neutral-800 rounded px-4 py-2">
          View Full Target List
        </button>
      </div>
    </section>
  );
}
