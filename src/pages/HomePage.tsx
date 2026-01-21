/**
 * PYTHH HOMEPAGE — LEAKING MAP
 * =============================
 * Frozen Layout v1.0
 * 
 * This is the ONLY allowed homepage shape.
 * 
 * GRID STRUCTURE:
 * • 12-column grid
 * • Left (5 cols) = Invocation Panel
 * • Center-right (7 cols) = Intelligence Leak
 * • Bottom-left = Curiosity Anchor
 * 
 * INVARIANTS:
 * • Wide, left-weighted, asymmetric
 * • No center stacking
 * • No right-hand widget
 * • No marketing sections
 * • No SaaS hero
 * 
 * PHILOSOPHY:
 * The homepage is a capital desk leaking intelligence.
 * Not a marketing page. Not a form. Not a SaaS hero.
 */

import { InvocationPanel } from "@/components/home/InvocationPanel";
import { IntelligenceLeak } from "@/components/home/IntelligenceLeak";
import { CuriosityAnchor } from "@/components/home/CuriosityAnchor";
import { BackgroundIntelligence } from "@/components/home/BackgroundIntelligence";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <BackgroundIntelligence />

      <main className="relative z-10 grid min-h-screen grid-cols-12 gap-6 px-10 py-10">

        {/* LEFT — INVOCATION */}
        <section className="col-span-12 md:col-span-5">
          <InvocationPanel />
        </section>

        {/* CENTER-RIGHT — INTELLIGENCE LEAK */}
        <section className="col-span-12 md:col-span-7 flex items-start pt-24">
          <IntelligenceLeak />
        </section>

        {/* BOTTOM-LEFT — CURIOSITY */}
        <section className="col-span-12 md:col-span-5 mt-12">
          <CuriosityAnchor />
        </section>

      </main>
    </div>
  );
}
