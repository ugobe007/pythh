// Signals Tab - Foundation data that drives everything
import type { SignalSnapshot } from '../../../types/snapshot';

export default function SignalsTab({ snapshot }: { snapshot: SignalSnapshot }) {
  const startupSignals = snapshot.startupSignals;
  const investorSignals = snapshot.investorSignals;
  const marketSignals = snapshot.marketSignals;

  const mapStartupColor = (strength: string) =>
    strength === 'Strong' ? 'green' : strength === 'Medium' ? 'yellow' : 'red';

  const mapNeutralColor = (status: string) =>
    status === 'Favorable' || status === 'High' || status === 'Active' || status === 'Rising' || status === 'Increasing'
      ? 'green'
      : status === 'Neutral' || status === 'Moderate' || status === 'Entering'
      ? 'yellow'
      : 'red';

  const startupSummary =
    startupSignals.every((s) => s.strength === 'Strong')
      ? 'Strong ↑'
      : startupSignals.some((s) => s.strength === 'Weak')
      ? 'Mixed →'
      : 'Developing →';

  const investorSummary =
    investorSignals.some((s) => String(s.status).toLowerCase().includes('unfavorable'))
      ? 'Unfavorable ↓'
      : 'Favorable →';

  const marketSummary =
    marketSignals.some((s) => String(s.status).toLowerCase().includes('rising'))
      ? 'Improving ↑'
      : 'Developing →';

  const strengthColor = {
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
  } as const;

  return (
    <div className="space-y-8">
      {/* Top Summary */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Your Signals Today</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-white/50 mb-1">Startup Signals</div>
            <div className="text-xl font-semibold text-green-400">{startupSummary}</div>
          </div>
          <div>
            <div className="text-sm text-white/50 mb-1">Investor Signals</div>
            <div className="text-xl font-semibold text-yellow-400">{investorSummary}</div>
          </div>
          <div>
            <div className="text-sm text-white/50 mb-1">Market Signals</div>
            <div className="text-xl font-semibold text-green-400">{marketSummary}</div>
          </div>
        </div>
        
        <p className="text-sm text-white/60 mt-4 p-3 bg-white/5 rounded border-l-2 border-blue-500">
          <span className="font-semibold text-white">Interpretation:</span> Investors will perceive you as early institutional-ready with moderate risk.
        </p>
      </div>

      {/* Startup Signals */}
      <section>
        <h3 className="text-xl font-semibold mb-4">Startup Signals</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {startupSignals.map((signal) => {
            const c = mapStartupColor(signal.strength);
            return (
            <div
              key={signal.name}
              className={`p-4 rounded-lg border ${strengthColor[c]}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-sm">{signal.name}</div>
                <div className="text-lg">{signal.trend}</div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="text-white/50">Strength</div>
                  <div className="font-medium">{signal.strength}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/50">Sensitivity</div>
                  <div className="font-medium">{signal.sensitivity}</div>
                </div>
              </div>
              
              {signal.sensitivity === 'High' && (
                <div className="mt-2 text-xs text-white/40 italic">
                  Heavily influences Seed/Early A partners
                </div>
              )}
            </div>
            );
          })}
        </div>
      </section>

      {/* Investor Signals */}
      <section>
        <h3 className="text-xl font-semibold mb-4">Investor Signals</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investorSignals.map((signal) => {
            const c = mapNeutralColor(String(signal.status));
            return (
              <div
                key={signal.name}
                className={`p-4 rounded-lg border ${strengthColor[c]}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-sm">{signal.name}</div>
                  <div className="text-lg">{signal.trend}</div>
                </div>
                
                <div className="text-xs">
                  <div className="text-white/50">Status</div>
                  <div className="font-medium">{signal.status}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg text-sm text-white/70">
          <span className="font-semibold text-white">Interpretation:</span> Your category is entering an active deployment phase for early-stage funds.
        </div>
      </section>

      {/* Market Signals */}
      <section>
        <h3 className="text-xl font-semibold mb-4">Market Signals</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketSignals.map((signal) => {
            const c = mapNeutralColor(String(signal.status));
            return (
              <div
                key={signal.name}
                className={`p-4 rounded-lg border ${strengthColor[c]}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-sm">{signal.name}</div>
                  <div className="text-lg">{signal.trend}</div>
                </div>
                
                <div className="text-xs">
                  <div className="text-white/50">Status</div>
                  <div className="font-medium">{signal.status}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg text-sm text-white/70">
          <span className="font-semibold text-white">Interpretation:</span> Market conditions favor early infrastructure and energy-adjacent theses.
        </div>
      </section>
    </div>
  );
}
