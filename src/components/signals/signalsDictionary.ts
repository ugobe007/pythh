export type SignalLane = "TEAM" | "PRODUCT" | "MARKET" | "CAPITAL";

export type SignalDef = {
  id: string;           // matches channel id (e.g., "hiring")
  label: string;        // display label
  lane: SignalLane;
  meaning: string;      // what it means
  consequence: string;  // why it matters
};

export const SIGNAL_DEFS: SignalDef[] = [
  // TEAM
  {
    id: "talent",
    label: "Talent",
    lane: "TEAM",
    meaning: "Quality/strength of the team signal footprint.",
    consequence: "Stronger team signals increase execution credibility.",
  },
  {
    id: "hiring",
    label: "Hiring",
    lane: "TEAM",
    meaning: "Hiring momentum or senior role additions.",
    consequence: "Signals capacity and seriousness; improves investor confidence.",
  },
  {
    id: "grit",
    label: "Grit",
    lane: "TEAM",
    meaning: "Consistency of effort under difficulty.",
    consequence: "Raises belief you'll push through setbacks.",
  },

  // PRODUCT
  {
    id: "product",
    label: "Product",
    lane: "PRODUCT",
    meaning: "Shipping, iteration cadence, product proof signals.",
    consequence: "Improves defensibility + momentum perception.",
  },
  {
    id: "velocity",
    label: "Velocity",
    lane: "PRODUCT",
    meaning: "Rate of progress and compounding momentum.",
    consequence: "High velocity shortens time-to-conviction for investors.",
  },
  {
    id: "determination",
    label: "Determination",
    lane: "PRODUCT",
    meaning: "Focus + follow-through signals.",
    consequence: "Increases confidence you'll execute the plan.",
  },

  // MARKET
  {
    id: "customers",
    label: "Customers",
    lane: "MARKET",
    meaning: "Demand proof: revenue, deployments, logos, usage.",
    consequence: "The strongest de-risker; accelerates investor receptivity.",
  },
  {
    id: "opportunity",
    label: "Opportunity",
    lane: "MARKET",
    meaning: "Market size and upside tailwinds.",
    consequence: "Bigger opportunity increases ceiling → better funding odds.",
  },
  {
    id: "media",
    label: "Media",
    lane: "MARKET",
    meaning: "Narrative distribution: press, podcasts, mentions.",
    consequence: "Increases inbound probability and social proof.",
  },

  // CAPITAL
  {
    id: "capital_flow",
    label: "Capital Flow",
    lane: "CAPITAL",
    meaning: "Funding activity and appetite in your category.",
    consequence: "Rising flows mean faster meetings + higher conversion rates.",
  },
  {
    id: "alignment",
    label: "Alignment",
    lane: "CAPITAL",
    meaning: "Investors whose theses match your current signal profile.",
    consequence: "More alignment = more reachable meetings.",
  },
  {
    id: "fomo",
    label: "FOMO",
    lane: "CAPITAL",
    meaning: "Attention intensity: people watching, comparing, reacting.",
    consequence: "FOMO increases speed and reduces negotiation friction.",
  },
  {
    id: "goldilocks",
    label: "Goldilocks",
    lane: "CAPITAL",
    meaning: "Timing fit: not too early, not too late.",
    consequence: "Better timing widens your fundraising window.",
  },
];
