export type PublicMomentum = "Cooling" | "Stable" | "Warming" | "Surge";
export type PublicTiming = "Closed" | "Opening" | "Active" | "Closing";
export type StageBand = "Pre-Seed" | "Seed" | "Early A" | "Series A" | "Growth" | "Unknown";

export interface PublicSignalPulse {
  pulseId: string;
  computedAt: string; // ISO

  // visibility
  isAnonymized: boolean;
  displayName?: string; // only if public/opt-in

  // summary
  category: string;
  stageBand: StageBand;
  momentum: PublicMomentum;
  timingWindow: PublicTiming;

  // deltas
  alignmentBefore: number; // 0-100
  alignmentAfter: number;  // 0-100
  readinessBefore: number; // 0-100
  readinessAfter: number;  // 0-100

  // what drove the change (max 2)
  triggerSignals: string[]; // e.g., ["Customer Proof ↑", "Product Velocity ↑"]

  // what it unlocked
  unlockedInvestorsCount: number;
  investorClass: "Pre-Seed" | "Seed" | "Early A" | "Series A" | "Growth";

  // optional action tie-in (mirrors your ActionsTab concept)
  recommendedAction?: {
    title: string;
    probabilityDeltaPct?: number;
  };
}

export interface PublicPulseQuery {
  category?: string;
  stageBand?: StageBand;
  momentum?: PublicMomentum;
  limit?: number;
}
