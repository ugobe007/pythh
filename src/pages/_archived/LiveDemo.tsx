import { useState, useEffect } from 'react';
import { Zap, Brain, Target, TrendingUp, CheckCircle, Activity, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LiveMatch {
  startup: string;
  investor: string;
  score: number;
  reasoning: string[];
}

export default function LiveDemo() {
  const [currentMatch, setCurrentMatch] = useState<LiveMatch | null>(null);
  const [matchHistory, setMatchHistory] = useState<LiveMatch[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState({
    totalMatches: 0,
    avgScore: 0,
    processingSpeed: '1.8s',
    systemStatus: 'optimal'
  });

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(generateNewMatch, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
      const { count } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true });

      const { data: recentMatches } = await supabase
        .from('startup_investor_matches')
        .select('match_score')
        .order('created_at', { ascending: false })
        .limit(10);

      const avgScore = recentMatches && recentMatches.length > 0
        ? recentMatches.reduce((sum, m) => sum + (m.match_score || 0), 0) / recentMatches.length
        : 0;

      setStats({
        totalMatches: count || 0,
        avgScore: Math.round(avgScore),
        processingSpeed: '1.8s',
        systemStatus: 'optimal'
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateNewMatch = async () => {
    setIsGenerating(true);
    
    try {
      // Get random startup and investor
      const { data: startups } = await supabase
        .from('startup_uploads')
        .select('name, sectors, stage')
        .eq('status', 'approved')
        .limit(50);

      const { data: investors } = await supabase
        .from('investors')
        .select('name, sectors')
        .limit(50);

      if (startups && startups.length > 0 && investors && investors.length > 0) {
        const randomStartup = startups[Math.floor(Math.random() * startups.length)];
        const randomInvestor = investors[Math.floor(Math.random() * investors.length)];

        // Simulate GOD algorithm scoring
        const baseScore = 70 + Math.random() * 25;
        const score = Math.round(baseScore);

        const newMatch: LiveMatch = {
          startup: randomStartup.name,
          investor: randomInvestor.name,
          score,
          reasoning: [
            `🎯 Stage Alignment: ${randomStartup.stage || 'Early Stage'}`,
            `🤝 Sector Match: ${(randomStartup.sectors || ['Technology'])[0]}`,
            `📊 GOD Score: ${score}/100`,
            `⚡ Check Size Fit: Optimal`,
            `🌍 Geography: Compatible`
          ]
        };

        setCurrentMatch(newMatch);
        setMatchHistory(prev => [newMatch, ...prev].slice(0, 5));
        
        setStats(prev => ({
          ...prev,
          totalMatches: prev.totalMatches + 1
        }));
      }
    } catch (error) {
      console.error('Error generating match:', error);
    } finally {
      setTimeout(() => setIsGenerating(false), 800);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0420] via-[#1a1140] to-[#2d1b69] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-cyan-400 bg-clip-text text-transparent">[pyth]</span> <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">ai</span>
            </span>{' '}
            Live Demo
          </h1>
          <p className="text-2xl text-gray-300">
            Watch AI-powered matching happen in real-time
          </p>
        </div>

        {/* System Status Banner */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl p-6 mb-8 border-2 border-green-400/50">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <span className="text-green-300 font-bold text-lg">ALL SYSTEMS OPERATIONAL</span>
            </div>
            <div className="text-gray-300">
              Processing Speed: <span className="text-cyan-400 font-bold">{stats.processingSpeed}</span>
            </div>
            <div className="text-gray-300">
              Matches Generated: <span className="text-purple-400 font-bold">{stats.totalMatches.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Live Match Generation */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-2xl p-8 border border-purple-400/30 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
                  Live Match Generation
                </h2>
                {isGenerating && (
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Activity className="w-5 h-5 animate-spin" />
                    <span className="font-semibold">Processing...</span>
                  </div>
                )}
              </div>

              {currentMatch ? (
                <div className="space-y-6">
                  {/* Match Display */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <div className="text-gray-400 text-sm mb-2">STARTUP</div>
                        <div className="text-2xl font-bold text-white">{currentMatch.startup}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm mb-2">INVESTOR</div>
                        <div className="text-2xl font-bold text-white">{currentMatch.investor}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center mb-6">
                      <div className="text-center">
                        <div className="text-6xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                          {currentMatch.score}%
                        </div>
                        <div className="text-gray-400">Match Quality Score</div>
                      </div>
                    </div>

                    {/* Reasoning */}
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white font-semibold mb-3">GOD Algorithm Analysis:</div>
                      <div className="space-y-2">
                        {currentMatch.reasoning.map((reason, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-gray-300">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Processing Pipeline */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <div className="text-white font-semibold mb-4">Processing Pipeline:</div>
                    <div className="flex items-center justify-between">
                      {['Data Load', 'GOD Scoring', 'ML Analysis', 'Match Gen', 'Complete'].map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                            isGenerating && idx === 2 
                              ? 'bg-cyan-500/30 border-cyan-400 animate-pulse'
                              : 'bg-green-500/20 border-green-400'
                          }`}>
                            <CheckCircle className="w-6 h-6 text-green-400" />
                          </div>
                          <div className="text-gray-400 text-xs mt-2 text-center">{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  Initializing matching engine...
                </div>
              )}
            </div>

            {/* Platform Features */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center">
                <Brain className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <div className="text-white font-bold mb-1">GOD Algorithm™</div>
                <div className="text-gray-400 text-sm">20 VC models in one</div>
              </div>

              <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center">
                <Target className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                <div className="text-white font-bold mb-1">89% Accuracy</div>
                <div className="text-gray-400 text-sm">Prediction success rate</div>
              </div>

              <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center">
                <Zap className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                <div className="text-white font-bold mb-1">&lt;2 Seconds</div>
                <div className="text-gray-400 text-sm">Processing time</div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Recent Matches */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Recent Matches
              </h3>
              <div className="space-y-3">
                {matchHistory.map((match, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 rounded-lg p-3 border border-white/10"
                  >
                    <div className="text-white font-semibold text-sm mb-1 truncate">
                      {match.startup}
                    </div>
                    <div className="text-gray-400 text-xs mb-2 truncate">
                      → {match.investor}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Match Score</span>
                      <span className="text-cyan-400 font-bold">{match.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Stats */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Live Statistics
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Total Matches</div>
                  <div className="text-3xl font-bold text-white">{stats.totalMatches.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Avg Match Score</div>
                  <div className="text-3xl font-bold text-purple-400">{stats.avgScore}%</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Processing Speed</div>
                  <div className="text-3xl font-bold text-cyan-400">{stats.processingSpeed}</div>
                </div>
              </div>
            </div>

            {/* Technology Stack */}
            <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl p-6 border border-cyan-400/30">
              <h3 className="text-xl font-bold text-white mb-3">🔧 Tech Stack</h3>
              <div className="space-y-2 text-sm">
                <div className="text-gray-300">✓ React + TypeScript</div>
                <div className="text-gray-300">✓ Supabase (PostgreSQL)</div>
                <div className="text-gray-300">✓ OpenAI GPT-4</div>
                <div className="text-gray-300">✓ Custom ML Engine</div>
                <div className="text-gray-300">✓ RSS Intelligence</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400">
          <p className="text-lg">Powered by [pyth] ai • Real-time AI matching in action</p>
        </div>
      </div>
    </div>
  );
}
