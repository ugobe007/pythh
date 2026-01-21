/**
 * DIAGNOSTICS TOGGLE — Results Spatial Contract
 * ==============================================
 * 
 * Only behind a toggle.
 * Never visible by default.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DiagnosticsToggleProps {
  diagnostics: {
    readinessScore?: number;
    gaps?: string[];
    strengths?: string[];
    [key: string]: any;
  };
}

export function DiagnosticsToggle({ diagnostics }: DiagnosticsToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!diagnostics) return null;

  return (
    <section className="mb-12">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide diagnostics
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Show diagnostics
          </>
        )}
      </button>

      {isExpanded && (
        <div className="mt-6 border border-neutral-800 rounded-lg p-6 bg-neutral-950/20">
          <h3 className="text-lg font-medium mb-4 text-neutral-400">Diagnostics</h3>
          
          {diagnostics.readinessScore !== undefined && (
            <div className="mb-4">
              <span className="text-sm text-neutral-500">Readiness Score:</span>
              <span className="ml-2 text-neutral-300">{diagnostics.readinessScore}%</span>
            </div>
          )}

          {diagnostics.gaps && diagnostics.gaps.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-neutral-500 mb-2">Gaps:</div>
              <ul className="text-sm text-neutral-400 space-y-1">
                {diagnostics.gaps.map((gap: string, i: number) => (
                  <li key={i}>• {gap}</li>
                ))}
              </ul>
            </div>
          )}

          {diagnostics.strengths && diagnostics.strengths.length > 0 && (
            <div>
              <div className="text-sm text-neutral-500 mb-2">Strengths:</div>
              <ul className="text-sm text-neutral-400 space-y-1">
                {diagnostics.strengths.map((strength: string, i: number) => (
                  <li key={i}>• {strength}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
