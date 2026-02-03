/**
 * Signal definitions - hardcoded, founder-readable meanings
 * Used in: SignalTape, TranslatorLine, tooltips, help text
 */

export interface SignalDefinition {
  id: string;
  label: string;
  shortDef: string; // 1-liner for tape
  fullDef: string; // Full explanation
  whatItSignals: string; // Founder language
}

export const SIGNALS_DICT: Record<string, SignalDefinition> = {
  hiring: {
    id: "hiring",
    label: "Hiring",
    shortDef: "Execution capacity",
    fullDef: "Team expansion / key roles filled",
    whatItSignals: "Signals execution credibility; increases investor confidence.",
  },
  customers: {
    id: "customers",
    label: "Customers",
    shortDef: "Demand proof",
    fullDef: "Proof of customer adoption and validation",
    whatItSignals: "Validates demand + pricing power; increases round velocity.",
  },
  media: {
    id: "media",
    label: "Media",
    shortDef: "Narrative reach",
    fullDef: "Attention and narrative distribution",
    whatItSignals: "Raises awareness; increases inbound probability.",
  },
  product: {
    id: "product",
    label: "Product",
    shortDef: "Momentum shipped",
    fullDef: "Shipped improvements and feature releases",
    whatItSignals: "Demonstrates execution momentum; strengthens competitive position.",
  },
  velocity: {
    id: "velocity",
    label: "Velocity",
    shortDef: "Rate of progress",
    fullDef: "Speed of execution and momentum",
    whatItSignals: "Signals pace and urgency; increases alignment probability.",
  },
  capital_flow: {
    id: "capital_flow",
    label: "Capital Flow",
    shortDef: "Investor appetite",
    fullDef: "Funding activity and dry powder in your category",
    whatItSignals: "Validates investor appetite; signals fundraising window.",
  },
  goldilocks: {
    id: "goldilocks",
    label: "Goldilocks",
    shortDef: "Timing fit",
    fullDef: "Market timing and maturity alignment",
    whatItSignals: "Signals optimal market timing; increases acquisition speed.",
  },
  alignment: {
    id: "alignment",
    label: "Alignment",
    shortDef: "Investor match",
    fullDef: "Investors whose investment theses match your current signals",
    whatItSignals: "Increases fundraising probability; signals market validation.",
  },
  grit: {
    id: "grit",
    label: "Grit",
    shortDef: "Resilience shown",
    fullDef: "Founder resilience and perseverance",
    whatItSignals: "Signals founder durability; increases downside confidence.",
  },
  opportunity: {
    id: "opportunity",
    label: "Opportunity",
    shortDef: "Market upside",
    fullDef: "Market size and tailwind visibility",
    whatItSignals: "Signals TAM growth; increases upside potential.",
  },
  determination: {
    id: "determination",
    label: "Determination",
    shortDef: "Focus clarity",
    fullDef: "Focus and clarity on core priorities",
    whatItSignals: "Signals strategic clarity; increases execution odds.",
  },
  fomo: {
    id: "fomo",
    label: "FOMO",
    shortDef: "Competitive urgency",
    fullDef: "FOMO and competitive tension in your space",
    whatItSignals: "Creates urgency for investors; accelerates decision-making.",
  },
};

export function getSignalDef(signalId: string): SignalDefinition | null {
  const normalized = signalId.toLowerCase().replace(/[_\s]/g, "");
  for (const [key, def] of Object.entries(SIGNALS_DICT)) {
    if (key.replace(/[_\s]/g, "") === normalized) {
      return def;
    }
  }
  return null;
}

export function translateSignal(signalId: string): string {
  const def = getSignalDef(signalId);
  return def?.whatItSignals || "Signals market momentum.";
}
