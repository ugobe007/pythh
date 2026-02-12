import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../hooks/useBilling';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import {
  User, Settings, CreditCard, LogOut, Shield, Pencil, Check, X,
  ChevronRight, Sparkles, AlertTriangle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

const ROLE_OPTIONS = [
  { value: 'founder', label: 'Founder', icon: '🚀' },
  { value: 'investor', label: 'Investor', icon: '💰' },
  { value: 'operator', label: 'Operator', icon: '⚙️' },
  { value: 'other', label: 'Other', icon: '🔮' },
];

interface ProfileData {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  plan_status: string;
  role: string;
  created_at: string | null;
  preferences: Record<string, unknown>;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, refreshProfile } = useAuth();
  const { plan: billingPlan } = useBilling();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editRole, setEditRole] = useState('founder');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/profile`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
        setEditName(data.display_name || '');
        setEditRole(data.role || 'founder');
      }
    } catch (err) {
      console.error('[ProfilePage] Failed to fetch profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchProfile();
    else setIsLoading(false);
  }, [isLoggedIn, fetchProfile]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setSaveMessage({ text, type });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setIsSavingName(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ display_name: editName.trim() })
      });

      if (response.ok) {
        setProfileData(prev => prev ? { ...prev, display_name: editName.trim() } : prev);
        setIsEditingName(false);
        showToast('Name updated', 'success');
        await refreshProfile();
      } else {
        showToast('Failed to update name', 'error');
      }
    } catch {
      showToast('Failed to update name', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveRole = async (newRole: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setProfileData(prev => prev ? { ...prev, role: newRole } : prev);
        setEditRole(newRole);
        setIsEditingRole(false);
        showToast('Role updated', 'success');
      } else {
        showToast('Failed to update role', 'error');
      }
    } catch {
      showToast('Failed to update role', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (response.ok) {
        logout();
        navigate('/');
      } else {
        showToast('Failed to delete account', 'error');
      }
    } catch {
      showToast('Failed to delete account', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Not logged in
  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <User className="w-8 h-8 text-white/40" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white mb-2">Sign in to view your profile</h1>
            <p className="text-white/50 text-sm">Access your account, settings, and saved matches.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors text-sm"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-6 py-2.5 bg-white/10 text-white font-medium rounded-lg hover:bg-white/15 transition-colors text-sm border border-white/10"
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = billingPlan || profileData?.plan || 'free';
  const displayName = profileData?.display_name || user.name || user.email.split('@')[0];
  const memberSince = profileData?.created_at
    ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const currentRole = ROLE_OPTIONS.find(r => r.value === (profileData?.role || 'founder'));

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <LogoDropdownMenu />

      {/* Page header pill */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-full bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 text-slate-800 font-medium text-sm flex items-center gap-2 shadow-lg hover:from-slate-400 hover:via-slate-300 hover:to-slate-500 transition-all cursor-pointer"
          style={{
            boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.2)',
            textShadow: '0 1px 1px rgba(255,255,255,0.8)'
          }}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </div>

      {/* Toast notification */}
      {saveMessage && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
          saveMessage.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {saveMessage.text}
        </div>
      )}

      <div className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Profile Header Card ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                  {currentRole?.icon || '👤'}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Editable display name */}
                  {isEditingName ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        autoComplete="off"
                        className="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-white text-lg font-semibold focus:outline-none focus:border-cyan-500/50 w-full max-w-[240px]"
                        maxLength={100}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName}
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setIsEditingName(false); setEditName(displayName); }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-lg font-semibold text-white truncate">{displayName}</h1>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                        title="Edit name"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {user.isAdmin && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-full uppercase tracking-wider">
                          Admin
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-white/40 text-sm truncate">{user.email}</p>

                  {/* Role tag */}
                  <div className="flex items-center gap-2 mt-3">
                    {isEditingRole ? (
                      <div className="flex flex-wrap gap-2">
                        {ROLE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleSaveRole(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              editRole === opt.value
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {opt.icon} {opt.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setIsEditingRole(false)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingRole(true)}
                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-1.5"
                      >
                        {currentRole?.icon} {currentRole?.label || 'Founder'}
                        <Pencil className="w-3 h-3 text-white/30" />
                      </button>
                    )}
                  </div>

                  {memberSince && (
                    <p className="text-white/25 text-xs mt-2">Member since {memberSince}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Plan Card ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    {currentPlan === 'elite' ? (
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-white/40" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {currentPlan === 'elite' ? 'Elite' : currentPlan === 'pro' ? 'Pro' : 'Free'} Plan
                      {currentPlan === 'elite' && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">
                      {currentPlan === 'elite'
                        ? 'Full access to all features'
                        : currentPlan === 'pro'
                          ? 'Enhanced matching features'
                          : 'Basic signal discovery'}
                    </p>
                  </div>
                </div>
                {currentPlan !== 'elite' && (
                  <button
                    onClick={() => navigate('/pricing')}
                    className="px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-colors"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>

            {/* ── Quick Links ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-white/40" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Settings</div>
                    <div className="text-xs text-white/40">Email alerts, digest, timezone</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </button>

              <button
                onClick={() => navigate('/pricing')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-white/40" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Billing & Plans</div>
                    <div className="text-xs text-white/40">Manage subscription and payments</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </button>

              <button
                onClick={() => navigate('/app/signals-dashboard')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-white/40" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Signals Dashboard</div>
                    <div className="text-xs text-white/40">Your saved signals and matches</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </button>

              {user.isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-amber-400/60" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">Admin Dashboard</div>
                      <div className="text-xs text-amber-400/40">System management & controls</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20" />
                </button>
              )}
            </div>

            {/* ── Account Actions ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <LogOut className="w-5 h-5 text-white/40" />
                <span className="text-sm font-medium text-white">Sign out</span>
              </button>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-500/5 transition-colors"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400/50" />
                  <span className="text-sm text-red-400/70">Delete account</span>
                </button>
              ) : (
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-400 font-medium">Are you sure?</p>
                      <p className="text-xs text-white/40 mt-1">
                        This will permanently delete your account, all saved signals, and match history. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-8">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white/60 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Back Button ── */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 text-slate-800 font-medium text-sm rounded-xl shadow-lg hover:from-slate-400 hover:via-slate-300 hover:to-slate-500 transition-all"
                style={{
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.2)',
                  textShadow: '0 1px 1px rgba(255,255,255,0.8)'
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
