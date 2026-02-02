/**
 * LOCKED SIGNALS SECTION
 * =======================
 * Blurred paywall section showing locked signals
 */

import { Lock } from 'lucide-react';
import { LockedSignalsData } from '../../types/signals';

interface LockedSignalsSectionProps {
  data: LockedSignalsData;
}

export default function LockedSignalsSection({ data }: LockedSignalsSectionProps) {
  return (
    <div 
      className="relative bg-white/5 border border-white/10 rounded-lg p-8"
      style={{ animation: 'fadeIn 0.5s ease-out 4s both' }}
    >
      {/* Blurred Stack */}
      <div className="relative mb-6">
        <div className="locked-stack">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div 
              key={i}
              className="bg-white/10 border border-white/10 rounded-lg p-6 mb-3"
              style={{
                transform: `translateY(${i * 4}px)`,
                opacity: 1 - (i * 0.15)
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-white/20 rounded w-32 mb-2" />
                  <div className="h-3 bg-white/20 rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="mb-6">
        <div className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {data.count} MORE SIGNALS
        </div>
        <div className="space-y-2 text-sm text-white/70">
          <div>• {data.breakdown.topTier} top-tier venture firms (Sequoia tier)</div>
          <div>• {data.breakdown.specialists} robotics & automation specialist funds</div>
          <div>• {data.breakdown.corporate} corporate venture arms (Google, Amazon...)</div>
        </div>
        <div className="mt-4 space-y-1 text-sm text-white/60">
          <div>Median signal strength: {data.medianStrength}</div>
          <div>Average outreach window: {data.avgTimeframe}</div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg p-6 text-center mb-6">
        <button className="w-full text-white font-semibold text-lg mb-2 hover:scale-105 transition">
          Unlock capital flow — $49/month
        </button>
        <div className="text-white/80 text-sm">
          or start 7-day free trial
        </div>
      </div>

      {/* Value Props */}
      <div className="space-y-2 text-sm">
        <div className="text-white/90">What you get:</div>
        <div className="space-y-1.5 text-white/70">
          <div>✓ Real-time signal updates</div>
          <div>✓ Direct contact information</div>
          <div>✓ Full investment thesis analysis</div>
          <div>✓ Warm intro paths (when available)</div>
          <div>✓ Custom positioning playbook</div>
        </div>
      </div>

      {/* CSS for blur effect */}
      <style>{`
        .locked-stack {
          filter: blur(8px);
          opacity: 0.6;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
