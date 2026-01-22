import React, { useMemo } from "react";
import { Link } from "react-router-dom";

type SignalItem = {
  firm: string;
  signal: string;
  time: string;
};

const MOCK_SIGNALS: SignalItem[] = [
  { firm: "Sequoia", signal: "Partner mention: agent infrastructure", time: "1h ago" },
  { firm: "Accel", signal: "Seed velocity spike in agent tooling", time: "20m ago" },
  { firm: "Greylock", signal: "Thesis published: developer automation", time: "today" },
  { firm: "Khosla", signal: "Thesis convergence: compute efficiency", time: "today" },
  { firm: "Lightspeed", signal: "New seed: developer automation stack", time: "3h ago" },
  { firm: "NFX", signal: "Partner post: agent workflows & reliability", time: "today" },
];

export default function Live() {
  const rows = useMemo(() => MOCK_SIGNALS, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Live Signals
          </h1>
          <div className="mt-2 text-sm text-white/60">
            Investor movement detected right now.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-sm text-white/70 hover:text-white transition"
          >
            Home
          </Link>
          <div className="text-white/30">·</div>
          <Link
            to="/signals"
            className="text-sm text-white/70 hover:text-white transition"
          >
            How signals work
          </Link>
        </div>
      </header>

      {/* Tape */}
      <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="px-4 py-3 text-[12px] uppercase tracking-wider text-white/45">
          Signal tape
        </div>
        <div className="border-t border-white/10">
          <div className="max-h-[340px] overflow-auto">
            <div className="divide-y divide-white/10">
              {rows.map((s, idx) => (
                <div key={`${s.firm}-${idx}`} className="px-4 py-3 flex items-baseline gap-3">
                  <div className="min-w-[92px] text-sm font-semibold text-white/85">
                    {s.firm}
                  </div>
                  <div className="flex-1 text-sm text-white/70">
                    <span className="text-white/40">·</span> {s.signal}
                  </div>
                  <div className="text-xs text-white/40 whitespace-nowrap">
                    {s.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom anchor */}
      <div className="mt-6 text-sm text-white/60">
        Run your URL on the home page to see which signals align with your startup.
      </div>
    </div>
  );
}
