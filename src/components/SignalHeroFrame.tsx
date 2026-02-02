/**
 * Signal Hero Frame - Premium container for startup signal card
 * Creates hierarchy through structure, not dimming
 */
import React from "react";

export function SignalHeroFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative mt-6">
      {/* Hero band with subtle gradient and glow */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/6 via-white/3 to-transparent shadow-[0_20px_80px_rgba(0,0,0,0.55)] overflow-hidden">
        {/* Subtle aura effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-30 bg-cyan-500/30" />
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-25 bg-violet-500/30" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
        </div>

        <div className="relative p-5 sm:p-6">{children}</div>
      </div>
    </section>
  );
}
