import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Settings,
  Bookmark,
  History,
  FileText,
  Lock,
  Cpu,
  Home,
  LogIn,
  LogOut,
  Sliders,
  Activity,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from '../lib/analytics';
import { getSession } from '../lib/routeGuards';

interface Props {
  onPythClick?: () => void;
  /** External control: when true, drawer opens */
  externalOpen?: boolean;
  /** Callback when open state changes (for external control) */
  onOpenChange?: (open: boolean) => void;
  /** 
   * Mode controls what UI gets rendered:
   * - 'app': Full UI with trigger button and Back/Home pills (default)
   * - 'oracle': Drawer content only, no floating UI (OracleHeader provides trigger)
   */
  mode?: 'app' | 'oracle';
}

/**
 * SYSTEM DRAWER - Pyth "Quiet Instrument" Design
 *
 * Goals:
 * - Monochrome base (no yellow buttons)
 * - Thin rows, clear hierarchy
 * - Accent (amber) only for emphasis/hover/admin
 * - Admin section not in DOM unless admin
 */
export default function LogoDropdownMenu({ onPythClick, externalOpen, onOpenChange, mode = 'app' }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Oracle mode = drawer content only, no floating trigger/pills
  const isOracleMode = mode === 'oracle';
  
  // Use external control if provided, otherwise internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasScan, setHasScan] = useState(false);
  const [userRole, setUserRole] = useState<'founder' | 'investor'>('founder');

  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Single source of truth: logged in = user exists
  const isLoggedIn = !!user;

  const ADMIN_EMAILS = [
    'aabramson@comunicano.com',
    'ugobe07@gmail.com',
    'ugobe1@mac.com'
  ];

  useEffect(() => {
    const checkAuth = () => {
      // Get session state (scan status)
      const session = getSession();
      setHasScan(session.hasSubmittedUrl);
      
      // Get role from localStorage (this is intentional - role persists across sessions)
      const savedRole = (localStorage.getItem('userRole') as 'founder' | 'investor') || 'founder';
      setUserRole(savedRole);

      // Admin check: use user from useAuth() as primary source
      let adminStatus = false;

      if (user) {
        adminStatus =
          Boolean(user.isAdmin) ||
          (user.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false);
      }

      setIsAdmin(adminStatus);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    trackEvent('drawer_opened');
  };

  const handleClose = () => {
    setIsOpen(false);
    trackEvent('drawer_closed');
  };

  const toggleRole = () => {
    const newRole = userRole === 'founder' ? 'investor' : 'founder';
    setUserRole(newRole);
    localStorage.setItem('userRole', newRole);
    trackEvent('role_toggled', { from: userRole, to: newRole });
  };

  const Row = ({
    to,
    icon: Icon,
    label,
    subtle,
    onClick
  }: {
    to: string;
    icon: any;
    label: string;
    subtle?: boolean;
    onClick?: () => void;
  }) => (
    <Link
      to={to}
      onClick={() => {
        onClick?.();
        handleClose();
      }}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all
        ${subtle ? 'opacity-70 hover:opacity-100' : ''}
        hover:bg-white/5`}
    >
      <Icon className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
        {label}
      </span>
    </Link>
  );

  const SectionLabel = ({ children }: { children: string }) => (
    <p className="text-[10px] text-gray-600 px-3 mt-4 mb-2 uppercase tracking-[0.18em]">
      {children}
    </p>
  );

  return (
    <>

      {/* Header bar with logo + hamburger - hidden on Oracle Gate (OracleHeader provides its own) */}
      {!isOracleMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Logo (left side) */}
            <Link to="/" className="group flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-wide text-white/90 group-hover:text-white">
                pythh.ai
              </span>
              <span className="text-xs tracking-[0.25em] text-white/40 group-hover:text-white/60 hidden sm:inline">
                SIGNAL SCIENCE
              </span>
            </Link>

            {/* Right side: Sign in + Hamburger */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                Sign in
              </Link>
              <button
                onClick={() => (isOpen ? handleClose() : handleOpen())}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 hover:bg-white/10 hover:text-white transition"
                aria-label="Open menu"
              >
                <div className="flex flex-col gap-1 w-[18px]">
                  <div className="h-0.5 rounded-full bg-current" />
                  <div className="h-0.5 rounded-full bg-current" />
                  <div className="h-0.5 rounded-full bg-current" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu ref for Oracle mode (OracleHeader triggers drawer) */}
      {isOracleMode && <div ref={menuRef} />}

      {isOpen && (
        <div className="fixed inset-0 z-[60]">
          {/* Overlay - button element so clicks close the drawer but don't propagate */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={handleClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          {/* Panel - positioned from the right side */}
          <div
            ref={menuRef}
            className="absolute right-4 top-4 w-[320px] z-10 rounded-2xl border border-white/10 bg-[#0a0a0a]/95 shadow-2xl overflow-hidden"
          >
            {/* Header - Brand lockup */}
            <div className="px-4 py-4 border-b border-white/10">
              <div className="text-xs tracking-[0.25em] text-white/40">PYTHH.AI</div>
              <div className="text-sm font-semibold text-white/90">Find my investors</div>
              <div className="text-xs text-white/45 mt-1">Investor discovery for founders</div>
            </div>

            <div className="p-2 max-h-[72vh] overflow-y-auto space-y-1">
              {/* DEMO FIRST - Before anything else */}
              <MenuItem to="/" label="Home" sub="Find your investor matches" onClose={handleClose} />
              <MenuItem to="/demo" label="Live Demo" sub="Capital navigation in 60 seconds" onClose={handleClose} />
              <MenuItem to="/how-it-works" label="How it works" sub="GOD scoring + investor matching" onClose={handleClose} />
              <MenuItem to="/value" label="What you get" sub="Free vs paid features" onClose={handleClose} />

              <div className="h-px bg-white/10 my-2" />

              {/* PRICING AFTER BENEFITS */}
              <MenuItem to="/pricing" label="Pricing" sub="Only after you understand the value" onClose={handleClose} />
              
              {isLoggedIn ? (
                <>
                  <MenuItem to="/app/oracle" label="Pythh Oracle" sub="Signal coaching & VC alignment" onClose={handleClose} />
                  <MenuItem to="/profile" label="Dashboard" sub="Signals, matches, actions" onClose={handleClose} />
                  <MenuItem to="/saved-matches" label="Saved Matches" sub="Your signal map" onClose={handleClose} />
                </>
              ) : (
                <MenuItem to="/login" label="Sign in" sub="Access saved matches + outreach" onClose={handleClose} />
              )}

              {/* What is Pythh - special button */}
              {onPythClick && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onPythClick();
                  }}
                  className="w-full text-left rounded-xl px-4 py-3 hover:bg-white/5 transition"
                >
                  <div className="text-sm font-semibold text-white/90">What is Pythh?</div>
                  <div className="text-xs text-white/45 mt-0.5">How investor discovery works</div>
                </button>
              )}

              {/* Admin Section */}
              {isAdmin && (
                <>
                  <div className="h-px bg-amber-500/20 my-2" />
                  <div className="text-[9px] text-amber-500/70 uppercase tracking-widest px-4 py-1">
                    Operator
                  </div>
                  <MenuItem to="/admin/control" label="Control" sub="System settings" onClose={handleClose} />
                  <MenuItem to="/admin/health" label="Health" sub="System status" onClose={handleClose} />
                  <MenuItem to="/admin/pipeline" label="Pipelines" sub="Data flows" onClose={handleClose} />
                </>
              )}

              {/* Logout */}
              {isLoggedIn && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      trackEvent('logout_completed');
                      handleClose();
                      navigate('/');
                    }}
                    className="w-full text-left rounded-xl px-4 py-3 hover:bg-red-500/10 transition"
                  >
                    <div className="text-sm font-semibold text-red-400/80">Logout</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 
 * MenuItem - Real Link route that navigates AND closes drawer 
 * This is the fix for "menu links don't work"
 */
function MenuItem({ 
  to, 
  label, 
  sub, 
  onClose 
}: { 
  to: string; 
  label: string; 
  sub?: string; 
  onClose: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={() => onClose()}
      className="block rounded-xl px-4 py-3 hover:bg-white/5 transition"
    >
      <div className="text-sm font-semibold text-white/90">{label}</div>
      {sub && <div className="text-xs text-white/45 mt-0.5">{sub}</div>}
    </Link>
  );
}
