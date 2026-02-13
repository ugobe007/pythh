/**
 * PRICING PAGE - Prompt 17
 * =========================
 * 3-tier pricing with Stripe integration
 * 
 * Tiers (source of truth: plan.ts):
 * - Free ($0): Preview tier
 * - Pro ($99/mo): Enhanced visibility
 * - Elite ($399/mo): Full access + exports + alerts
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
import LogoDropdownMenu from '../components/LogoDropdownMenu';
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
    tagline: 'See your signals',
    color: 'border-zinc-700 hover:border-zinc-600',
    iconColor: 'text-zinc-400',
    ctaText: 'Get Started',
    features: [
      { text: 'Unlimited URL scans', included: true },
      { text: '3 Investor matches (masked)', included: true },
      { text: 'GOD Score overview', included: true },
      { text: 'Match reasoning', included: true },
      { text: 'Pitch Signal Scan (preview)', included: false },
      { text: 'Signal Playbook', included: false },
      { text: 'Timing Map', included: false },
      { text: 'Export & Share', included: false },
    ],
  },
  {
    name: 'Signal Map',
    tier: 'pro',
    price: 49,
    annualPrice: 39,
    tagline: 'Understand your position',
    color: 'border-amber-500/50 hover:border-amber-500',
    iconColor: 'text-amber-400',
    ctaText: 'Upgrade to Signal Map',
    features: [
      { text: '50+ Investor matches (full identity)', included: true },
      { text: 'Pitch Signal Scan (5 dimensions)', included: true },
      { text: 'Daily signal updates', included: true },
      { text: 'Saved matches + Watchlist', included: true },
      { text: 'Signal Playbook', included: false },
      { text: 'Timing Map', included: false },
      { text: 'Real-time alerts', included: false },
      { text: 'Export CSV + Share links', included: false },
    ],
  },
  {
    name: 'Navigator',
    tier: 'elite',
    price: 149,
    annualPrice: 119,
    tagline: 'Full signal navigation',
    color: 'border-violet-500 hover:border-violet-400',
    iconColor: 'text-violet-400',
    ctaText: 'Go Navigator',
    popular: true,
    features: [
      { text: '50+ Matches + explainability + confidence', included: true, highlight: true },
      { text: 'Signal Playbook (per-investor strategy)', included: true, highlight: true },
      { text: 'Pitch Signal Scan (full 5 dimensions)', included: true, highlight: true },
      { text: 'Fundraising Timing Map + weekly cadence', included: true, highlight: true },
      { text: 'Real-time alerts + signal shift notifications', included: true, highlight: true },
      { text: 'Export CSV + Deal Memo generation', included: true, highlight: true },
      { text: 'Oracle coaching sessions', included: true, highlight: true },
      { text: 'Share links for advisors', included: true, highlight: true },
    ],
  },
];

const FAQ_ITEMS = [
  {
    question: 'Can I try before I pay?',
    answer: 'Yes. The free tier gives you a full system readout and your top 3 matches. No card required.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No lock-in. Cancel when you want, keep access through your billing period.',
  },
  {
    question: 'How is this different from a VC database?',
    answer: "VC databases tell you who exists. Pythh tells you who's already aligned with your specific signals. It's pattern recognition, not directory lookup.",
  },
  {
    question: 'What happens if I downgrade?',
    answer: 'You keep access to your current tier until the billing period ends, then features revert to the lower tier. Your data is never deleted.',
  },
  {
    question: 'Do you offer refunds?',
    answer: "If you're not satisfied within the first 7 days, contact us for a full refund. No questions asked.",
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
    
    // Free tier - just go home
    if (tier === 'free') {
      navigate('/');
      return;
    }

    // Not logged in - redirect to login with return URL
    if (!user) {
      navigate(`/login?redirect=/pricing&plan=${tier}`);
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
      const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan: tier }),
      });

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
      alert('Failed to start checkout. Please try again.');
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
        <div className="absolute top-20 left-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <LogoDropdownMenu />

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
                  ${isHighlighted ? 'border-amber-500 shadow-2xl shadow-amber-500/20 scale-[1.02] md:scale-105' : ''}
                  ${isPopular && !isHighlighted ? 'border-violet-500 shadow-2xl shadow-violet-500/20 scale-[1.02] md:scale-105' : !isHighlighted ? plan.color : ''}
                  ${isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0a0a0a]' : ''}
                `}
              >
                {/* Upgrade Source Badge */}
                {isHighlighted && upgradeSource && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    Unlocks {UPGRADE_COPY[upgradeSource]?.title.replace('are Elite-only', '').replace('Export ', '').trim()}
                  </div>
                )}

                {/* Popular Badge */}
                {isPopular && !isHighlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
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

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={isLoading || isCurrent}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all
                    flex items-center justify-center gap-2
                    ${isCurrent
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : plan.tier === 'elite'
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20'
                        : plan.tier === 'pro'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
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

        {/* What You Unlock Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-xl font-bold text-white text-center mb-8">
            What you unlock with Elite
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Screenshot placeholder 1 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                <Eye className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Full Explainability</h3>
              <p className="text-sm text-zinc-500">
                See exactly why each investor matches your startup, with confidence scores and dimension breakdowns.
              </p>
            </div>

            {/* Screenshot placeholder 2 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Real-Time Alerts</h3>
              <p className="text-sm text-zinc-500">
                Get notified instantly when watched startups heat up or show momentum spikes with "Why" context.
              </p>
            </div>

            {/* Screenshot placeholder 3 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <Download className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Export & Share</h3>
              <p className="text-sm text-zinc-500">
                Export match lists to CSV, generate AI deal memos, and create shareable links for your team.
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
                <th className="text-center py-3 px-4 text-amber-400 font-medium">Pro</th>
                <th className="text-center py-3 px-4 text-violet-400 font-medium">Elite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              <tr>
                <td className="py-3 px-4 text-zinc-300">Live Pairings</td>
                <td className="py-3 px-4 text-center text-zinc-500">1 (masked)</td>
                <td className="py-3 px-4 text-center text-zinc-300">3</td>
                <td className="py-3 px-4 text-center text-white font-medium">10 + confidence</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Trending Startups</td>
                <td className="py-3 px-4 text-center text-zinc-500">3</td>
                <td className="py-3 px-4 text-center text-zinc-300">10 + score</td>
                <td className="py-3 px-4 text-center text-white font-medium">50 + all signals</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Investor Matches</td>
                <td className="py-3 px-4 text-center text-zinc-500">3 (masked)</td>
                <td className="py-3 px-4 text-center text-zinc-300">10</td>
                <td className="py-3 px-4 text-center text-white font-medium">50 + reasons</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Alerts</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-violet-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Export CSV</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-violet-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Deal Memo</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-violet-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Share Links</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-zinc-700 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-violet-400 mx-auto" /></td>
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
          <div className="p-8 bg-gradient-to-r from-amber-500/5 via-zinc-900 to-violet-500/5 border border-zinc-800 rounded-2xl">
            <p className="text-xl text-zinc-300 leading-relaxed">
              Pythh doesn't help you pitch better.
            </p>
            <p className="text-xl text-white font-semibold mt-2">
              It helps you talk to the right people before you pitch.
            </p>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="text-center mt-12">
          <p className="text-zinc-500 text-sm mb-2">Need custom limits or team features?</p>
          <a
            href="mailto:team@pythh.ai?subject=Enterprise%20Inquiry"
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium"
          >
            Contact us for Enterprise
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
