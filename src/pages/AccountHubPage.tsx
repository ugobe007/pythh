/**
 * Post-login account hub: one place to see status and jump to founder profile, admin, or settings.
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { LayoutDashboard, Shield, Settings, LogOut } from 'lucide-react';

export default function AccountHubPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return <Navigate to="/login" state={{ redirectTo: '/account' }} replace />;
  }

  if (user.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const displayName = user.name || user.email?.split('@')[0] || 'Account';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <LogoDropdownMenu />

      <main className="max-w-lg mx-auto px-6 pt-24 pb-20">
        <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2">Your account</p>
        <h1 className="text-[26px] font-semibold text-zinc-100 leading-tight">Hello, {displayName}</h1>
        <p className="text-sm text-zinc-500 mt-2">{user.email}</p>
        {user.isAdmin && (
          <p className="text-xs text-amber-500/80 mt-3 font-medium">Administrator access is enabled for this account.</p>
        )}

        <div className="mt-10 space-y-3">
          <Link
            to="/profile"
            className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/35 p-4 hover:border-cyan-500/35 hover:bg-zinc-900/55 transition-colors group"
          >
            <LayoutDashboard className="w-5 h-5 text-cyan-500/80 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-zinc-100 group-hover:text-cyan-300 transition-colors">
                Founder profile
              </div>
              <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Your dashboard: signals, investor matches, and next steps.
              </div>
            </div>
          </Link>

          {user.isAdmin && (
            <Link
              to="/admin"
              className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 hover:border-amber-500/45 hover:bg-amber-950/30 transition-colors group"
            >
              <Shield className="w-5 h-5 text-amber-400/90 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-100 group-hover:text-amber-50 transition-colors">
                  Admin panel
                </div>
                <div className="text-xs text-amber-200/45 mt-1 leading-relaxed">
                  Review queue, RSS, scrapers, health, and operator tools.
                </div>
              </div>
            </Link>
          )}

          <Link
            to="/settings"
            className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 hover:border-zinc-600 transition-colors group"
          >
            <Settings className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">Settings</div>
              <div className="text-xs text-zinc-500 mt-1">Account preferences and notifications</div>
            </div>
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
