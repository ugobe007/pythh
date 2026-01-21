// Odds Tab - Probability engine (this is where Pythh becomes addictive)
import type { SignalSnapshot } from '../../../types/snapshot';

export default function OddsTab({ snapshot }: { snapshot: SignalSnapshot }) {
  const odds = snapshot.odds;
  return (
    <div className="space-y-8">
      {/* Fundraising Readiness Score */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Fundraising Readiness</h2>
        
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-white/50 mb-2">Fundraising Readiness Score</div>
              <div className="flex items-baseline gap-3">
                <div className="text-6xl font-bold text-blue-400">{odds.readinessScore}</div>
                <div className="text-2xl text-white/40">/ 100</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-white/50 mb-2">Trend</div>
              <div className="text-3xl text-green-400">↑</div>
              <div className="text-xs text-white/40">{odds.readinessTrendDelta7d ? `+${odds.readinessTrendDelta7d}` : '+6'} this week</div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xs text-white/50 mb-1">Execution Readiness</div>
              <div className="text-2xl font-bold text-green-400">{odds.breakdown.execution}</div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xs text-white/50 mb-1">Traction Readiness</div>
              <div className="text-2xl font-bold text-yellow-400">{odds.breakdown.traction}</div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xs text-white/50 mb-1">Narrative Readiness</div>
              <div className="text-2xl font-bold text-yellow-400">{odds.breakdown.narrative}</div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xs text-white/50 mb-1">Market Timing</div>
              <div className="text-2xl font-bold text-green-400">{odds.breakdown.marketTiming}</div>
            </div>
          </div>
          
          <p className="text-sm text-white/60 mt-4 p-3 bg-white/5 rounded border-l-2 border-blue-500">
            <span className="font-semibold text-white">Interpretation:</span> You are likely to convert meetings with Seed and select Early A funds.
          </p>
        </div>
      </section>

      {/* Alignment Matrix */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Alignment Matrix</h2>
        
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="space-y-4 mb-6">
            <AlignmentBar label="Thesis Alignment" score={78} />
            <AlignmentBar label="Stage Alignment" score={71} />
            <AlignmentBar label="Signal Alignment" score={64} />
            <AlignmentBar label="Timing Alignment" score={81} />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div>
              <div className="text-sm text-white/50">Overall Alignment Strength</div>
              <div className="text-3xl font-bold text-green-400">74%</div>
            </div>
            <div className="text-green-400 text-4xl">✓</div>
          </div>
          
          <p className="text-sm text-white/60 mt-4 p-3 bg-white/5 rounded border-l-2 border-green-500">
            <span className="font-semibold text-white">Interpretation:</span> Alignment is strong enough to begin active outreach with high-conviction funds.
          </p>
        </div>
      </section>

      {/* Objection Forecast */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Objection Forecast</h2>
        
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <p className="text-sm text-white/50 mb-4">
            Predicted investor objections (statistically likely based on comparable outcomes):
          </p>
          
          <div className="space-y-3">
            <div className="p-4 bg-yellow-500/5 border-l-2 border-yellow-500 rounded">
              <div className="flex items-start gap-3">
                <div className="text-yellow-500 text-xl">1</div>
                <div className="flex-1">
                  <div className="font-medium text-yellow-400 mb-1">"Customer proof is still thin for institutional conviction"</div>
                  <div className="text-xs text-white/50">Affects: Series A funds | Probability: High</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-500/5 border-l-2 border-yellow-500 rounded">
              <div className="flex items-start gap-3">
                <div className="text-yellow-500 text-xl">2</div>
                <div className="flex-1">
                  <div className="font-medium text-yellow-400 mb-1">"GTM clarity will be questioned"</div>
                  <div className="text-xs text-white/50">Affects: Growth-stage VCs | Probability: Medium</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-500/5 border-l-2 border-yellow-500 rounded">
              <div className="flex items-start gap-3">
                <div className="text-yellow-500 text-xl">3</div>
                <div className="flex-1">
                  <div className="font-medium text-yellow-400 mb-1">"Revenue predictability will matter at next raise"</div>
                  <div className="text-xs text-white/50">Affects: Institutional partners | Probability: Medium</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timing Window */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Timing Window</h2>
        
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-white/50 mb-1">Timing Status</div>
              <div className="text-3xl font-bold text-blue-400">OPENING</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/50 mb-1">Window Opens In</div>
              <div className="text-2xl font-bold text-white">4–8 weeks</div>
            </div>
          </div>
          
          <div className="relative mb-6">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-white/20 via-blue-500 to-green-500 w-[45%]"></div>
            </div>
            <div className="flex justify-between text-xs text-white/40 mt-2">
              <span>Closed</span>
              <span>Opening</span>
              <span className="font-semibold text-blue-400">ACTIVE</span>
              <span>Closing</span>
            </div>
            <div className="absolute left-[45%] -top-6 transform -translate-x-1/2">
              <div className="text-xs text-blue-400 font-semibold">YOU ARE HERE</div>
            </div>
          </div>
          
          <p className="text-sm text-white/60 p-3 bg-white/5 rounded border-l-2 border-blue-500">
            <span className="font-semibold text-white">Interpretation:</span> Optimal outreach window opens in 4–8 weeks if signals continue improving.
          </p>
        </div>
      </section>
    </div>
  );
}

function AlignmentBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? 'green' : score >= 60 ? 'yellow' : 'red';
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-white/70">{label}</div>
        <div className="text-sm font-bold text-white">{score}%</div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} transition-all duration-500`} 
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  );
}
