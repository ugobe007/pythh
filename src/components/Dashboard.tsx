import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Zap, Brain, Rocket, Target, Star, 
  Trophy, Flame, ChevronRight, Users, Building2,
  BarChart3, Sparkles, Award, Gift, Lock, Calendar
} from 'lucide-react';
import LogoDropdownMenu from './LogoDropdownMenu';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useVotes } from '../hooks/useVotes';
import { getInvestorProfile, getTierColor } from '../utils/firePointsManager';
import { TIER_THRESHOLDS } from '../types/gamification';

interface YesVote {
  id: number;
  name: string;
  pitch?: string;
  tagline?: string;
  stage?: number;
  fivePoints?: string[];
  votedAt: string;
}

interface RecentStartup {
  id: string;
  name: string;
  tagline?: string;
  industry?: string;
  hotScore: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userId, isLoading: authLoading } = useAuth();
  const { votes, isLoading: votesLoading, getYesVotes, voteCounts } = useVotes(userId);
  const [myYesVotes, setMyYesVotes] = useState<YesVote[]>([]);
  const [recentStartups, setRecentStartups] = useState<RecentStartup[]>([]);
  const [stats, setStats] = useState({ totalStartups: 0, totalInvestors: 0, matchesMade: 0 });
  const [loading, setLoading] = useState(true);

  // Get fire points profile
  const profile = getInvestorProfile();
  const firePoints = profile?.firePoints?.total || 0;
  const tier = profile?.tier || 'Bronze';
  const streak = profile?.firePoints?.streak || 0;

  // Calculate progress to next tier
  const tierKeys = Object.keys(TIER_THRESHOLDS) as Array<keyof typeof TIER_THRESHOLDS>;
  const currentTierIndex = tierKeys.indexOf(tier as keyof typeof TIER_THRESHOLDS);
  const nextTier = tierKeys[currentTierIndex + 1];
  const nextTierThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : null;
  const currentThreshold = TIER_THRESHOLDS[tier as keyof typeof TIER_THRESHOLDS] || 0;
  const progress = nextTierThreshold 
    ? ((firePoints - currentThreshold) / (nextTierThreshold - currentThreshold)) * 100
    : 100;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Fetch recent hot startups
      // SSOT: Use startup_uploads table (not 'startups')
      const { data: startupData, count: startupCount } = await supabase
        .from('startup_uploads')
        .select('id, name, tagline, sectors, raise_amount', { count: 'exact' })
        .eq('status', 'approved')
        .limit(5);
      
      const { count: investorCount } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true });
      
      // Transform startups with hot scores
      const startupsWithScores = (startupData || []).map(s => ({
        id: s.id,
        name: s.name,
        tagline: s.tagline || '',
        industry: Array.isArray(s.sectors) ? s.sectors[0] : s.sectors || '',
        hotScore: s.total_god_score || Math.floor(60 + Math.random() * 35)
      }));
      
      setRecentStartups(startupsWithScores);
      setStats({
        totalStartups: startupCount || 0,
        totalInvestors: investorCount || 0,
        matchesMade: Math.floor((startupCount || 0) * 2.8)
      });
      
      // Load YES votes from localStorage
      const myYesVotesStr = localStorage.getItem('myYesVotes');
      if (myYesVotesStr) {
        try {
          const yesVotesArray = JSON.parse(myYesVotesStr);
          const uniqueVotesMap = new Map();
          yesVotesArray.forEach((vote: YesVote) => {
            if (vote && vote.id !== undefined) {
              uniqueVotesMap.set(vote.id, vote);
            }
          });
          setMyYesVotes(Array.from(uniqueVotesMap.values()));
        } catch (e) {
          console.error('Error parsing myYesVotes:', e);
        }
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, []);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0015] via-[#1a0a2e] to-[#0f0520] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0015] via-[#1a0a2e] to-[#0f0520] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Logo Dropdown Menu */}
      <LogoDropdownMenu />

      {/* Navigation Buttons - Top Right */}
      <div className="fixed top-6 right-8 z-50 flex items-center gap-4">
        <Link 
          to="/trending" 
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all border border-white/20"
        >
          🔥 Trending
        </Link>
        <Link 
          to="/get-matched" 
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg"
        >
          Get Matched
        </Link>
      </div>

      <div className="relative z-10 container mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent">
              🎯 Your Dashboard
            </span>
          </h1>
          <p className="text-lg text-gray-300">
            Track your activity, matches, and investor journey
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl p-5 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-6 h-6 text-cyan-400" />
              <span className="text-sm text-gray-300">Fire Points</span>
            </div>
            <div className="text-3xl font-bold text-white">{firePoints}</div>
            <div className="text-xs text-cyan-300 mt-1">{tier} Tier</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-lg rounded-2xl p-5 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-6 h-6 text-purple-400" />
              <span className="text-sm text-gray-300">Hot Picks</span>
            </div>
            <div className="text-3xl font-bold text-white">{myYesVotes.length}</div>
            <div className="text-xs text-purple-300 mt-1">Startups saved</div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-lg rounded-2xl p-5 border border-emerald-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-emerald-400" />
              <span className="text-sm text-gray-300">Streak</span>
            </div>
            <div className="text-3xl font-bold text-white">{streak}</div>
            <div className="text-xs text-emerald-300 mt-1">{streak > 0 ? 'Days active' : 'Start today!'}</div>
          </div>
          
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl p-5 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-6 h-6 text-cyan-400" />
              <span className="text-sm text-gray-300">Progress</span>
            </div>
            <div className="text-3xl font-bold text-white">{Math.round(progress)}%</div>
            <div className="text-xs text-cyan-300 mt-1">to {nextTier || 'Max'}</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Fire Points Progress Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Fire Points Progress</h2>
                  <p className="text-sm text-gray-400">Level up your investor game</p>
                </div>
              </div>
              <Link to="/account" className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-all">
                Account
              </Link>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">{tier} Tier</span>
                <span className="text-cyan-400 font-bold">{firePoints} / {nextTierThreshold || firePoints} pts</span>
              </div>
              <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {nextTier && (
                <p className="text-xs text-gray-500 mt-2">
                  {nextTierThreshold ? nextTierThreshold - firePoints : 0} points to {nextTier} Tier
                </p>
              )}
            </div>

            {/* Tier Badges */}
            <div className="grid grid-cols-5 gap-2">
              {['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'].map((t, i) => {
                const isUnlocked = tierKeys.indexOf(t as keyof typeof TIER_THRESHOLDS) <= currentTierIndex;
                const isCurrent = t === tier;
                return (
                  <div 
                    key={t}
                    className={`text-center p-3 rounded-xl transition-all ${
                      isCurrent 
                        ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-cyan-500' 
                        : isUnlocked 
                          ? 'bg-white/10 border border-white/20' 
                          : 'bg-white/5 border border-white/10 opacity-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {i === 0 ? '🥉' : i === 1 ? '🥈' : i === 2 ? '🥇' : i === 3 ? '💎' : '👑'}
                    </div>
                    <div className="text-xs text-gray-300">{t}</div>
                    {!isUnlocked && <Lock className="w-3 h-3 text-gray-500 mx-auto mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            {/* Match Engine Card */}
            <Link to="/get-matched" className="block bg-gradient-to-br from-purple-600/30 to-indigo-600/30 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-5 hover:border-purple-400/50 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-1">Spark Engine™</h3>
                  <p className="text-sm text-gray-400">Get AI-powered investor matches</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
              </div>
            </Link>

            {/* My Matches Card - Link to match search (will need startup/investor ID from profile) */}
            <Link to="/matching" className="block bg-gradient-to-br from-blue-600/30 to-cyan-600/30 backdrop-blur-lg rounded-2xl border border-blue-500/30 p-5 hover:border-blue-400/50 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-1">My Matches</h3>
                  <p className="text-sm text-gray-400">Search & filter your matches</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
              </div>
            </Link>

            {/* Explore Startups Card */}
            <Link to="/trending" className="block bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl border border-cyan-500/30 p-5 hover:border-cyan-400/50 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Rocket className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-1">Trending Startups</h3>
                  <p className="text-sm text-gray-400">{stats.totalStartups}+ startups by sector</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-cyan-400 transition-colors" />
              </div>
            </Link>

            {/* Vote Card */}
            <Link to="/vote" className="block bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-lg rounded-2xl border border-emerald-500/30 p-5 hover:border-emerald-400/50 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-1">Vote on Startups</h3>
                  <p className="text-sm text-gray-400">Earn fire points</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-400 transition-colors" />
              </div>
            </Link>
          </div>
        </div>

        {/* Hot Picks Section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Star className="w-6 h-6 text-yellow-400" />
              Your Hot Picks
            </h2>
            {myYesVotes.length > 0 && (
              <span className="text-sm text-gray-400">{myYesVotes.length} startups saved</span>
            )}
          </div>

          {myYesVotes.length === 0 ? (
            <div className="bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-10 text-center">
              <div className="text-6xl mb-4">🤷‍♂️</div>
              <h3 className="text-xl font-bold text-white mb-2">No hot picks yet!</h3>
              <p className="text-gray-400 mb-6">Start voting on startups to build your portfolio</p>
              <Link 
                to="/vote" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all"
              >
                <Zap className="w-5 h-5" />
                Start Voting
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myYesVotes.slice(0, 6).map((vote) => (
                <div 
                  key={vote.id}
                  className="bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-xl border border-purple-500/30 p-4 hover:border-purple-400/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-white">{vote.name}</h3>
                    <span className="text-yellow-400">⭐</span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-3">{vote.tagline || vote.pitch || 'Innovative startup'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded-full">
                      Saved
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(vote.votedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform Stats */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            Platform Stats
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-6 text-center">
              <Rocket className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{stats.totalStartups}+</div>
              <div className="text-sm text-gray-400 mt-1">Startups</div>
            </div>
            <div className="bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-6 text-center">
              <Building2 className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">{stats.totalInvestors}+</div>
              <div className="text-sm text-gray-400 mt-1">Investors</div>
            </div>
            <div className="bg-gradient-to-br from-[#1a0033]/80 to-[#2d1b4e]/80 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-6 text-center">
              <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{stats.matchesMade}+</div>
              <div className="text-sm text-gray-400 mt-1">Matches Made</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
