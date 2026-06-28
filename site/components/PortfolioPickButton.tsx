/**
 * Add startup to investor virtual portfolio (10-pick cap).
 */

import { useState, type MouseEvent } from 'react';
import { Bookmark, Check, Loader2 } from 'lucide-react';
import { addPortfolioPick, INVESTOR_PORTFOLIO_MAX_PICKS } from '@/lib/investorPortfolio';

type Props = {
  startupId: string;
  startupName?: string;
  picked: boolean;
  picksUsed: number;
  onPicked: (startupId: string, picksUsed: number) => void;
  onCapReached?: () => void;
};

export default function PortfolioPickButton({
  startupId,
  picked,
  picksUsed,
  onPicked,
  onCapReached,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atCap = picksUsed >= INVESTOR_PORTFOLIO_MAX_PICKS;

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (picked || loading || atCap) return;
    setLoading(true);
    setError(null);
    const result = await addPortfolioPick(startupId);
    if (result.ok && result.picks_used != null) {
      onPicked(startupId, result.picks_used);
    } else if (result.error?.includes('full') || result.error?.includes('409')) {
      onCapReached?.();
      setError('Full');
    } else if (result.error?.includes('Already')) {
      onPicked(startupId, picksUsed);
    } else {
      setError('!');
    }
    setLoading(false);
  };

  if (picked) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium" title="In your portfolio">
        <Check className="w-3.5 h-3.5" />
        Picked
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={loading || atCap}
      title={
        atCap
          ? `Portfolio full (${INVESTOR_PORTFOLIO_MAX_PICKS}/${INVESTOR_PORTFOLIO_MAX_PICKS})`
          : 'Add to your portfolio'
      }
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-zinc-700 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Bookmark className="w-3 h-3" />
      )}
      {error || 'Pick'}
    </button>
  );
}
