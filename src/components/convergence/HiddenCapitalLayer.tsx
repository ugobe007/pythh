/**
 * HIDDEN CAPITAL LAYER - Blurred investors + unlock CTA
 * ======================================================
 */

import type { HiddenInvestorPreview } from '../../types/convergence';
import { Lock } from 'lucide-react';

interface Props {
  preview: HiddenInvestorPreview[];
  totalCount: number;
  onUnlock?: () => void;
}

export function HiddenCapitalLayer({ preview, totalCount, onUnlock }: Props) {
  if (totalCount === 0) return null;
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Additional Investors Detecting Your Signals</h2>
        <p className="text-gray-400 text-sm">
          {totalCount} investors currently exhibiting discovery or portfolio alignment patterns around your startup.
        </p>
      </div>

      {/* Blurred Investor Grid */}
      <BlurredInvestorGrid preview={preview} />

      {/* Unlock CTA */}
      <UnlockCTA onUnlock={onUnlock} />
    </div>
  );
}

function BlurredInvestorGrid({ preview }: { preview: HiddenInvestorPreview[] }) {
  return (
    <div className="space-y-2">
      {preview.map((inv, i) => (
        <div
          key={inv.blurred_id}
          className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden"
        >
          {/* Blur overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent backdrop-blur-md"></div>
          
          {/* Semi-visible content */}
          <div className="relative flex items-center justify-between opacity-40">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-700 rounded"></div>
              <div>
                <div className="h-4 w-32 bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-24 bg-gray-700 rounded"></div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <StateBadgeMini state={inv.signal_state} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StateBadgeMini({ state }: { state: string }) {
  const emoji = {
    breakout: '🚀',
    surge: '🔥',
    warming: '🌡',
    watch: '👀'
  };
  
  return <span>{emoji[state as keyof typeof emoji] || '👀'} {state}</span>;
}

function UnlockCTA({ onUnlock }: { onUnlock?: () => void }) {
  return (
    <div className="mt-6 text-center sticky bottom-4 md:relative md:bottom-0">
      <button 
        onClick={onUnlock}
        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition flex items-center gap-2 mx-auto shadow-lg"
      >
        <Lock className="w-4 h-4" />
        Unlock Full Signal Map
      </button>
      <p className="text-xs text-gray-500 mt-2">
        Reveal all investors, partners, and behavioral signals detecting your startup
      </p>
    </div>
  );
}
