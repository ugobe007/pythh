import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Filter, TrendingUp, Download, Rocket, Zap,
  Building2, Users, Target, BarChart3, FileText, Sparkles,
  ArrowRight, CheckCircle2, Star, DollarSign, MapPin,
  Calendar, MessageSquare, BookOpen, Lightbulb, Code2,
  Briefcase, Award, TrendingDown, Activity, Eye, Database,
  BarChart, PieChart, LineChart, TrendingUp as TrendingUpIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: any;
  route: string;
  category: 'matching' | 'analytics' | 'portfolio' | 'research';
  featured?: boolean;
  badge?: string;
}

export default function InvestorToolsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalMatches: 0,
    highQualityStartups: 0,
    totalStartups: 0,
    avgGODScore: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: matchCount } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true });
        
        const { count: startupCount } = await supabase
          .from('startup_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        setStats({
          totalMatches: matchCount || 0,
          highQualityStartups: 0, // Calculate from startups with high GOD scores
          totalStartups: startupCount || 0,
          avgGODScore: 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }
    fetchStats();
  }, []);

  const tools: Tool[] = [
    // Matching Tools
    {
      id: 'match-search',
      name: 'Startup Match Search',
      description: 'Search and filter your startup matches with advanced criteria. Find high-quality startups that fit your investment thesis.',
      icon: Search,
      route: '/investor/:id/matches',
      category: 'matching',
      featured: true,
      badge: 'Popular'
    },
    {
      id: 'trending',
      name: 'Trending Startups',
      description: 'Discover trending startups across different algorithms. See what\'s hot in the market.',
      icon: TrendingUp,
      route: '/trending',
      category: 'matching',
      featured: true
    },
    {
      id: 'market-trends',
      name: 'Market Trends & Analysis',
      description: 'Deep market analysis: sector trends, supply/demand, top performers, and investment opportunities.',
      icon: BarChart3,
      route: '/market-trends',
      category: 'analytics',
      featured: true
    },
    
    // Analytics Tools
    {
      id: 'portfolio-analytics',
      name: 'Portfolio Analytics',
      description: 'Analyze your portfolio performance, track exits, and measure ROI across your investments.',
      icon: PieChart,
      route: '/portfolio',
      category: 'analytics'
    },
    {
      id: 'match-analytics',
      name: 'Match Analytics',
      description: 'Deep dive into your match statistics. See quality distribution, sector breakdown, and score trends.',
      icon: Activity,
      route: '/investor/:id/matches',
      category: 'analytics'
    },
    {
      id: 'god-scores',
      name: 'GOD Score Explorer',
      description: 'Explore startup GOD scores and understand the scoring methodology. Find high-quality opportunities.',
      icon: Star,
      route: '/admin/god-scores',
      category: 'analytics'
    },
    
    // Portfolio Management
    {
      id: 'portfolio',
      name: 'Portfolio Manager',
      description: 'Manage your portfolio, track investments, and monitor startup progress over time.',
      icon: Briefcase,
      route: '/portfolio',
      category: 'portfolio'
    },
    {
      id: 'exits',
      name: 'Exit Tracker',
      description: 'Track exits, acquisitions, and IPOs. Monitor portfolio performance and returns.',
      icon: Award,
      route: '/portfolio',
      category: 'portfolio'
    },
    
    // Research Tools
    {
      id: 'startup-directory',
      name: 'Startup Directory',
      description: 'Browse all startups on the platform. Filter by sector, stage, location, and quality scores.',
      icon: Database,
      route: '/trending',
      category: 'research'
    },
    {
      id: 'investor-directory',
      name: 'Investor Directory',
      description: 'View other investors, their portfolios, and investment strategies. Network and learn.',
      icon: Building2,
      route: '/investors',
      category: 'research'
    },
    {
      id: 'feed',
      name: 'Activity Feed',
      description: 'Stay updated on startup activity, funding rounds, and market movements.',
      icon: MessageSquare,
      route: '/feed',
      category: 'research'
    }
  ];

  const categories = ['matching', 'analytics', 'portfolio', 'research'] as const;
  const categoryLabels = {
    matching: 'Matching Tools',
    analytics: 'Analytics & Insights',
    portfolio: 'Portfolio Management',
    research: 'Research & Discovery'
  };

  const getToolsByCategory = (category: typeof categories[number]) => {
    return tools.filter(tool => tool.category === category);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <LogoDropdownMenu />
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Investor Tools & Resources
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Powerful tools to discover startups, analyze opportunities, and manage your portfolio
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.totalMatches.toLocaleString()}</div>
            <div className="text-white/60 text-sm">Total Matches</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.totalStartups.toLocaleString()}</div>
            <div className="text-white/60 text-sm">Active Startups</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.highQualityStartups}</div>
            <div className="text-white/60 text-sm">High Quality (80+)</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.avgGODScore.toFixed(1)}</div>
            <div className="text-white/60 text-sm">Avg GOD Score</div>
          </div>
        </div>

        {/* Featured Tools */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Featured Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tools.filter(t => t.featured).map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  to={tool.route}
                  className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all hover:scale-105"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white/10 rounded-xl">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {tool.badge && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{tool.name}</h3>
                  <p className="text-white/70 text-sm mb-4">{tool.description}</p>
                  <div className="flex items-center text-white/80 group-hover:text-white transition-colors">
                    <span className="text-sm">Explore</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* All Tools by Category */}
        {categories.map((category) => {
          const categoryTools = getToolsByCategory(category);
          if (categoryTools.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">{categoryLabels[category]}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.id}
                      to={tool.route}
                      className="group bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-white/30 transition-all hover:scale-105"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-2 bg-white/10 rounded-lg">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        {tool.badge && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{tool.name}</h3>
                      <p className="text-white/60 text-sm">{tool.description}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Quick Actions */}
        <div className="mt-16 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Discover Startups?</h2>
          <p className="text-white/70 mb-6">
            Explore trending startups, search matches, or analyze market trends to find your next investment.
          </p>
          <div className="flex gap-4">
            <Link
              to="/trending"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Explore Trending Startups
            </Link>
            <Link
              to="/market-trends"
              className="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-all border border-white/20"
            >
              View Market Trends
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

