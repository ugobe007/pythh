/**
 * ADMIN LOGIN - Dedicated admin access page
 * ==========================================
 * Professional admin login with:
 * - Email/password authentication
 * - Emergency bypass option
 * - Admin account setup instructions
 * - Supabase auth integration
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Mail, Lock, Key, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBypass, setShowBypass] = useState(false);
  const [bypassKey, setBypassKey] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Check if admin
      const isAdmin = email.toLowerCase().includes('admin') || 
                     email.toLowerCase().includes('ugobe') ||
                     ['aabramson@comunicano.com', 'ugobe07@gmail.com', 'ugobe1@mac.com'].includes(email.toLowerCase());

      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Not an admin account. Admin emails must contain "admin" or "ugobe".');
      }

      // Create admin session
      const adminUser = {
        email: data.user?.email || email,
        name: data.user?.email?.split('@')[0] || 'Admin',
        isAdmin: true,
      };

      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      localStorage.setItem('isLoggedIn', 'true');

      // Redirect to admin panel
      navigate('/admin/health');
    } catch (err: any) {
      console.error('[AdminLogin] Error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBypass = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedKey = import.meta.env.VITE_ADMIN_KEY;

    if (!expectedKey) {
      setError('Admin bypass not configured. Add VITE_ADMIN_KEY to .env file.');
      return;
    }

    if (bypassKey !== expectedKey) {
      setError('Invalid bypass key.');
      return;
    }

    // Create admin session
    const adminUser = {
      email: 'admin@pythh.ai',
      name: 'Admin',
      isAdmin: true,
    };

    localStorage.setItem('currentUser', JSON.stringify(adminUser));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('adminBypass', 'true');

    navigate('/admin/health');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              pythh
            </div>
          </Link>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <p className="text-slate-400 text-sm">Admin Access</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/20 p-8">
          {!showBypass ? (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">Admin Login</h1>
              <p className="text-slate-400 text-sm mb-6">
                Use your admin credentials to access the dashboard
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">{error}</div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@pythh.ai"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Email must contain "admin" or "ugobe"
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Sign In as Admin
                    </>
                  )}
                </button>
              </form>

              {/* Bypass Option */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <button
                  onClick={() => setShowBypass(true)}
                  className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Emergency Bypass (if rate limited)
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">Emergency Bypass</h1>
              <p className="text-slate-400 text-sm mb-6">
                Use bypass key to access admin panel without Supabase auth
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">{error}</div>
                </div>
              )}

              <form onSubmit={handleBypass} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Bypass Key</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="password"
                      value={bypassKey}
                      onChange={(e) => setBypassKey(e.target.value)}
                      placeholder="Enter VITE_ADMIN_KEY"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Key is configured in .env file
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Key className="w-5 h-5" />
                  Use Bypass Key
                </button>
              </form>

              <button
                onClick={() => {
                  setShowBypass(false);
                  setError('');
                  setBypassKey('');
                }}
                className="w-full mt-4 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                ← Back to regular login
              </button>
            </>
          )}

          {/* Setup Instructions */}
          <div className="mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-1">Setting up admin access?</p>
                <p className="text-xs">
                  1. Create Supabase account with admin email<br />
                  2. Email must contain "admin" or "ugobe"<br />
                  3. Use credentials to sign in
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Site */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            ← Back to pythh.ai
          </Link>
        </div>
      </div>
    </div>
  );
}
