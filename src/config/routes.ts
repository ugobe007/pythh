/**
 * Route Configuration
 * 
 * Centralized route definitions for the application.
 * Use these constants instead of hardcoding route paths.
 */

export const ROUTES = {
  // Public Routes
  HOME: '/',
  LANDING: '/',
  GET_MATCHED: '/get-matched',
  CHECKOUT: '/checkout',
  SUBSCRIPTION_SUCCESS: '/get-matched/success',
  
  // Services & Tools
  SERVICES: '/services',
  SERVICE_DETAIL: (slug: string) => `/services/${slug}`,
  STRATEGIES: '/strategies',
  STARTUP_TOOLS: '/startup-tools',
  INVESTOR_TOOLS: '/investor-tools',
  
  // Discovery & Matching
  TRENDING: '/trending',
  MATCHING_ENGINE: '/matching-engine',
  SAVED_MATCHES: '/saved-matches',
  STARTUP_MATCHES: (startupId: string) => `/startup/${startupId}/matches`,
  INVESTOR_MATCHES: (investorId: string) => `/investor/${investorId}/matches`,
  TALENT_MATCHING: '/talent-matching',
  STARTUP_TALENT: (startupId: string) => `/startup/${startupId}/talent`,
  MARKET_INTELLIGENCE: '/market-intelligence',
  
  // Voting (Legacy)
  VOTE_CARDS: '/vote-cards',
  VOTE: '/vote',
  VOTE_DEMO: '/vote-demo',
  
  // User Pages
  SIGNUP: '/signup',
  LOGIN: '/login',
  ACCOUNT: '/account',
  PROFILE: '/profile',
  FEED: '/feed',
  PORTFOLIO: '/portfolio',
  SETTINGS: '/settings',
  
  // Startup Pages
  SUBMIT: '/submit',
  UPLOAD: '/upload',
  STARTUP_DETAIL: (id: string) => `/startup/${id}`,
  DEALS: '/deals',
  
  // Investor Pages
  INVESTORS: '/investors',
  INVESTOR_PROFILE: (id: string) => `/investor/${id}`,
  INVESTOR_EDIT: (id: string) => `/investor/${id}/edit`,
  INVITE_INVESTOR: '/invite-investor',
  
  // Dashboard
  DASHBOARD: '/dashboard',
  STARTUPS: '/startups',
  
  // Analytics & Intelligence
  METRICS: '/metrics',
  ANALYTICS: '/analytics',
  MARKET_TRENDS: '/market-trends',
  DATA_INTELLIGENCE: '/data-intelligence',
  DEMO: '/demo',
  
  // Navigation
  NAVIGATION: '/navigation',
  SITEMAP: '/navigation',
  
  // Static Pages
  ABOUT: '/why',
  PRIVACY: '/privacy',
  CONTACT: '/contact',
  
  // Admin Routes
  ADMIN: {
    BASE: '/admin',
    CONTROL: '/admin/control',
    REVIEW: '/admin/review',
    ANALYTICS: '/admin/analytics',
    AGENT: '/admin/agent',
    HEALTH: '/admin/health',
    INSTRUCTIONS: '/admin/instructions',
    
    // Data Management
    DISCOVERED_STARTUPS: '/admin/discovered-startups',
    DISCOVERED_INVESTORS: '/admin/discovered-investors',
    EDIT_STARTUPS: '/admin/edit-startups',
    QUICK_ADD_INVESTOR: '/admin/investors/add',
    INVESTOR_ENRICHMENT: '/admin/investor-enrichment',
    
    // Content Management
    RSS_MANAGER: '/admin/rss-manager',
    BULK_UPLOAD: '/admin/bulk-upload',
    BULK_IMPORT: '/admin/bulk-import',
    DOCUMENT_UPLOAD: '/admin/document-upload',
    
    // Scoring & Intelligence
    GOD_SCORES: '/admin/god-scores',
    AI_INTELLIGENCE: '/admin/ai-intelligence',
    ML_DASHBOARD: '/admin/ml-dashboard',
    AI_LOGS: '/admin/ai-logs',
    TALENT_MATCHING: '/admin/talent-matching',
    
    // Diagnostics
    DIAGNOSTIC: '/admin/diagnostic',
    DATABASE_CHECK: '/admin/database-check',
    
    // Migration Tools
    SETUP: '/admin/setup',
    SYNC: '/admin/sync',
    MIGRATE: '/admin/migrate',
    MIGRATE_DATA: '/admin/migrate-data',
  },
} as const;

/**
 * Route helper functions
 */
export const routeHelpers = {
  /**
   * Navigate to a route
   */
  navigate: (path: string) => path,
  
  /**
   * Check if a route is an admin route
   */
  isAdminRoute: (path: string): boolean => {
    return path.startsWith('/admin');
  },
  
  /**
   * Check if a route is a public route
   */
  isPublicRoute: (path: string): boolean => {
    return !path.startsWith('/admin') && path !== '/login' && path !== '/signup';
  },
  
  /**
   * Get route category
   */
  getRouteCategory: (path: string): 'public' | 'admin' | 'auth' => {
    if (path.startsWith('/admin')) return 'admin';
    if (path === '/login' || path === '/signup') return 'auth';
    return 'public';
  },
};




