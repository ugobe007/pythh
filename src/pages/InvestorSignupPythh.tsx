/**
 * INVESTOR SIGNUP PAGE (Pythh Style)
 * Growth experiment: short_form (1 step) vs thesis_deep (2 steps)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PythhTopNav from '../components/PythhTopNav';
import {
  fetchGrowthAssignment,
  trackGrowthEvent,
  type GrowthAssignment,
} from '../lib/growthExperiment';

const CHECK_SIZE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: '25-100', label: '$25K – $100K', min: 25_000, max: 100_000 },
  { key: '100-500', label: '$100K – $500K', min: 100_000, max: 500_000 },
  { key: '500-2000', label: '$500K – $2M', min: 500_000, max: 2_000_000 },
  { key: '2000+', label: '$2M+', min: 2_000_000, max: 10_000_000 },
];

function bandToCheckSize(bandKey: string) {
  const band = CHECK_SIZE_BANDS.find((b) => b.key === bandKey);
  return band ? { min: band.min, max: band.max } : { min: null, max: null };
}

export default function InvestorSignupPythh() {
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<GrowthAssignment | null>(null);
  const variantKey = assignment?.variant_key ?? 'thesis_deep';
  const isShortForm = variantKey === 'short_form';
  const reviewGate = Boolean(
    (assignment?.schema as { review_gate?: boolean } | undefined)?.review_gate,
  );
  const copy = (assignment?.copy ?? {}) as { headline?: string; cta?: string };

  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    firm: '',
    title: '',
    investorType: '' as 'VC' | 'Angel' | 'Family Office' | 'Corporate VC' | 'Accelerator' | '',
    checkSizeMin: '',
    checkSizeMax: '',
    checkSizeBand: '',
    sectors: [] as string[],
    stages: [] as string[],
    geography: [] as string[],
    investmentThesis: '',
  });

  useEffect(() => {
    let cancelled = false;
    void fetchGrowthAssignment('investor').then((a) => {
      if (cancelled || !a) return;
      setAssignment(a);
      void trackGrowthEvent(a, 'investor_signup_started');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sectors = [
    'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech',
    'Cybersecurity', 'EdTech', 'Developer Tools', 'Consumer', 'Marketplace',
  ];
  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  const geographies = ['US West', 'US East', 'Europe', 'Asia', 'Global'];

  const totalSteps = isShortForm ? 1 : 2;
  const headline = copy.headline || (isShortForm ? 'Join the Pythh investor network' : 'Create investor account');
  const submitLabel = copy.cta || (isShortForm ? 'Request access' : 'Create account');

  const handleToggle = (field: 'sectors' | 'stages' | 'geography', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const goToStep2 = () => {
    if (assignment) void trackGrowthEvent(assignment, 'investor_profile_step_2');
    setStep(2);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      let checkMin: number | null = null;
      let checkMax: number | null = null;

      if (isShortForm && formData.checkSizeBand) {
        const band = bandToCheckSize(formData.checkSizeBand);
        checkMin = band.min;
        checkMax = band.max;
      } else {
        checkMin = formData.checkSizeMin ? parseInt(formData.checkSizeMin, 10) * 1000 : null;
        checkMax = formData.checkSizeMax ? parseInt(formData.checkSizeMax, 10) * 1000 : null;
      }

      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        firm: formData.firm || null,
        title: isShortForm ? null : formData.title || null,
        type: isShortForm ? 'VC' : formData.investorType || null,
        check_size_min: checkMin,
        check_size_max: checkMax,
        sectors: formData.sectors,
        stage: isShortForm ? [] : formData.stages,
        geography_focus: isShortForm ? null : formData.geography.join(', ') || null,
        investment_thesis: formData.investmentThesis || null,
        status: 'pending_review',
        created_at: new Date().toISOString(),
      };

      const { data, error: insertError } = await supabase
        .from('investors')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      if (assignment) {
        await trackGrowthEvent(assignment, 'investor_signup_completed', {
          investor_id: data?.id,
          review_gate: reviewGate,
        });
      }

      navigate('/investor/dashboard', { state: { newInvestor: true, investorId: data?.id } });
    } catch (err: unknown) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepGuide: Record<1 | 2, { heading: string; intro: string; items: { title: string; detail: string }[] }> = {
    1: {
      heading: 'The Observatory',
      intro: 'Your investor profile powers AI-driven deal flow — startups matched to your thesis, not the other way around.',
      items: [
        { title: 'Signal-matched deal flow', detail: 'Startups ranked by alignment to your investment thesis, stage, and sector preferences.' },
        { title: 'GOD score analytics', detail: 'Every startup evaluated across 22+ models — team, traction, market, product, vision.' },
        { title: 'Private by default', detail: 'Your profile is visible only to matched startups. No cold outreach from unqualified founders.' },
      ],
    },
    2: {
      heading: 'How matching works',
      intro: 'Your investment profile feeds matching layers that narrow thousands of startups to your highest-signal opportunities.',
      items: [
        { title: 'Thesis alignment', detail: 'Sector and stage filters eliminate noise. Only startups within your mandate surface.' },
        { title: 'Check size calibration', detail: 'Startups see your range only if their raise falls within it.' },
        { title: 'Semantic scoring', detail: 'Embedding similarity compares your thesis against each startup\'s positioning.' },
      ],
    },
  };

  const guide = stepGuide[step];

  const stepLabel = isShortForm
    ? 'Quick intake'
    : step === 1
      ? 'Basic info & profile'
      : 'Thesis & preferences';

  return (
    <div className="min-h-screen bg-[#090909]">
      <PythhTopNav showSignup={false} />

      <div className="min-h-[calc(100vh-65px)] flex">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-6 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>

            <div className="mb-4">
              <h1 className="text-xl font-semibold text-white mb-1">{headline}</h1>
              <p className="text-sm text-zinc-500">
                Step {step} of {totalSteps} — {stepLabel}
              </p>
            </div>

            <div className="flex gap-1.5 mb-6">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    s <= step ? 'bg-emerald-500' : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                {error}
              </div>
            )}

            {/* SHORT FORM — single step */}
            {isShortForm && (
              <div className="space-y-4">
                <Field label="Full name *" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder="Jane Smith" />
                <Field label="Email *" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder="jane@firm.com" type="email" />
                <Field label="Firm *" value={formData.firm} onChange={(v) => setFormData({ ...formData, firm: v })} placeholder="Acme Ventures" />

                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Typical check size *</label>
                  <select
                    value={formData.checkSizeBand}
                    onChange={(e) => setFormData({ ...formData, checkSizeBand: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm focus:border-zinc-600 focus:outline-none"
                  >
                    <option value="">Select range</option>
                    {CHECK_SIZE_BANDS.map((b) => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </select>
                </div>

                <ChipGroup label="Sectors *" options={sectors} selected={formData.sectors} onToggle={(v) => handleToggle('sectors', v)} />

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.name || !formData.email || !formData.firm || !formData.checkSizeBand || formData.sectors.length === 0}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting…' : submitLabel}
                </button>
              </div>
            )}

            {/* DEEP FORM — step 1 */}
            {!isShortForm && step === 1 && (
              <div className="space-y-4">
                <Field label="Full name *" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder="Jane Smith" />
                <Field label="Email *" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder="jane@firm.com" type="email" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Firm" value={formData.firm} onChange={(v) => setFormData({ ...formData, firm: v })} placeholder="Acme Ventures" />
                  <Field label="Title" value={formData.title} onChange={(v) => setFormData({ ...formData, title: v })} placeholder="Partner" />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Investor type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['VC', 'Angel', 'Family Office', 'Corporate VC', 'Accelerator'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, investorType: type as typeof formData.investorType })}
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
                  <Field label="Min check ($K)" value={formData.checkSizeMin} onChange={(v) => setFormData({ ...formData, checkSizeMin: v })} placeholder="50" type="number" />
                  <Field label="Max check ($K)" value={formData.checkSizeMax} onChange={(v) => setFormData({ ...formData, checkSizeMax: v })} placeholder="500" type="number" />
                </div>

                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!formData.name || !formData.email || !formData.investorType}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* DEEP FORM — step 2 */}
            {!isShortForm && step === 2 && (
              <div className="space-y-4">
                <ChipGroup label="Sectors *" options={sectors} selected={formData.sectors} onToggle={(v) => handleToggle('sectors', v)} />
                <ChipGroup label="Stages *" options={stages} selected={formData.stages} onToggle={(v) => handleToggle('stages', v)} />
                <ChipGroup label="Geography" options={geographies} selected={formData.geography} onToggle={(v) => handleToggle('geography', v)} />

                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Investment thesis</label>
                  <textarea
                    value={formData.investmentThesis}
                    onChange={(e) => setFormData({ ...formData, investmentThesis: e.target.value })}
                    placeholder="What you invest in, what you avoid, and what makes you say yes…"
                    rows={4}
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none resize-none"
                  />
                </div>

                {reviewGate && (
                  <p className="text-xs text-zinc-500 border border-zinc-800 rounded-md px-3 py-2">
                    Profiles are reviewed before dealflow goes live — usually within 1 business day.
                  </p>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || formData.sectors.length === 0 || formData.stages.length === 0}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating…' : submitLabel}
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

        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0c0c0c] border-l border-zinc-800/40 p-12">
          <div className="max-w-sm space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                {guide.heading}
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">{guide.intro}</p>
            </div>
            <div className="space-y-5">
              {guide.items.map((item, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm text-zinc-300">{item.title}</p>
                  <p className="text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-zinc-500 text-xs mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
      />
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-zinc-500 text-xs mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              selected.includes(option)
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {selected.includes(option) && <Check className="w-3 h-3 inline mr-1" />}
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
