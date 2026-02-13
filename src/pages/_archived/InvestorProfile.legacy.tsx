import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Investor {
  id: string;
  name: string;
  firm: string;
  title: string;
  bio: string;
  email: string;
  photo_url: string;
  stage: string[];
  sectors: string[];
  check_size_min: number;
  check_size_max: number;
  investment_thesis: string;
  linkedin_url: string;
  type: string;
  total_investments: number | null; // SSOT: Database uses total_investments, not portfolio_size
}

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  summary: string;
  published_date: string;
  source: string;
  sentiment?: string;
}

export default function InvestorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsArticle[]>([]);

  // Use browser history to go back instead of navigate to a route
  const goBack = () => {
    window.history.back();
  };

  useEffect(() => {
    async function fetchInvestor() {
      if (!id) return;
      const { data } = await supabase
        .from('investors')
        .select('*')
        .eq('id', id)
        .single();
      setInvestor(data);
      
      // Fetch mock news for investor
      if (data) {
        setNews([
          {
            id: '1',
            title: `${data.firm} Announces $${Math.floor(Math.random() * 500 + 100)}M New Fund`,
            url: '#',
            summary: 'The firm closes oversubscribed fund to back next generation of startups.',
            published_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'TechCrunch',
            sentiment: 'positive'
          },
          {
            id: '2',
            title: `${data.name} Shares Investment Insights at Conference`,
            url: '#',
            summary: 'Key takeaways on market trends and emerging opportunities in the sector.',
            published_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'VentureBeat',
            sentiment: 'positive'
          },
          {
            id: '3',
            title: `${data.firm} Portfolio Company Achieves Major Milestone`,
            url: '#',
            summary: 'Recent investment reaches unicorn status, validating thesis.',
            published_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            source: 'The Information',
            sentiment: 'positive'
          }
        ]);
      }
      
      setLoading(false);
    }
    fetchInvestor();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        {/* Pythh glowing background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
        </div>
        <div className="text-white text-xl relative z-10">Loading...</div>
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex flex-col items-center justify-center gap-4">
        {/* Pythh glowing background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
        </div>
        <div className="text-red-400 text-xl relative z-10">Investor not found</div>
        <button 
          onClick={() => navigate('/matches')} 
          className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all relative z-10"
        >
          ← Back to Matches
        </button>
      </div>
    );
  }

  // Format check size for display
  const formatCheckSize = () => {
    if (investor.check_size_min && investor.check_size_max) {
      return `$${(investor.check_size_min / 1000000).toFixed(1)}M - $${(investor.check_size_max / 1000000).toFixed(1)}M`;
    }
    return 'Undisclosed';
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden p-6 scrollbar-hide overflow-y-auto">
      {/* Pythh glowing background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Back Button */}
        <button
          onClick={goBack}
          className="group mb-6 px-6 py-3 rounded-xl bg-white/5 hover:bg-cyan-500/20 transition-all flex items-center gap-2 text-gray-300 hover:text-cyan-400"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Matches</span>
        </button>

        {/* Main Profile Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 mb-6">
          {/* Header Section with Photo */}
          <div className="flex items-start gap-6 mb-8 pb-6 border-b border-white/10">
            {/* Avatar/Photo */}
            <div className="relative flex-shrink-0">
              <img 
                src={investor.photo_url || '/images/investor_icon_.png'} 
                alt={investor.name}
                className="w-24 h-24 rounded-xl object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/images/investor_icon_.png';
                }}
              />
              {/* Status indicator */}
              <div className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full border border-green-400/50">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-400">Active</span>
              </div>
            </div>

            {/* Name and Title */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{investor.name}</h1>
              <p className="text-lg text-white/70 mb-4">
                {investor.title} @ {investor.firm}
              </p>
              
              {/* Quick Links */}
              <div className="flex gap-3 mt-4">
                {investor.linkedin_url && (
                  <a 
                    href={investor.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-medium border border-cyan-500/30 transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    LinkedIn
                  </a>
                )}
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-medium transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Check Size */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Check Size</p>
              <p className="text-white text-xl font-bold">{formatCheckSize()}</p>
            </div>

            {/* Total Investments */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Portfolio</p>
              <p className="text-white text-xl font-bold">{investor.total_investments || 'N/A'} companies</p>
            </div>

            {/* Investment Type */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Type</p>
              <p className="text-white text-xl font-bold">{investor.type || 'VC Firm'}</p>
            </div>
          </div>

          {/* Stages Section */}
          {investor.stage && investor.stage.length > 0 && (
            <div className="mb-6 bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-3">Investment Stages</h3>
              <div className="flex flex-wrap gap-2">
                {investor.stage.map((stg: string, i: number) => (
                  <span 
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-white/90 font-medium border border-white/10 text-sm"
                  >
                    {stg}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sectors Section */}
          {investor.sectors && investor.sectors.length > 0 && (
            <div className="mb-6 bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-3">Focus Sectors</h3>
              <div className="flex flex-wrap gap-2">
                {investor.sectors.map((sector: string, i: number) => (
                  <span 
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-white/90 font-medium border border-white/10 text-sm"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio Section */}
          {investor.bio && (
            <div className="mb-8 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-cyan-400/30 shadow-lg shadow-cyan-500/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📝</span>
                <h3 className="text-2xl font-bold text-cyan-300">About</h3>
              </div>
              <p className="text-white text-lg leading-relaxed">{investor.bio}</p>
            </div>
          )}

          {/* Investment Thesis */}
          {investor.investment_thesis && (
            <div className="mb-8 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm rounded-xl p-6 border border-purple-400/30 shadow-lg shadow-purple-500/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">💡</span>
                <h3 className="text-2xl font-bold text-purple-300">Investment Thesis</h3>
              </div>
              <p className="text-white text-lg leading-relaxed italic">"{investor.investment_thesis}"</p>
            </div>
          )}

          {/* Recent News */}
          {news.length > 0 && (
            <div className="mt-8">
              <h3 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                <span className="text-4xl">📰</span>
                Recent Activity
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
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-2xl">
                            📰
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="text-white font-bold text-lg group-hover:text-emerald-300 transition-colors line-clamp-2">
                              {article.title}
                            </h4>
                            <span className="flex-shrink-0 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                              {daysAgo}d ago
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{article.summary}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-emerald-400 font-medium">{article.source}</span>
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

          {/* CTA - Subtle Version */}
          <div className="mt-8">
            <a
              href={`mailto:${investor.email}`}
              className="group block w-full px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-emerald-400/30 hover:border-emerald-400/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-emerald-300 font-semibold text-lg group-hover:text-emerald-200 transition-colors">Connect with {investor.name.split(' ')[0]}</div>
                  <div className="text-gray-400 text-sm">Reach out via email</div>
                </div>
                <svg className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
