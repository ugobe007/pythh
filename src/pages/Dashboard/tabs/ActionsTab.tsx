// Actions Tab - The command center (This is the killer feature)
import { useState } from 'react';
import type { SignalSnapshot } from '../../../types/snapshot';

export default function ActionsTab({ snapshot }: { snapshot: SignalSnapshot }) {
  const [selectedAction, setSelectedAction] = useState<number | null>(null);
  
  const priorityActions = snapshot.actions.priority;
  const attenuationControls = snapshot.actions.attenuation;
  const unlockPreview = snapshot.actions.unlockPreview;

  return (
    <div className="space-y-8">
      {/* Priority Actions */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Priority Actions</h2>
        <p className="text-sm text-white/60 mb-6">Ordered by impact on fundraising odds. Each action shows probability delta and investor sensitivity.</p>
        
        <div className="space-y-4">
          {priorityActions.map((action) => (
            <div
              key={action.id}
              className={`bg-white/5 border rounded-lg transition-all cursor-pointer ${
                selectedAction === action.id
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'border-white/10 hover:border-white/20'
              }`}
              onClick={() => setSelectedAction(selectedAction === action.id ? null : action.id)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl font-bold text-blue-400">{action.id}</div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{action.title}</h3>
                      <p className="text-sm text-white/60">{action.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">+{action.probabilityDeltaPct}%</div>
                    <div className="text-xs text-white/40">Probability delta</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="p-3 bg-white/5 rounded">
                    <div className="text-xs text-white/50 mb-1">Affects</div>
                    <div className="text-sm font-medium">{action.affects}</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded">
                    <div className="text-xs text-white/50 mb-1">Time to impact</div>
                    <div className="text-sm font-medium">{action.timeToImpact}</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded">
                    <div className="text-xs text-white/50 mb-1">Investors unlocked</div>
                    <div className="text-sm font-medium text-blue-400">+{action.investorsUnlocked}</div>
                  </div>
                </div>
                
                {selectedAction === action.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex gap-3">
                    <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded font-medium transition-colors text-sm">
                      Mark In Progress
                    </button>
                    <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded font-medium transition-colors text-sm">
                      Show Investors Unlocked
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Signal Attenuation Controls */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Signal Attenuation Controls</h2>
        <p className="text-sm text-white/60 mb-6">Fine-tune how your signals are expressed to improve alignment with target investors.</p>
        
        <div className="space-y-6">
          {/* Narrative Controls */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-purple-400">Narrative Controls</h3>
            <div className="space-y-3">
              {attenuationControls.narrative.map((control, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{control.action}</div>
                    <div className="text-xs text-white/50">
                      Signals: {control.signalsAffected.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-400">+{control.investorsUnlocked}</div>
                    <div className="text-xs text-white/40">investors</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traction Controls */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-400">Traction Controls</h3>
            <div className="space-y-3">
              {attenuationControls.traction.map((control, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{control.action}</div>
                    <div className="text-xs text-white/50">
                      Signals: {control.signalsAffected.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-400">+{control.investorsUnlocked}</div>
                    <div className="text-xs text-white/40">investors</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Controls */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-400">Team Controls</h3>
            <div className="space-y-3">
              {attenuationControls.team.map((control, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{control.action}</div>
                    <div className="text-xs text-white/50">
                      Signals: {control.signalsAffected.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-400">+{control.investorsUnlocked}</div>
                    <div className="text-xs text-white/40">investors</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Unlock Effect Preview */}
      <section>
        <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-8">
          <h3 className="text-xl font-semibold mb-6 text-center">If you complete Actions 1–3:</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">{unlockPreview.alignmentStrengthPct}%</div>
              <div className="text-xs text-white/50">Alignment Strength</div>
              <div className="text-xs text-green-400 mt-1">+{unlockPreview.alignmentDeltaPct}%</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-1">{unlockPreview.timingWindowAfter}</div>
              <div className="text-xs text-white/50">Timing Window</div>
              <div className="text-xs text-blue-400 mt-1">Opening → {unlockPreview.timingWindowAfter}</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400 mb-1">+{unlockPreview.investorsUnlockedTotal}</div>
              <div className="text-xs text-white/50">Investors Unlocked</div>
              <div className="text-xs text-purple-400 mt-1">New matches</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-1">+{unlockPreview.leadProbabilityDeltaPct}%</div>
              <div className="text-xs text-white/50">Lead Probability</div>
              <div className="text-xs text-yellow-400 mt-1">Conversion boost</div>
            </div>
          </div>
          
          <p className="text-center text-sm text-white/60 mt-6 italic">
            This becomes extremely motivating.
          </p>
        </div>
      </section>
    </div>
  );
}
