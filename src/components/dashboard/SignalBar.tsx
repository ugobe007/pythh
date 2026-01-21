// Persistent Signal Bar - Always visible at top
interface SignalBarProps {
  stage: string;
  momentum: 'Cooling' | 'Stable' | 'Warming' | 'Surge';
  signalStrength: 'Low' | 'Medium' | 'High';
  category: string;
  timing: 'Closed' | 'Opening' | 'Active' | 'Closing';
  mode: 'Estimate' | 'Verified';
}

export default function SignalBar({ stage, momentum, signalStrength, category, timing, mode }: SignalBarProps) {
  const momentumColor = {
    Cooling: 'text-red-400 bg-red-500/10',
    Stable: 'text-yellow-400 bg-yellow-500/10',
    Warming: 'text-orange-400 bg-orange-500/10',
    Surge: 'text-green-400 bg-green-500/10',
  };

  const strengthColor = {
    Low: 'text-red-400 bg-red-500/10',
    Medium: 'text-yellow-400 bg-yellow-500/10',
    High: 'text-green-400 bg-green-500/10',
  };

  const timingColor = {
    Closed: 'text-white/40 bg-white/5',
    Opening: 'text-blue-400 bg-blue-500/10',
    Active: 'text-green-400 bg-green-500/10',
    Closing: 'text-orange-400 bg-orange-500/10',
  };

  return (
    <div className="sticky top-0 z-50 bg-black/95 border-b border-white/10 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-white/40">Stage</span>
              <span className="px-2 py-1 bg-white/10 text-white rounded">{stage}</span>
            </div>
            
            <div className="h-4 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-2">
              <span className="text-white/40">Momentum</span>
              <span className={`px-2 py-1 rounded font-medium ${momentumColor[momentum]}`}>
                {momentum}
              </span>
            </div>
            
            <div className="h-4 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-2">
              <span className="text-white/40">Signal Strength</span>
              <span className={`px-2 py-1 rounded font-medium ${strengthColor[signalStrength]}`}>
                {signalStrength}
              </span>
            </div>
            
            <div className="h-4 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-2">
              <span className="text-white/40">Category</span>
              <span className="px-2 py-1 bg-white/10 text-white rounded">{category}</span>
            </div>
            
            <div className="h-4 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-2">
              <span className="text-white/40">Timing</span>
              <span className={`px-2 py-1 rounded font-medium ${timingColor[timing]}`}>
                {timing}
              </span>
            </div>
            
            <div className="h-4 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-2">
              <span className="text-white/40">Mode</span>
              <span className={`px-2 py-1 rounded ${mode === 'Verified' ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white/60'}`}>
                {mode}
              </span>
            </div>
          </div>
          
          <div className="text-xs text-white/30 italic">
            Updates in real time as signals change
          </div>
        </div>
      </div>
    </div>
  );
}
