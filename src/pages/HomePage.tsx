/**
 * PYTHH HOME PAGE — FROZEN STRUCTURE
 * ===================================
 * 
 * This file must NEVER become a SaaS hero again.
 * 
 * INVARIANTS:
 * • Only these four foreground components
 * • In this order
 * • No right-hand panels
 * • No extra sections
 * • No marketing components
 * • No onboarding components
 * 
 * CAN:
 * • promise
 * • tease
 * • prove (thinly)
 * • intrigue
 * 
 * CANNOT:
 * • explain
 * • onboard
 * • market
 * • sell
 * • educate
 * • look like SaaS
 * • look like a tool
 */

import { PrimaryCTA } from "@/components/home/PrimaryCTA";
import { ProofStrip } from "@/components/home/ProofStrip";
import { CuriosityStrip } from "@/components/home/CuriosityStrip";
import { CredibilityAnchor } from "@/components/home/CredibilityAnchor";
import { BackgroundIntelligence } from "@/components/home/BackgroundIntelligence";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* BACKGROUND — intelligence only */}
      <BackgroundIntelligence />

      {/* FOREGROUND — content contract */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">

        {/* SECTION 1 — PRIMARY CTA */}
        <PrimaryCTA />

        {/* SECTION 2 — THIN PROOF STRIP */}
        <ProofStrip />

        {/* SECTION 3 — CURIOSITY STRIP */}
        <CuriosityStrip />

        {/* SECTION 4 — CREDIBILITY ANCHOR (OPTIONAL) */}
        <CredibilityAnchor />

      </main>
    </div>
  );
}
