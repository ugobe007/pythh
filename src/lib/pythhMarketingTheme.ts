import type { CSSProperties } from 'react';

/**
 * Shared “POP” backgrounds for discovery / marketing pages — layered radials
 * (amber / violet / cyan) so UI isn’t flat cyan-on-black.
 */
export const PYTHH_MARKETING_BG: CSSProperties = {
  backgroundColor: '#05070b',
  backgroundImage: `
    radial-gradient(ellipse 90% 55% at 100% 0%, rgba(251, 191, 36, 0.09), transparent 55%),
    radial-gradient(ellipse 70% 45% at 0% 100%, rgba(139, 92, 246, 0.1), transparent 50%),
    radial-gradient(ellipse 60% 35% at 50% 0%, rgba(34, 211, 238, 0.07), transparent 55%),
    linear-gradient(180deg, #05070b 0%, #0a0f16 45%, #06080d 100%)
  `,
};

/** Slightly cooler variant (rankings / scoreboard) */
export const PYTHH_MARKETING_BG_ALT: CSSProperties = {
  backgroundColor: '#05070b',
  backgroundImage: `
    radial-gradient(ellipse 85% 50% at 0% 0%, rgba(34, 211, 238, 0.08), transparent 50%),
    radial-gradient(ellipse 75% 45% at 100% 80%, rgba(249, 115, 22, 0.06), transparent 50%),
    radial-gradient(ellipse 50% 30% at 80% 20%, rgba(167, 139, 250, 0.08), transparent 55%),
    linear-gradient(180deg, #05070b 0%, #0b1118 50%, #06080d 100%)
  `,
};
