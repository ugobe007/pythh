/**
 * FROZEN CONTENT CONFIG — Human-Smart Homepage v1.0
 * ==================================================
 * 
 * DESIGN LANGUAGE: Human-smart, not mystical
 * See: PYTHH_DESIGN_LANGUAGE_CONTRACT.md
 * See: PYTHH_HOMEPAGE_HUMANSPEC.md
 * 
 * INVARIANTS:
 * • No mystical language
 * • No oracle theater
 * • No machine-speak
 * • No "AI-powered" claims
 * • No "capital posture" framing
 * • No patronizing guidance
 * • Direct, grounded, ambitious
 * 
 * This file is the SINGLE SOURCE OF TRUTH for all front-page copy.
 * No copy scattered through JSX. No "just tweak this string" chaos.
 */

export const HOME_CONTENT = {
  hero: {
    headline: "Find My Investors.",
    subheadline: "Discover which investors match your company right now — and why.",
  },

  input: {
    label: "Your startup website",
    placeholder: "https://yourcompany.com",
    buttonLabel: "Find My Investors",
  },

  socialProof: {
    label: "Recently matched:",
    examples: [
      { startup: "Rovi Health", investor: "Health Infra Partners" },
      { startup: "Flux Robotics", investor: "US Seed Operator Fund" },
      { startup: "Argo AI Tools", investor: "Enterprise Seed Capital" },
    ],
  },

  intelligenceTeaser: {
    paragraphs: [
      "We track how investors behave, what they fund, and how companies like yours are being recognized over time.",
      "That's how we show you who's aligned with you now — and who's likely to be aligned next.",
    ],
  },

  livePreview: [
    {
      name: "US Seed Operator Fund",
      score: 72,
      state: "warming",
      why: "Portfolio adjacency + operator bias",
    },
    {
      name: "Health Infra Partners",
      score: 69,
      state: "forming",
      why: "Category convergence detected",
    },
    {
      name: "Seed Stage Capital",
      score: 66,
      state: "adjacent",
      why: "Similar winners in portfolio",
    },
  ],

  valueProps: {
    heading: "What you'll see:",
    bullets: [
      "The investors that match your company right now",
      "Why they're aligned with you",
      "Which investors are starting to warm up",
      "What you can do to increase your odds",
    ],
  },
} as const;

// Type exports for strict typing
export type HomeContent = typeof HOME_CONTENT;
export type SocialProofExample = HomeContent["socialProof"]["examples"][number];
export type LivePreviewMatch = HomeContent["livePreview"][number];
