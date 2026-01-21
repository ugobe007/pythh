// Overview Tab - Immediate orientation + authority
import type { SignalSnapshot } from '../../../types/snapshot';

export default function OverviewTab({ snapshot }: { snapshot: SignalSnapshot }) {
  const odds = snapshot.odds;
  return (
    <div className="space-y-8">
      {/* Signal State Summary */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Your Signal State</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-white/50 mb-1">Effective Stage</div>
            <div className="text-lg font-semibold">{snapshot.stage}</div>
            <div className="text-xs text-green-400">Mode: {snapshot.mode}</div>
          </div>
          
          <div>
            <div className="text-xs text-white/50 mb-1">Momentum</div>
            <div className="text-lg font-semibold text-orange-400">{snapshot.momentum}</div>
            <div className="text-xs text-white/50">↑ {snapshot.signalStrength}</div>
          </div>
          
          <div>
            <div className="text-xs text-white/50 mb-1">Alignment Strength</div>
            <div className="text-lg font-semibold text-green-400">{odds.alignment.overall}%</div>
            <div className="text-xs text-white/50">Medium–High</div>
          </div>
          
          <div>
            <div className="text-xs text-white/50 mb-1">Timing Window</div>
            <div className="text-lg font-semibold text-blue-400">{snapshot.timingWindow}</div>
            <div className="text-xs text-white/50">{odds.timing.etaText || '4–8 weeks'}</div>
          </div>
        </div>
      </div>

      {/* Three Core Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Your Signals Card */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-purple-500/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">📡</div>
            <h3 className="text-lg font-semibold">Your Signals</h3>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Startup Signals</span>
              <span className="text-green-400 font-medium">Strong ↑</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Investor Signals</span>
              <span className="text-yellow-400 font-medium">Favorable →</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Market Signals</span>
              <span className="text-green-400 font-medium">Improving ↑</span>
            </div>
          </div>
          
          <p className="text-xs text-white/40 mt-4 italic">
            Investors will perceive you as early institutional-ready with moderate risk.
          </p>
        </div>

        {/* Your Odds Card */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-blue-500/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">🎯</div>
            <h3 className="text-lg font-semibold">Your Odds</h3>
          </div>
          
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-4xl font-bold text-blue-400">72</div>
              <div className="text-white/40 text-sm">/ 100</div>
            </div>
            <div className="text-xs text-white/50">Fundraising Readiness Score</div>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/60">Thesis Alignment</span>
              <span className="text-green-400">78%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Stage Alignment</span>
              <span className="text-green-400">71%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Signal Alignment</span>
              <span className="text-yellow-400">64%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Timing Alignment</span>
              <span className="text-green-400">81%</span>
            </div>
          </div>
        </div>

        {/* Your Next Moves Card */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-green-500/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">⚡</div>
            <h3 className="text-lg font-semibold">Your Next Moves</h3>
          </div>
          
          <div className="space-y-3">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
              <div className="text-sm font-medium mb-1">1. Strengthen customer proof</div>
              <div className="text-xs text-white/50">Impact: +14% odds</div>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
              <div className="text-sm font-medium mb-1">2. Reframe narrative</div>
              <div className="text-xs text-white/50">Impact: +9% odds</div>
            </div>
            
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
              <div className="text-sm font-medium mb-1">3. Target 18 seed funds</div>
              <div className="text-xs text-white/50">Impact: +8% odds</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-6 text-center">
        <p className="text-white/80 mb-4">
          <span className="font-semibold">Your signals determine your odds.</span> Improve your signals to improve your outcomes.
        </p>
        <button className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors">
          View All Actions
        </button>
      </div>
    </div>
  );
}
