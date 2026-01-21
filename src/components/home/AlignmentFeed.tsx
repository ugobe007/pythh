import { useMemo, useState } from "react";
import type { PublicSignalPulse } from "../../types/publicPulse";

function clamp0_100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function timingBoost(t: PublicSignalPulse["timingWindow"]): number {
  // timing gets up to +15% boost
  if (t === "Active") return 0.15;
  if (t === "Opening") return 0.10;
  if (t === "Closing") return 0.05;
  return 0;
}

function momentumBoost(m: PublicSignalPulse["momentum"]): number {
  // momentum gets a small boost (public feed proxy for "conviction")
  if (m === "Surge") return 0.15;
  if (m === "Warming") return 0.10;
  if (m === "Stable") return 0.05;
  return 0;
}

function compositeScore(p: PublicSignalPulse): number {
  const alignment = clamp0_100(p.alignmentAfter);
  return alignment * (1 + timingBoost(p.timingWindow) + momentumBoost(p.momentum));
}

function alignmentColor(alignment: number): string {
  if (alignment >= 85) return "text-emerald-300";
  if (alignment >= 70) return "text-cyan-300";
  if (alignment >= 55) return "text-amber-300";
  return "text-white/70";
}

function Pill({
  label,
  variant,
}: {
  label: string;
  variant: "emerald" | "cyan" | "amber" | "red" | "slate" | "violet";
}) {
  const cls =
    variant === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : variant === "cyan"
      ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200"
      : variant === "amber"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
      : variant === "red"
      ? "border-red-500/25 bg-red-500/10 text-red-200"
      : variant === "violet"
      ? "border-violet-500/25 bg-violet-500/10 text-violet-200"
      : "border-white/10 bg-white/5 text-white/70";

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[11px] ${cls}`}>
      {label}
    </span>
  );
}

function timingPill(t: PublicSignalPulse["timingWindow"]) {
  if (t === "Active") return <Pill label="Active window" variant="emerald" />;
  if (t === "Opening") return <Pill label="Opening" variant="cyan" />;
  if (t === "Closing") return <Pill label="Closing" variant="amber" />;
  return <Pill label="Closed" variant="slate" />;
}

function momentumPill(m: PublicSignalPulse["momentum"]) {
  if (m === "Surge") return <Pill label="Surge" variant="emerald" />;
  if (m === "Warming") return <Pill label="Warming" variant="amber" />;
  if (m === "Stable") return <Pill label="Stable" variant="slate" />;
  return <Pill label="Cooling" variant="red" />;
}

function displayTitle(p: PublicSignalPulse): string {
  // If they opted in, show name. Otherwise show anonymized label.
  if (p.displayName && !p.isAnonymized) return p.displayName;
  return "Anonymized startup";
}

function subtitle(p: PublicSignalPulse): string {
  const delta = clamp0_100(p.alignmentAfter) - clamp0_100(p.alignmentBefore);
  const sign = delta >= 0 ? "+" : "";
  const timing = p.timingWindow;
  return `Alignment ${sign}${Math.round(delta)} → ${Math.round(p.alignmentAfter)}%. Window: ${timing}.`;
}

function fallbackWhy(p: PublicSignalPulse): string[] {
  // Use the trigger signals, but keep it investor-language
  const sigs = (p.triggerSignals || []).slice(0, 2);
  if (sigs.length) return sigs.map((s) => `Signal shift: ${s}`);
  return ["Signal shift detected", "Alignment updated", "Timing window recalculated"];
}

export default function AlignmentFeed({
  pulses,
  onRunMySignals,
}: {
  pulses: PublicSignalPulse[];
  onRunMySignals: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = (pulses || []).slice(0, 12);
    return list.sort((a, b) => compositeScore(b) - compositeScore(a));
  }, [pulses]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-bold text-white">See Pythh working in the wild</h3>
          <p className="text-sm text-white/60 mt-1">
            Sorted by <span className="text-white/80">alignment × timing × momentum</span>. Click a row for
            <span className="text-white/80"> why / action / unlock</span>.
          </p>
        </div>
        <div className="text-xs text-white/40">Public-signal analysis only</div>
      </div>

      <div className="space-y-3">
        {sorted.map((p) => {
          const isOpen = openId === p.pulseId;

          const aBefore = clamp0_100(p.alignmentBefore);
          const aAfter = clamp0_100(p.alignmentAfter);
          const aDelta = aAfter - aBefore;

          const rBefore = clamp0_100(p.readinessBefore);
          const rAfter = clamp0_100(p.readinessAfter);
          const rDelta = rAfter - rBefore;

          const why = fallbackWhy(p);
          const actionTitle = p.recommendedAction?.title;
          const actionDelta = p.recommendedAction?.probabilityDeltaPct;

          // Public feed: warm intros always locked.
          const warmIntroLocked = true;

          return (
            <div key={p.pulseId} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              {/* Row */}
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : p.pulseId)}
                className="w-full text-left px-5 py-4 hover:bg-white/[0.06] transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-white font-semibold truncate">{displayTitle(p)}</div>
                      <Pill label={p.category} variant="violet" />
                      <Pill label={p.stageBand} variant="slate" />
                    </div>

                    <div className="text-sm text-white/60 mt-1">{subtitle(p)}</div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {(p.triggerSignals || []).slice(0, 3).map((s) => (
                        <Pill key={s} label={s} variant="slate" />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={`text-2xl font-bold ${alignmentColor(aAfter)}`}>
                      {Math.round(aAfter)}%
                    </div>
                    <div className="flex items-center gap-2">
                      {timingPill(p.timingWindow)}
                      {momentumPill(p.momentum)}
                    </div>
                    <div className="text-[11px] text-white/40">click for details</div>
                  </div>
                </div>
              </button>

              {/* Drawer */}
              {isOpen && (
                <div className="px-5 pb-5 pt-0 border-t border-white/10 bg-black/20">
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                        What changed
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-white/75">
                        {why.map((w, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-emerald-300">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill
                          label={`Alignment: ${aDelta >= 0 ? "+" : ""}${Math.round(aDelta)} → ${Math.round(aAfter)}%`}
                          variant={aDelta >= 0 ? "emerald" : "red"}
                        />
                        <Pill
                          label={`Readiness: ${rDelta >= 0 ? "+" : ""}${Math.round(rDelta)} → ${Math.round(rAfter)}%`}
                          variant={rDelta >= 0 ? "cyan" : "red"}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                        What it unlocked
                      </div>

                      <div className="mt-3 text-sm text-white/80">
                        <span className="text-white font-semibold">{p.unlockedInvestorsCount}</span>{" "}
                        investors unlocked in{" "}
                        <span className="text-white font-semibold">{p.investorClass}</span>.
                      </div>

                      <div className="mt-3 text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                        Recommended action
                      </div>

                      <div className="mt-2 text-sm text-white/75">
                        {actionTitle ? (
                          <>
                            <div className="text-white/85 font-medium">{actionTitle}</div>
                            {typeof actionDelta === "number" && (
                              <div className="text-white/60 mt-1">
                                Expected lift:{" "}
                                <span className="text-emerald-300 font-semibold">
                                  +{Math.round(actionDelta)}%
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-white/60">
                            No action required — this pulse reflects a public shift.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                        Warm intro paths
                      </div>
                      <div className="mt-2 text-sm text-white/70">
                        {warmIntroLocked ? (
                          <span className="text-white/60">🔒 Locked (intros only in verified mode)</span>
                        ) : (
                          <span className="text-emerald-300">✓ Warm intro available</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 md:col-span-2">
                      <div className="text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                        Why this matters
                      </div>
                      <div className="mt-3 text-sm text-white/75 leading-relaxed">
                        This is the verb: <span className="text-white font-semibold">signals</span>.
                        Public pulses show how alignment shifts when momentum or timing changes.
                        Your private scan adds the missing pieces (traction depth, team, narrative, proof) and produces your ranked investor list.
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                        Do this now
                      </div>
                      <div className="mt-3 text-sm text-white/75">
                        Run your signals to compute your top actions and unlock your best-fit investors.
                      </div>
                      <button
                        onClick={onRunMySignals}
                        className="mt-3 inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold py-2.5 transition"
                      >
                        Read my signals →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-white/40">
        This feed is anonymized/public. Your private investor matches appear after you scan your URL.
      </div>
    </div>
  );
}
