/**
 * INVESTOR SIGNUP PAGE (Pythh Style)
 * ==================================
 * Supabase-style: minimal, clean multi-step wizard
 * - Step 1: Basic Info
 * - Step 2: Investment Profile  
 * - Step 3: Preferences
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PythhTopNav from '../components/PythhTopNav';

export default function InvestorSignupPythh() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    firm: '',
    title: '',
    investorType: '' as 'VC' | 'Angel' | 'Family Office' | 'Corporate VC' | 'Accelerator' | '',
    checkSizeMin: '',
    checkSizeMax: '',
    sectors: [] as string[],
    stages: [] as string[],
    geography: [] as string[],
  });

  const sectors = [
    'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech', 
    'Cybersecurity', 'EdTech', 'Developer Tools', 'Consumer', 'Marketplace'
  ];

  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  
  const geographies = ['US West', 'US East', 'Europe', 'Asia', 'Global'];

  const handleToggle = (field: 'sectors' | 'stages' | 'geography', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('investors')
        .insert({
          name: formData.name,
          email: formData.email,
          firm: formData.firm,
          title: formData.title,
          type: formData.investorType,
          check_size_min: formData.checkSizeMin ? parseInt(formData.checkSizeMin) * 1000 : null,
          check_size_max: formData.checkSizeMax ? parseInt(formData.checkSizeMax) * 1000 : null,
          sectors: formData.sectors,
          stage: formData.stages,
          geography_focus: formData.geography.join(', '),
          source: 'investor_signup_pythh',
          status: 'pending_review',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      navigate('/investor/dashboard', { state: { newInvestor: true, investorId: data?.id } });
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step-contextual right panel content
  const stepGuide: Record<1 | 2 | 3, { heading: string; intro: string; items: { title: string; detail: string }[] }> = {
    1: {
      heading: 'The Observatory',
      intro: 'Your investor profile powers AI-driven deal flow — startups matched to your thesis, not the other way around.',
      items: [
        { title: 'Signal-matched deal flow', detail: 'Startups ranked by alignment to your investment thesis, stage, and sector preferences. Updated continuously.' },
        { title: 'GOD score analytics', detail: 'Every startup evaluated across 22+ models — team strength, traction velocity, market timing, product quality, vision clarity.' },
        { title: 'Private by default', detail: 'Your profile is visible only to matched startups. No cold outreach from unqualified founders.' },
      ],
    },
    2: {
      heading: 'How matching works',
      intro: 'Your investment profile feeds three matching layers that narrow thousands of startups to your highest-signal opportunities.',
      items: [
        { title: 'Thesis alignment', detail: 'Sector and stage filters eliminate noise. Only startups within your stated mandate surface.' },
        { title: 'Check size calibration', detail: 'Startups see your range only if their raise falls within it. No mismatched conversations.' },
        { title: 'Semantic scoring', detail: 'Embedding-based similarity compares your portfolio history and stated thesis against each startup\'s positioning.' },
      ],
    },
    3: {
      heading: 'Your preferences matter',
      intro: 'Fine-grained preferences increase match precision. The more specific you are, the higher-signal your deal flow becomes.',
      items: [
        { title: 'Sector depth', detail: 'Select all sectors you actively invest in. Multi-sector investors see cross-sector opportunities others miss.' },
        { title: 'Stage focus', detail: 'Matches are filtered to your stage range. A Series A investor won\'t see pre-seed companies.' },
        { title: 'Geography signals', detail: 'Regional preferences affect match weighting. Global investors see the full pipeline; regional investors see concentrated deal flow.' },
      ],
    },
  };

  const guide = stepGuide[step];

  return (
    <div className="min-h-screen bg-[#090909]">
      <PythhTopNav showSignup={false} />

      <div className="min-h-[calc(100vh-65px)] flex">
        {/* LEFT — Wizard */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Back link */}
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-6 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>

            {/* Header */}
            <div className="mb-4">
              <h1 className="text-xl font-semibold text-white mb-1">Create investor account</h1>
              <p className="text-sm text-zinc-500">
                Step {step} of 3 — {step === 1 ? 'Basic info' : step === 2 ? 'Investment profile' : 'Preferences'}
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 mb-6">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    s <= step ? 'bg-emerald-500' : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                {error}
              </div>
            )}

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Full name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="jane@firm.com"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1.5">Firm</label>
                    <input
                      type="text"
                      value={formData.firm}
                      onChange={e => setFormData({...formData, firm: e.target.value})}
                      placeholder="Acme Ventures"
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1.5">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder="Partner"
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.name || !formData.email}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2: Investment Profile */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Investor type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['VC', 'Angel', 'Family Office', 'Corporate VC', 'Accelerator'].map(type => (
                      <button
                        key={type}
                        onClick={() => setFormData({...formData, investorType: type as any})}
                        className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                          formData.investorType === type
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                            : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1.5">Min check ($K)</label>
                    <input
                      type="number"
                      value={formData.checkSizeMin}
                      onChange={e => setFormData({...formData, checkSizeMin: e.target.value})}
                      placeholder="50"
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1.5">Max check ($K)</label>
                    <input
                      type="number"
                      value={formData.checkSizeMax}
                      onChange={e => setFormData({...formData, checkSizeMax: e.target.value})}
                      placeholder="500"
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!formData.investorType}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preferences */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Sectors *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {sectors.map(sector => (
                      <button
                        key={sector}
                        onClick={() => handleToggle('sectors', sector)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          formData.sectors.includes(sector)
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {formData.sectors.includes(sector) && <Check className="w-3 h-3 inline mr-1" />}
                        {sector}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Stages *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map(stage => (
                      <button
                        key={stage}
                        onClick={() => handleToggle('stages', stage)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          formData.stages.includes(stage)
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {formData.stages.includes(stage) && <Check className="w-3 h-3 inline mr-1" />}
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Geography</label>
                  <div className="flex flex-wrap gap-1.5">
                    {geographies.map(geo => (
                      <button
                        key={geo}
                        onClick={() => handleToggle('geography', geo)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          formData.geography.includes(geo)
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {formData.geography.includes(geo) && <Check className="w-3 h-3 inline mr-1" />}
                        {geo}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || formData.sectors.length === 0 || formData.stages.length === 0}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating...' : 'Create account'}
                  </button>
                </div>
              </div>
            )}

            <div className="my-6 border-t border-zinc-800/60" />

            <p className="text-center text-zinc-600 text-xs">
              Already have an account?{' '}
              <Link to="/login" className="text-zinc-400 hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* RIGHT — Step-contextual instructive content */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0c0c0c] border-l border-zinc-800/40 p-12">
          <div className="max-w-sm space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                {guide.heading}
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {guide.intro}
              </p>
            </div>

            <div className="space-y-5">
              {guide.items.map((item, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm text-zinc-300">{item.title}</p>
                  <p className="text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-zinc-800/40">
              <p className="text-xs text-zinc-600">
                Profile setup takes under 2 minutes. All fields can be updated later from your dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
