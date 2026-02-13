import React from "react";

export default function SignalsFlow() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          How Signals Flow
        </h1>
        <p className="mt-4 text-white/70 max-w-2xl">
          A quick, human-readable view of what Pythh observes and how alignment is inferred.
        </p>

        <section className="mt-10 grid gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <div className="text-lg font-semibold">What we observe</div>
            <ul className="mt-3 space-y-2 text-white/75">
              <li>• Funding behavior and deal patterns</li>
              <li>• Thesis publishing and category focus shifts</li>
              <li>• Partner commentary and public mentions</li>
              <li>• Portfolio moves and follow-on dynamics</li>
              <li>• Hiring moves and operator signals</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <div className="text-lg font-semibold">What is an investor signal?</div>
            <p className="mt-3 text-white/75 leading-relaxed">
              An investor signal is any observable action that reveals capital intent — what they fund,
              what they publish, what their partners talk about, and how their portfolio focus shifts.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <div className="text-lg font-semibold">How alignment is detected</div>
            <p className="mt-3 text-white/75 leading-relaxed">
              When multiple investor behaviors converge around your problem space and narrative,
              Pythh marks those investors as becoming relevant — and explains why.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <div className="text-lg font-semibold">Why timing matters</div>
            <p className="mt-3 text-white/75 leading-relaxed">
              Signals form, accelerate, and fade. Pythh tracks the change so founders can respond at the
              right moment — not too early, not too late.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
