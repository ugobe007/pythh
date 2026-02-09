/**
 * FOUNDER SIGNUP PAGE (Pythh Style)
 * =================================
 * Supabase-style: minimal, clean, monochromatic
 * - Email + Password
 * - Role auto-set to Founder
 */

import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import PythhTopNav from '../components/PythhTopNav';
import { getPendingInvite, acceptInvite } from '../lib/referral';
import { trackEvent } from '../lib/analytics';

export default function SignupFounderPythh() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Get redirect URL
  const redirectUrl = searchParams.get('redirect') || '/matches';
  const matchCount = searchParams.get('matches') || '';
  const startupUrl = searchParams.get('url') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Create Supabase auth user
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            name: email.split('@')[0],
            role: 'founder'
          }
        }
      });
      
      if (authError) {
        // If user already exists, try to sign in instead
        if (authError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (signInError) throw signInError;
        } else {
          throw authError;
        }
      }
      
      console.log('[SignupFounderPythh] User created:', data?.user?.id);
      
      // Check for pending invite and accept it
      const pendingInvite = getPendingInvite();
      if (pendingInvite) {
        try {
          const result = await acceptInvite(pendingInvite.token);
          if (result.success) {
            console.log('[SignupFounderPythh] Invite accepted:', result);
            trackEvent('invite_accepted', { 
              token: pendingInvite.token,
              inviter_rewarded: result.inviter_rewarded 
            });
          }
        } catch (inviteErr) {
          console.error('[SignupFounderPythh] Invite acceptance failed:', inviteErr);
        }
      }
      
      // Also update localStorage auth for backward compatibility
      login(email, password);
      
      // Navigate to matches or signal confirmation
      const confirmationUrl = startupUrl 
        ? `/matches?url=${encodeURIComponent(startupUrl)}`
        : redirectUrl;
      navigate(confirmationUrl);
    } catch (err: any) {
      console.error('[SignupFounderPythh] Error:', err);
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909]">
      <PythhTopNav showSignup={false} />

      <div className="min-h-[calc(100vh-65px)] flex">
        {/* LEFT — Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            {/* Back link */}
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-6 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-white mb-1">Create your account</h1>
              <p className="text-sm text-zinc-500">
                Start tracking investor signals in under 60 seconds.
              </p>
            </div>

            {/* Context message - if coming from matches */}
            {matchCount && (
              <div className="mb-4 px-3 py-2 border-l-2 border-emerald-500/60 bg-emerald-500/5">
                <p className="text-emerald-400/80 text-xs">
                  {matchCount} investors matched — create account to save your results
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                {error}
              </div>
            )}

            {/* Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-zinc-500 text-xs mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                  <input
                    type="email"
                    placeholder="you@startup.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-500 text-xs mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm placeholder-zinc-700 focus:border-zinc-600 focus:outline-none transition-colors"
                    required
                    minLength={8}
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
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="my-6 border-t border-zinc-800/60" />

            <p className="text-center text-zinc-600 text-xs">
              Already have an account?{' '}
              <Link 
                to={`/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* RIGHT — Instructive content */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0c0c0c] border-l border-zinc-800/40 p-12">
          <div className="max-w-sm space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                What you get
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Your account activates a live signal dashboard — investor matches that update as market conditions shift.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm text-zinc-300">Top investor matches</p>
                <p className="text-xs text-zinc-600">
                  5 unlocked investor profiles with fit scores, thesis alignment details, and outreach guidance. Ranked by signal strength.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-300">Live signal scoring</p>
                <p className="text-xs text-zinc-600">
                  Your startup scored across 5 signal dimensions in real-time: language shift, capital convergence, investor receptivity, news momentum, execution velocity.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-300">GOD score breakdown</p>
                <p className="text-xs text-zinc-600">
                  22+ models evaluate your startup's intrinsic position — team, traction, market, product, vision. Scores recalibrate continuously.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-300">Actionable next moves</p>
                <p className="text-xs text-zinc-600">
                  Prioritized actions based on your specific signal data. Not generic advice — derived from your startup's current market position.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/40">
              <p className="text-xs text-zinc-600">
                Free tier includes 5 unlocked investors and 3 daily unlocks. Matches refresh every 10 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
