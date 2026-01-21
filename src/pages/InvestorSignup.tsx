import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  Zap, 
  Target, 
  TrendingUp, 
  Shield, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  Brain,
  Filter,
  Bell,
  BarChart3,
  Users,
  Globe,
  Clock,
  Star,
  ChevronRight,
  Mail,
  Building2,
  DollarSign,
  Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function InvestorSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'info' | 'profile' | 'preferences'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: '',
    email: '',
    firm: '',
    title: '',
    linkedinUrl: '',
    
    // Step 2: Profile
    investorType: '' as 'VC' | 'Angel' | 'Family Office' | 'Corporate VC' | 'Accelerator' | '',
    checkSizeMin: '',
    checkSizeMax: '',
    aum: '',
    
    // Step 3: Preferences
    sectors: [] as string[],
    stages: [] as string[],
    geography: [] as string[],
    dealFlowPreference: 'curated' as 'curated' | 'all' | 'hot-only',
  });

  const sectors = [
    'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'E-Commerce', 'CleanTech', 
    'Cybersecurity', 'EdTech', 'Robotics', 'Developer Tools', 'Consumer',
    'Biotech', 'SpaceTech', 'Gaming', 'Web3/Crypto', 'Marketplace'
  ];

  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Growth'];
  
  const geographies = ['US - West Coast', 'US - East Coast', 'US - Other', 'Europe', 'Asia', 'LATAM', 'Global'];

  const handleSectorToggle = (sector: string) => {
    setFormData(prev => ({
      ...prev,
      sectors: prev.sectors.includes(sector)
        ? prev.sectors.filter(s => s !== sector)
        : [...prev.sectors, sector]
    }));
  };

  const handleStageToggle = (stage: string) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.includes(stage)
        ? prev.stages.filter(s => s !== stage)
        : [...prev.stages, stage]
    }));
  };

  const handleGeoToggle = (geo: string) => {
    setFormData(prev => ({
      ...prev,
      geography: prev.geography.includes(geo)
        ? prev.geography.filter(g => g !== geo)
        : [...prev.geography, geo]
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Insert into investors table
      const { data, error: insertError } = await supabase
        .from('investors')
        .insert({
          name: formData.name,
          email: formData.email,
          firm: formData.firm,
          title: formData.title,
          linkedin_url: formData.linkedinUrl,
          type: formData.investorType,
          check_size_min: formData.checkSizeMin ? parseInt(formData.checkSizeMin) * 1000 : null,
          check_size_max: formData.checkSizeMax ? parseInt(formData.checkSizeMax) * 1000 : null,
          aum: formData.aum ? parseInt(formData.aum) * 1000000 : null,
          sectors: formData.sectors,
          stage: formData.stages,
          geography_focus: formData.geography.join(', '),
          source: 'investor_signup',
          status: 'pending_review',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Navigate to matching engine
      navigate('/match', { state: { newInvestor: true, investorId: data?.id } });
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-purple-500/5 to-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Home
          </Link>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-6">
            <Briefcase className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-sm font-bold tracking-wide">FOR INVESTORS</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Intelligence Layer</span> for Early-Stage Discovery
          </h1>
          
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-2">
            Everyone sees the surface.
          </p>
          <p className="text-2xl font-semibold text-white max-w-2xl mx-auto">
            You see the patterns.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left side - Value Props */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Platform Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: '3,400+', label: 'Startups', icon: '🚀' },
                  { value: '89%', label: 'Match Accuracy', icon: '🎯' },
                  { value: '<2s', label: 'Match Speed', icon: '⚡' },
                  { value: '100+', label: 'Data Sources', icon: '📡' },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center p-3 bg-slate-900/50 rounded-xl">
                    <div className="text-xl mb-1">{stat.icon}</div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* What You Get */}
            <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">What You Get</h3>
              <div className="space-y-4">
                {[
                  {
                    icon: <Brain className="w-5 h-5" />,
                    title: 'Pattern Recognition at Scale',
                    desc: 'See signals forming before they become obvious to the market',
                    color: 'cyan'
                  },
                  {
                    icon: <Filter className="w-5 h-5" />,
                    title: 'Your Personal Observatory',
                    desc: 'Track how discovery is forming around your investment thesis',
                    color: 'purple'
                  },
                  {
                    icon: <BarChart3 className="w-5 h-5" />,
                    title: 'Intelligence Without Noise',
                    desc: 'Anonymized insights that surface trends, not individual pitches',
                    color: 'cyan'
                  },
                  {
                    icon: <Bell className="w-5 h-5" />,
                    title: 'Timing Signals',
                    desc: 'Know when sectors align with your mandate before the crowd',
                    color: 'green'
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div 
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{
                        backgroundColor: item.color === 'cyan' ? 'rgba(6, 182, 212, 0.2)' :
                                        item.color === 'cyan' ? 'rgba(6, 182, 212, 0.2)' :
                                        item.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                                        'rgba(34, 197, 94, 0.2)',
                        color: item.color === 'cyan' ? '#06b6d4' :
                               item.color === 'cyan' ? '#06b6d4' :
                               item.color === 'purple' ? '#a855f7' :
                               '#22c55e'
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{item.title}</h4>
                      <p className="text-gray-500 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-1 mb-3">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-white italic mb-3">
                "[pyth] ai cut my deal sourcing time by 70%. The GOD Score actually predicts which founders will execute."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                  JK
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Jason Kim</div>
                  <div className="text-gray-500 text-xs">Partner, Horizon Ventures</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Sign Up Form */}
          <div className="lg:col-span-3">
            <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-8">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-8">
                {[
                  { id: 'info', label: 'Your Info', num: 1 },
                  { id: 'profile', label: 'Investment Profile', num: 2 },
                  { id: 'preferences', label: 'Preferences', num: 3 },
                ].map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <button
                      onClick={() => setStep(s.id as any)}
                      className={`flex items-center gap-2 ${
                        step === s.id 
                          ? 'text-white' 
                          : s.num < (step === 'info' ? 1 : step === 'profile' ? 2 : 3)
                            ? 'text-green-400'
                            : 'text-gray-500'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        step === s.id 
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                          : s.num < (step === 'info' ? 1 : step === 'profile' ? 2 : 3)
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-slate-700 text-gray-500'
                      }`}>
                        {s.num < (step === 'info' ? 1 : step === 'profile' ? 2 : 3) 
                          ? <CheckCircle2 className="w-4 h-4" />
                          : s.num
                        }
                      </div>
                      <span className="hidden sm:block text-sm font-medium">{s.label}</span>
                    </button>
                    {idx < 2 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        s.num < (step === 'info' ? 1 : step === 'profile' ? 2 : 3)
                          ? 'bg-green-500/50'
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
                    <h2 className="text-2xl font-bold text-white mb-2">Let's get started</h2>
                    <p className="text-gray-400">Tell us about yourself so we can personalize your deal flow.</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Jane Smith"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="jane@horizonvc.com"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Firm / Organization</label>
                      <input
                        type="text"
                        value={formData.firm}
                        onChange={e => setFormData({...formData, firm: e.target.value})}
                        placeholder="Horizon Ventures"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        placeholder="Partner"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">LinkedIn URL</label>
                    <input
                      type="url"
                      value={formData.linkedinUrl}
                      onChange={e => setFormData({...formData, linkedinUrl: e.target.value})}
                      placeholder="https://linkedin.com/in/janesmith"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                    />
                  </div>

                  <button
                    onClick={() => setStep('profile')}
                    disabled={!formData.name || !formData.email}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold text-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Step 2: Investment Profile */}
              {step === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Investment Profile</h2>
                    <p className="text-gray-400">Help us understand your investment criteria.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Investor Type *</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['VC', 'Angel', 'Family Office', 'Corporate VC', 'Accelerator'].map(type => (
                        <button
                          key={type}
                          onClick={() => setFormData({...formData, investorType: type as any})}
                          className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                            formData.investorType === type
                              ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                              : 'bg-slate-900/50 border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Min Check Size ($K)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="number"
                          value={formData.checkSizeMin}
                          onChange={e => setFormData({...formData, checkSizeMin: e.target.value})}
                          placeholder="50"
                          className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">e.g., 50 = $50,000</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Max Check Size ($K)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="number"
                          value={formData.checkSizeMax}
                          onChange={e => setFormData({...formData, checkSizeMax: e.target.value})}
                          placeholder="500"
                          className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">e.g., 500 = $500,000</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">AUM / Fund Size ($M)</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="number"
                        value={formData.aum}
                        onChange={e => setFormData({...formData, aum: e.target.value})}
                        placeholder="100"
                        className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">e.g., 100 = $100M fund</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('info')}
                      className="px-6 py-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep('preferences')}
                      disabled={!formData.investorType}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold text-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Preferences */}
              {step === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Investment Preferences</h2>
                    <p className="text-gray-400">Select all that apply. We'll match you with relevant startups.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Sectors of Interest</label>
                    <div className="flex flex-wrap gap-2">
                      {sectors.map(sector => (
                        <button
                          key={sector}
                          onClick={() => handleSectorToggle(sector)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            formData.sectors.includes(sector)
                              ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300'
                              : 'bg-slate-900/50 border border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                        >
                          {sector}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Investment Stages</label>
                    <div className="flex flex-wrap gap-2">
                      {stages.map(stage => (
                        <button
                          key={stage}
                          onClick={() => handleStageToggle(stage)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            formData.stages.includes(stage)
                              ? 'bg-blue-500/20 border border-blue-500 text-blue-300'
                              : 'bg-slate-900/50 border border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                        >
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Geographic Focus</label>
                    <div className="flex flex-wrap gap-2">
                      {geographies.map(geo => (
                        <button
                          key={geo}
                          onClick={() => handleGeoToggle(geo)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            formData.geography.includes(geo)
                              ? 'bg-purple-500/20 border border-purple-500 text-purple-300'
                              : 'bg-slate-900/50 border border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                        >
                          {geo}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Deal Flow Preference</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'curated', label: 'Curated', desc: 'Best matches only' },
                        { id: 'all', label: 'All Matches', desc: 'See everything' },
                        { id: 'hot-only', label: 'Hot Only', desc: 'GOD Score 80+' },
                      ].map(pref => (
                        <button
                          key={pref.id}
                          onClick={() => setFormData({...formData, dealFlowPreference: pref.id as any})}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            formData.dealFlowPreference === pref.id
                              ? 'bg-green-500/20 border-green-500 text-green-300'
                              : 'bg-slate-900/50 border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                        >
                          <div className="font-semibold text-sm">{pref.label}</div>
                          <div className="text-xs opacity-70">{pref.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('profile')}
                      className="px-6 py-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || formData.sectors.length === 0 || formData.stages.length === 0}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 text-white font-bold text-lg hover:from-cyan-500 hover:via-blue-500 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating Profile...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Start Matching
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-center text-gray-500 text-xs">
                    By signing up, you agree to our Terms of Service and Privacy Policy
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 container mx-auto px-4 py-8 mt-16 border-t border-slate-800/50">
        <div className="text-center">
          <p className="text-sm text-gray-500 italic max-w-2xl mx-auto">
            Pythh reads investor signals so founders don't have to guess.
          </p>
        </div>
      </div>
    </div>
  );
}

