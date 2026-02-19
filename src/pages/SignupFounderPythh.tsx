/**
 * FOUNDER SIGNUP PAGE (Pythh Style)
 * =================================
 * Supabase-style: minimal, clean multi-step wizard
 * - Step 1: Account (email + password)
 * - Step 2: About you (name, company, role)
 * - Step 3: Your startup (stage, sector, fundraising)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowRight, ArrowLeft, Eye, EyeOff, Check } from 'lucide-react';
import PythhTopNav from '../components/PythhTopNav';
import { getPendingInvite, acceptInvite } from '../lib/referral';
import { trackEvent } from '../lib/analytics';

export default function SignupFounderPythh() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user, isLoggedIn } = useAuth();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (isLoggedIn && user) {
      navigate('/dashboard');
    }
  }, [isLoggedIn, user, navigate]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Get redirect URL
  const redirectUrl = searchParams.get('redirect') || '/matches';
  const matchCount = searchParams.get('matches') || '';
  const startupUrl = searchParams.get('url') || '';

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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

  const handleToggle = (value: string) => {
    setFormData(prev => ({
      ...prev,
      sectors: prev.sectors.includes(value)
        ? prev.sectors.filter(v => v !== value)
        : [...prev.sectors, value],
    }));
  };

  // Step 1 → create Supabase auth, then advance
  const handleCreateAccount = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.email.split('@')[0],
            role: 'founder',
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          if (signInError) throw signInError;
          setUserId(signInData.user?.id || null);
        } else {
          throw authError;
        }
      } else {
        setUserId(data?.user?.id || null);
      }

      console.log('[SignupFounderPythh] Account created, advancing to step 2');

      // Handle invite
      const pendingInvite = getPendingInvite();
      if (pendingInvite) {
        try {
          const result = await acceptInvite(pendingInvite.token);
          if (result.success) {
            trackEvent('invite_accepted', {
              token: pendingInvite.token,
              inviter_rewarded: result.inviter_rewarded,
            });
          }
        } catch (inviteErr) {
          console.error('[SignupFounderPythh] Invite acceptance failed:', inviteErr);
        }
      }

      login(formData.email, formData.password);
      setStep(2);
    } catch (err: any) {
      console.error('[SignupFounderPythh] Error:', err);
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final submit — save profile data and navigate
  const handleFinish = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Update profile with collected data
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          display_name: formData.name || undefined,
          role: 'founder',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        // Store startup details in user metadata
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

      const confirmationUrl = startupUrl
        ? `/matches?url=${encodeURIComponent(startupUrl)}`
        : redirectUrl;
      navigate(confirmationUrl);
    } catch (err: any) {
      console.error('[SignupFounderPythh] Profile update error:', err);
      // Navigate anyway — account is created, profile is optional
      navigate(redirectUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step-contextual right panel content
  const stepGuide: Record<1 | 2 | 3, { heading: string; intro: string; items: { title: string; detail: string }[] }> = {
    1: {
      heading: 'Signal intelligence',
      intro: 'Your account activates a live signal dashboard — investor matches that update as market conditions shift.',
      items: [
        { title: 'Top investor matches', detail: '5 unlocked investor profiles with fit scores, thesis alignment details, and outreach guidance. Ranked by signal strength.' },
        { title: 'Live signal scoring', detail: 'Your startup scored across 5 signal dimensions in real-time: language shift, capital convergence, investor receptivity, news momentum, execution velocity.' },
        { title: 'GOD score breakdown', detail: '22+ models evaluate your startup\'s intrinsic position — team, traction, market, product, vision. Scores recalibrate continuously.' },
      ],
    },
    2: {
      heading: 'Why this matters',
      intro: 'Your profile powers precision matching. The more we know, the higher-signal your investor recommendations become.',
      items: [
        { title: 'Name recognition', detail: 'Investors see who they\'re matched with. A complete profile builds trust before the first conversation.' },
        { title: 'Company context', detail: 'Your company name and role help the matching engine distinguish co-founders and map team strength signals.' },
        { title: 'Better deal flow', detail: 'Founders with complete profiles get 3× more investor views. Signal quality increases with profile depth.' },
      ],
    },
    3: {
      heading: 'Precision matching',
      intro: 'Stage and sector data feed directly into the matching algorithm. Investors are filtered to those actively deploying in your space.',
      items: [
        { title: 'Stage alignment', detail: 'A pre-seed founder won\'t see growth-stage VCs. Matches are filtered to investors writing checks at your stage.' },
        { title: 'Sector depth', detail: 'Sector tags map your startup against investor thesis vectors. Multi-sector startups surface cross-category opportunities.' },
        { title: 'Timing signals', detail: 'Your fundraising status affects match urgency scoring. Actively raising founders get priority in investor feeds.' },
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
              <h1 className="text-xl font-semibold text-white mb-1">Create your account</h1>
              <p className="text-sm text-zinc-500">
                Step {step} of 3 — {step === 1 ? 'Account' : step === 2 ? 'About you' : 'Your startup'}
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

            {/* Context message - if coming from matches */}
            {matchCount && step === 1 && (
              <div className="mb-4 px-3 py-2 border-l-2 border-emerald-500/60 bg-emerald-500/5">
                <p className="text-emerald-400/80 text-xs">
                  {matchCount} investors matched — create account to save your results
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                {error}
              </div>
            )}

            {/* Step 1: Account */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@startup.com"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-1.5">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                  disabled={!formData.email || formData.password.length < 8 || isSubmitting}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Creating...' : 'Continue'}
                  {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Step 2: About You */}
            {step === 2 && (
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
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
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
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!formData.name}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Your Startup */}
            {step === 3 && (
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
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
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
                  <label className="block text-zinc-500 text-xs mb-2">Fundraising status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Not yet', 'Actively raising', 'Closing round'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setFormData({ ...formData, raising: status })}
                        className={`px-3 py-2 rounded-md border text-xs transition-colors ${
                          formData.raising === status
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
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
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-medium rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={!formData.stage || isSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                to={`/login${redirectUrl !== '/matches' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                className="text-zinc-400 hover:text-white transition-colors"
              >
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
                {step === 1
                  ? 'Free tier includes 5 unlocked investors and 3 daily unlocks. Matches refresh every 10 seconds.'
                  : 'All fields can be updated later from your dashboard. Setup takes under 2 minutes.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
