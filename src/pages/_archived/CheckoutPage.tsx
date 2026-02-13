import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  CreditCard, 
  Shield, 
  Zap, 
  ArrowRight,
  Loader2,
  Star,
  CheckCircle,
  Gift
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TIER_DETAILS, TierName, BillingCycle, getYearlySavings, formatPrice } from '../lib/stripe';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const tierParam = searchParams.get('tier') as TierName || 'flame';
  const userType = searchParams.get('type') || 'startup';
  
  const [selectedTier, setSelectedTier] = useState<TierName>(tierParam);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'checkout'>('select');
  
  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  // Get available tiers based on user type
  const availableTiers = userType === 'startup' 
    ? ['spark', 'flame', 'inferno'] as TierName[]
    : ['scout', 'dealflow_pro'] as TierName[];

  const tierDetails = TIER_DETAILS[selectedTier];
  const yearlySavings = getYearlySavings(selectedTier);

  const handleCheckout = async () => {
    if (!email || !name) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For free tier, just create the account
      if (selectedTier === 'spark') {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: Math.random().toString(36).slice(-12), // Temporary password
          options: {
            data: {
              name,
              company_name: companyName,
              user_type: userType,
            }
          }
        });

        if (authError) throw authError;

        // Create subscription record
        if (authData.user) {
          await (supabase.from as any)('user_subscriptions').insert({
            user_id: authData.user.id,
            tier: 'spark',
            status: 'active',
            user_type: userType,
            matches_used: 0,
            matches_limit: 3,
          });
        }

        // Redirect to success page
        navigate('/get-matched/success?tier=spark');
        return;
      }

      // For paid tiers, redirect to Stripe Checkout
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          tier: selectedTier,
          billingCycle,
          email,
          successUrl: `${window.location.origin}/get-matched/success`,
          cancelUrl: `${window.location.origin}/checkout?tier=${selectedTier}&type=${userType}`,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const tierColors: Record<string, string> = {
    spark: 'from-gray-500 to-gray-600',
    flame: 'from-cyan-600 to-blue-600',
    inferno: 'from-red-500 to-purple-600',
    scout: 'from-blue-500 to-cyan-500',
    dealflow_pro: 'from-indigo-500 to-purple-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <LogoDropdownMenu />
            <div className="flex items-center gap-4">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-400">Secure checkout powered by Stripe</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            Complete Your Subscription
          </h1>
          <p className="text-xl text-gray-400">
            Start your 7-day free trial • Cancel anytime
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Side - Plan Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Plan Cards */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Select Your Plan</h2>
              {availableTiers.map((tier) => {
                const details = TIER_DETAILS[tier];
                const isSelected = selectedTier === tier;
                const savings = getYearlySavings(tier);
                
                return (
                  <motion.button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-cyan-500 bg-cyan-600/10' 
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tierColors[tier]} flex items-center justify-center text-xl`}>
                          {details.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{details.name}</h3>
                          <p className="text-sm text-gray-400">{details.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          {details.price === 0 ? 'Free' : `$${details.price}`}
                        </p>
                        {details.price > 0 && (
                          <p className="text-xs text-gray-500">/month</p>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex flex-wrap gap-2">
                          {details.features.slice(0, 4).map((feature, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300">
                              {feature}
                            </span>
                          ))}
                          {details.features.length > 4 && (
                            <span className="px-2 py-1 text-xs text-cyan-400">
                              +{details.features.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Billing Cycle Toggle */}
            {tierDetails.price > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Billing Cycle</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 py-3 px-4 rounded-lg transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span className="font-medium">Monthly</span>
                    <p className="text-sm opacity-80">${tierDetails.price}/mo</p>
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`flex-1 py-3 px-4 rounded-lg transition-all relative ${
                      billingCycle === 'yearly'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {yearlySavings > 0 && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                        Save ${yearlySavings}
                      </span>
                    )}
                    <span className="font-medium">Yearly</span>
                    <p className="text-sm opacity-80">${Math.round(tierDetails.priceYearly / 12)}/mo</p>
                  </button>
                </div>
              </div>
            )}

            {/* Trust Signals */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-gray-400">256-bit SSL</p>
              </div>
              <div className="text-center">
                <Gift className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-xs text-gray-400">7-day trial</p>
              </div>
              <div className="text-center">
                <X className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Cancel anytime</p>
              </div>
            </div>
          </motion.div>

          {/* Right Side - Checkout Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 h-fit"
          >
            <h2 className="text-xl font-semibold text-white mb-6">Your Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="John Smith"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="john@company.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="Acme Inc."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Order Summary */}
              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-300">
                    <span>{tierDetails.name} Plan ({billingCycle})</span>
                    <span>
                      {tierDetails.price === 0 
                        ? 'Free' 
                        : billingCycle === 'monthly' 
                          ? `$${tierDetails.price}` 
                          : `$${tierDetails.priceYearly}`
                      }
                    </span>
                  </div>
                  {tierDetails.price > 0 && (
                    <div className="flex justify-between text-green-400 text-sm">
                      <span>7-day free trial</span>
                      <span>-${billingCycle === 'monthly' ? tierDetails.price : tierDetails.priceYearly}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white font-semibold pt-2 border-t border-gray-700">
                    <span>Due today</span>
                    <span>$0.00</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading || !email || !name}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {tierDetails.price === 0 ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Start Free Plan
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Start Free Trial
                      </>
                    )}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                {tierDetails.price > 0 
                  ? "You won't be charged until your trial ends. Cancel anytime."
                  : "No credit card required for the free plan."
                }
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
