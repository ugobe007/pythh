import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Filter, TrendingUp, Download, Rocket, Zap,
  Building2, Users, Target, BarChart3, FileText, Sparkles,
  ArrowRight, CheckCircle2, Star, DollarSign, MapPin,
  Calendar, MessageSquare, BookOpen, Lightbulb, Code2,
  Briefcase, Award, TrendingDown, Activity, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: any;
  route: string;
  category: 'matching' | 'analytics' | 'resources' | 'community';
  featured?: boolean;
  badge?: string;
}

export default function StartupToolsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalMatches: 0,
    highConfidenceMatches: 0,
    totalInvestors: 0,
    avgMatchScore: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: matchCount } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true });
        
        const { count: investorCount } = await supabase
          .from('investors')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalMatches: matchCount || 0,
          highConfidenceMatches: 0, // Calculate from matches
          totalInvestors: investorCount || 0,
          avgMatchScore: 0
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
      name: 'Investor Match Search',
      description: 'Search and filter your investor matches with advanced criteria. Find the perfect investor for your startup.',
      icon: Search,
      route: '/startup/:id/matches',
      category: 'matching',
      featured: true,
      badge: 'Popular'
    },
    {
      id: 'trending',
      name: 'Trending Startups',
      description: 'See which startups are trending and discover what makes them stand out. Learn from top performers.',
      icon: TrendingUp,
      route: '/trending',
      category: 'matching',
      featured: true
    },
    {
      id: 'market-trends',
      name: 'Market Trends',
      description: 'Analyze sector trends, supply/demand, and market opportunities. Make data-driven decisions.',
      icon: BarChart3,
      route: '/market-trends',
      category: 'analytics'
    },
    
    // Analytics Tools
    {
      id: 'god-scores',
      name: 'GOD Score Analysis',
      description: 'View your GOD score breakdown and see how you compare to other startups. Understand your strengths.',
      icon: Star,
      route: '/admin/god-scores',
      category: 'analytics'
    },
    {
      id: 'match-analytics',
      name: 'Match Analytics',
      description: 'Deep dive into your match statistics. See confidence levels, score distributions, and top sectors.',
      icon: Activity,
      route: '/startup/:id/matches',
      category: 'analytics'
    },
    
    // Resources
    {
      id: 'fundraising-playbook',
      name: 'Fundraising Playbook',
      description: 'Comprehensive guides, templates, and strategies for fundraising success.',
      icon: BookOpen,
      route: '/strategies',
      category: 'resources',
      featured: true
    },
    {
      id: 'services',
      name: 'AI-Powered Services',
      description: 'Get help with pitch decks, investor research, and fundraising strategy using AI.',
      icon: Sparkles,
      route: '/services',
      category: 'resources'
    },
    {
      id: 'investor-directory',
      name: 'Investor Directory',
      description: 'Browse 600+ investors. Filter by sector, stage, check size, and geography.',
      icon: Building2,
      route: '/investors',
      category: 'resources'
    },
    
    // Community
    {
      id: 'feed',
      name: 'Activity Feed',
      description: 'See what\'s happening in the startup ecosystem. Trending startups, new funding, and more.',
      icon: MessageSquare,
      route: '/feed',
      category: 'community'
    },
    {
      id: 'submit',
      name: 'Submit Your Startup',
      description: 'Get matched with investors. Submit your startup to our platform.',
      icon: Rocket,
      route: '/submit',
      category: 'community',
      featured: true,
      badge: 'Get Started'
    }
  ];

  const categories = ['matching', 'analytics', 'resources', 'community'] as const;
  const categoryLabels = {
    matching: 'Matching Tools',
    analytics: 'Analytics & Insights',
    resources: 'Resources & Guides',
    community: 'Community'
  };

  const getToolsByCategory = (category: typeof categories[number]) => {
    return tools.filter(tool => tool.category === category);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
            Startup Tools & Resources
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Everything you need to find investors, analyze your startup, and grow your business
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.totalMatches.toLocaleString()}</div>
            <div className="text-white/60 text-sm">Total Matches</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.totalInvestors.toLocaleString()}</div>
            <div className="text-white/60 text-sm">Active Investors</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.highConfidenceMatches}</div>
            <div className="text-white/60 text-sm">High Confidence</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.avgMatchScore.toFixed(1)}</div>
            <div className="text-white/60 text-sm">Avg Match Score</div>
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
                      <span className="px-2 py-1 bg-cyan-600/20 text-cyan-300 text-xs rounded-full">
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
        <div className="mt-16 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl p-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-white/70 mb-6">
            Submit your startup to get matched with investors, or explore our tools to find the perfect fit.
          </p>
          <div className="flex gap-4">
            <Link
              to="/submit"
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all"
            >
              Submit Your Startup
            </Link>
            <Link
              to="/trending"
              className="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-all border border-white/20"
            >
              Explore Trending
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

