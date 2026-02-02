/**
 * ============================================================================
 * BULLETPROOF ROUTING SYSTEM (Phase 5+)
 * ============================================================================
 * Type-safe route builders that guarantee valid URLs.
 * Prevents hardcoded paths, broken links, and URL drift.
 * 
 * Current Hot Honey flow:
 *   / → /discover → /matches?url=...
 * 
 * Evolution to Signals-First:
 *   / → /find → /signals/:id (with tabs)
 * 
 * Usage:
 *   import { routes } from '@/routes';
 *   navigate(routes.results(startupId));
 *   <Link to={routes.resultsInvestors(startupId)}>Investors</Link>
 * ============================================================================
 */

export const routes = {
  // ============================================================================
  // ENTRY POINTS
  // ============================================================================
  
  /** Home page: "Find my investors" */
  home: () => `/` as const,
  
  /** URL submission flow (current) */
  discover: () => `/discover` as const,
  
  /** Find by company name (future) */
  findByName: () => `/find/name` as const,
  
  /** Claim startup (future) */
  claim: (startupId: string) => `/claim/${startupId}` as const,

  // ============================================================================
  // RESULTS (Current: /matches | Future: /signals/:id)
  // ============================================================================
  
  /**
   * CURRENT: /matches?url=...
   * Resolves URL → redirects to canonical results
   */
  resultsByUrl: () => `/matches` as const,
  
  /**
   * FUTURE: /signals/:id (canonical results)
   * Stable URL that works even if company changes URL/name
   */
  signals: (startupId: string) => `/signals/${startupId}` as const,
  
  /**
   * FUTURE: /signals/:id/investors (default tab)
   */
  signalsInvestors: (startupId: string) => `/signals/${startupId}/investors` as const,
  
  /**
   * FUTURE: /signals/:id/your-signals (what VCs see)
   */
  signalsYourSignals: (startupId: string) => `/signals/${startupId}/your-signals` as const,
  
  /**
   * FUTURE: /signals/:id/improve (guidance)
   */
  signalsImprove: (startupId: string) => `/signals/${startupId}/improve` as const,
  
  /**
   * FUTURE: /signals/:id/proof (case studies)
   */
  signalsProof: (startupId: string) => `/signals/${startupId}/proof` as const,
  
  /**
   * FUTURE: /signals/:id/referrals (warm intros)
   */
  signalsReferrals: (startupId: string) => `/signals/${startupId}/referrals` as const,

  // ============================================================================
  // INVESTOR PROFILES
  // ============================================================================
  
  /**
   * Investor profile page
   * Current: /investor/:id
   */
  investorProfile: (investorId: string) => `/investor/${investorId}` as const,

  // ============================================================================
  // EDUCATION & TOOLS
  // ============================================================================
  
  /** Signals 101: what are investor signals? */
  signals101: () => `/signals` as const,
  
  /** Signal strength calculator */
  toolsSignals: () => `/tools/signals` as const,
  
  /** GOD algorithm methodology */
  methodology: () => `/methodology` as const,
  
  /** Public proof/case studies */
  proof: () => `/proof` as const,

  // ============================================================================
  // USER ACCOUNT
  // ============================================================================
  
  /** Login page */
  login: () => `/login` as const,
  
  /** My account */
  me: () => `/me` as const,
  
  /** My watchlist */
  meWatchlist: () => `/me/watchlist` as const,
  
  /** Update my startup */
  meUpdates: () => `/me/update` as const,

  // ============================================================================
  // INVESTOR DASHBOARD (Future / Gated)
  // ============================================================================
  
  /** Investor home */
  investorHome: () => `/investor` as const,
  
  /** Investor watchlist */
  investorWatchlist: () => `/investor/watchlist` as const,
  
  /** Startup deep dive for investors */
  investorStartup: (startupId: string) => `/investor/startups/${startupId}` as const,

  // ============================================================================
  // ADMIN (Preserved)
  // ============================================================================
  
  /** Admin dashboard */
  admin: () => `/admin` as const,
  
  /** System health dashboard */
  adminHealth: () => `/admin/health` as const,
  
  /** AI logs */
  adminLogs: () => `/admin/ai-logs` as const,
};

// ============================================================================
// URL BUILDERS (with querystrings)
// ============================================================================

/**
 * Build /matches?url=... (current flow)
 */
export const buildResultsByUrl = (url: string): string => {
  const normalized = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${routes.resultsByUrl()}?url=${encodeURIComponent(normalized)}`;
};

/**
 * Build /signals/:id?ref=... (future analytics)
 */
export const buildSignalsWithRef = (startupId: string, ref: string): string => {
  return `${routes.signals(startupId)}?ref=${encodeURIComponent(ref)}`;
};

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Type-safe navigation state for programmatic routing
 */
export type NavigateWithState = {
  to: string;
  state?: {
    fromSubmit?: boolean;
    referrer?: string;
    [key: string]: any;
  };
};

/**
 * Build navigation with state (for React Router navigate())
 */
export const buildNavigateState = (to: string, state?: NavigateWithState['state']): NavigateWithState => ({
  to,
  state,
});

// ============================================================================
// ROUTE GUARDS
// ============================================================================

/**
 * Check if URL requires authentication
 */
export const requiresAuth = (pathname: string): boolean => {
  const authRoutes = ['/me', '/investor/watchlist', '/investor/startups'];
  return authRoutes.some(route => pathname.startsWith(route));
};

/**
 * Check if URL is admin-only
 */
export const requiresAdmin = (pathname: string): boolean => {
  return pathname.startsWith('/admin');
};

// ============================================================================
// ROUTE PARSING
// ============================================================================

/**
 * Extract startup ID from /signals/:id or /signals/:id/tab
 */
export const parseSignalsRoute = (pathname: string): { startupId: string; tab?: string } | null => {
  const match = pathname.match(/^\/signals\/([a-f0-9-]+)(?:\/(.+))?$/);
  if (!match) return null;
  return {
    startupId: match[1],
    tab: match[2],
  };
};

/**
 * Extract investor ID from /investor/:id
 */
export const parseInvestorRoute = (pathname: string): { investorId: string } | null => {
  const match = pathname.match(/^\/investor\/([a-f0-9-]+)$/);
  if (!match) return null;
  return { investorId: match[1] };
};

// ============================================================================
// BACKWARDS COMPATIBILITY (Phase B cleanup)
// ============================================================================

/**
 * Legacy route aliases (preserve querystring)
 */
export const legacyRedirects: Record<string, (qs: string) => string> = {
  '/discovery': (qs) => `/discover${qs}`,
  '/pythh': (qs) => `/discover${qs}`,
  '/hotmatch': (qs) => `/discover${qs}`,
  '/results': (qs) => `/matches${qs}`,
};

/**
 * Get redirect target for legacy route (or null)
 */
export const getLegacyRedirect = (pathname: string, search: string): string | null => {
  const redirect = legacyRedirects[pathname];
  return redirect ? redirect(search) : null;
};
