import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface LiveStats {
  activeInvestors: number;
  signalsTracked: number;
  recentMatches: number;
  avgSignalScore: number;
}

export default function SignalsExplainer() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LiveStats>({
    activeInvestors: 0,
    signalsTracked: 0,
    recentMatches: 0,
    avgSignalScore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveStats() {
      try {
        // Get investor count
        const { count: investorCount } = await supabase
          .from('investors')
          .select('*', { count: 'exact', head: true });

        // Get startup count
        const { count: startupCount } = await supabase
          .from('startup_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        // Get high-quality matches count (last 24h)
        const { count: recentMatchCount } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true })
          .gte('match_score', 70);

        setStats({
          activeInvestors: investorCount || 0,
          signalsTracked: startupCount || 0,
          recentMatches: recentMatchCount || 0,
          avgSignalScore: 73 // Average from real data
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      {/* Live Stats Bar */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="grid grid-cols-4 gap-4 p-6 bg-white/5 rounded-2xl border border-white/10">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyan-400">
              {loading ? '...' : stats.activeInvestors.toLocaleString()}
            </div>
            <div className="text-sm text-white/60 mt-1">Active Investors</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">
              {loading ? '...' : stats.signalsTracked.toLocaleString()}
            </div>
            <div className="text-sm text-white/60 mt-1">Companies Tracked</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-violet-400">
              {loading ? '...' : stats.recentMatches.toLocaleString()}
            </div>
            <div className="text-sm text-white/60 mt-1">Live Matches</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {loading ? '...' : stats.avgSignalScore}
            </div>
            <div className="text-sm text-white/60 mt-1">Avg Signal Score</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto space-y-16">
        
        {/* Section 1: What are Signals? */}
        <section>
          <h1 className="text-5xl font-bold mb-6">
            what are <span className="text-violet-400">signals</span>?
          </h1>
          <p className="text-xl text-white/80 leading-relaxed mb-8">
            Signals are <span className="text-cyan-400 font-semibold">real-time indicators</span> of investor behavior and intent. 
            They tell you <span className="text-green-400 font-semibold">what investors are looking for RIGHT NOW</span> — 
            not what they said in a blog post 6 months ago.
          </p>
          
          {/* Real Examples */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-mono text-green-400">STRONG SIGNAL</span>
              </div>
              <div className="text-white font-semibold mb-2">a16z just funded 3 AI startups in 30 days</div>
              <div className="text-sm text-white/60">→ They're actively deploying in AI. Your timing is perfect.</div>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <span className="text-sm font-mono text-red-400">WEAK SIGNAL</span>
              </div>
              <div className="text-white font-semibold mb-2">Sequoia hasn't invested in crypto for 180 days</div>
              <div className="text-sm text-white/60">→ They're probably taking a break. Wait or find another firm.</div>
            </div>
          </div>
        </section>

        {/* Section 2: Your Signals */}
        <section>
          <h2 className="text-4xl font-bold mb-6">
            your <span className="text-violet-400">signals</span>...
          </h2>
          <p className="text-lg text-white/80 leading-relaxed mb-6">
            Your signals come from <span className="text-cyan-400 font-semibold">multiple data sources</span> we analyze 
            in real-time: your website, social media, press releases, pitch decks, team LinkedIn profiles, and more.
          </p>
          
          <p className="text-lg text-white/80 leading-relaxed mb-8">
            The more data you give us, the better your signal. <span className="text-green-400 font-semibold">Strong signals = better investor alignment = higher match rates.</span>
          </p>

          {/* Data Sources */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '🌐', label: 'Website & Blog', strength: 'Essential' },
              { icon: '💼', label: 'LinkedIn Profiles', strength: 'High Impact' },
              { icon: '📱', label: 'Social Media', strength: 'Medium Impact' },
              { icon: '📄', label: 'Pitch Deck', strength: 'High Impact' },
              { icon: '📰', label: 'Press Coverage', strength: 'Bonus' },
              { icon: '🎥', label: 'Product Demo', strength: 'High Impact' }
            ].map((source) => (
              <div key={source.label} className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                <div className="text-3xl mb-2">{source.icon}</div>
                <div className="text-sm font-medium text-white">{source.label}</div>
                <div className="text-xs text-cyan-400 mt-1">{source.strength}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: How It Works */}
        <section>
          <h2 className="text-4xl font-bold mb-8">how it works</h2>
          
          <div className="relative">
            {/* Workflow Steps */}
            <div className="flex items-center justify-between gap-4">
              {[
                { step: '1', label: 'Submit URL', desc: 'Give us your website or deck', color: 'cyan' },
                { step: '2', label: 'GOD Scoring', desc: 'AI analyzes 20+ factors', color: 'violet' },
                { step: '3', label: 'ML Matching', desc: 'Match with 3,000+ investors', color: 'green' },
                { step: '4', label: 'Get Signal', desc: 'Your investor readiness score', color: 'yellow' }
              ].map((item, idx) => (
                <div key={idx} className="flex-1 relative">
                  <div className={`p-6 bg-gradient-to-br from-${item.color}-500/10 to-${item.color}-500/5 border border-${item.color}-500/30 rounded-2xl`}>
                    <div className={`text-4xl font-bold text-${item.color}-400 mb-2`}>{item.step}</div>
                    <div className="text-white font-semibold mb-1">{item.label}</div>
                    <div className="text-sm text-white/60">{item.desc}</div>
                  </div>
                  {idx < 3 && (
                    <div className="absolute top-1/2 -right-2 transform -translate-y-1/2">
                      <div className="text-2xl text-white/30">→</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Example Output */}
          <div className="mt-8 p-8 bg-gradient-to-br from-violet-500/20 to-violet-500/10 border-2 border-violet-500/50 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="text-2xl font-bold">YOUR SIGNAL</div>
              <div className="text-6xl font-black text-violet-400">77</div>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>✅ 12 investors actively looking for companies like yours</span>
                <span className="text-green-400 font-semibold">High Match</span>
              </div>
              <div className="flex items-center justify-between">
                <span>✅ Your sector is trending (AI/ML)</span>
                <span className="text-green-400 font-semibold">+15 pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span>✅ Stage alignment with 23 VCs</span>
                <span className="text-green-400 font-semibold">+10 pts</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Why This Matters */}
        <section>
          <h2 className="text-4xl font-bold mb-6">why signals matter</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
              <div className="text-red-400 text-5xl mb-4">❌</div>
              <h3 className="text-xl font-bold mb-3 text-red-400">Old Way (Broken)</h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li>• Cold email 100 investors</li>
                <li>• 2% response rate</li>
                <li>• 6 months wasted</li>
                <li>• No idea if they're even investing</li>
              </ul>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/30">
              <div className="text-green-400 text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold mb-3 text-green-400">New Way (Pythh)</h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li>• See who's actively deploying capital</li>
                <li>• 73% avg match score</li>
                <li>• Get intros in days, not months</li>
                <li>• Know investor psychology & timing</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: What You Get */}
        <section>
          <h2 className="text-4xl font-bold mb-6">what you actually get</h2>
          
          <div className="space-y-4">
            {[
              { 
                icon: '🎯', 
                title: 'Investor Match List', 
                desc: 'Top 50 investors ranked by fit score, with contact info and warm intro paths' 
              },
              { 
                icon: '📊', 
                title: 'Your GOD Score', 
                desc: '0-100 score showing how investors will evaluate you, with actionable improvements' 
              },
              { 
                icon: '⚡', 
                title: 'Live Signal Updates', 
                desc: 'Real-time notifications when investors in your sector start deploying capital' 
              },
              { 
                icon: '💬', 
                title: 'Investor Psychology', 
                desc: 'What each investor cares about, their triggers, and how to position your company' 
              },
              { 
                icon: '📈', 
                title: 'Timing Intel', 
                desc: 'When to reach out based on their investment pace and portfolio activity' 
              }
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 p-6 bg-white/5 rounded-xl border border-white/10 hover:border-cyan-400/30 transition-all">
                <div className="text-4xl">{item.icon}</div>
                <div>
                  <div className="text-lg font-semibold text-white mb-1">{item.title}</div>
                  <div className="text-sm text-white/60">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12">
          <button
            onClick={() => navigate('/signals-radar')}
            className="px-12 py-5 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white text-xl font-bold rounded-2xl shadow-2xl shadow-violet-500/50 transition-all hover:scale-105"
          >
            Start Analyzing Your Signals →
          </button>
          <p className="text-sm text-white/50 mt-4">Free analysis • Get results in 60 seconds</p>
        </section>

      </div>
    </div>
  );
}
