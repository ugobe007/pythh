import type { EvidenceItem, TimingWindow, Mode } from "./snapshot";

export type Conviction = "High" | "Medium" | "Low";

export interface InvestorMatch {
  id: string;
  name: string;
  firm?: string;
  alignmentScore: number; // 0-100
  stageFit: "Pre-Seed" | "Seed" | "Early A" | "Series A" | "Growth" | "Unknown";
  timingFit: TimingWindow; // Closed/Opening/Active/Closing
  conviction: Conviction;

  whyAligned: string[]; // 1-3 bullets
  respondsToSignals: string[]; // top 3 signal names
  objections: string[]; // top 2
  bestNarrativeAngle: string;

  // ties to ActionsTab
  unlockCondition?: {
    actionId: number;           // e.g. Action 1
    actionTitle: string;        // "Strengthen customer proof"
    unlocksCount: number;       // how many similar investors become reachable
  };

  warmIntroPaths?: Array<{
    label: string;              // "2nd-degree via X"
    detail?: string;
    isLocked: boolean;          // locked if mode === Estimate
  }>;

  evidence?: EvidenceItem[];
}

export interface InvestorsResponse {
  mode: Mode;
  matches: InvestorMatch[];
}
