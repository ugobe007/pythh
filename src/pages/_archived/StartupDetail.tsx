import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useVotes } from '../hooks/useVotes';
import TemplateCompletionWidget from '../components/TemplateCompletionWidget';

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  summary: string;
  published_date: string;
  source: string;
  sentiment?: string;
}

const StartupDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [startup, setStartup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [matchCount, setMatchCount] = useState<number>(0);
  const { userId } = useAuth();
  const { castVote, hasVoted, removeVote, voteCounts } = useVotes(userId);

  useEffect(() => {
    async function fetchStartup() {
      console.log('🔍 Fetching startup from DATABASE with ID:', id);
      
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('❌ Supabase error:', error);
        setStartup(null);
      } else {
        console.log('✅ Found startup:', data?.name);
        setStartup(data);
        
        // Fetch match count
        const { count } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true })
          .eq('startup_id', id);
        
        setMatchCount(count || 0);
        
        // Fetch mock news for startup
        setNews([
          {
            id: '1',
            title: `${data.name} Raises $${Math.floor(Math.random() * 10 + 1)}M in Seed Funding`,
            url: '#',
            summary: 'The startup announced a successful funding round led by top-tier VCs.',
            published_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'TechCrunch',
            sentiment: 'positive'
          },
          {
            id: '2',
            title: `${data.name} Launches Innovative Product Feature`,
            url: '#',
            summary: 'Company unveils breakthrough technology that could disrupt the industry.',
            published_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'VentureBeat',
            sentiment: 'positive'
          },
          {
            id: '3',
            title: `${data.name} Expands Team with Key Hires`,
            url: '#',
            summary: 'Strategic additions to the executive team signal aggressive growth plans.',
            published_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'The Information',
            sentiment: 'positive'
          }
        ]);
      }
      setLoading(false);
    }
    
    if (id) {
      fetchStartup();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!startup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <p className="text-white text-xl">Startup not found.</p>
          <button 
            onClick={() => navigate('/match')}
            className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-xl"
          >
            ← Back to Matches
          </button>
        </div>
      </div>
    );
  }

  // Extract fivePoints from extracted_data
  const fivePoints = startup.extracted_data?.fivePoints || [];
  
  // Get user's vote for this startup
  const userVote = hasVoted(startup.id.toString());
  const voteCount = voteCounts[startup.id.toString()];

  const handleVote = async (voteType: 'yes' | 'no') => {
    // If already voted this way, toggle off
    if (userVote === voteType) {
      await removeVote(startup.id.toString());
    } else {
      await castVote(startup.id.toString(), voteType);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0033] via-[#2d1b4e] to-[#1a0033] p-6 scrollbar-hide overflow-y-auto">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Back Button */}
        <button
          onClick={() => navigate('/match')}
          className="group mb-6 px-6 py-3 rounded-xl bg-white/5 hover:bg-emerald-500/20 transition-all flex items-center gap-2 text-gray-300 hover:text-emerald-300"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Matches</span>
        </button>

        {/* Main Content Card */}
        <div className="bg-gradient-to-br from-[#1a0033]/95 via-[#2d1b4e]/90 to-[#3d1f5e]/85 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-emerald-600/20 mb-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-emerald-400/30">
            <div className="flex-1">
              <h2 className="text-5xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4">{startup.name}</h2>
              {startup.extracted_data?.pitch && (
                <p className="text-2xl text-emerald-300 font-bold italic mb-3 drop-shadow-lg">"{startup.extracted_data.pitch}"</p>
              )}
              {startup.tagline && (
                <p className="text-xl text-purple-200">{startup.tagline}</p>
              )}
            </div>
            <div className="text-8xl ml-6 drop-shadow-2xl animate-bounce">🚀</div>
          </div>

          {/* Key Metrics: Benchmark Score, GOD Score, Match Count */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {startup.benchmark_score !== null && startup.benchmark_score !== undefined && (
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-xl p-5 border border-blue-400/30 shadow-lg">
                <div className="text-blue-300 text-sm font-semibold mb-1">Benchmark Score</div>
                <div className="text-3xl font-bold text-white">{startup.benchmark_score}</div>
                <div className="text-xs text-gray-400 mt-1">vs Industry Peers</div>
              </div>
            )}
            {startup.total_god_score !== null && startup.total_god_score !== undefined && (
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-5 border border-cyan-400/30 shadow-lg">
                <div className="text-yellow-300 text-sm font-semibold mb-1">GOD Score</div>
                <div className="text-3xl font-bold text-white">{startup.total_god_score}</div>
                <div className="text-xs text-gray-400 mt-1">Overall Quality</div>
              </div>
            )}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl p-5 border border-purple-400/30 shadow-lg">
              <div className="text-purple-300 text-sm font-semibold mb-1">Matches</div>
              <div className="text-3xl font-bold text-white">{matchCount.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">Investor Matches</div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              LIFEFORM: Competitive Drift Narrative
              "Since last week: You moved +2, 3 competitors fell below you"
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-8 bg-[#1c1c1c]/50 rounded-xl p-5 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Competitive Drift</span>
              <span className="text-xs text-zinc-600">· since last week</span>
            </div>
            <div className="space-y-2 text-sm">
              {startup.total_god_score >= 70 ? (
                <>
                  <p className="text-zinc-300">
                    Your position <span className="text-emerald-400">strengthened</span>. 
                    <span className="text-zinc-500"> 2 similar-stage startups fell below you.</span>
                  </p>
                  <p className="text-zinc-500">
                    Investor attention in your sector <span className="text-zinc-400">increased 12%</span> this window.
                  </p>
                </>
              ) : startup.total_god_score >= 50 ? (
                <>
                  <p className="text-zinc-300">
                    Your position <span className="text-amber-400">held steady</span>. 
                    <span className="text-zinc-500"> Market noise, no significant shifts.</span>
                  </p>
                  <p className="text-zinc-500">
                    <span className="text-zinc-400">4 startups</span> moved past you. <span className="text-zinc-400">2 fell behind</span>.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-zinc-300">
                    Your position <span className="text-zinc-400">drifted lower</span>. 
                    <span className="text-zinc-500"> 3 competitors gaining momentum.</span>
                  </p>
                  <p className="text-zinc-500">
                    Consider updating your profile. <span className="text-zinc-400">Signal activity slowing</span>.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Five Points */}
          {fivePoints && fivePoints.length > 0 && (
            <div className="mb-8">
              <h3 className="text-4xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                <span className="text-5xl animate-pulse">💎</span>
                Key Highlights
              </h3>
              <div className="grid gap-4">
                {fivePoints.map((point: string, i: number) => {
                  const colors = [
                    'from-emerald-500/20 to-cyan-500/20 shadow-emerald-500/20',
                    'from-purple-500/20 to-violet-500/20 shadow-purple-500/20',
                    'from-cyan-500/20 to-blue-500/20 shadow-cyan-500/20',
                    'from-emerald-600/20 to-green-500/20 shadow-emerald-500/20',
                    'from-purple-600/20 to-indigo-500/20 shadow-purple-500/20'
                  ];
                  const icons = ['🎯', '📈', '⚡', '👥', '💰'];
                  return (
                    <div key={i} className={`bg-gradient-to-r ${colors[i]} backdrop-blur-sm rounded-xl p-6 shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300 cursor-pointer border border-emerald-400/20`}>
                      <p className="text-white text-xl font-bold flex items-start gap-3">
                        <span className="text-2xl">{icons[i]}</span>
                        <span>{point}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Startup Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {startup.extracted_data?.description && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-sm rounded-xl p-5 border border-emerald-400/30 shadow-lg shadow-emerald-500/10 hover:scale-105 transition-transform">
                <h4 className="text-emerald-300 font-bold mb-2 text-lg flex items-center gap-2">
                  <span>🎯</span> Value Proposition
                </h4>
                <p className="text-white/90 font-medium">{startup.extracted_data.description}</p>
              </div>
            )}
            {startup.extracted_data?.market_size && (
              <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 backdrop-blur-sm rounded-xl p-5 border border-purple-400/30 shadow-lg shadow-purple-500/10 hover:scale-105 transition-transform">
                <h4 className="text-purple-300 font-bold mb-2 text-lg flex items-center gap-2">
                  <span>📈</span> Market Size
                </h4>
                <p className="text-white/90 font-medium">{startup.extracted_data.market_size}</p>
              </div>
            )}
            {startup.extracted_data?.unique && (
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-5 border border-cyan-400/30 shadow-lg shadow-cyan-500/10 hover:scale-105 transition-transform">
                <h4 className="text-cyan-300 font-bold mb-2 text-lg flex items-center gap-2">
                  <span>✨</span> Unique Value
                </h4>
                <p className="text-white/90 font-medium">{startup.extracted_data.unique}</p>
              </div>
            )}
            {startup.extracted_data?.raise && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-sm rounded-xl p-5 border border-emerald-400/30 shadow-lg shadow-emerald-500/10 hover:scale-105 transition-transform">
                <h4 className="text-emerald-300 font-bold mb-2 text-lg flex items-center gap-2">
                  <span>💰</span> Raise Amount
                </h4>
                <p className="text-white/90 font-medium text-xl">{startup.extracted_data.raise}</p>
              </div>
            )}
            {startup.extracted_data?.stage && (
              <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm rounded-xl p-5 border border-purple-400/30 shadow-lg shadow-purple-500/10 hover:scale-105 transition-transform">
                <h4 className="text-purple-300 font-bold mb-2 text-lg flex items-center gap-2">
                  <span>🎯</span> Stage
                </h4>
                <p className="text-white/90 font-medium">Stage {startup.extracted_data.stage}</p>
              </div>
            )}
          </div>

          {/* Video Link */}
          {startup.video && (
            <div className="mb-8 bg-gradient-to-r from-emerald-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl p-6 border border-emerald-400/30 shadow-lg shadow-emerald-500/10">
              <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <span>🎥</span> Pitch Video
              </h3>
              <a 
                className="text-emerald-300 hover:text-emerald-200 underline text-lg font-semibold inline-flex items-center gap-2 hover:gap-3 transition-all" 
                href={startup.video} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Watch now <span>→</span>
              </a>
            </div>
          )}

          {/* Template Completion Report */}
          <div className="mb-8 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-6 border border-cyan-400/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>📚</span> Fundraising Toolkit Progress
              </h3>
              <Link
                to={`/startup/${id}/templates`}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
              >
                View All Templates →
              </Link>
            </div>
            <TemplateCompletionWidget startupId={id || ''} />
          </div>

          {/* Recent News */}
          {news.length > 0 && (
            <div className="mb-6">
              <h3 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                <span className="text-4xl">📰</span>
                Recent News
              </h3>
              <div className="space-y-4">
                {news.map((article) => {
                  const daysAgo = Math.floor((Date.now() - new Date(article.published_date).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm rounded-xl p-5 border border-emerald-400/20 hover:border-emerald-400/50 transition-all hover:bg-white/15"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl">
                            📰
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="text-white font-bold text-lg group-hover:text-purple-300 transition-colors line-clamp-2">
                              {article.title}
                            </h4>
                            <span className="flex-shrink-0 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                              {daysAgo}d ago
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{article.summary}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-cyan-400 font-medium">{article.source}</span>
                            {article.sentiment === 'positive' && (
                              <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">📈 Positive</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vote Stats - Compact Version */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleVote('yes')}
              className={`group relative overflow-hidden rounded-xl p-5 border transition-all ${
                userVote === 'yes'
                  ? 'border-emerald-400 bg-gradient-to-br from-emerald-500/20 to-green-500/20 shadow-emerald-500/20'
                  : 'border-emerald-400/30 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-3xl mb-1">👍</div>
                  <div className={`text-sm font-medium uppercase tracking-wide mb-1 ${
                    userVote === 'yes' ? 'text-green-300' : 'text-gray-400'
                  }`}>
                    {userVote === 'yes' ? 'You voted YES' : 'Vote YES'}
                  </div>
                  <div className="text-2xl font-bold text-white">{voteCount?.yes_votes || startup.yesVotes || 0}</div>
                </div>
                {userVote === 'yes' && (
                  <div className="text-green-400 text-xl">✓</div>
                )}
              </div>
            </button>
            <button
              onClick={() => handleVote('no')}
              className={`group relative overflow-hidden rounded-xl p-5 border transition-all ${
                userVote === 'no'
                  ? 'border-purple-400 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 shadow-purple-500/20'
                  : 'border-purple-400/30 bg-white/5 hover:bg-purple-500/10 hover:border-purple-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-3xl mb-1">👎</div>
                  <div className={`text-sm font-medium uppercase tracking-wide mb-1 ${
                    userVote === 'no' ? 'text-gray-300' : 'text-gray-400'
                  }`}>
                    {userVote === 'no' ? 'You voted NO' : 'Vote NO'}
                  </div>
                  <div className="text-2xl font-bold text-white">{voteCount?.no_votes || startup.noVotes || 0}</div>
                </div>
                {userVote === 'no' && (
                  <div className="text-gray-400 text-xl">✓</div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartupDetail;
