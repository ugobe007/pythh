import React from "react";

export default function SignalHeroFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="w-full">
      <div
        className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/6 to-white/2
                   shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]
                   backdrop-blur-md"
      >
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </section>
  );
}
