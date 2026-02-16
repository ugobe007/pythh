/**
 * ADMIN BYPASS - Direct Admin Access
 * ==================================
 * Bypasses Supabase email rate limiting for admin access
 * URL: http://localhost:5173/admin-bypass?key=YOUR_ADMIN_KEY
 * 
 * Security: Uses ADMIN_KEY from env, auto-redirects to admin panel
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function AdminBypass() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('Verifying admin key...');

  useEffect(() => {
    const key = searchParams.get('key');
    const expectedKey = import.meta.env.VITE_ADMIN_KEY;

    // Security check
    if (!key) {
      setStatus('error');
      setMessage('No admin key provided. Add ?key=YOUR_KEY to URL.');
      return;
    }

    if (!expectedKey) {
      setStatus('error');
      setMessage('VITE_ADMIN_KEY not configured in .env file.');
      return;
    }

    if (key !== expectedKey) {
      setStatus('error');
      setMessage('Invalid admin key. Access denied.');
      return;
    }

    // Bypass successful - create admin session
    const adminUser = {
      email: 'admin@pythh.ai',
      name: 'Admin',
      isAdmin: true,
    };

    localStorage.setItem('currentUser', JSON.stringify(adminUser));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('adminBypass', 'true');
    localStorage.setItem('adminBypassTime', new Date().toISOString());

    setStatus('success');
    setMessage('Admin access granted! Redirecting...');

    // Redirect to admin panel
    setTimeout(() => {
      navigate('/admin/health');
    }, 1500);
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-purple-500/20">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {status === 'checking' && (
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
          )}
          {status === 'success' && (
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          )}
          {status === 'error' && (
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center mb-2 text-white">
          Admin Bypass
        </h1>

        {/* Message */}
        <p className="text-center text-slate-300 mb-6">
          {message}
        </p>

        {/* Status Indicator */}
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-400">
              <p className="font-medium text-slate-300 mb-1">Security Notice</p>
              <p>This bypass is for emergency admin access only. Configure Supabase rate limits for normal operation.</p>
            </div>
          </div>
        </div>

        {/* Error Recovery */}
        {status === 'error' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400 mb-3">Need help?</p>
            <div className="bg-slate-900 rounded-lg p-3 text-left text-xs text-slate-300 font-mono">
              <p>1. Check .env has VITE_ADMIN_KEY</p>
              <p>2. Restart dev server</p>
              <p>3. Use: ?key=YOUR_KEY</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
