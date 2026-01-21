/**
 * FORBIDDEN HOME STRINGS — Hard Guardrail
 * ========================================
 * 
 * These strings must NEVER appear on the front page.
 * Wire this into an ESLint custom rule for enforcement.
 */

export const FORBIDDEN_HOME_STRINGS = [
  "how it works",
  "AI",
  "powered by",
  "submit",
  "get started",
  "learn more",
  "features",
  "onboarding",
  "demo",
  "tool",
  "platform",
  "example",
  "try it",
  "see how",
  "watch",
  "tutorial",
  "guide",
  "step",
  "easy",
  "simple",
  "just",
  "only takes",
  "in seconds",
  "instantly",
  "free",
  "pricing",
  "enterprise",
  "solutions",
  "benefits",
  "why us",
  "our approach",
  "how we",
  "what we do",
] as const;

/**
 * ALLOWED HOME IMPORTS — Component Whitelist
 * ==========================================
 * LEAKING MAP LAYOUT
 * 
 * HomePage.tsx may ONLY import these components.
 * Anything else = lint error.
 */
export const ALLOWED_HOME_IMPORTS = [
  "InvocationPanel",
  "IntelligenceLeak",
  "CuriosityAnchor",
  "BackgroundIntelligence",
] as const;
