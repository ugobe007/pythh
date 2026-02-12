/**
 * V5.1 Route Guards + Analytics
 * 
 * State-based access control:
 * - L0 (public): /, /get-matched, /login, /pricing, /checkout, /about, /privacy
 * - L1 (signals): /feed, /demo → requires login OR post-submit session
 * - L2 (matches): /instant-matches, /saved-matches, /startup/:id, /investor/:id → requires scan OR login
 * - L4 (connect): → requires phase >= 4
 * - L5 (admin): requires role === admin
 * 
 * Non-negotiable: If user hits gated route directly, redirect to / with toast
 */

import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from './analytics';
import { isAdminEmail } from './adminConfig';

// Session state stored in sessionStorage (not localStorage - ephemeral)
const SESSION_KEY = 'pyth_session';

interface SessionState {
  hasSubmittedUrl: boolean;
  lastScanTimestamp: number | null;
  scannedUrls: string[];
  phase: number; // 0=unknown, 1=curious, 2=engaged, 3=ready, 4=connected
}

const defaultSession: SessionState = {
  hasSubmittedUrl: false,
  lastScanTimestamp: null,
  scannedUrls: [],
  phase: 0
};

// Session management
export function getSession(): SessionState {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : defaultSession;
  } catch {
    return defaultSession;
  }
}

export function updateSession(updates: Partial<SessionState>): SessionState {
  const current = getSession();
  const updated = { ...current, ...updates };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export function markUrlSubmitted(url: string): void {
  const session = getSession();
  updateSession({
    hasSubmittedUrl: true,
    lastScanTimestamp: Date.now(),
    scannedUrls: [...session.scannedUrls, url].slice(-10), // Keep last 10
    phase: Math.max(session.phase, 2) // At least phase 2 after scan
  });
  trackEvent('url_submitted', { url });
}

export function advancePhase(newPhase: number): void {
  const session = getSession();
  if (newPhase > session.phase) {
    updateSession({ phase: newPhase });
    trackEvent('phase_advanced', { from: session.phase, to: newPhase });
  }
}

// Toast notification (simple inline implementation)
let toastTimeout: NodeJS.Timeout | null = null;

export function showToast(message: string): void {
  // Remove existing toast
  const existing = document.getElementById('pyth-toast');
  if (existing) existing.remove();
  if (toastTimeout) clearTimeout(toastTimeout);
  
  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'pyth-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 1px solid rgba(255, 90, 9, 0.4);
      border-radius: 12px;
      padding: 12px 20px;
      color: #fff;
      font-size: 14px;
      font-family: 'SF Mono', Monaco, monospace;
      z-index: 9999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: slideUp 0.3s ease-out;
    ">
      <span style="color: #FF5A09;">⚡</span> ${message}
    </div>
    <style>
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    </style>
  `;
  document.body.appendChild(toast);
  
  // Auto-remove after 4 seconds
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE GUARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface GuardProps {
  children: React.ReactNode;
}

/**
 * L1 Guard: Requires login OR post-submit session
 * For: /feed, /demo
 */
export function L1Guard({ children }: GuardProps): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const session = getSession();
  
  const hasAccess = !!user || session.hasSubmittedUrl;
  
  useEffect(() => {
    if (!hasAccess) {
      trackEvent('guard_blocked', { level: 'L1', path: location.pathname });
    }
  }, [hasAccess, location.pathname]);
  
  if (!hasAccess) {
    showToast('Run a scan to reveal access.');
    return <Navigate to="/" state={{ redirectTo: location.pathname }} replace />;
  }
  
  return <>{children}</>;
}

/**
 * L2 Guard: Requires login OR scan completion
 * For: /instant-matches, /saved-matches, /startup/:id, /investor/:id
 */
export function L2Guard({ children }: GuardProps): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const session = getSession();
  
  // Only allow ?url= bypass for /instant-matches (scan in progress)
  // Prevents backdoor access to other L2 routes via ?url=anything
  const searchParams = new URLSearchParams(location.search);
  const isInstantMatches = location.pathname === '/instant-matches';
  const hasUrlParam = isInstantMatches && !!searchParams.get('url');
  
  const hasAccess = !!user || session.hasSubmittedUrl || hasUrlParam;
  
  useEffect(() => {
    if (!hasAccess) {
      trackEvent('guard_blocked', { level: 'L2', path: location.pathname });
    }
  }, [hasAccess, location.pathname]);
  
  if (!hasAccess) {
    showToast('Run a scan to reveal access.');
    return <Navigate to="/" state={{ redirectTo: location.pathname }} replace />;
  }
  
  return <>{children}</>;
}

/**
 * L4 Guard: Requires phase >= 4 (connection phase)
 * For: /invite-investor, /contact (when gated)
 */
export function L4Guard({ children }: GuardProps): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const session = getSession();
  
  const hasAccess = !!user || session.phase >= 4;
  
  useEffect(() => {
    if (!hasAccess) {
      trackEvent('guard_blocked', { level: 'L4', path: location.pathname });
    }
  }, [hasAccess, location.pathname]);
  
  if (!hasAccess) {
    showToast('Complete your signal journey to unlock connections.');
    return <Navigate to="/" state={{ redirectTo: location.pathname }} replace />;
  }
  
  return <>{children}</>;
}

/**
 * L5 Guard: Requires admin role
 * For: /admin/*
 */
export function L5Guard({ children }: GuardProps): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  
  const isAdmin = user?.isAdmin === true || isAdminEmail(user?.email);
  
  useEffect(() => {
    if (!isAdmin) {
      trackEvent('guard_blocked', { level: 'L5', path: location.pathname });
    }
  }, [isAdmin, location.pathname]);
  
  if (!isAdmin) {
    showToast('Admin access required.');
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

/**
 * Auth Guard: Requires login (any authenticated user)
 */
export function AuthGuard({ children }: GuardProps): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  
  useEffect(() => {
    if (!user) {
      trackEvent('guard_blocked', { level: 'auth', path: location.pathname });
    }
  }, [user, location.pathname]);
  
  if (!user) {
    showToast('Login required.');
    return <Navigate to="/login" state={{ redirectTo: location.pathname }} replace />;
  }
  
  return <>{children}</>;
}
