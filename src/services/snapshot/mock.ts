import type { SignalSnapshot } from '../../types/snapshot';

export function buildMockSnapshot(): SignalSnapshot {
  const now = new Date().toISOString();

  return {
    computedAt: now,
    stage: "Seed",
    momentum: "Warming",
    signalStrength: "High",
    category: "Energy Infra",
    timingWindow: "Opening",
    mode: "Estimate",

    startupSignals: [
      { kind: "startup", name: "Product Velocity", strength: "Strong", trend: "↑", sensitivity: "High", weight: 0.9 },
      { kind: "startup", name: "Traction Shape", strength: "Medium", trend: "→", sensitivity: "High", weight: 0.8 },
      { kind: "startup", name: "Customer Proof", strength: "Weak", trend: "↓", sensitivity: "High", weight: 0.95 },
      { kind: "startup", name: "Team Composition", strength: "Strong", trend: "↑", sensitivity: "Medium", weight: 0.6 },
      { kind: "startup", name: "Technical Depth", strength: "Strong", trend: "↑", sensitivity: "Medium", weight: 0.6 },
      { kind: "startup", name: "Narrative Coherence", strength: "Medium", trend: "→", sensitivity: "High", weight: 0.85 },
      { kind: "startup", name: "Execution Tempo", strength: "Strong", trend: "↑", sensitivity: "Medium", weight: 0.55 },
    ],

    investorSignals: [
      { kind: "investor", name: "Thesis Alignment", status: "Favorable", trend: "↑", weight: 0.9 },
      { kind: "investor", name: "Category Appetite", status: "High", trend: "↑", weight: 0.85 },
      { kind: "investor", name: "Deployment Phase", status: "Active", trend: "→", weight: 0.75 },
      { kind: "investor", name: "Portfolio Saturation", status: "Low", trend: "→", weight: 0.7 },
      { kind: "investor", name: "Partner Activity", status: "Increasing", trend: "↑", weight: 0.8 },
    ],

    marketSignals: [
      { kind: "market", name: "Category Momentum", status: "Rising", trend: "↑", weight: 0.8 },
      { kind: "market", name: "Narrative Tailwinds", status: "Moderate", trend: "→", weight: 0.6 },
      { kind: "market", name: "Capital Rotation", status: "Entering", trend: "→", weight: 0.55 },
      { kind: "market", name: "Regulatory Pressure", status: "Neutral", trend: "→", weight: 0.4 },
      { kind: "market", name: "Talent Flow", status: "Increasing", trend: "↑", weight: 0.65 },
    ],

    odds: {
      readinessScore: 72,
      readinessTrendDelta7d: 6,
      breakdown: { execution: 82, traction: 61, narrative: 68, marketTiming: 77 },
      alignment: { thesis: 78, stage: 71, signal: 64, timing: 81, overall: 74 },
      objections: [
        { id: 1, text: "Customer proof is still thin for institutional conviction", affects: "Series A funds", probability: "High" },
        { id: 2, text: "GTM clarity will be questioned", affects: "Growth-stage VCs", probability: "Medium" },
        { id: 3, text: "Revenue predictability will matter at next raise", affects: "Institutional partners", probability: "Medium" },
      ],
      timing: {
        status: "Opening",
        etaText: "4–8 weeks",
        progressPct: 45,
        interpretation: "Optimal outreach window opens in 4–8 weeks if signals continue improving.",
      },
      interpretation: "You are likely to convert meetings with Seed and select Early A funds.",
    },

    actions: {
      priority: [
        {
          id: 1,
          title: "Strengthen customer proof",
          probabilityDeltaPct: 14,
          affects: "Institutional partners",
          timeToImpact: "30–60 days",
          investorsUnlocked: 12,
          objectionsReduced: 2,
          description: "Add 2–3 enterprise reference customers or detailed case studies",
          signalsAffected: ["Customer Proof", "Traction Shape"],
        },
        {
          id: 2,
          title: "Reframe narrative toward infrastructure thesis",
          probabilityDeltaPct: 9,
          affects: "Deep-tech & infra funds",
          timeToImpact: "Immediate",
          investorsUnlocked: 8,
          objectionsReduced: 1,
          description: "Emphasize platform capabilities over application features",
          signalsAffected: ["Narrative Coherence"],
        },
        {
          id: 3,
          title: "Delay Series A outreach",
          probabilityDeltaPct: 11,
          affects: "Lead conversion",
          timeToImpact: "60–90 days",
          investorsUnlocked: 5,
          objectionsReduced: 3,
          description: "Build 2 more quarters of traction before institutional meetings",
          signalsAffected: ["Customer Proof", "Traction Shape"],
        },
        {
          id: 4,
          title: "Target these 18 seed funds first",
          probabilityDeltaPct: 8,
          affects: "Early momentum",
          timeToImpact: "Immediate",
          investorsUnlocked: 18,
          objectionsReduced: 0,
          description: "Focus on high-alignment seed funds to build momentum",
          signalsAffected: ["Timing Alignment", "Thesis Alignment"],
        },
      ],
      attenuation: {
        narrative: [
          { action: "Shift positioning: Tool → Platform", signalsAffected: ["Narrative Coherence"], investorsUnlocked: 6 },
          { action: "Emphasize infra use-case", signalsAffected: ["Category Momentum"], investorsUnlocked: 4 },
          { action: "De-emphasize short-term revenue", signalsAffected: ["Traction Shape"], investorsUnlocked: 3 },
        ],
        traction: [
          { action: "Highlight cohort retention", signalsAffected: ["Customer Proof"], investorsUnlocked: 5 },
          { action: "Surface design partners", signalsAffected: ["Traction Shape"], investorsUnlocked: 7 },
          { action: "Delay ARR framing", signalsAffected: ["Narrative Coherence"], investorsUnlocked: 2 },
        ],
        team: [
          { action: "Showcase senior engineering hires", signalsAffected: ["Team Composition"], investorsUnlocked: 8 },
          { action: "Delay sales hiring signal", signalsAffected: ["Execution Tempo"], investorsUnlocked: 3 },
        ],
      },
      unlockPreview: {
        alignmentStrengthPct: 82,
        alignmentDeltaPct: 8,
        timingWindowAfter: "Active",
        investorsUnlockedTotal: 27,
        leadProbabilityDeltaPct: 19,
      },
    },
  };
}
