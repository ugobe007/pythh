import React from "react";

export default function LiveMatch() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Live Investor Signal Alignment
        </h1>
        <p className="mt-4 text-white/70 max-w-2xl">
          This is an example of what Pythh detects when investor behavior begins aligning with a startup thesis.
        </p>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="text-sm text-white/60">Your startup</div>
          <div className="mt-1 text-xl font-semibold">
            AI infrastructure for autonomous agents
          </div>

          <div className="mt-8 text-sm font-semibold text-white/80">
            Pythh detected:
          </div>
          <ul className="mt-3 space-y-3 text-white/75">
            <li>• Accel partners discussing agent tooling trends</li>
            <li>• Sequoia partner mentioning autonomous infra on X</li>
            <li>• Greylock publishing a thesis on developer automation</li>
            <li>• Khosla climate partner tracking compute efficiency</li>
          </ul>

          <div className="mt-8 text-sm font-semibold text-white/80">
            What this means:
          </div>
          <p className="mt-3 text-white/75 leading-relaxed">
            These investors are moving into your thesis space right now. Your category timing is improving.
            Your narrative is beginning to align with their capital deployment behavior.
          </p>

          <div className="mt-8 rounded-xl border border-white/10 bg-black/40 p-5">
            <p className="text-white/85">
              These are not leads. <br />
              <span className="text-white/70">
                These are investors already signaling interest in your problem space.
              </span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
