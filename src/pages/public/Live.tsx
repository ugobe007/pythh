import React, { useState, useEffect } from "react";
import PageShell, { ContentContainer } from "../../components/layout/PageShell";
import TopBar, { TopBarBrand } from "../../components/layout/TopBar";
import { PythhTokens } from "../../lib/designTokens";
import { Activity, TrendingUp, Zap } from "lucide-react";
import { dbErrorMonitor } from "../../lib/dbErrorMonitor";
import { apiUrl } from "../../lib/apiConfig";

type SignalItem = {
  firm: string;
  signal: string;
  time: string;
  correlation: 'high' | 'mid' | 'low';
};

// Signal correlation colors: cyan=high, green=mid, orange=low
const getSignalColor = (correlation: 'high' | 'mid' | 'low') => {
  switch(correlation) {
    case 'high': return { border: 'border-cyan-500/40', bg: 'bg-cyan-500/5', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' };
    case 'mid': return { border: 'border-green-500/40', bg: 'bg-green-500/5', text: 'text-green-400', glow: 'shadow-green-500/20' };
    case 'low': return { border: 'border-orange-500/40', bg: 'bg-orange-500/5', text: 'text-orange-400', glow: 'shadow-orange-500/20' };
  }
};

export default function Live() {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLiveSignals() {
      try {
        setError(null);
        const response = await fetch(apiUrl('/api/live-signals?limit=20'));
        
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.signals && Array.isArray(data.signals)) {
          const formatted: SignalItem[] = data.signals.map((s: any) => {
            // Extract match score from signal text if available
            const scoreMatch = s.signal.match(/score (\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            
            // Determine correlation based on score
            let correlation: 'high' | 'mid' | 'low' = 'low';
            if (score >= 85) {
              correlation = 'high';
            } else if (score >= 70) {
              correlation = 'mid';
            }
            
            return {
              firm: s.firm || 'Unknown Firm',
              signal: s.signal || 'Signal detected',
              time: s.time || 'just now',
              correlation
            };
          });
          
          setSignals(formatted);
        } else {
          setSignals([]);
        }
      } catch (err) {
        console.error('Failed to fetch live signals:', err);
        dbErrorMonitor.logError('Live', 'fetch_live_signals', err as Error, {
          endpoint: '/api/live-signals'
        });
        setError(err instanceof Error ? err.message : 'Failed to load signals');
        setSignals([]);
      } finally {
        setLoading(false);
      }
    }
    
    // Initial fetch
    fetchLiveSignals();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveSignals, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <PageShell variant="standard">
      <TopBar 
        leftContent={<TopBarBrand />}
        rightLinks={[
          { to: "/", label: "Home" },
          { to: "/live", label: "Live" },
          { to: "/signals", label: "How It Works" },
        ]}
      />

      <ContentContainer>
        <div className="py-12">
          {/* Hero with animated glow */}
          <div className="text-center mb-10 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] bg-cyan-500/10 blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
            
            <div className="relative">
              {/* Live indicator */}
              <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                <div className="relative flex items-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <div className="absolute w-2 h-2 rounded-full bg-cyan-400/50 animate-ping" />
                </div>
                <span className="text-xs uppercase tracking-wider text-cyan-400 font-mono font-semibold">LIVE</span>
              </div>
              
              <h1 className={`${PythhTokens.text.hero} mb-3`}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400">Live Signals</span>
              </h1>
              <p className="text-xl text-white/60">
                Investor movement detected right now.
              </p>
            </div>
          </div>

          {/* Signal tape - streaming style */}
          <div className="relative">
            {/* Glow behind tape */}
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent rounded-2xl blur-xl" />
            
            <div className="relative bg-gradient-to-br from-[#0f0f0f] via-[#131313] to-[#0f0f0f] border border-cyan-500/30 rounded-2xl overflow-hidden shadow-lg shadow-cyan-500/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs uppercase tracking-widest text-cyan-400/80 font-mono font-semibold">SIGNAL TAPE</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
                </div>
              </div>
              
              {/* Feed */}
              {loading ? (
                <div className="px-6 py-12 text-center">
                  <div className="text-white/50">Loading signals...</div>
                </div>
              ) : error ? (
                <div className="px-6 py-12 text-center">
                  <div className="text-red-400 mb-2">Error loading signals</div>
                  <div className="text-white/50 text-sm">{error}</div>
                </div>
              ) : signals.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="text-white/50">No signals detected yet</div>
                  <div className="text-white/30 text-sm mt-2">Check back soon for live investor activity</div>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-auto divide-y divide-white/5">
                  {signals.map((s, idx) => {
                  const colors = getSignalColor(s.correlation);
                  return (
                    <div 
                      key={`${s.firm}-${idx}`} 
                      className={`group px-6 py-4 hover:${colors.bg} transition-all duration-300 relative`}
                      style={{
                        animation: idx < 2 ? 'slideInFromTop 0.5s ease-out' : 'none',
                        animationDelay: `${idx * 100}ms`
                      }}
                    >
                      {/* Correlation indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.bg} group-hover:w-2 transition-all`} />
                      
                      <div className="flex items-start gap-4">
                        {/* Firm */}
                        <div className="min-w-[120px] pt-0.5">
                          <div className="text-base font-bold text-white/90 group-hover:text-white transition-colors">
                            {s.firm}
                          </div>
                        </div>
                        
                        {/* Signal */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/70 group-hover:text-white/90 transition-colors leading-relaxed">
                            {s.signal}
                          </div>
                          
                          {/* Correlation badge */}
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${colors.bg} border ${colors.border}">
                            {s.correlation === 'high' && <TrendingUp className="w-3 h-3 ${colors.text}" />}
                            {s.correlation === 'mid' && <Activity className="w-3 h-3 ${colors.text}" />}
                            {s.correlation === 'low' && <Zap className="w-3 h-3 ${colors.text}" />}
                            <span className={`text-[10px] uppercase tracking-wider font-semibold ${colors.text}`}>
                              {s.correlation} signal
                            </span>
                          </div>
                        </div>
                        
                        {/* Time */}
                        <div className="text-xs text-white/40 font-mono whitespace-nowrap pt-0.5">
                          {s.time}
                        </div>
                      </div>
                      
                      {/* Hover glow */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-${colors.glow} to-transparent pointer-events-none`} />
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 text-center">
            <div className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
              <div className="text-sm text-white/70">
                Run your URL on the <span className="text-white font-semibold">home page</span> to see which signals align with <span className="text-cyan-400 font-semibold">your startup</span>.
              </div>
            </div>
          </div>
        </div>
      </ContentContainer>
      
      <style>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </PageShell>
  );
}
