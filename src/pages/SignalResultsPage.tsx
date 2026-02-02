/**
 * SIGNAL RESULTS PAGE
 * ===================
 * Minimal landing page showing investor signals for a startup URL
 * Design: Compact, at-a-glance, pythh dark grey + glowing effects
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { getSignalStrength, formatTimeAgo } from '../utils/signalHelpers';
import { SignalResult } from '../types/signals';

export default function SignalResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url') || 'acme-robotics.com';
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);

  // Simulate analysis
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setLoading(false);
            setShowContent(true);
          }, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    return () => clearInterval(timer);
  }, []);

  // Mock data - 5 top signals (using real investor UUIDs from database)
  const signals: SignalResult[] = [
    {
      investor: {
        id: '32b659b6-c483-4f31-9b34-c80f15f56eac', // Shaun Maguire - Sequoia Capital
        name: 'Shaun Maguire',
        firm: 'Sequoia Capital',
        title: 'Partner',
        initials: 'SC',
        practice: 'Hardware & Robotics Practice'
      },
      signalStrength: 82,
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      lookingFor: [
        'Labor automation with proven unit economics',
        'Series A stage ($8-15M typical check)',
        'Manufacturing partnerships (Asia preferred)',
        '3-5 customer deployments minimum'
      ],
      matchBreakdown: {
        portfolioFit: 94,
        stageMatch: 88,
        sectorVelocity: 92,
        geoFit: 85
      },
      composition: {
        recentActivity: 8,
        portfolioAdjacency: 10,
        thesisAlignment: 7,
        stageMatch: 9
      },
      prediction: {
        outreachProbability: 67,
        likelyTimeframe: '7-14 days',
        trigger: 'Series A announcement or customer milestone'
      },
      recentContext: [
        { date: 'Dec 2025', event: 'Led $12M Series A in Plus One Robotics' },
        { date: 'Nov 2025', event: 'Wrote "Labor Automation" thesis post' },
        { date: 'Oct 2025', event: 'Attended RoboBusiness (where you presented)' }
      ]
    },
    {
      investor: {
        id: 'ea67baeb-12ba-47f2-b462-7574159d08d8', // Dan Boneh - Andreessen Horowitz
        name: 'Dan Boneh',
        firm: 'Andreessen Horowitz',
        title: 'Co-Founder',
        initials: 'MA'
      },
      signalStrength: 78,
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      lookingFor: [
        'Deep tech with real-world applications',
        'Series A-B ($10-25M rounds)',
        'Strong technical founders',
        'Clear path to scale'
      ],
      matchBreakdown: { portfolioFit: 91, stageMatch: 85, sectorVelocity: 88, geoFit: 82 },
      composition: { recentActivity: 7, portfolioAdjacency: 9, thesisAlignment: 8, stageMatch: 8 },
      prediction: { outreachProbability: 62, likelyTimeframe: '14-21 days' },
      recentContext: []
    },
    {
      investor: {
        id: 'demo-founders-fund', // Demo ID - Founders Fund not in database yet
        name: 'Brian Singerman',
        firm: 'Founders Fund',
        title: 'Partner',
        initials: 'BS'
      },
      signalStrength: 74,
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      lookingFor: [
        'Contrarian bets in automation',
        'Series A stage',
        'Hardware-software integration',
        'Manufacturing capability'
      ],
      matchBreakdown: { portfolioFit: 87, stageMatch: 90, sectorVelocity: 85, geoFit: 78 },
      composition: { recentActivity: 6, portfolioAdjacency: 9, thesisAlignment: 7, stageMatch: 9 },
      prediction: { outreachProbability: 58, likelyTimeframe: '21-30 days' },
      recentContext: []
    },
    {
      investor: {
        id: '966bf9f8-c446-4851-aa02-69f42ef0ce11', // Greylock Ventures
        name: 'Greylock Ventures',
        firm: 'Greylock Partners',
        title: 'Partner',
        initials: 'RH'
      },
      signalStrength: 71,
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      lookingFor: [
        'Platform plays in B2B',
        'Series A-B rounds',
        'Network effects potential',
        'Enterprise sales motion'
      ],
      matchBreakdown: { portfolioFit: 83, stageMatch: 88, sectorVelocity: 80, geoFit: 85 },
      composition: { recentActivity: 5, portfolioAdjacency: 8, thesisAlignment: 7, stageMatch: 8 },
      prediction: { outreachProbability: 54, likelyTimeframe: '30-45 days' },
      recentContext: []
    },
    {
      investor: {
        id: '06aec117-cd04-47a4-a26c-9102130c1f0b', // Vinod Khosla - Khosla Ventures
        name: 'Vinod Khosla',
        firm: 'Khosla Ventures',
        title: 'Founder',
        initials: 'VK'
      },
      signalStrength: 68,
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
      lookingFor: [
        'Hard tech with impact',
        'Early-stage bets',
        'Climate/efficiency angle',
        'Big vision founders'
      ],
      matchBreakdown: { portfolioFit: 79, stageMatch: 82, sectorVelocity: 77, geoFit: 80 },
      composition: { recentActivity: 5, portfolioAdjacency: 7, thesisAlignment: 8, stageMatch: 8 },
      prediction: { outreachProbability: 51, likelyTimeframe: '30-60 days' },
      recentContext: []
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        {/* Pythh glowing background */}
        <div className="fixed bottom-0 right-0 w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="fixed bottom-20 right-20 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
        
        <div className="max-w-5xl mx-auto px-6 py-20 relative z-10">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-8">
              Analyzing capital signals for {url}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4 max-w-md mx-auto">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-sm text-white/50">
              {progress < 30 && 'Scanning investor databases...'}
              {progress >= 30 && progress < 60 && 'Analyzing portfolio patterns...'}
              {progress >= 60 && progress < 90 && 'Calculating signal strength...'}
              {progress >= 90 && 'Preparing your results...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Pythh glowing background */}
      <div className="fixed bottom-0 right-0 w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="fixed bottom-20 right-20 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
      <div className="fixed top-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      
      {/* Grid pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="text-xl font-bold tracking-tight hover:text-cyan-400 transition">
            pythh.ai
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-white/70 hover:text-white transition">
              Sign in
            </Link>
            <button className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium border border-cyan-500/30 transition">
              Get started
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">pythh signals</h1>
          <p className="text-lg text-white/60">
            Top Matches by <span className="text-cyan-400 font-semibold" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.6)' }}>[signal]</span>: these firms match your signals
          </p>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-4 gap-4 mb-12">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-cyan-400 mb-1">60</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Investors Signaling</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400 mb-1" style={{ textShadow: '0 0 15px rgba(74, 222, 128, 0.5)' }}>82</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Top Signal Score</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-500 mb-1" style={{ textShadow: '0 0 15px rgba(245, 158, 11, 0.5)' }}>Series A</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Capital Pushing →</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-400 mb-1" style={{ textShadow: '0 0 15px rgba(192, 132, 252, 0.5)' }}>$12M</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Avg Check Size</div>
          </div>
        </div>

        {/* Compact Signal Cards */}
        <div className="space-y-4 mb-12">
          {signals.map((signal, index) => {
            const strength = getSignalStrength(signal.signalStrength);
            return (
              <div 
                key={index}
                className="bg-white/5 border border-white/10 hover:border-cyan-500/30 rounded-2xl p-6 transition-all hover:bg-white/10"
                style={{ animation: `fadeIn 0.3s ease-out ${0.5 + index * 0.1}s both` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{strength.emoji}</span>
                      <Link 
                        to={`/investor/${signal.investor.id}`}
                        className="font-semibold text-lg hover:text-cyan-400 transition"
                      >
                        {signal.investor.firm}:
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
                      <div>
                        <span className="text-white/50">focus:</span> {signal.lookingFor[0].split(' ').slice(0, 3).join(' ')}
                      </div>
                      <div>
                        <span className="text-white/50">stage:</span> Series A
                      </div>
                      <div>
                        <span className="text-white/50">size:</span> $8-15M
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/50">signal:</span> 
                        <span className={`text-2xl font-bold ${strength.color}`} style={{ textShadow: `0 0 15px ${strength.color.includes('green') ? 'rgba(34, 197, 94, 0.5)' : strength.color.includes('blue') ? 'rgba(59, 130, 246, 0.5)' : strength.color.includes('yellow') ? 'rgba(251, 191, 36, 0.5)' : 'rgba(156, 163, 175, 0.5)'}` }}>
                          {signal.signalStrength}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/investor/${signal.investor.id}`)}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    View details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Why They Match */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6">Why they match</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Portfolio Fit</div>
              <div className="text-xl font-bold text-cyan-400 mb-1">94%</div>
              <div className="text-sm text-white/70">They've backed 3 similar robotics companies at your stage</div>
            </div>
            <div>
              <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Sector Velocity</div>
              <div className="text-xl font-bold text-cyan-400 mb-1">5 deals</div>
              <div className="text-sm text-white/70">In automation space in last 12 months</div>
            </div>
            <div>
              <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Recent Activity</div>
              <div className="text-xl font-bold text-cyan-400 mb-1">4 hours ago</div>
              <div className="text-sm text-white/70">Latest signal from Sequoia Capital</div>
            </div>
            <div>
              <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Outreach Window</div>
              <div className="text-xl font-bold text-cyan-400 mb-1">7-14 days</div>
              <div className="text-sm text-white/70">Predicted timeframe for top match</div>
            </div>
          </div>
        </div>

        {/* What to Do Next */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">What to do next</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold">1</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Publish technical proof</div>
                <div className="text-sm text-white/70">Add GitHub repo with demos to boost credibility (+15 to GOD score)</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold">2</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Add customer ROI data</div>
                <div className="text-sm text-white/70">Quantified results prove labor automation thesis (+12 to sector fit)</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold">3</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Reframe as "automation infrastructure"</div>
                <div className="text-sm text-white/70">23 investors shifted thesis to this positioning (+18 to alignment)</div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10">
            <button className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg transition shadow-lg shadow-orange-600/30">
              Unlock all 60 signals — $49/month
            </button>
            <div className="text-center text-sm text-white/50 mt-2">
              or start 7-day free trial
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
