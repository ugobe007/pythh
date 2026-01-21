import type { InvestorsResponse } from "../../types/investors";

export function buildMockInvestors(mode: "Estimate" | "Verified"): InvestorsResponse {
  const locked = mode !== "Verified";

  return {
    mode,
    matches: [
      {
        id: "inv-001",
        name: "Atlas Ventures",
        firm: "Atlas Ventures",
        alignmentScore: 86,
        stageFit: "Seed",
        timingFit: "Active",
        conviction: "High",
        whyAligned: [
          "Actively deploying into infrastructure-adjacent theses",
          "Portfolio gap in energy systems + software layer",
          "Partner behavior favors technical founders with velocity",
        ],
        respondsToSignals: ["Product Velocity", "Technical Depth", "Execution Tempo"],
        objections: ["Customer proof depth", "GTM clarity"],
        bestNarrativeAngle: "Frame as infrastructure platform (not an app). Lead with system-level moat and technical execution velocity.",
        unlockCondition: { actionId: 1, actionTitle: "Strengthen customer proof", unlocksCount: 9 },
        warmIntroPaths: [
          { label: "Warm intro available", detail: "2nd-degree via portfolio founder", isLocked: locked },
          { label: "Partner likely to sponsor", detail: "Based on past adjacency bets", isLocked: locked },
        ],
      },
      {
        id: "inv-002",
        name: "Northbridge Capital",
        firm: "Northbridge",
        alignmentScore: 79,
        stageFit: "Early A",
        timingFit: "Opening",
        conviction: "Medium",
        whyAligned: [
          "Category appetite rising (recent thesis drift into your space)",
          "Strong timing window opening within 4–8 weeks",
          "Responds to compounding momentum signals",
        ],
        respondsToSignals: ["Category Momentum", "Narrative Coherence", "Traction Shape"],
        objections: ["Customer proof", "Revenue predictability"],
        bestNarrativeAngle: "Position as category leader in formation. Show market pull and repeatable traction narrative.",
        unlockCondition: { actionId: 2, actionTitle: "Reframe narrative toward infrastructure thesis", unlocksCount: 6 },
        warmIntroPaths: [{ label: "Intro path detected", detail: "3rd-degree via operator network", isLocked: locked }],
      },
      {
        id: "inv-003",
        name: "Frost Peak Partners",
        firm: "Frost Peak",
        alignmentScore: 71,
        stageFit: "Seed",
        timingFit: "Active",
        conviction: "Medium",
        whyAligned: [
          "Seed check behavior matches your effective stage",
          "Partner activity increasing in last 30 days",
          "Portfolio adjacency supports fast conviction",
        ],
        respondsToSignals: ["Product Velocity", "Team Composition", "Narrative Coherence"],
        objections: ["Customer proof", "Defensibility framing"],
        bestNarrativeAngle: "Lead with velocity + team depth. Make defensibility explicit: why you win even if incumbents respond.",
        unlockCondition: { actionId: 1, actionTitle: "Strengthen customer proof", unlocksCount: 4 },
        warmIntroPaths: [{ label: "Warm intro possible", detail: "Shared investor overlap", isLocked: locked }],
      },
      {
        id: "inv-004",
        name: "Redwood Frontier",
        firm: "Redwood Frontier",
        alignmentScore: 64,
        stageFit: "Series A",
        timingFit: "Closing",
        conviction: "Low",
        whyAligned: [
          "Thesis fit exists but timing window is closing",
          "Portfolio saturation increasing",
          "Will likely ask you to come back later",
        ],
        respondsToSignals: ["Customer Proof", "Traction Shape", "Revenue predictability"],
        objections: ["Not enough institutional proof yet", "GTM scalability risk"],
        bestNarrativeAngle: "Defer until customer proof strengthens. If meeting, anchor on proof + repeatable GTM motion.",
        unlockCondition: { actionId: 3, actionTitle: "Delay Series A outreach", unlocksCount: 7 },
        warmIntroPaths: [{ label: "Intro path detected", detail: "Requires verification", isLocked: locked }],
      },
    ],
  };
}
