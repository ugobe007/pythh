import { useState } from 'react';
import { useSignalSnapshot } from '../../hooks/useSignalSnapshot';
import SignalBar from './SignalBar';
import OverviewTab from './tabs/OverviewTab';
import SignalsTab from './tabs/SignalsTab';
import OddsTab from './tabs/OddsTab';
import ActionsTab from './tabs/ActionsTab';
import InvestorsTab from './tabs/InvestorsTab';

type TabType = 'overview' | 'signals' | 'odds' | 'actions' | 'investors' | 'opportunities' | 'history';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // SSOT: One snapshot, all tabs consume it
  const { snapshot, loading, error } = useSignalSnapshot({
    startupUrl: 'https://example.com', // TODO: get from route params or context
    mode: 'Estimate',
  });
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-white/50">Computing signals...</div>
      </div>
    );
  }
  
  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-red-400">Error loading snapshot: {error || 'Unknown error'}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: '●' },
    { id: 'signals' as TabType, label: 'Signals', icon: '📡' },
    { id: 'odds' as TabType, label: 'Odds', icon: '🎯' },
    { id: 'actions' as TabType, label: 'Actions', icon: '⚡' },
    { id: 'investors' as TabType, label: 'Investors', icon: '👥' },
    { id: 'opportunities' as TabType, label: 'Opportunities', icon: '🔮' },
    { id: 'history' as TabType, label: 'History', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Persistent Signal Bar */}
      <SignalBar snapshot={snapshot} />

      {/* Main Layout: Left Nav + Content + Right Context */}
      <div className="flex">
        {/* Left Navigation */}
        <nav className="w-64 border-r border-white/10 min-h-[calc(100vh-60px)] bg-black/40">
          <div className="p-6 border-b border-white/10">
            <h1 className="text-xl font-bold">Pythh</h1>
            <p className="text-xs text-white/40 mt-1">Signals → Odds → Actions</p>
          </div>
          
          <ul className="p-4 space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-500/20 text-blue-400 font-medium'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="p-6 border-t border-white/10 mt-auto">
            <div className="text-xs text-white/40 space-y-2">
              <p className="font-semibold text-white/60">Your signals determine your odds</p>
              <p>Alignment Strength: <span className="text-green-400">{snapshot.odds.alignment.overall}%</span></p>
              <p>Timing Window: <span className="text-blue-400">{snapshot.timingWindow}</span></p>
            </div>
          </div>
        </nav>

        {/* Center: Active Intelligence Panel */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8">
            {activeTab === 'overview' && <OverviewTab snapshot={snapshot} />}
            {activeTab === 'signals' && <SignalsTab snapshot={snapshot} />}
            {activeTab === 'odds' && <OddsTab snapshot={snapshot} />}
            {activeTab === 'actions' && <ActionsTab snapshot={snapshot} />}
            {activeTab === 'investors' && <InvestorsTab snapshot={snapshot} />}
            {activeTab === 'opportunities' && <div className="text-white/60">Opportunities tab - Coming soon</div>}
            {activeTab === 'history' && <div className="text-white/60">History tab - Coming soon</div>}
          </div>
        </main>

        {/* Right: Context + Guidance Panel */}
        <aside className="w-80 border-l border-white/10 bg-black/20 p-6">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white/70 mb-3">Context</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                These indicators update in real time as your signals change. Your alignment strength determines which investors see you as a strong fit.
              </p>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="text-xs text-blue-400 font-mono mb-2">KEY INSIGHT</div>
              <p className="text-sm text-white/80">
                Your timing window is opening. Begin preparing outreach materials now.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white/70 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-left transition-colors">
                  View priority actions
                </button>
                <button className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-left transition-colors">
                  See aligned investors
                </button>
                <button className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-left transition-colors">
                  Update signals
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
