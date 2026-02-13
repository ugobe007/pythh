import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Brain, Target, TrendingUp, MessageSquare, Lightbulb, FileText, 
  BarChart3, Users2, Handshake, Headphones, Crown, Lock,
  Sparkles, ArrowRight, Play, CheckCircle
} from 'lucide-react';
import FlameIcon from '../components/FlameIcon';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface ServiceTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tier_required: string;
  icon: string;
  estimated_time: string;
  is_active: boolean;
}

const iconMap: Record<string, any> = {
  '📊': BarChart3,
  '✨': Sparkles,
  '📖': FileText,
  '🎯': Target,
  '🗺️': TrendingUp,
  '🔗': Handshake,
  '📈': TrendingUp,
  '💬': MessageSquare,
  '👥': Users2,
  '🧠': Brain,
  '🔍': Target,
  '🤝': Handshake,
  '🎓': Lightbulb,
  '🚀': TrendingUp,
  '⚖️': FileText,
  '🏢': Target,
  '📰': FileText,
};

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  pitch: { bg: 'from-cyan-500/40 to-blue-500/40', border: 'border-cyan-400/50', text: 'text-cyan-300' },
  strategy: { bg: 'from-purple-500/40 to-indigo-500/40', border: 'border-purple-400/50', text: 'text-purple-300' },
  traction: { bg: 'from-emerald-500/40 to-teal-500/40', border: 'border-emerald-400/50', text: 'text-emerald-300' },
  team: { bg: 'from-blue-500/40 to-cyan-500/40', border: 'border-blue-400/50', text: 'text-blue-300' },
  pmf: { bg: 'from-blue-500/40 to-violet-500/40', border: 'border-red-400/50', text: 'text-red-300' },
  partnerships: { bg: 'from-blue-500/40 to-yellow-500/40', border: 'border-cyan-400/50', text: 'text-cyan-300' },
  talent: { bg: 'from-cyan-500/40 to-blue-500/40', border: 'border-cyan-400/50', text: 'text-cyan-300' },
  ecosystem: { bg: 'from-green-500/40 to-emerald-500/40', border: 'border-green-400/50', text: 'text-green-300' },
  growth: { bg: 'from-cyan-500/40 to-blue-500/40', border: 'border-cyan-400/50', text: 'text-cyan-300' },
};

const tierBadges: Record<string, { label: string; color: string }> = {
  spark: { label: 'Free', color: 'bg-gray-500' },
  flame: { label: 'Flame', color: 'bg-gradient-to-r from-orange-600 to-amber-600' },
  inferno: { label: 'Inferno', color: 'bg-gradient-to-r from-orange-500 to-red-600' },
};

export default function ServicesPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<string>('spark');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [completedServices, setCompletedServices] = useState<string[]>([]);

  useEffect(() => {
    loadServices();
    loadUserTier();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from as any)('service_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error loading services:', error);
      // Use fallback data
      setServices([
        { id: '1', slug: 'pitch-analyzer', name: 'Pitch Deck Analyzer', description: 'AI analyzes your pitch deck and provides specific improvement recommendations.', category: 'pitch', tier_required: 'flame', icon: '📊', estimated_time: '2-3 min', is_active: true },
        { id: '2', slug: 'value-prop-sharpener', name: 'Value Prop Sharpener', description: 'Refine your one-liner and elevator pitch to capture investor attention.', category: 'pitch', tier_required: 'flame', icon: '✨', estimated_time: '1-2 min', is_active: true },
        { id: '3', slug: 'vc-approach-playbook', name: 'VC Approach Playbook', description: 'Custom strategies for approaching each matched investor.', category: 'strategy', tier_required: 'flame', icon: '🎯', estimated_time: '1-2 min', is_active: true },
        { id: '4', slug: 'funding-strategy', name: 'Funding Strategy Roadmap', description: 'Personalized fundraising plan with timeline and investor sequencing.', category: 'strategy', tier_required: 'inferno', icon: '🗺️', estimated_time: '3-5 min', is_active: true },
        { id: '5', slug: 'traction-improvement', name: 'Traction Improvement Plan', description: 'Data-driven recommendations to improve metrics VCs care about.', category: 'traction', tier_required: 'inferno', icon: '📈', estimated_time: '3-5 min', is_active: true },
        { id: '6', slug: 'team-gap-analysis', name: 'Team Gap Analysis', description: 'Identify missing roles and advisor types for your fundraise.', category: 'team', tier_required: 'inferno', icon: '👥', estimated_time: '3-5 min', is_active: true },
        { id: '7', slug: 'pmf-analysis', name: 'Product-Market Fit Analysis', description: 'Deep analysis of PMF signals with improvement recommendations.', category: 'pmf', tier_required: 'inferno', icon: '🎯', estimated_time: '5-7 min', is_active: true },
        { id: '8', slug: 'partnership-opportunities', name: 'Partnership Finder', description: 'Identify strategic partnership opportunities to accelerate growth.', category: 'partnerships', tier_required: 'inferno', icon: '🤝', estimated_time: '3-5 min', is_active: true },
      ]);
    } else {
      setServices((data || []) as ServiceTemplate[]);
    }
    setLoading(false);
  };

  const loadUserTier = () => {
    const plan = localStorage.getItem('userPlan') || 'spark';
    setUserTier(plan);
    
    // Load completed services
    const completed = JSON.parse(localStorage.getItem('completedServices') || '[]');
    setCompletedServices(completed);
  };

  const canAccessService = (tierRequired: string): boolean => {
    const tierHierarchy = ['spark', 'flame', 'inferno'];
    const userTierIndex = tierHierarchy.indexOf(userTier);
    const requiredTierIndex = tierHierarchy.indexOf(tierRequired);
    return userTierIndex >= requiredTierIndex;
  };

  const categories = ['all', ...new Set(services.map(s => s.category))];

  const filteredServices = selectedCategory === 'all' 
    ? services 
    : services.filter(s => s.category === selectedCategory);

  const handleServiceClick = (service: ServiceTemplate) => {
    if (!canAccessService(service.tier_required)) {
      navigate('/get-matched');
      return;
    }
    navigate(`/services/${service.slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] flex items-center justify-center">
        <div className="text-white text-2xl">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0015] via-[#1a0a2e] to-[#0f0520] relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-orange-500/10 to-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Logo Dropdown Menu - Global Navigation */}
      <LogoDropdownMenu />

      <div className="relative z-10 container mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 rounded-full mb-6">
            <Brain className="w-4 h-4 text-orange-400" />
            <span className="text-orange-300 text-sm font-medium">AI-Powered Services</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 flex items-center justify-center gap-3">
            <span className="bg-gradient-to-r from-orange-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Founder Toolkit
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            AI-powered tools to improve your pitch, strategy, traction, and more
          </p>
          
          {/* Current Plan Badge */}
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-black/30 rounded-full border border-white/10">
            <span className="text-gray-400 text-sm">Your Plan:</span>
            <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${tierBadges[userTier]?.color || 'bg-gray-500'}`}>
              {tierBadges[userTier]?.label || 'Free'}
            </span>
          </div>
        </div>

        {/* Category Filter - Enhanced */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat, index) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all transform ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold shadow-lg shadow-orange-500/50 scale-105 border-2 border-orange-300'
                  : 'bg-gradient-to-r from-slate-800/60 to-slate-700/60 text-white hover:from-cyan-600/60 hover:to-blue-600/60 border border-cyan-500/30 hover:border-cyan-400/50 hover:scale-102 backdrop-blur-sm'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {cat === 'all' ? 'All Services' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Services Grid - Enhanced */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {filteredServices.map((service, index) => {
            const colors = categoryColors[service.category] || categoryColors.pitch;
            const IconComponent = iconMap[service.icon] || Brain;
            const canAccess = canAccessService(service.tier_required);
            const isCompleted = completedServices.includes(service.slug);

            return (
              <button
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className={`group relative text-left bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl backdrop-blur-sm overflow-hidden ${
                  !canAccess ? 'opacity-90' : 'hover:shadow-cyan-500/20'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-700"></div>
                
                {/* Tier Badge - Enhanced */}
                <div className="absolute top-4 right-4 z-10">
                  {!canAccess ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-gray-700 shadow-lg">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-400">{tierBadges[service.tier_required]?.label}</span>
                    </div>
                  ) : isCompleted ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/30 backdrop-blur-md rounded-full border border-green-500/50 shadow-lg">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-medium text-green-400">Completed</span>
                    </div>
                  ) : (
                    <div className={`px-3 py-1.5 ${tierBadges[service.tier_required]?.color} rounded-full shadow-lg backdrop-blur-sm border border-white/20`}>
                      <span className="text-xs text-white font-bold">{tierBadges[service.tier_required]?.label}</span>
                    </div>
                  )}
                </div>

                {/* Icon - Enhanced with glow */}
                <div className={`relative w-16 h-16 rounded-xl bg-gradient-to-br ${colors.bg} border-2 ${colors.border} flex items-center justify-center mb-5 shadow-lg group-hover:shadow-xl transition-all duration-300 ${!canAccess ? 'opacity-60' : ''}`}>
                  {/* Glow effect - always visible */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${colors.bg} opacity-30 blur-md animate-pulse`}></div>
                  {/* Stronger glow on hover */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${colors.bg} opacity-0 group-hover:opacity-60 blur-xl transition-opacity duration-300`}></div>
                  {IconComponent && typeof IconComponent !== 'string' ? (
                    <IconComponent className={`relative w-8 h-8 ${colors.text} transition-transform duration-300 group-hover:scale-110 drop-shadow-lg filter brightness-110`} style={{ filter: 'drop-shadow(0 0 8px currentColor) brightness(1.2)' }} />
                  ) : (
                    <Brain className={`relative w-8 h-8 ${colors.text} transition-transform duration-300 group-hover:scale-110 drop-shadow-lg filter brightness-110`} style={{ filter: 'drop-shadow(0 0 8px currentColor) brightness(1.2)' }} />
                  )}
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors">{service.name}</h3>
                <p className="text-gray-300 text-sm mb-5 line-clamp-3 leading-relaxed">{service.description}</p>

                {/* Footer - Enhanced */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-gray-400 text-xs font-medium">{service.estimated_time}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${colors.text} group-hover:translate-x-1 transition-transform duration-300`}>
                    {canAccess ? (
                      <>
                        <span className="text-sm font-semibold">Start</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold">Unlock</span>
                        <Lock className="w-4 h-4" />
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Upgrade CTA - Enhanced */}
        {userTier === 'spark' && (
          <div className="mt-20 max-w-3xl mx-auto text-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-cyan-500/20 to-blue-500/20 rounded-3xl blur-2xl"></div>
            <div className="relative bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-xl border-2 border-cyan-500/40 rounded-3xl p-10 shadow-2xl">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-orange-500/20 border border-cyan-400/50 mb-6">
                <Crown className="w-10 h-10 text-cyan-400 animate-pulse" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-cyan-400 to-orange-400 bg-clip-text text-transparent">
                Unlock All Services
              </h3>
              <p className="text-gray-300 mb-8 text-lg max-w-xl mx-auto">
                Upgrade to Flame or Inferno to access AI-powered tools that help you raise faster and smarter.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-cyan-600 via-blue-600 to-orange-600 hover:from-cyan-500 hover:via-blue-500 hover:to-orange-500 text-white font-bold rounded-xl transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 transform duration-300"
              >
            <Sparkles className="w-6 h-6 animate-pulse" />
                <span>View Pricing & Upgrade</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
