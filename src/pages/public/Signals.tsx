import React from "react";
import { Link } from "react-router-dom";

function StepCard({
  step,
  title,
  bullets,
}: {
  step: string;
  title: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-[12px] uppercase tracking-wider text-white/45">
        {step}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-white/90">
        {title}
      </div>
      <ul className="mt-4 space-y-2 text-sm text-white/70">
        {bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Signals() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            How Signals Flow
          </h1>
          <div className="mt-2 text-sm text-white/60">
            Direction · Awareness · Timing
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-white/70 hover:text-white transition">
            Home
          </Link>
          <div className="text-white/30">·</div>
          <Link to="/live" className="text-sm text-white/70 hover:text-white transition">
            Live signals
          </Link>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        <StepCard
          step="1"
          title="Observe"
          bullets={[
            "Investor behavior in public + portfolio reality",
            "Thesis publishing, partner commentary, category moves",
            "Funding patterns and attention shifts over time",
          ]}
        />
        <StepCard
          step="2"
          title="Align"
          bullets={[
            "Signals converge toward a startup thesis",
            "Relevance emerges without guessing or intros",
            "You see who is becoming receptive — and why",
          ]}
        />
        <StepCard
          step="3"
          title="Move"
          bullets={[
            "Timing windows form, accelerate, then fade",
            "You decide when to engage, wait, or reposition",
            "Goal: get to a term sheet with the right capital",
          ]}
        />
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-white/70">
          Pythh isn't telling you who's "best." It's showing you who matters to <span className="text-white/90 font-semibold">your</span> startup — and when.
        </div>
      </div>
    </div>
  );
}
