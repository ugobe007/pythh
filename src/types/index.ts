/**
 * SINGLE SOURCE OF TRUTH (SSOT) FOR TYPES
 * 
 * All type definitions should be imported from here.
 * This file re-exports types from the database schema.
 * 
 * Usage:
 *   import { Startup, Investor, StartupComponent, InvestorComponent } from '@/types';
 * 
 * For adapters to convert between formats:
 *   import { adaptStartupForComponent, adaptInvestorForComponent } from '@/utils/adapters';
 */

// Re-export SSOT types from database schema
export type {
  Startup,
  StartupInsert,
  StartupUpdate,
  Investor,
  InvestorInsert,
  InvestorUpdate,
  DiscoveredStartup,
  Match
} from '../lib/database.types';

// Re-export supporting types that are commonly used
export type { Database } from '../lib/database.types';

// Define Startup and Investor interfaces for components that need them directly
type Startup = import('../lib/database.types').Startup;
type Investor = import('../lib/database.types').Investor;

/**
 * Component-specific types that extend the base types
 * These are for UI components that need additional computed/display fields
 */

// Extended Startup type for components (includes computed fields)
export interface StartupComponent extends Startup {
  // Computed/display fields
  hotness?: number;
  yesVotes?: number;
  noVotes?: number;
  rating?: number;
  comments?: Comment[];
  
  // Legacy compatibility fields (will be deprecated)
  description?: string;
  marketSize?: string;
  unique?: string;
  raise?: string;
  video?: string;
  deck?: string;
  press?: string;
  tech?: string;
  teamLogos?: string[];
  stage?: number;
  tagline?: string;
  pitch?: string;
  fivePoints?: string[];
  industries?: string[];
  answersCount?: number;
  team?: string;  // Team description
  
  // Extended fields
  founders?: Founder[];
  ipFilings?: IPFiling[];
  teamHires?: TeamMember[];
  advisors?: Advisor[];
  boardMembers?: Advisor[];
  customerTraction?: CustomerTraction[];
  
  // Funding velocity fields (from enrichment)
  funding_velocity_score?: number;
  funding_rounds_count?: number;
  has_repeat_founder_with_exit?: boolean;
  founder_previous_exits?: number;
}

// Supporting types for components
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface Founder {
  name: string;
  role: string;
  background?: string;
  linkedin?: string;
}

export interface IPFiling {
  type: string;
  title: string;
  date: string;
  status: string;
}

export interface TeamMember {
  name: string;
  role: string;
  joined: string;
}

export interface Advisor {
  name: string;
  role: string;
  company?: string;
}

export interface CustomerTraction {
  metric: string;
  value: number;
  description?: string;
}

// Extended Investor type for components
export interface InvestorComponent extends Investor {
  // Computed/display fields
  portfolioCount?: number;
  exits?: number;
  unicorns?: number;
  notableInvestments?: any[];
  totalInvestments?: number;
  investmentPace?: number;
  lastInvestmentDate?: string;
  hotHoneyInvestments?: number;
  hotHoneyStartups?: string[];
  
  // Legacy/alias fields for component compatibility
  type?: string;  // Maps to investor_tier or 'VC' default
  tagline?: string;  // Maps to investment_thesis
  description?: string;  // Maps to bio
  geography?: string;  // Maps to geography_focus[0]
  checkSize?: string;  // Formatted check_size_min - check_size_max
  checkSizeMin?: number;  // Alias for check_size_min
  checkSizeMax?: number;  // Alias for check_size_max
  website?: string;  // Maps to blog_url
  linkedin?: string;  // Maps to linkedin_url
  twitter?: string;  // Maps to twitter_url
  aum?: number;  // Maps to active_fund_size
  fundSize?: number;  // Maps to active_fund_size
  portfolio_size?: number;  // Alias for total_investments
}

// Re-export verification types
export * from './verification';