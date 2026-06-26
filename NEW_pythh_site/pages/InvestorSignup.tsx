/**
 * /signup/investor — investor intake with growth experiment variants.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import SharedNavbar from '@/components/SharedNavbar';
import { apiUrl } from '@/lib/apiConfig';
import {
  fetchGrowthAssignment,
  trackGrowthEvent,
  type GrowthAssignment,
} from '@/lib/growthExperiment';
import { INVESTOR_SIGNUP_SECTORS } from '@/lib/investorSignupSectors';
import {
  clearInvestorSignupDraft,
  isResumeSignupUrl,
  readInvestorSignupDraft,
  saveInvestorSignupDraft,
  type InvestorSignupDraft,
} from '@/lib/investorSignupDraft';
import { bindInvestorPortfolioOwner } from '@/lib/investorSession';

const CHECK_SIZE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: '25-100', label: '$25K – $100K', min: 25_000, max: 100_000 },
  { key: '100-500', label: '$100K – $500K', min: 100_000, max: 500_000 },
  { key: '500-2000', label: '$500K – $2M', min: 500_000, max: 2_000_000 },
  { key: '2000+', label: '$2M+', min: 2_000_000, max: 10_000_000 },
];

const FALLBACK_INVESTOR_ASSIGNMENT: GrowthAssignment = {
  experiment_id: 'investor_signup_schema',
  variant_key: 'short_form_email_first',
  audience: 'investor',
  schema: { profile_enrichment: true },
  copy: {},
};

function bandToCheckSize(bandKey: string) {
  const band = CHECK_SIZE_BANDS.find((b) => b.key === bandKey);
  return band ? { min: band.min, max: band.max } : { min: null, max: null };
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Investor';
  const cleaned = local.replace(/[.+_-]+/g, ' ').trim();
  if (!cleaned) return 'Investor';
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function InvestorSignup() {
  const [, navigate] = useLocation();
  const [resumeDraft] = useState<InvestorSignupDraft | null>(() =>
    isResumeSignupUrl() ? readInvestorSignupDraft() : null,
  );
  const isResumeMode = Boolean(resumeDraft);
  const [assignment, setAssignment] = useState<GrowthAssignment | null>(null);
  const startedRef = useRef(false);
  const variantKey = assignment?.variant_key ?? 'short_form_email_first';
  const isEmailFirst = !isResumeMode && variantKey === 'short_form_email_first';
  const isShortForm = !isResumeMode && variantKey === 'short_form';
  const reviewGate = Boolean(
    (assignment?.schema as { review_gate?: boolean } | undefined)?.review_gate,
  );
  const copy = (assignment?.copy ?? {}) as { headline?: string; subline?: string; cta?: string };

  const [step, setStep] = useState<1 | 2>(() => (isResumeSignupUrl() && readInvestorSignupDraft() ? 1 : 1));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState(() => {
    const draft = isResumeSignupUrl() ? readInvestorSignupDraft() : null;
    return {
      name: draft?.name || (draft?.email ? nameFromEmail(draft.email) : ''),
      email: draft?.email || '',
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
    };
  });

  useEffect(() => {
    if (isResumeSignupUrl() && !readInvestorSignupDraft()) {
      setError('Profile session not found. Enter your email again to continue.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchGrowthAssignment('investor').then((a) => {
      if (cancelled) return;
      setAssignment(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveAssignment = async (): Promise<GrowthAssignment> => {
    if (assignment) return assignment;
    const fetched = await fetchGrowthAssignment('investor');
    if (fetched) {
      setAssignment(fetched);
      return fetched;
    }
    return FALLBACK_INVESTOR_ASSIGNMENT;
  };

  const trackInvestorStarted = async () => {
    if (startedRef.current || isResumeMode) return;
    startedRef.current = true;
    const resolved = await resolveAssignment();
    await trackGrowthEvent(resolved, 'investor_signup_started', { intent: 'form_action' });
  };

  const trackInvestorCompleted = async (payload: Record<string, unknown>) => {
    const resolved = await resolveAssignment();
    await trackGrowthEvent(resolved, 'investor_signup_completed', payload);
  };

  const sectors = [...INVESTOR_SIGNUP_SECTORS];
  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  const geographies = ['US West', 'US East', 'Europe', 'Asia', 'Global'];

  const totalSteps = isResumeMode || isEmailFirst || isShortForm ? 1 : 2;
  const headline = isResumeMode
    ? 'Complete your investor profile'
    : copy.headline || (isEmailFirst
      ? 'Automate dealflow — track your top 10 picks'
      : isShortForm
        ? 'Join the Pythh investor network'
        : 'Automate dealflow — track your top 10 picks');
  const subline = isResumeMode
    ? (formData.email ? `Finishing setup for ${formData.email}` : 'Add firm, sectors, and check size.')
    : copy.subline || (isEmailFirst ? 'One field now — pick startups and track GOD signals over time.' : null);
  const submitLabel = isResumeMode
    ? 'Save profile'
    : copy.cta || (isEmailFirst ? 'Get access' : isShortForm ? 'Request access' : 'Create account');

  const handleToggle = (field: 'sectors' | 'stages' | 'geography', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const goToStep2 = async () => {
    await trackInvestorStarted();
    const resolved = await resolveAssignment();
    void trackGrowthEvent(resolved, 'investor_profile_step_2');
    setStep(2);
  };

  const submitInvestorSignup = async (payload: Record<string, unknown>) => {
    const res = await fetch(apiUrl('/api/investors/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      investor_id?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || 'Failed to create account. Please try again.');
    }
    return json;
  };

  const updateInvestorProfile = async (payload: Record<string, unknown>) => {
    if (!resumeDraft?.investor_id) {
      throw new Error('Session expired. Please start again from the completion page.');
    }
    const res = await fetch(apiUrl(`/api/investors/signup/${resumeDraft.investor_id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      investor_id?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || 'Failed to update profile. Please try again.');
    }
    return json;
  };

  const buildProfilePayload = () => {
    let checkMin: number | null = null;
    let checkMax: number | null = null;

    if ((isShortForm || isResumeMode) && formData.checkSizeBand) {
      const band = bandToCheckSize(formData.checkSizeBand);
      checkMin = band.min;
      checkMax = band.max;
    } else {
      checkMin = formData.checkSizeMin ? parseInt(formData.checkSizeMin, 10) * 1000 : null;
      checkMax = formData.checkSizeMax ? parseInt(formData.checkSizeMax, 10) * 1000 : null;
    }

    return {
      name: formData.name,
      email: formData.email,
      firm: formData.firm || null,
      title: isShortForm || isResumeMode ? null : formData.title || null,
      type: isShortForm || isResumeMode ? 'VC' : formData.investorType || null,
      check_size_min: checkMin,
      check_size_max: checkMax,
      sectors: formData.sectors,
      stage: isShortForm || isResumeMode ? [] : formData.stages,
      geography: isShortForm || isResumeMode ? [] : formData.geography,
      investment_thesis: formData.investmentThesis || null,
    };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      if (isEmailFirst) {
        await trackInvestorStarted();
        const displayName = nameFromEmail(formData.email);
        const result = await submitInvestorSignup({
          name: displayName,
          email: formData.email,
          firm: null,
          title: null,
          type: 'VC',
          check_size_min: null,
          check_size_max: null,
          sectors: [],
          stage: [],
          geography_focus: null,
          investment_thesis: null,
        });

        await trackInvestorCompleted({
          investor_id: result.investor_id,
          email_first: true,
          profile_incomplete: true,
        });

        if (result.investor_id) {
          bindInvestorPortfolioOwner(result.investor_id);
          saveInvestorSignupDraft({
            investor_id: result.investor_id,
            email: formData.email,
            name: displayName,
          });
        }

        navigate('/signup/investor/complete?profile=incomplete');
        return;
      }

      if (isResumeMode) {
        const result = await updateInvestorProfile(buildProfilePayload());

        await trackInvestorCompleted({
          investor_id: result.investor_id,
          profile_completed: true,
          resumed: true,
        });

        if (result.investor_id) bindInvestorPortfolioOwner(result.investor_id);

        clearInvestorSignupDraft();
        navigate('/signup/investor/complete');
        return;
      }

      await trackInvestorStarted();

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

      const result = await submitInvestorSignup({
        name: formData.name,
        email: formData.email,
        firm: formData.firm || null,
        title: isShortForm ? null : formData.title || null,
        type: isShortForm ? 'VC' : formData.investorType || null,
        check_size_min: checkMin,
        check_size_max: checkMax,
        sectors: formData.sectors,
        stage: isShortForm ? [] : formData.stages,
        geography: isShortForm ? [] : formData.geography,
        investment_thesis: formData.investmentThesis || null,
      });

      await trackInvestorCompleted({
        investor_id: result.investor_id,
        review_gate: reviewGate,
      });

      if (result.investor_id) bindInvestorPortfolioOwner(result.investor_id);

      navigate('/signup/investor/complete');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909]">
      <Helmet>
        <title>Investor signup — Pythh.ai</title>
      </Helmet>
      <SharedNavbar />

      <div className="min-h-[calc(100vh-65px)] flex pt-16">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Link href="/">
              <a className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-6">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </a>
            </Link>

            <div className="mb-4">
              <h1 className="text-xl font-semibold text-white mb-1">{headline}</h1>
              {subline && <p className="text-sm text-zinc-400 mb-1">{subline}</p>}
              <p className="text-sm text-zinc-500">
                Step {step} of {totalSteps}
              </p>
            </div>

            <div className="flex gap-1.5 mb-6">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={`h-0.5 flex-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                />
              ))}
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                {error}
              </div>
            )}

            {isResumeMode && (
              <div className="space-y-4">
                <Field label="Email" value={formData.email} onChange={() => {}} readOnly />
                <Field label="Firm *" value={formData.firm} onChange={(v) => setFormData({ ...formData, firm: v })} />
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Typical check size *</label>
                  <select
                    value={formData.checkSizeBand}
                    onChange={(e) => setFormData({ ...formData, checkSizeBand: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm"
                  >
                    <option value="">Select range</option>
                    {CHECK_SIZE_BANDS.map((b) => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <ChipGroup label="Sectors *" options={sectors} selected={formData.sectors} onToggle={(v) => handleToggle('sectors', v)} />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Under a minute — then we route thesis-fit startups to your inbox.
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.firm || !formData.checkSizeBand || formData.sectors.length === 0}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving…' : submitLabel}
                </button>
              </div>
            )}

            {isEmailFirst && (
              <div className="space-y-4">
                <Field
                  label="Work email *"
                  value={formData.email}
                  onChange={(v) => setFormData({ ...formData, email: v })}
                  type="email"
                />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  We&apos;ll ask for firm, sectors, and check size after you&apos;re in — takes under a minute.
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.email.includes('@')}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting…' : submitLabel}
                </button>
              </div>
            )}

            {isShortForm && (
              <div className="space-y-4">
                <Field label="Full name *" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} />
                <Field label="Email *" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} type="email" />
                <Field label="Firm *" value={formData.firm} onChange={(v) => setFormData({ ...formData, firm: v })} />
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Typical check size *</label>
                  <select
                    value={formData.checkSizeBand}
                    onChange={(e) => setFormData({ ...formData, checkSizeBand: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm"
                  >
                    <option value="">Select range</option>
                    {CHECK_SIZE_BANDS.map((b) => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <ChipGroup label="Sectors *" options={sectors} selected={formData.sectors} onToggle={(v) => handleToggle('sectors', v)} />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.name || !formData.email || !formData.firm || !formData.checkSizeBand || formData.sectors.length === 0}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting…' : submitLabel}
                </button>
              </div>
            )}

            {!isResumeMode && !isShortForm && !isEmailFirst && step === 1 && (
              <div className="space-y-4">
                <Field label="Full name *" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} />
                <Field
                  label="Email *"
                  value={formData.email}
                  onChange={(v) => setFormData({ ...formData, email: v })}
                  type="email"
                  readOnly={isResumeMode}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Firm" value={formData.firm} onChange={(v) => setFormData({ ...formData, firm: v })} />
                  <Field label="Title" value={formData.title} onChange={(v) => setFormData({ ...formData, title: v })} />
                </div>
                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Investor type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['VC', 'Angel', 'Family Office', 'Corporate VC', 'Accelerator'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, investorType: type as typeof formData.investorType })}
                        className={`px-3 py-2 rounded-md border text-sm ${
                          formData.investorType === type
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                            : 'border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Min check ($K)" value={formData.checkSizeMin} onChange={(v) => setFormData({ ...formData, checkSizeMin: v })} type="number" />
                  <Field label="Max check ($K)" value={formData.checkSizeMax} onChange={(v) => setFormData({ ...formData, checkSizeMax: v })} type="number" />
                </div>
                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!formData.name || !formData.email || !formData.investorType}
                  className="w-full mt-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {!isResumeMode && !isShortForm && !isEmailFirst && step === 2 && (
              <div className="space-y-4">
                <ChipGroup label="Sectors *" options={sectors} selected={formData.sectors} onToggle={(v) => handleToggle('sectors', v)} />
                <ChipGroup label="Stages *" options={stages} selected={formData.stages} onToggle={(v) => handleToggle('stages', v)} />
                <ChipGroup label="Geography" options={geographies} selected={formData.geography} onToggle={(v) => handleToggle('geography', v)} />
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Investment thesis</label>
                  <textarea
                    value={formData.investmentThesis}
                    onChange={(e) => setFormData({ ...formData, investmentThesis: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm resize-none"
                  />
                </div>
                {reviewGate && (
                  <p className="text-xs text-zinc-500 border border-zinc-800 rounded-md px-3 py-2">
                    Profiles are reviewed before dealflow goes live.
                  </p>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-2.5 border border-zinc-800 text-zinc-400 text-sm rounded-md">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || formData.sectors.length === 0 || formData.stages.length === 0}
                    className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving…' : submitLabel}
                  </button>
                </div>
              </div>
            )}

            <p className="text-center text-zinc-600 text-xs mt-8">
              Already signed up?{' '}
              <Link href="/investor/login"><a className="text-zinc-400 hover:text-white">Sign in with magic link</a></Link>
              {' · '}
              <Link href="/login"><a className="text-zinc-400 hover:text-white">Founder login</a></Link>
            </p>
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
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-zinc-500 text-xs mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        autoComplete="off"
        className={`w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm focus:outline-none ${readOnly ? 'text-zinc-500 cursor-not-allowed' : ''}`}
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
            className={`px-2.5 py-1 rounded text-xs border ${
              selected.includes(option)
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
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
