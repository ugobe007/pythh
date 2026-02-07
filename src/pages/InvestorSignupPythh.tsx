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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PythhTopNav showSignup={false} />

      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-65px)]">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white mb-1">Create investor account</h1>
            <p className="text-zinc-500 text-sm">
              Step {step} of 3 — {step === 1 ? 'Basic info' : step === 2 ? 'Investment profile' : 'Preferences'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map(s => (
              <div 
                key={s} 
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-emerald-500' : 'bg-zinc-800'
                }`} 
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">Full name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="jane@firm.com"
                  className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 text-sm mb-1.5">Firm</label>
                  <input
                    type="text"
                    value={formData.firm}
                    onChange={e => setFormData({...formData, firm: e.target.value})}
                    placeholder="Acme Ventures"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-sm mb-1.5">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Partner"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
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
                <label className="block text-zinc-400 text-sm mb-2">Investor type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {['VC', 'Angel', 'Family Office', 'Corporate VC', 'Accelerator'].map(type => (
                    <button
                      key={type}
                      onClick={() => setFormData({...formData, investorType: type as any})}
                      className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                        formData.investorType === type
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
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
                  <label className="block text-zinc-400 text-sm mb-1.5">Min check ($K)</label>
                  <input
                    type="number"
                    value={formData.checkSizeMin}
                    onChange={e => setFormData({...formData, checkSizeMin: e.target.value})}
                    placeholder="50"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-sm mb-1.5">Max check ($K)</label>
                  <input
                    type="number"
                    value={formData.checkSizeMax}
                    onChange={e => setFormData({...formData, checkSizeMax: e.target.value})}
                    placeholder="500"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md transition-colors"
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
                <label className="block text-zinc-400 text-sm mb-2">Sectors *</label>
                <div className="flex flex-wrap gap-1.5">
                  {sectors.map(sector => (
                    <button
                      key={sector}
                      onClick={() => handleToggle('sectors', sector)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        formData.sectors.includes(sector)
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      {formData.sectors.includes(sector) && <Check className="w-3 h-3 inline mr-1" />}
                      {sector}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Stages *</label>
                <div className="flex flex-wrap gap-1.5">
                  {stages.map(stage => (
                    <button
                      key={stage}
                      onClick={() => handleToggle('stages', stage)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        formData.stages.includes(stage)
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      {formData.stages.includes(stage) && <Check className="w-3 h-3 inline mr-1" />}
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Geography</label>
                <div className="flex flex-wrap gap-1.5">
                  {geographies.map(geo => (
                    <button
                      key={geo}
                      onClick={() => handleToggle('geography', geo)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        formData.geography.includes(geo)
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800'
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
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md transition-colors"
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

          {/* Divider */}
          <div className="my-6 border-t border-zinc-800" />

          {/* Footer */}
          <p className="text-center text-zinc-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
