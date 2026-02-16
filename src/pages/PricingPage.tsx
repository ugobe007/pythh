/**
 * PRICING PAGE
 * =========================
 * 4-tier pricing with Stripe integration
 * 
 * Tiers:
 * - Free ($0): Explore the signal layer
 * - Pro ($29/mo): Full signal access for founders
 * - Signal Navigator ($99/mo, tier key: 'elite'): The full intelligence layer
 * - Fund ($249/seat/mo): Contact-us tier for VCs/angels
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Check, 
  X,
  Crown,
  ChevronDown,
  ChevronUp,
  Bell,
  Download,
  Eye,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { analytics } from '../analytics';
import { UPGRADE_COPY, UpgradeMoment } from '../lib/upgradeMoments';

type BillingCycle = 'monthly' | 'annual';
type PlanTier = 'free' | 'pro' | 'elite';

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface PricingPlan {
  name: string;
  tier: PlanTier;
  price: number;
  annualPrice?: number;
  tagline: string;
  features: PlanFeature[];
  ctaText: string;
  popular?: boolean;
  color: string;
  iconColor: string;
}

const PLANS: PricingPlan[] = [
  {
    name: 'Free',
    tier: 'free',
    price: 0,
    tagline: 'Explore the signal layer',
    color: 'border-zinc-700/50 hover:border-zinc-600',
    iconColor: 'text-zinc-400',
    ctaText: 'Start Free',
    features: [
      { text: 'Submit 1 startup URL', included: true },
      { text: '5 unlocked investor signals', included: true },
      { text: 'GOD Score overview', included: true },
      { text: 'Browse Rankings & Explore', included: true },
      { text: '3 investor matches (masked)', included: true },
      { text: 'Weekly Signal Digest email', included: true },
      { text: 'Watchlists', included: false },
      { text: 'Signal alerts', included: false },
    ],
  },
  {
    name: 'Pro',
    tier: 'pro',
    price: 29,
    annualPrice: 23,
    tagline: 'Full signal access for founders',
    color: 'border-cyan-500/40 hover:border-cyan-500',
    iconColor: 'text-cyan-400',
    ctaText: 'Upgrade to Pro',
    features: [
      { text: 'All matches unlocked (full identity)', included: true },
      { text: 'Complete signal dashboard', included: true },
      { text: 'Watchlists — track startups & investors', included: true },
      { text: 'Signal alerts (email + in-app)', included: true },
      { text: 'Competitive radar', included: true },
      { text: 'Follow-on round prep', included: true },
      { text: 'Signal Playbook per investor', included: false },
      { text: 'Export CSV + Deal Memos', included: false },
    ],
  },
  {
    name: 'Signal Navigator',
    tier: 'elite',
    price: 99,
    annualPrice: 79,
    tagline: 'The full intelligence layer',
    color: 'border-cyan-400/60 hover:border-cyan-400',
    iconColor: 'text-cyan-400',
    ctaText: 'Go Navigator',
    popular: true,
    features: [
      { text: 'Everything in Pro', included: true, highlight: true },
      { text: 'Signal Playbook (per-investor strategy)', included: true, highlight: true },
      { text: 'Fundraising Timing Map', included: true, highlight: true },
      { text: 'Real-time signal shift alerts', included: true, highlight: true },
      { text: 'Export CSV + AI Deal Memo generation', included: true, highlight: true },
      { text: 'Shareable links for advisors', included: true, highlight: true },
      { text: 'Sector signal heatmaps', included: true, highlight: true },
      { text: 'Priority support', included: true, highlight: true },
    ],
  },
];

const FAQ_ITEMS = [
  {
    question: 'Can I try before I pay?',
    answer: 'Yes. The free tier gives you GOD Scores, rankings, and 3 masked matches. No card required.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No lock-in. Cancel when you want, keep access through your billing period.',
  },
  {
    question: 'How is this different from Pitchbook or Crunchbase?',
    answer: "Those are static encyclopedias. Pythh is a timing weapon — it tells you who\'s aligned with your signals right now, not just who exists.",
  },
  {
    question: 'What keeps me coming back after I raise?',
    answer: 'Watchlists, competitive radar, and signal alerts keep working. Most founders use Pythh to track the market and prep their next round before they need it.',
  },
  {
    question: 'What happens if I downgrade?',
    answer: 'You keep access to your current tier until the billing period ends, then features revert to the lower tier. Your data is never deleted.',
  },
  {
    question: 'Do you offer refunds?',
    answer: "If you\'re not satisfied within the first 7 days, contact us for a full refund. No questions asked.",
  },
];

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }
  return { 'Content-Type': 'application/json' };
}

const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('free');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  // Get upgrade source from URL params or sessionStorage
  const urlSource = searchParams.get('source') as UpgradeMoment | null;
  const urlPlan = searchParams.get('plan') as PlanTier | null;
  const upgradeSource = urlSource || (sessionStorage.getItem('upgrade_source') as UpgradeMoment | null);
  const highlightPlan = urlPlan || (upgradeSource ? UPGRADE_COPY[upgradeSource]?.targetPlan : null);

  // Track pricing page view with source
  useEffect(() => {
    analytics.pricingViewed();
    // Log with source for attribution
    if (upgradeSource) {
      analytics.logEvent('pricing_viewed_from_gate', {
        source: upgradeSource,
        target_plan: highlightPlan
      });
    }
  }, [upgradeSource, highlightPlan]);

  // Fetch current billing status
  useEffect(() => {
    async function fetchBillingStatus() {
      if (!user) {
        setCurrentPlan('free');
        setHasSubscription(false);
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/billing/status`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCurrentPlan(data.plan || 'free');
          setHasSubscription(data.hasSubscription || false);
        }
      } catch (err) {
        console.error('[PricingPage] Failed to fetch billing status:', err);
      }
    }

    fetchBillingStatus();
  }, [user]);

  // Handle plan selection
  const handleSelectPlan = async (tier: PlanTier) => {
    // Track upgrade CTA click
    if (tier !== 'free') {
      analytics.upgradeCTAClicked(tier);
    }
    
    // Not logged in
    if (!user) {
      if (tier === 'free') {
        // Free tier — regular signup
        navigate('/signup/founder');
      } else {
        // Paid tier — go straight to Stripe checkout, account created after payment
        setIsLoading(true);
        setLoadingTier(tier);
        try {
          const res = await fetch(`${API_BASE}/api/billing/create-guest-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: tier }),
          });
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to start checkout');
          }
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
          }
        } catch (err) {
          console.error('[PricingPage] Guest checkout error:', err);
          alert('Failed to start checkout. Please try again.');
        } finally {
          setIsLoading(false);
          setLoadingTier(null);
        }
      }
      return;
    }

    // Free tier — already logged in, go to matches
    if (tier === 'free') {
      navigate('/matches');
      return;
    }

    // Already on this plan
    if (tier === currentPlan) {
      return;
    }

    // Already has subscription - open portal
    if (hasSubscription && currentPlan !== 'free') {
      await handleManageSubscription();
      return;
    }

    // Create checkout session
    setIsLoading(true);
    setLoadingTier(tier);

    try {
      const headers = await getAuthHeaders();
      
      // If no auth token available, redirect to login
      if (!headers['Authorization' as keyof HeadersInit]) {
        navigate(`/login?redirect=${encodeURIComponent(`/pricing?plan=${tier}`)}`);
        setIsLoading(false);
        setLoadingTier(null);
        return;
      }
      
      const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan: tier }),
      });

      if (res.status === 401) {
        // Session expired — redirect to login
        navigate(`/login?redirect=${encodeURIComponent(`/pricing?plan=${tier}`)}`);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('[PricingPage] Checkout error:', err);
      alert('Failed to start checkout. Please log in and try again.');
    } finally {
      setIsLoading(false);
      setLoadingTier(null);
    }
  };

  // Handle manage subscription (portal)
  const handleManageSubscription = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/billing/create-portal-session`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to open portal');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('[PricingPage] Portal error:', err);
      alert('Failed to open subscription management. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPrice = (plan: PricingPlan) => {
    if (billingCycle === 'annual' && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.price;
  };

  const getCTAText = (plan: PricingPlan) => {
    if (plan.tier === currentPlan) {
      return 'Current Plan';
    }
    if (hasSubscription && currentPlan !== 'free' && plan.tier !== 'free') {
      return 'Manage Subscription';
    }
    return plan.ctaText;
  };

  const isCurrentPlan = (tier: PlanTier) => tier === currentPlan;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-400/5 rounded-full blur-3xl" />
      </div>

      <PythhUnifiedNav />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 pt-20 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Navigate fundraising with clarity.
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
            Signal-to-target navigation for founders. See your signals, understand your position, know exactly what to do.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 bg-zinc-900 rounded-xl border border-zinc-800 mt-8">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all relative ${
                billingCycle === 'annual'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-emerald-500 text-[10px] font-bold text-white rounded-full">
                -20%
              </span>
            </button>
          </div>
          
          {billingCycle === 'annual' && (
            <p className="text-xs text-emerald-400 mt-3">
              Save 20% with annual billing
            </p>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {PLANS.map((plan) => {
            const price = getPrice(plan);
            const isCurrent = isCurrentPlan(plan.tier);
            const isPopular = plan.popular;
            const isHighlighted = highlightPlan === plan.tier && !isCurrent;

            return (
              <div
                key={plan.tier}
                className={`
                  relative bg-zinc-900/80 border-2 rounded-2xl p-6 sm:p-8 transition-all
                  ${isHighlighted ? 'border-cyan-400 shadow-2xl shadow-cyan-400/10 scale-[1.02] md:scale-105' : ''}
                  ${isPopular && !isHighlighted ? 'border-cyan-400 shadow-2xl shadow-cyan-400/10 scale-[1.02] md:scale-105' : !isHighlighted ? plan.color : ''}
                  ${isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0a0a0a]' : ''}
                `}
              >
                {/* Upgrade Source Badge */}
                {isHighlighted && upgradeSource && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 border border-cyan-400 bg-cyan-400/10 text-cyan-400 text-xs font-bold rounded-full flex items-center gap-1">
                    Unlocks {UPGRADE_COPY[upgradeSource]?.title.replace('are Elite-only', '').replace('Export ', '').trim()}
                  </div>
                )}

                {/* Popular Badge */}
                {isPopular && !isHighlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 border border-cyan-400 bg-cyan-400/10 text-cyan-400 text-xs font-bold rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    Most Popular
                  </div>
                )}

                {/* Early Access Badge for paid tiers */}
                {plan.tier !== 'free' && !isCurrent && (
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-medium rounded-full border border-emerald-500/30">
                    Early Access Pricing
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                    Current
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                  <p className={`text-sm font-medium ${plan.iconColor}`}>{plan.tagline}</p>
                </div>

                {/* Price */}
                <div className="text-center mb-6">
                  <span className="text-5xl font-black text-white">${price}</span>
                  {price > 0 && (
                    <span className="text-zinc-500 text-lg">
                      /{billingCycle === 'annual' ? 'mo' : 'month'}
                    </span>
                  )}
                  {billingCycle === 'annual' && price > 0 && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Billed annually (${price * 12}/year)
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          feature.highlight ? plan.iconColor : 'text-zinc-500'
                        }`} />
                      ) : (
                        <X className="w-5 h-5 text-zinc-700 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${
                        feature.included 
                          ? feature.highlight ? 'text-white font-medium' : 'text-zinc-300'
                          : 'text-zinc-600 line-through'
                      }`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button — stroke only (Supabase style) */}
                <button
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={isLoading || isCurrent}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all
                    flex items-center justify-center gap-2 bg-transparent
                    ${isCurrent
                      ? 'border border-emerald-500/40 text-emerald-400 cursor-default'
                      : plan.tier === 'elite'
                        ? 'border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10'
                        : plan.tier === 'pro'
                          ? 'border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10'
                          : 'border border-zinc-600 text-zinc-300 hover:bg-zinc-800'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {loadingTier === plan.tier ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    getCTAText(plan)
                  )}
                </button>

                {/* Free tier note */}
                {plan.tier === 'free' && !isCurrent && (
                  <p className="text-xs text-zinc-500 text-center mt-3">
                    You're seeing masked results. Upgrade to reveal.
                  </p>
                )}

                {/* Elite early access note */}
                {plan.tier === 'elite' && !isCurrent && (
                  <p className="text-xs text-emerald-400/80 text-center mt-3">
                    Early access pricing — will increase as features expand.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Fund Tier — Contact Card */}
        <div className="max-w-5xl mx-auto mb-12">
          <div className="bg-zinc-900/80 border-2 border-zinc-700/50 hover:border-zinc-600 rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-1">Fund</h3>
              <p className="text-sm font-medium text-cyan-400 mb-4">For VCs, angels &amp; syndicates</p>
              <div className="mb-4">
                <span className="text-4xl font-black text-white">$249</span>
                <span className="text-zinc-500 text-lg">/seat/month</span>
              </div>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Everything in Signal Navigator</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Multi-seat team dashboard</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Pipeline import &amp; CRM sync</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Custom scoring weights</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Dedicated onboarding + support</li>
              </ul>
            </div>
            <div className="flex-shrink-0">
              <a
                href="mailto:team@pythh.ai?subject=Fund%20Tier%20Inquiry"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10 transition-all"
              >
                Contact Us
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* What You Unlock Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-xl font-bold text-white text-center mb-8">
            What you unlock with Signal Navigator
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Signal Playbook</h3>
              <p className="text-sm text-zinc-500">
                Per-investor strategy with confidence scores, dimension breakdowns, and timing recommendations.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Bell className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Signal Shift Alerts</h3>
              <p className="text-sm text-zinc-500">
                Get notified when investors shift focus — before anyone else sees it.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Download className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Export &amp; Share</h3>
              <p className="text-sm text-zinc-500">
                Export to CSV, generate AI deal memos, and share links with advisors and co-founders.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Comparison Table (Compact) */}
        <div className="max-w-4xl mx-auto mb-16 overflow-x-auto">
          <h2 className="text-xl font-bold text-white text-center mb-6">
            Compare Plans
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium">Free</th>
                <th className="text-center py-3 px-4 text-cyan-500 font-medium">Pro</th>
                <th className="text-center py-3 px-4 text-cyan-400 font-medium">Navigator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              <tr>
                <td className="py-3 px-4 text-zinc-300">Investor Matches</td>
                <td className="py-3 px-4 text-center text-zinc-500">3 (masked)</td>
                <td className="py-3 px-4 text-center text-zinc-300">All (full identity)</td>
                <td className="py-3 px-4 text-center text-white font-medium">All + strategy</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Watchlists</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Signal Alerts</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Competitive Radar</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Signal Playbook</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Timing Map</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Export CSV + Deal Memo</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Shareable Links</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-cyan-400 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="font-medium text-white">{faq.question}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-zinc-400">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Closing Statement */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8 bg-gradient-to-r from-cyan-500/5 via-zinc-900 to-cyan-400/5 border border-zinc-800 rounded-2xl">
            <p className="text-xl text-zinc-400 leading-relaxed">
              The signal is already there.
            </p>
            <p className="text-xl text-white font-semibold mt-2">
              We just show you where to aim.
            </p>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="text-center mt-12">
          <p className="text-zinc-500 text-sm mb-2">Need custom limits or team features?</p>
          <a
            href="mailto:team@pythh.ai?subject=Enterprise%20Inquiry"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
          >
            Contact us for Enterprise
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
