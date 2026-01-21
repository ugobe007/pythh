export type Mode = "Estimate" | "Verified";

export type Momentum = "Cooling" | "Stable" | "Warming" | "Surge";
export type SignalStrength = "Low" | "Medium" | "High";
export type TimingWindow = "Closed" | "Opening" | "Active" | "Closing";

export type Trend = "↑" | "→" | "↓";
export type Strength = "Strong" | "Medium" | "Weak";

export type Sensitivity = "Low" | "Medium" | "High";
export type Sentiment = "Favorable" | "Neutral" | "Unfavorable";

export interface EvidenceItem {
  source: "website" | "github" | "linkedin" | "press" | "social" | "internal" | "manual";
  label: string;           // short: "Product releases", "Hiring page", etc.
  timestamp?: string;      // ISO string
  excerpt?: string;        // 1–2 lines max
  url?: string;
}

export interface StartupSignal {
  kind: "startup";
  name: string;
  strength: Strength;
  trend: Trend;
  sensitivity: Sensitivity;
  weight: number;          // 0–1
  evidence?: EvidenceItem[];
}

export interface InvestorSignal {
  kind: "investor";
  name: string;
  status: "High" | "Active" | "Low" | "Increasing" | "Moderate" | "Neutral" | Sentiment | string;
  trend: Trend;
  weight: number;          // 0–1
  evidence?: EvidenceItem[];
}

export interface MarketSignal {
  kind: "market";
  name: string;
  status: "Rising" | "Entering" | "Neutral" | "Moderate" | "Increasing" | Sentiment | string;
  trend: Trend;
  weight: number;          // 0–1
  evidence?: EvidenceItem[];
}

export interface Odds {
  readinessScore: number;          // 0–100
  readinessTrendDelta7d?: number;  // e.g. +6
  breakdown: {
    execution: number;
    traction: number;
    narrative: number;
    marketTiming: number;
  };
  alignment: {
    thesis: number;
    stage: number;
    signal: number;
    timing: number;
    overall: number;
  };
  objections: Array<{
    id: number;
    text: string;
    affects: string;
    probability: "High" | "Medium" | "Low";
  }>;
  timing: {
    status: TimingWindow;
    etaText?: string;      // "4–8 weeks"
    progressPct: number;   // 0–100 for bar
    interpretation: string;
  };
  interpretation: string;
}

export interface ActionItem {
  id: number;
  title: string;
  probabilityDeltaPct: number;   // e.g. 14 means +14%
  affects: string;
  timeToImpact: string;
  investorsUnlocked: number;
  objectionsReduced: number;
  description: string;
  signalsAffected?: string[];
  evidence?: EvidenceItem[];
}

export interface UnlockPreview {
  alignmentStrengthPct: number;  // e.g. 82
  alignmentDeltaPct: number;     // e.g. +8
  timingWindowAfter: TimingWindow; // e.g. "Active"
  investorsUnlockedTotal: number;  // e.g. 27
  leadProbabilityDeltaPct: number; // e.g. 19
}

export interface SignalSnapshot {
  startupId?: string;
  startupUrl?: string;
  computedAt: string; // ISO

  // Top bar
  stage: string;
  momentum: Momentum;
  signalStrength: SignalStrength;
  category: string;
  timingWindow: TimingWindow;
  mode: Mode;

  // Panels
  startupSignals: StartupSignal[];
  investorSignals: InvestorSignal[];
  marketSignals: MarketSignal[];

  odds: Odds;
  actions: {
    priority: ActionItem[];
    attenuation: {
      narrative: Array<{ action: string; signalsAffected: string[]; investorsUnlocked: number }>;
      traction: Array<{ action: string; signalsAffected: string[]; investorsUnlocked: number }>;
      team: Array<{ action: string; signalsAffected: string[]; investorsUnlocked: number }>;
    };
    unlockPreview: UnlockPreview;
  };
}
