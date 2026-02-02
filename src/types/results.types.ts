/**
 * Results Page Types - Step 5+ Architecture
 * Startup = control panel (source)
 * Investors = trophies (prize list)
 */

export type StartupSignal = {
  name: string;
  industry: string;
  stageLabel: string;
  signalScore: number;
  signalMax: number;
  phase: number; // 0..1
  velocityLabel: "building" | "surging" | "cooling";
  tierLabel: string; // "top_25" etc
  observers7d: number;
  matches: number;
  signalBand: "low" | "med" | "high";
  heat: "cool" | "warming" | "hot";
};

export type InvestorMatch = {
  id: string;
  name: string;
  subtitle?: string;
  focus: string;
  stage: string;
  check: string;
  signal: number;
  why: string;
  chips: string[];

  // Option A: contact data (best-effort; may be partial)
  contact?: {
    email?: string;
    website?: string;
    linkedin?: string;
    twitter?: string;
  };

  // Optional if scraper finds it (for warm intro strategy)
  portfolioCompanies?: Array<{
    name: string;
    website?: string;
    linkedin?: string;
  }>;
};
