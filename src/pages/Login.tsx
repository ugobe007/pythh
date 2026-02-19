import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowLeft, Sparkles, Eye, EyeOff, Github } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setSocialLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      // OAuth redirects away, so loading state persists
    } catch (err: any) {
      console.error(`[Login] ${provider} OAuth error:`, err);
      setError(err.message || `Failed to sign in with ${provider}`);
      setSocialLoading(false);
    }
  };

  const handleForgotPassword = useCallback(async () => {
    if (!email) {
      setError('Enter your email address first, then click Forgot password');
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // First try Supabase auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        // If user doesn't exist, sign them up
        if (authError.message.includes('Invalid login credentials')) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name: email.split('@')[0] }
            }
          });
          
          if (signUpError) throw signUpError;
          
          // Profile is auto-created by database trigger
          console.log('[Login] Created new user:', signUpData.user?.id);
        } else {
          throw authError;
        }
      } else {
        console.log('[Login] Signed in:', data.user?.id);
      }
      
      // Also update localStorage auth for backward compatibility
      login(email, password);
      
      // Check if admin and redirect accordingly
      const isAdmin = email.includes('admin') || email.includes('ugobe');
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      
      if (redirect) {
        // Always honor explicit redirect (e.g. from pricing page)
        navigate(redirect);
      } else if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-slate-400">Sign in to access your matches</p>
          </div>

          {/* Success / Error messages */}
          {resetSent && (
            <div className="mb-6 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm text-center">
              Password reset email sent! Check your inbox.
            </div>
          )}
          {error && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500" />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                {resetLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-500 text-sm">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Social login buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={socialLoading}
              className="w-full py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-300 font-medium hover:bg-slate-900 hover:border-slate-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.27 9.75A6.46 6.46 0 0 1 12 5.5c1.7 0 3.14.63 4.28 1.65l3.18-3.18C17.4 2.09 14.89 1 12 1 7.7 1 4.05 3.5 2.25 7.1l3.02 2.65z" />
                <path fill="#34A853" d="M16.04 18.01A7.4 7.4 0 0 1 12 19.5a6.46 6.46 0 0 1-6.73-4.75L2.25 17.4C4.05 21 7.7 23.5 12 23.5c2.7 0 5.2-.89 7.17-2.53l-3.13-2.96z" />
                <path fill="#4A90E2" d="M19.17 20.97C21.45 18.93 23 15.7 23 12.23c0-.79-.07-1.53-.2-2.23H12v4.5h6.18c-.3 1.45-1.1 2.64-2.27 3.41l3.26 2.06z" />
                <path fill="#FBBC05" d="M5.27 14.75A6.53 6.53 0 0 1 5.27 9.75L2.25 7.1a10.5 10.5 0 0 0 0 10.3l3.02-2.65z" />
              </svg>
              Continue with Google
            </button>
            
            <button
              type="button"
              onClick={() => handleSocialLogin('github')}
              disabled={socialLoading}
              className="w-full py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-300 font-medium hover:bg-slate-900 hover:border-slate-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </button>
          </div>

          {/* Sign up link */}
          <div className="text-center">
            <p className="text-slate-400">
              Don't have an account?{' '}
              <Link to="/get-matched" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign up free
              </Link>
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <Link to="/about" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
          <span className="mx-2">•</span>
          <Link to="/about" className="hover:text-slate-400 transition-colors">About</Link>
        </div>
      </div>
    </div>
  );
}
