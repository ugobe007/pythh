/**
 * FROZEN CONTENT CONFIG — Front Page Contract
 * ============================================
 * 
 * INVARIANTS:
 * • No explanation copy
 * • No onboarding copy
 * • No product narration
 * • No "how it works"
 * • No marketing slogans
 * • No AI language
 * 
 * This file is the SINGLE SOURCE OF TRUTH for all front-page copy.
 * No copy scattered through JSX. No "just tweak this string" chaos.
 */

export const HOME_CONTENT = {
  cta: {
    headline: "Find My Investors",
    subtext: "Paste your startup website. We'll show you who recognizes you right now.",
    inputPlaceholder: "Paste your website",
    buttonLabel: "Find My Investors",
  },

  proofStrip: [
    {
      startup: "Rovi Health",
      matches: [
        { name: "US Seed Operator Fund", score: 72 },
        { name: "Health Infra Partners", score: 69 },
        { name: "Seed Stage Capital", score: 66 },
      ],
      why: [
        "Portfolio adjacency detected",
        "Market signals forming",
        "Execution cadence improving",
      ],
    },
    {
      startup: "Atlas Robotics",
      matches: [
        { name: "DeepTech Ventures", score: 74 },
        { name: "Industrial AI Fund", score: 71 },
        { name: "Future Mobility Capital", score: 68 },
      ],
      why: [
        "Category convergence emerging",
        "Technical credibility increasing",
        "Customer proof forming",
      ],
    },
  ],

  curiosityLines: [
    "Some startups are being discovered before they raise.",
    "Some investors are warming up to categories you don't expect.",
    "Your narrative is legible to some funds and invisible to others.",
    "Capital moves before founders notice.",
    "Your signals change your odds.",
  ],

  credibilityAnchor: "Built from real investor behavior, not pitch decks.",
} as const;

// Type exports for strict typing
export type HomeContent = typeof HOME_CONTENT;
export type ProofStripItem = HomeContent["proofStrip"][number];
export type MatchItem = ProofStripItem["matches"][number];
