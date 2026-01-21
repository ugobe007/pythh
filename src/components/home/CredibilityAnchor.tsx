/**
 * CREDIBILITY ANCHOR — Front Page Contract
 * =========================================
 * 
 * One line only. No logos. No testimonials.
 * Optional — returns null if not configured.
 */

import { HOME_CONTENT } from "@/config/homeContent";

export function CredibilityAnchor() {
  if (!HOME_CONTENT.credibilityAnchor) return null;

  return (
    <section className="mt-8 text-neutral-600 text-xs">
      {HOME_CONTENT.credibilityAnchor}
    </section>
  );
}
