import { AlertCircle, TrendingUp } from 'lucide-react';

interface DataCompletenessBadgeProps {
  percentage: number;
  enrichmentToken?: string;
  compactMode?: boolean;
}

/**
 * Displays data completeness percentage and "Improve Score" link
 * for founder self-service enrichment
 * 
 * Usage:
 * <DataCompletenessBadge percentage={35} enrichmentToken="uuid-here" />
 */
export default function DataCompletenessBadge({ 
  percentage, 
  enrichmentToken,
  compactMode = false 
}: DataCompletenessBadgeProps) {
  
  // Completeness tiers (matching server logic)
  const getTier = () => {
    if (percentage >= 80) return { label: 'Complete', color: 'emerald', showPrompt: false };
    if (percentage >= 60) return { label: 'Good', color: 'blue', showPrompt: false };
    if (percentage >= 40) return { label: 'Fair', color: 'amber', showPrompt: true };
    return { label: 'Low Data', color: 'rose', showPrompt: true };
  };

  const tier = getTier();

  const handleImproveClick = () => {
    if (!enrichmentToken) {
      alert('Enrichment token not available. Please refresh the page.');
      return;
    }
    
    // Open enrichment form in new tab (will be created next)
    const enrichUrl = `${window.location.origin}/enrich/${enrichmentToken}`;
    window.open(enrichUrl, '_blank');
  };

  if (compactMode) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border bg-${tier.color}-500/10 text-${tier.color}-400 border-${tier.color}-500/20`}>
          {percentage}%
        </span>
        {tier.showPrompt && enrichmentToken && (
          <button
            onClick={handleImproveClick}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            Improve
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-500">Data Quality:</span>
      <span className={`px-2 py-0.5 rounded border font-medium bg-${tier.color}-500/10 text-${tier.color}-400 border-${tier.color}-500/20`}>
        {tier.label} ({percentage}%)
      </span>
      
      {tier.showPrompt && enrichmentToken && (
        <button
          onClick={handleImproveClick}
          className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded hover:bg-cyan-500/20 transition-colors"
        >
          <TrendingUp size={12} />
          <span>Improve Your Score</span>
        </button>
      )}

      {tier.showPrompt && !enrichmentToken && (
        <span className="flex items-center gap-1 text-amber-400/60">
          <AlertCircle size={12} />
          <span className="text-[10px]">Token unavailable</span>
        </span>
      )}
    </div>
  );
}
