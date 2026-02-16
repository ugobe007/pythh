/**
 * SIGNUP COMPLETE PAGE
 * ====================
 * Handles post-payment account creation for paid plan signups.
 * Flow: Stripe checkout → this page → set password → profile wizard → /matches
 *
 * URL: /signup/complete?session_id=cs_xxx
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowRight, ArrowLeft, Eye, EyeOff, Check, CheckCircle, Loader2 } from 'lucide-react';
import PythhTopNav from '../components/PythhTopNav';
import { trackEvent } from '../lib/analytics';

const API_BASE = import.meta.env.VITE_API_URL || '';

type Step = 'verifying' | 'password' | 'profile' | 'startup' | 'done' | 'error';

export default function SignupComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const sessionId = searchParams.get('session_id') || '';

  const [step, setStep] = useState<Step>('verifying');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Session data from Stripe
  const [sessionData, setSessionData] = useState<{
    email: string;
    plan: string;
    customerId: string;
    subscriptionId: string;
  } | null>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: '' as 'Founder' | 'Co-Founder' | 'CEO' | 'CTO' | 'COO' | '',
    stage: '' as string,
    sectors: [] as string[],
    raising: '' as 'Not yet' | 'Actively raising' | 'Closing round' | '',
  });

  const sectors = [
    'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech',
    'Cybersecurity', 'EdTech', 'Developer Tools', 'Consumer', 'Marketplace',
  ];

  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];

  const planLabels: Record<string, string> = {
    pro: 'Pro',
    elite: 'Signal Navigator',
  };

  // Step 0: Verify the Stripe session on mount
  useEffect(() => {
    if (!sessionId) {
      setStep('error');
      setError('No session ID found. Please try the checkout again.');
      return;
    }

    async function verifySession() {
      try {
        const res = await fetch(`${API_BASE}/api/billing/verify-session?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify payment');
        }

        setSessionData(data);
        setStep('password');
      } catch (err: any) {
        console.error('[SignupComplete] Verify failed:', err);
        setError(err.message || 'Failed to verify your payment. Please contact support.');
        setStep('error');
      }
    }

    verifySession();
  }, [sessionId]);

  // Step 1: Create account with password
  const handleCreateAccount = async () => {
    if (!sessionData) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/billing/complete-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'existing_user') {
          setError('An account with this email already exists. Please log in and upgrade from the pricing page.');
          return;
        }
        throw new Error(data.error || 'Failed to create account');
      }

      // Set auth session
      if (data.accessToken && data.refreshToken) {
        await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });
      }

      // Also set localStorage auth for backward compat
      login(sessionData.email, password);

      trackEvent('paid_signup_account_created', {
        plan: sessionData.plan,
        isExistingUser: data.isExistingUser,
      });

      setStep('profile');
    } catch (err: any) {
      console.error('[SignupComplete] Account creation failed:', err);
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 → 3: Save profile, navigate to matches
  const handleFinish = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          display_name: formData.name || undefined,
          role: 'founder',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        await supabase.auth.updateUser({
          data: {
            name: formData.name,
            company: formData.company,
            founder_role: formData.role,
            stage: formData.stage,
            sectors: formData.sectors,
            raising: formData.raising,
          },
        });
      }

      setStep('done');
      // Brief pause then navigate to matches
      setTimeout(() => navigate('/matches'), 1500);
    } catch (err: any) {
      console.error('[SignupComplete] Profile update error:', err);
      // Navigate anyway — account + subscription are set up
      navigate('/matches');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = (value: string) => {
    setFormData(prev => ({
      ...prev,
      sectors: prev.sectors.includes(value)
        ? prev.sectors.filter(v => v !== value)
        : [...prev.sectors, value],
    }));
  };

  // Progress indicator
  const progressSteps = [
    { label: 'Payment', done: step !== 'verifying' && step !== 'error' },
    { label: 'Account', done: step === 'profile' || step === 'startup' || step === 'done' },
    { label: 'Profile', done: step === 'done' },
  ];

  const stepGuide: Record<string, { heading: string; intro: string; items: { title: string; detail: string }[] }> = {
    password: {
      heading: 'Payment confirmed',
      intro: `Your ${planLabels[sessionData?.plan || 'pro'] || 'Pro'} subscription is active. Set a password to secure your account.`,
      items: [
        { title: 'Instant access', detail: 'Your paid features are active immediately — no waiting period.' },
        { title: 'Full match unlocks', detail: 'All investor matches are now unlocked with detailed profiles and outreach guidance.' },
        { title: 'Cancel anytime', detail: 'Manage or cancel your subscription from your account settings.' },
      ],
    },
    profile: {
      heading: 'Almost there',
      intro: 'Your profile powers precision matching. The more we know, the higher-signal your investor recommendations become.',
      items: [
        { title: 'Name recognition', detail: "Investors see who they're matched with. A complete profile builds trust before the first conversation." },
        { title: 'Company context', detail: 'Your company name and role help the matching engine distinguish co-founders and map team strength signals.' },
        { title: 'Better deal flow', detail: 'Founders with complete profiles get 3× more investor views.' },
      ],
    },
    startup: {
      heading: 'Precision matching',
      intro: 'Stage and sector data feed directly into the matching algorithm. Investors are filtered to those actively deploying in your space.',
      items: [
        { title: 'Stage alignment', detail: "A pre-seed founder won't see growth-stage VCs. Matches are filtered to investors writing checks at your stage." },
        { title: 'Sector depth', detail: 'Sector tags map your startup against investor thesis vectors. Multi-sector startups surface cross-category opportunities.' },
        { title: 'Timing signals', detail: 'Your fundraising status affects match urgency scoring. Actively raising founders get priority in investor feeds.' },
      ],
    },
  };

  const guide = stepGuide[step] || stepGuide.password;

  return (
    <div className="min-h-screen bg-[#090909]">
      <PythhTopNav showSignup={false} />

      <div className="min-h-[calc(100vh-65px)] flex">
        {/* LEFT — Wizard */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Back link */}
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-6 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to pricing
            </Link>

            {/* Header */}
            <div className="mb-4">
              <h1 className="text-xl font-semibold text-white mb-1">
                {step === 'verifying' && 'Verifying payment...'}
                {step === 'password' && 'Set your password'}
                {step === 'profile' && 'Complete your profile'}
                {step === 'startup' && 'Your startup'}
                {step === 'done' && 'You\'re all set!'}
                {step === 'error' && 'Something went wrong'}
              </h1>
              {step !== 'verifying' && step !== 'error' && step !== 'done' && (
                <p className="text-sm text-zinc-500">
                  {step === 'password' && `Step 1 of 3 — Secure your ${planLabels[sessionData?.plan || 'pro'] || 'Pro'} account`}
                  {step === 'profile' && 'Step 2 of 3 — About you'}
                  {step === 'startup' && 'Step 3 of 3 — Your startup'}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {step !== 'verifying' && step !== 'error' && (
              <div className="flex gap-1.5 mb-6">
                {progressSteps.map((s, i) => (
                  <div
                    key={i}
                    className={`h-0.5 flex-1 rounded-full transition-colors ${
                      s.done ? 'bg-cyan-500' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Payment confirmed badge */}
            {step === 'password' && sessionData && (
              <div className="mb-4 px-3 py-2 border-l-2 border-cyan-500/60 bg-cyan-500/5">
                <p className="text-cyan-400/80 text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Payment confirmed — {planLabels[sessionData.plan] || 'Pro'} plan activated for {sessionData.email}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                {error}
              </div>
            )}

            {/* Verifying state */}
            {step === 'verifying' && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-zinc-500 text-sm">Verifying your payment...</p>
              </div>
            )}

            {/* Error state */}
            {step === 'error' && (
              <div className="space-y-4 py-8">
                <p className="text-zinc-400 text-sm">{error}</p>
                <div className="flex gap-3">
                  <Link
                    to="/pricing"
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back to pricing
                  </Link>
                  <a
                    href="mailto:support@pythh.ai"
                    className="px-4 py-2.5 border border-cyan-500/40 text-cyan-400 text-sm font-medium rounded-md transition-colors hover:bg-cyan-500/5"
                  >
                    Contact support
                  </a>
                </div>
              </div>
            )}

            {/* Done state */}
            {step === 'done' && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-zinc-300 text-sm">Taking you to your matches...</p>
              </div>
            )}

            {/* Step 1: Set Password */}
            {step === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Email</label>
                  <input
                    type="email"
                    value={sessionData?.email || ''}
                    disabled
                    className="w-full px-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-md text-zinc-400 text-sm cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                      className="w-full px-3 pr-10 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-zinc-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreateAccount}
                  disabled={password.length < 8 || isSubmitting}
                  className="w-full mt-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Creating account...' : 'Create account'}
                  {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Step 2: Profile */}
            {step === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Full name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Smith"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Company / startup name</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Acme Labs"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Your role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Founder', 'Co-Founder', 'CEO', 'CTO', 'COO'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setFormData({ ...formData, role: r })}
                        className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                          formData.role === r
                            ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                            : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep('password')}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('startup')}
                    disabled={!formData.name}
                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Startup */}
            {step === 'startup' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Stage *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map(s => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, stage: s })}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          formData.stage === s
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {formData.stage === s && <Check className="w-3 h-3 inline mr-1" />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-2">Sectors</label>
                  <div className="flex flex-wrap gap-1.5">
                    {sectors.map(sector => (
                      <button
                        key={sector}
                        onClick={() => handleToggle(sector)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          formData.sectors.includes(sector)
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
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
                  <label className="block text-zinc-500 text-xs mb-2">Fundraising status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Not yet', 'Actively raising', 'Closing round'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setFormData({ ...formData, raising: status })}
                        className={`px-3 py-2 rounded-md border text-xs transition-colors ${
                          formData.raising === status
                            ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                            : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep('profile')}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={!formData.stage || isSubmitting}
                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Finishing...' : 'Start matching'}
                  </button>
                </div>
              </div>
            )}

            <div className="my-6 border-t border-zinc-800/60" />

            <p className="text-center text-zinc-600 text-xs">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* RIGHT — Step-contextual instructive content */}
        {step !== 'verifying' && step !== 'error' && step !== 'done' && (
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
                  All fields can be updated later from your dashboard. Setup takes under 2 minutes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
