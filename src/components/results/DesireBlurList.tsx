/**
 * DESIRE BLUR LIST — Results Spatial Contract
 * ============================================
 * 
 * This is where gating belongs.
 * 
 * RULES:
 * • Blur names only, never blur "why_partial"
 * • Show counts (more aligned / more misaligned / warming)
 * • Keep it quiet and inevitable, not salesy
 */

interface DesireBlurListProps {
  moreAlignedCount: number;
  moreMisalignedCount: number;
  warmingCount: number;
  partialMatches: Array<{
    whyPartial: string;
    score: number;
  }>;
}

export function DesireBlurList({ 
  moreAlignedCount, 
  moreMisalignedCount, 
  warmingCount,
  partialMatches 
}: DesireBlurListProps) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-medium mb-6">Beyond Your Top 5</h2>

      <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-950/40 backdrop-blur-sm">
        
        {/* Counts */}
        <div className="flex gap-8 mb-6 text-sm">
          <div>
            <span className="text-neutral-500">More aligned:</span>
            <span className="ml-2 text-neutral-300">{moreAlignedCount}</span>
          </div>
          <div>
            <span className="text-neutral-500">More misaligned:</span>
            <span className="ml-2 text-neutral-300">{moreMisalignedCount}</span>
          </div>
          <div>
            <span className="text-neutral-500">Warming:</span>
            <span className="ml-2 text-neutral-300">{warmingCount}</span>
          </div>
        </div>

        {/* Blurred matches */}
        <div className="space-y-3 mb-6">
          {partialMatches.slice(0, 5).map((match, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="text-sm text-neutral-400 blur-sm select-none">
                ██████████ Capital Partners
              </div>
              <div className="text-right">
                <div className="text-sm text-neutral-300">{match.score}%</div>
                <div className="text-xs text-neutral-500">{match.whyPartial}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quiet unlock CTA */}
        <div className="text-center">
          <button className="text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-700 rounded px-6 py-2">
            Unlock your full investor map
          </button>
        </div>

      </div>
    </section>
  );
}
