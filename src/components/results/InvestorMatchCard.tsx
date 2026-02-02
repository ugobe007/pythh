import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InvestorMatch, StartupSignal } from "../../types/results.types";
import IntroStrategyModal from "./IntroStrategyModal";
import SignalExplainerModal from "./SignalExplainerModal";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
      {children}
    </span>
  );
}

// Credibility fix: never imply warm intro unless supported
function normalizeChips(m: InvestorMatch) {
  const hasPath =
    (m.portfolioCompanies && m.portfolioCompanies.length > 0) ||
    Boolean(m.contact?.email) ||
    Boolean(m.contact?.linkedin);

  return (m.chips || []).map((c) => {
    const lower = c.toLowerCase();
    if (lower.includes("warm intro")) return hasPath ? "Intro path available" : "Intro strategy suggested";
    return c;
  });
}

export default function InvestorMatchCard(props: {
  rank: number;
  m: InvestorMatch;
  featured?: boolean;
  startupSignal: StartupSignal;
  onDraftIntro?: () => void; // Optional callback from parent (unused but kept for compatibility)
}) {
  const { rank, m, featured = false, startupSignal } = props;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signalExplainerOpen, setSignalExplainerOpen] = useState(false);

  const chips = useMemo(() => {
    const base = normalizeChips(m);
    // keep tight like your older cards
    return featured ? base.slice(0, 4) : base.slice(0, 3);
  }, [m, featured]);

  return (
    <>
      <div className="w-full rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="p-4 md:p-5">
          {/* ROW: left content + right score/CTA */}
          <div className="flex items-center justify-between gap-4">
            {/* LEFT: identity + meta */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/6 text-white/75">
                  #{rank}
                </span>
                {featured && (
                  <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/8 text-white/85">
                    🏆 Top match
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-2 min-w-0">
                <div className="text-base md:text-lg font-semibold text-white truncate">
                  {m.name}
                </div>
                {m.subtitle && (
                  <div className="text-xs text-white/60 truncate">
                    {m.subtitle}
                  </div>
                )}
              </div>

              {/* tight one-line meta */}
              <div className="mt-2 text-xs text-white/70 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <span className="text-white/55">focus:</span> {m.focus}
                </span>
                <span>
                  <span className="text-white/55">stage:</span> {m.stage}
                </span>
                <span>
                  <span className="text-white/55">check:</span> {m.check}
                </span>
              </div>
            </div>

            {/* RIGHT: BIG SIGNAL (odometer) + CTAs */}
            <div className="shrink-0 flex items-center gap-3">
              {/* signal block (big + highlighted) - NOW CLICKABLE */}
              <button
                onClick={() => setSignalExplainerOpen(true)}
                className="text-right group cursor-pointer hover:scale-105 transition-transform"
                title="Click to understand this signal score"
              >
                <div className="text-[11px] text-white/55 group-hover:text-white/70">signal</div>
                <div
                  className={
                    "leading-none font-semibold transition-all " +
                    (featured
                      ? "text-3xl md:text-4xl"
                      : "text-2xl md:text-3xl")
                  }
                  style={{
                    // subtle glow, not rave
                    textShadow: "0 0 18px rgba(34, 197, 94, 0.25)",
                  }}
                >
                  <span className="text-emerald-300 group-hover:text-emerald-200">{Math.round(m.signal)}</span>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(true)}
                  className={
                    "rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 text-white px-4 py-2 text-sm font-medium flex items-center gap-2 " +
                    (featured ? "px-5" : "")
                  }
                >
                  {/* keep your "Request Intro" vibe */}
                  <span className="text-white/90">Request Intro</span>
                </button>
                <button
                  onClick={() => {
                    // TODO: Add pass functionality (update match status)
                    console.log("Passed on investor:", m.id);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/85 px-4 py-2 text-sm"
                >
                  Pass
                </button>
              </div>
            </div>
          </div>

          {/* WHY + CHIPS + CTA row (tight, like your old cards) */}
          <div className="mt-4">
            <div className="text-[11px] text-white/55">Why this match</div>
            <div className="mt-1 text-sm text-white/85">{m.why}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(true)}
                  className="rounded-xl border border-white/10 bg-white/6 hover:bg-white/10 text-white/90 px-3 py-2 text-sm"
                >
                  Draft Intro
                </button>
                <button
                  onClick={() => navigate(`/investor/${m.id}`)}
                  className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/85 px-3 py-2 text-sm"
                >
                  View Match
                </button>
                <button
                  onClick={() => {
                    // TODO: Add pass functionality (update match status)
                    console.log("Passed on investor:", m.id);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/85 px-3 py-2 text-sm"
                >
                  Pass
                </button>
              </div>

              <div className="text-[11px] text-white/50">
                Look below for next steps + signal improvement suggestions
              </div>
            </div>
          </div>
        </div>
      </div>

      <IntroStrategyModal
        open={open}
        onClose={() => setOpen(false)}
        match={m}
        startup={startupSignal}
        toolkitHref="/toolkit"
      />

      <SignalExplainerModal
        open={signalExplainerOpen}
        onClose={() => setSignalExplainerOpen(false)}
        signal={m.signal}
        investorName={m.name}
      />
    </>
  );
}
