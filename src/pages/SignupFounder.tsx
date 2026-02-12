/**
 * FOUNDER SIGNUP PAGE (Screen B)
 * ==============================
 * Lightweight, founder-focused signup
 * - Email + Password only
 * - Role auto-set to Founder
 * - No company name, no deck, no profile friction
 * - Redirect to Signal Confirmation after signup
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { getPendingInvite, acceptInvite } from '../lib/referral';
import { trackEvent } from '../lib/analytics';

export default function SignupFounder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Get redirect URL (usually back to instant-matches with signal data)
  const redirectUrl = searchParams.get('redirect') || '/signal-confirmation';
  const matchCount = searchParams.get('matches') || '53';
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
      
      console.log('[SignupFounder] User created:', data?.user?.id);
      
      // Check for pending invite and accept it
      const pendingInvite = getPendingInvite();
      if (pendingInvite) {
        try {
          const result = await acceptInvite(pendingInvite.token);
          if (result.success) {
            console.log('[SignupFounder] Invite accepted:', result);
            trackEvent('invite_accepted', { 
              token: pendingInvite.token,
              inviter_rewarded: result.inviter_rewarded 
            });
          }
        } catch (inviteErr) {
          console.error('[SignupFounder] Invite acceptance failed:', inviteErr);
        }
      }
      
      // Also update localStorage auth for backward compatibility
      login(email, password);
      
      // Navigate to signal confirmation with context
      const confirmationUrl = startupUrl 
        ? `/signal-confirmation?url=${encodeURIComponent(startupUrl)}&matches=${matchCount}`
        : '/signal-confirmation';
      navigate(confirmationUrl);
    } catch (err: any) {
      console.error('[SignupFounder] Error:', err);
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background subtle gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Brand mark */}
      <div className="fixed top-5 left-5 z-40">
        <BrandMark />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Signup Card */}
        <div className="bg-[#111111] rounded-2xl p-8 border border-gray-800">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-3">Create your Pythh account</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Your signals will be saved and updated daily.
            </p>
          </div>

          {/* Context message */}
          {matchCount && (
            <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 text-sm text-center">
                🔓 {matchCount} investors are ready to unlock
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="email"
                  placeholder="you@startup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-11 pr-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Role indicator - fixed to Founder */}
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-emerald-400 font-medium">Role: Founder</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creating an account to save your signals — not to pitch.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                'Continue →'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link 
                to={`/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                className="text-amber-500 hover:text-amber-400 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Trust signals */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
              <span>🔒 No pitch deck required</span>
              <span>📫 No spam</span>
              <span>🎯 No intros sent</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
