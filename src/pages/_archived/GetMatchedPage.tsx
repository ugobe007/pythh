import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Brain, 
  Target, 
  BarChart3, 
  Star,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  Users,
  DollarSign,
  Globe,
  Briefcase,
  ChevronRight,
  Play,
  Rocket,
  Shield,
  Award,
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

export default function GetMatchedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlParam = searchParams.get('url');
  
  // If user came here with a URL param, redirect to InstantMatches
  useEffect(() => {
    if (urlParam) {
      navigate(`/instant-matches?url=${encodeURIComponent(urlParam)}`, { replace: true });
    }
  }, [urlParam, navigate]);
  
  const [step, setStep] = useState<'info' | 'details' | 'pitch'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  
  // Animate the process steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveProcessStep((prev) => (prev + 1) % 5);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: '',
    tagline: '',
    website: '',
    founderName: '',
    founderEmail: '',
    
    // Step 2: Details
    sectors: [] as string[],
    stage: '',
    location: '',
    teamSize: '',
    
    // Step 3: Pitch
    description: '',
    raiseAmount: '',
    useOfFunds: '',
  });

  const sectors = [
    'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'E-Commerce', 'CleanTech', 
    'Cybersecurity', 'EdTech', 'Robotics', 'Developer Tools', 'Consumer',
    'Biotech', 'SpaceTech', 'Gaming', 'Web3/Crypto', 'Marketplace'
  ];

  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  
  const teamSizes = ['Solo Founder', '2-5', '6-10', '11-25', '26-50', '50+'];

  const handleSectorToggle = (sector: string) => {
    setFormData(prev => ({
      ...prev,
      sectors: prev.sectors.includes(sector)
        ? prev.sectors.filter(s => s !== sector)
        : prev.sectors.length < 3 ? [...prev.sectors, sector] : prev.sectors
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Parse team size from string to number
      let teamSizeNum: number | null = null;
      if (formData.teamSize) {
        const match = formData.teamSize.match(/(\d+)/);
        if (match) {
          teamSizeNum = parseInt(match[1]);
        } else if (formData.teamSize === 'Solo Founder') {
          teamSizeNum = 1;
        }
      }

      const { data, error: insertError } = await supabase
        .from('startup_uploads')
        .insert({
          name: formData.name,
          tagline: formData.tagline,
          website: formData.website,
          submitted_email: formData.founderEmail,
          sectors: formData.sectors,
          stage: stages.indexOf(formData.stage) + 1,
          location: formData.location,
          team_size: teamSizeNum,
          description: formData.description,
          raise_amount: formData.raiseAmount,
          source_type: 'manual',
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Check if there's a redirect parameter in the URL
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      
      if (redirect) {
        // If redirect is to matches page, navigate there
        navigate(redirect);
      } else {
        // Otherwise navigate to matching engine
        navigate('/match', { state: { newStartup: true, startupId: data?.id } });
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Process steps for the visualization
  const processSteps = [
    { 
      num: 1, 
      icon: <FileText className="w-6 h-6" />, 
      title: 'Submit', 
      desc: 'Your startup details',
      tags: ['Stage', 'Sector'],
      color: 'cyan'
    },
    { 
      num: 2, 
      icon: <Brain className="w-6 h-6" />, 
      title: 'Analyze', 
      desc: 'GOD Algorithm scores',
      tags: ['Team', 'PMF'],
      color: 'blue'
    },
    { 
      num: 3, 
      icon: <Target className="w-6 h-6" />, 
      title: 'Match', 
      desc: '3,000+ investors compared',
      tags: ['Sector', 'Stage'],
      color: 'indigo'
    },
    { 
      num: 4, 
      icon: <BarChart3 className="w-6 h-6" />, 
      title: 'Rank', 
      desc: 'Score & confidence',
      tags: ['Score', 'Fit'],
      color: 'violet'
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; textLight: string }> = {
      cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', text: 'text-cyan-400', textLight: 'text-cyan-300' },
      blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', textLight: 'text-blue-300' },
      indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/50', text: 'text-indigo-400', textLight: 'text-indigo-300' },
      violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/50', text: 'text-violet-400', textLight: 'text-violet-300' },
      emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', textLight: 'text-emerald-300' },
    };
    return colors[color] || colors.cyan;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Global Navigation (includes fixed header) */}
      <LogoDropdownMenu />
      
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-cyan-500/5 to-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 mb-4">
            <Rocket className="w-4 h-4 text-orange-400" />
            <span className="text-orange-300 text-sm font-bold tracking-wide">FOR STARTUPS</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500">Perfect Match in Seconds</span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Get matched with investors who actually fund your sector and stage.
          </p>
          
          {/* Primary Action Buttons - Fundraising Toolkit & Founder Toolkit */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 sm:mt-10 px-4">
            {/* Fundraising Toolkit Button - Dark Purple with Yellow Lightning (Merlin Style) */}
            <Link
              to="/strategies"
              className="group relative w-full sm:w-auto min-w-[280px] sm:min-w-[320px] px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-2 border-purple-600/50 rounded-2xl shadow-2xl shadow-purple-900/40 hover:shadow-purple-600/60 transition-all hover:scale-[1.02] hover:border-purple-500/70"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-purple-900" strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-bold text-base sm:text-lg">Fundraising Toolkit</div>
                    <div className="text-purple-300 text-xs sm:text-sm">Guides • Strategies • Playbooks</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </div>
            </Link>
            
            {/* Founder Toolkit Button - Light Blue to Violet to White Gradient */}
            <Link
              to="/services"
              className="group relative w-full sm:w-auto min-w-[280px] sm:min-w-[320px] px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-br from-blue-400 via-violet-400 to-white border-2 border-blue-300/50 rounded-2xl shadow-2xl shadow-blue-400/40 hover:shadow-blue-500/60 transition-all hover:scale-[1.02] hover:from-blue-300 hover:via-violet-300 hover:to-white/90"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/30 backdrop-blur-sm flex items-center justify-center border border-white/40 shadow-lg">
                    <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <div className="text-slate-900 font-bold text-base sm:text-lg drop-shadow-sm">Founder Toolkit</div>
                    <div className="text-slate-700 text-xs sm:text-sm font-medium">AI tools • Pitch helpers • Resources</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-900 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </div>
            </Link>
          </div>

          {/* Secondary Action - View Pricing */}
          <div className="flex justify-center mt-6">
            <Link
              to="/pricing"
              className="px-6 py-3 bg-slate-800/50 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-700/50 rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Briefcase className="w-4 h-4" />
              <span>View Pricing & Plans</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* How [pyth] ai Works - Process Visualization */}
        <div className="mb-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 text-sm font-semibold">The Matching Machine</span>
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-2">
            How <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-cyan-400 bg-clip-text text-transparent">[pyth]</span> <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">ai</span> <span className="text-orange-400">Works</span>
          </h2>
          <p className="text-center text-slate-400 mb-8">
            Watch the machinery process your startup and deliver perfect matches in under 2 seconds
          </p>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-2">
            {/* Process Steps */}
            {processSteps.map((step, idx) => {
              const colorClasses = getColorClasses(step.color);
              return (
                <React.Fragment key={step.num}>
                  <div 
                    className={`relative ${colorClasses.bg} backdrop-blur-sm border ${colorClasses.border} rounded-2xl p-5 w-full lg:w-44 transition-all duration-500 ${
                      activeProcessStep === idx ? 'scale-105 shadow-lg' : 'opacity-80'
                    }`}
                  >
                    {/* Step number badge */}
                    <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-500`}>
                      {step.num}
                    </div>

                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${colorClasses.bg} flex items-center justify-center mb-3 mx-auto ${colorClasses.text}`}>
                      {step.icon}
                    </div>

                    {/* Content */}
                    <h3 className="text-white font-bold text-center mb-1">{step.title}</h3>
                    <p className="text-slate-400 text-xs text-center mb-3">{step.desc}</p>

                    {/* Tags */}
                    <div className="flex justify-center gap-1.5">
                      {step.tags.map((tag, tidx) => (
                        <span 
                          key={tidx}
                          className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses.bg} ${colorClasses.textLight}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Arrow between steps (hidden on mobile) */}
                  {idx < processSteps.length - 1 && (
                    <div className="hidden lg:flex items-center justify-center w-8">
                      <ChevronRight className={`w-5 h-5 transition-all ${activeProcessStep === idx ? 'text-white scale-125' : 'text-slate-600'}`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Perfect Match Result Card */}
            <div className="hidden lg:flex items-center justify-center w-8">
              <ChevronRight className={`w-5 h-5 transition-all ${activeProcessStep === 4 ? 'text-white scale-125' : 'text-slate-600'}`} />
            </div>
            
            <div className={`relative bg-gradient-to-br from-cyan-500/30 to-blue-600/20 backdrop-blur-sm border-2 border-cyan-500/60 rounded-2xl p-5 w-full lg:w-52 transition-all duration-500 ${
              activeProcessStep === 4 ? 'scale-105 shadow-xl shadow-cyan-500/30' : 'opacity-90'
            }`}>
              {/* Sparkle icon */}
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>

              {/* Star icon */}
              <div className="w-12 h-12 rounded-xl bg-cyan-500/30 flex items-center justify-center mb-3 mx-auto">
                <Star className="w-6 h-6 text-cyan-400 fill-cyan-400" />
              </div>

              <h3 className="text-white font-bold text-center text-lg mb-2">Perfect Match!</h3>
              
              {/* Score */}
              <div className="text-center mb-3">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                  87%
                </span>
                <p className="text-slate-400 text-xs">Match Score</p>
              </div>

              {/* Match indicators */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">Sector match</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">Stage aligned</span>
                </div>
              </div>
            </div>
          </div>

          {/* Processing indicator */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-slate-300 text-sm">Processing in real-time</span>
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-cyan-400 font-bold text-sm">&lt;2s</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid - Mobile Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Left side - Benefits */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Stats */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Why Startups Choose [pyth] ai</h3>
              <div className="space-y-4">
                {[
                  { icon: <Target className="w-5 h-5" />, title: 'Pre-Qualified Investors', desc: 'Only see investors who fund your sector & stage', color: 'cyan' },
                  { icon: <Zap className="w-5 h-5" />, title: 'Skip Cold Outreach', desc: 'No more 97% rejection rate on cold emails', color: 'blue' },
                  { icon: <Brain className="w-5 h-5" />, title: 'GOD Score™ Analysis', desc: 'See how VCs will evaluate your startup', color: 'indigo' },
                  { icon: <TrendingUp className="w-5 h-5" />, title: 'Real-Time Matching', desc: '3,200+ active investors in our database', color: 'violet' },
                ].map((item, idx) => {
                  const colorClasses = getColorClasses(item.color);
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${colorClasses.bg} ${colorClasses.text}`}>
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-sm">{item.title}</h4>
                        <p className="text-slate-500 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Success Story */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-1 mb-3">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-blue-400" />
                ))}
              </div>
              <p className="text-white italic mb-3">
                "We got 12 investor meetings in our first week on [pyth] ai. The GOD Score helped us understand exactly what VCs were looking for."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                  AK
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Alex Kumar</div>
                  <div className="text-slate-500 text-xs">Founder, DataSync (YC W24)</div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">3,400+</div>
                <div className="text-xs text-slate-500">Startups Matched</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">89%</div>
                <div className="text-xs text-slate-500">Match Accuracy</div>
              </div>
            </div>
          </div>

          {/* Right side - Sign Up Form - Mobile Responsive */}
          <div className="lg:col-span-3">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 sm:p-6 md:p-8">
              {/* Progress Steps - Mobile Responsive */}
              <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2 overflow-x-auto pb-2">
                {[
                  { id: 'info', label: 'Your Startup', num: 1 },
                  { id: 'details', label: 'Details', num: 2 },
                  { id: 'pitch', label: 'Your Pitch', num: 3 },
                ].map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <button
                      onClick={() => setStep(s.id as any)}
                      className={`flex items-center gap-2 ${
                        step === s.id 
                          ? 'text-white' 
                          : s.num < (step === 'info' ? 1 : step === 'details' ? 2 : 3)
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        step === s.id 
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' 
                          : s.num < (step === 'info' ? 1 : step === 'details' ? 2 : 3)
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700 text-slate-500'
                      }`}>
                        {s.num < (step === 'info' ? 1 : step === 'details' ? 2 : 3) 
                          ? <CheckCircle2 className="w-4 h-4" />
                          : s.num
                        }
                      </div>
                      <span className="hidden sm:block text-sm font-medium">{s.label}</span>
                    </button>
                    {idx < 2 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        s.num < (step === 'info' ? 1 : step === 'details' ? 2 : 3)
                          ? 'bg-emerald-500/50'
                          : 'bg-slate-700'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Step 1: Basic Info */}
              {step === 'info' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Tell us about your startup</h2>
                    <p className="text-slate-400">We'll use this to find your perfect investor matches.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Startup Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Acme Inc"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">One-Line Tagline *</label>
                    <input
                      type="text"
                      value={formData.tagline}
                      onChange={e => setFormData({...formData, tagline: e.target.value})}
                      placeholder="AI-powered analytics for e-commerce"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1">Keep it short and punchy</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={e => setFormData({...formData, website: e.target.value})}
                      placeholder="https://acme.com"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Your Name *</label>
                      <input
                        type="text"
                        value={formData.founderName}
                        onChange={e => setFormData({...formData, founderName: e.target.value})}
                        placeholder="Jane Smith"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
                      <input
                        type="email"
                        value={formData.founderEmail}
                        onChange={e => setFormData({...formData, founderEmail: e.target.value})}
                        placeholder="jane@acme.com"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setStep('details')}
                    disabled={!formData.name || !formData.tagline || !formData.founderName || !formData.founderEmail}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black text-lg hover:from-orange-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-orange-500/50"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Step 2: Details */}
              {step === 'details' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Company Details</h2>
                    <p className="text-slate-400">Help us match you with the right investors.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Sectors (pick up to 3) *</label>
                    <div className="flex flex-wrap gap-2">
                      {sectors.map(sector => (
                        <button
                          key={sector}
                          onClick={() => handleSectorToggle(sector)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            formData.sectors.includes(sector)
                              ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300'
                              : 'bg-slate-900/50 border border-slate-600 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {sector}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Funding Stage *</label>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {stages.map(stage => (
                        <button
                          key={stage}
                          onClick={() => setFormData({...formData, stage})}
                          className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            formData.stage === stage
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={e => setFormData({...formData, location: e.target.value})}
                        placeholder="San Francisco, CA"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Team Size</label>
                      <select
                        value={formData.teamSize}
                        onChange={e => setFormData({...formData, teamSize: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                      >
                        <option value="">Select size</option>
                        {teamSizes.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('info')}
                      className="px-6 py-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep('pitch')}
                      disabled={formData.sectors.length === 0 || !formData.stage}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black text-lg hover:from-orange-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-orange-500/50"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Pitch */}
              {step === 'pitch' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Your Pitch</h2>
                    <p className="text-slate-400">Tell investors what makes you special.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">What do you do? *</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Describe your product, target market, and what problem you solve..."
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">How much are you raising?</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          value={formData.raiseAmount}
                          onChange={e => setFormData({...formData, raiseAmount: e.target.value})}
                          placeholder="2M"
                          className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Use of Funds</label>
                      <input
                        type="text"
                        value={formData.useOfFunds}
                        onChange={e => setFormData({...formData, useOfFunds: e.target.value})}
                        placeholder="Product, Engineering, Sales"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('details')}
                      className="px-6 py-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !formData.description}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-black font-black text-lg hover:from-orange-400 hover:via-amber-400 hover:to-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-2xl shadow-orange-500/60"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          Finding Matches...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Get Matched Now
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-center text-slate-500 text-xs">
                    By submitting, you agree to our <Link to="/privacy" className="text-cyan-400 hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-cyan-400 hover:underline">Privacy Policy</Link>
                  </p>
                </div>
              )}

              {/* Pricing Link & Account Login */}
              <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
                <div className="text-center">
                  <Link 
                    to="/pricing" 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 hover:border-orange-400/60 rounded-xl text-orange-300 hover:text-orange-200 font-medium transition-all text-sm"
                  >
                    <DollarSign className="w-4 h-4" />
                    View Pricing & Plans
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <p className="text-slate-400 text-center text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 container mx-auto px-4 py-8 mt-16 border-t border-slate-800/50">
        <div className="text-center">
          <p className="text-sm text-slate-500 italic max-w-2xl mx-auto">
            Pythh reads investor signals so founders don't have to guess.
          </p>
        </div>
      </div>
    </div>
  );
}
