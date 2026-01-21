import { useMemo, useState } from "react";
import type { SignalSnapshot } from "../../../types/snapshot";
import type { InvestorMatch } from "../../../types/investors";
import { useInvestors } from "../../../hooks/useInvestors";

export default function InvestorsTab({ snapshot }: { snapshot: SignalSnapshot }) {
  const { investors, loading, error } = useInvestors({
    startupId: snapshot.startupId,
    startupUrl: snapshot.startupUrl,
    mode: snapshot.mode,
  });

  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const rows = investors?.matches ?? [];
    // Default sort: alignment × timing × conviction (simple multipliers for V0)
    const timingMult = (t: string) => (t === "Active" ? 1.15 : t === "Opening" ? 1.1 : t === "Closing" ? 0.9 : 0.75);
    const convictionMult = (c: string) => (c === "High" ? 1.15 : c === "Medium" ? 1.0 : 0.85);

    return [...rows].sort((a, b) => {
      const sa = a.alignmentScore * timingMult(a.timingFit) * convictionMult(a.conviction);
      const sb = b.alignmentScore * timingMult(b.timingFit) * convictionMult(b.conviction);
      return sb - sa;
    });
  }, [investors]);

  if (loading) return <div className="text-white/60">Loading investor matches…</div>;
  if (error) return <div className="text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Investors</h2>
          <p className="text-sm text-white/60 mt-1">
            Sorted by <span className="text-white/80">Alignment × Timing × Conviction</span>. This is not a list — it's motive-aware matching.
          </p>
        </div>

        <div className="text-xs text-white/50">
          Mode:{" "}
          <span className={snapshot.mode === "Verified" ? "text-green-400" : "text-white/70"}>
            {snapshot.mode}
          </span>
        </div>
      </header>

      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-xs text-white/40 border-b border-white/10">
          <div className="col-span-5">Investor</div>
          <div className="col-span-2">Alignment</div>
          <div className="col-span-2">Stage Fit</div>
          <div className="col-span-2">Timing</div>
          <div className="col-span-1 text-right">Conviction</div>
        </div>

        {sorted.map((m) => (
          <InvestorRow
            key={m.id}
            match={m}
            isOpen={openId === m.id}
            onToggle={() => setOpenId(openId === m.id ? null : m.id)}
            mode={snapshot.mode}
          />
        ))}
      </div>

      {snapshot.mode !== "Verified" && (
        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg text-sm text-white/70">
          <span className="font-semibold text-white">Tip:</span> Verified mode unlocks warm intro paths, partner sponsor likelihood, and deeper evidence.
        </div>
      )}
    </div>
  );
}

function InvestorRow({
  match,
  isOpen,
  onToggle,
  mode,
}: {
  match: InvestorMatch;
  isOpen: boolean;
  onToggle: () => void;
  mode: "Estimate" | "Verified";
}) {
  return (
    <div className="border-b border-white/10">
      <button
        className="w-full text-left px-5 py-4 hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <div className="font-semibold text-white">{match.name}</div>
            {match.firm && <div className="text-xs text-white/40 mt-1">{match.firm}</div>}
          </div>

          <div className="col-span-2">
            <Pill value={`${match.alignmentScore}%`} tone={match.alignmentScore >= 80 ? "good" : match.alignmentScore >= 65 ? "mid" : "bad"} />
          </div>

          <div className="col-span-2">
            <div className="text-sm text-white/80">{match.stageFit}</div>
          </div>

          <div className="col-span-2">
            <Pill value={match.timingFit} tone={match.timingFit === "Active" ? "good" : match.timingFit === "Opening" ? "mid" : "bad"} />
          </div>

          <div className="col-span-1 text-right">
            <div className={match.conviction === "High" ? "text-green-400" : match.conviction === "Medium" ? "text-yellow-400" : "text-white/50"}>
              {match.conviction}
            </div>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="Why aligned" tone="blue">
              <ul className="list-disc pl-4 space-y-1 text-sm text-white/70">
                {match.whyAligned.slice(0, 3).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </Panel>

            <Panel title="How to pitch them" tone="green">
              <div className="text-sm text-white/70">{match.bestNarrativeAngle}</div>
              {match.respondsToSignals?.length ? (
                <div className="mt-3 text-xs text-white/50">
                  Responds to: <span className="text-white/70">{match.respondsToSignals.join(", ")}</span>
                </div>
              ) : null}
            </Panel>

            <Panel title="Objections they'll raise" tone="yellow">
              <ul className="list-disc pl-4 space-y-1 text-sm text-white/70">
                {match.objections.slice(0, 2).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </Panel>

            <Panel title="Unlock condition" tone="purple">
              {match.unlockCondition ? (
                <div className="text-sm text-white/70">
                  Complete{" "}
                  <span className="text-white font-semibold">
                    Action {match.unlockCondition.actionId}: {match.unlockCondition.actionTitle}
                  </span>{" "}
                  to unlock <span className="text-blue-400 font-semibold">+{match.unlockCondition.unlocksCount}</span> similar opportunities.
                </div>
              ) : (
                <div className="text-sm text-white/50">No specific unlock condition detected.</div>
              )}
            </Panel>

            <Panel title="Warm intro paths" tone="red">
              {match.warmIntroPaths?.length ? (
                <div className="space-y-2">
                  {match.warmIntroPaths.map((p, i) => {
                    const locked = mode !== "Verified" || p.isLocked;
                    return (
                      <div key={i} className="flex items-start justify-between gap-3 p-3 bg-white/5 rounded border border-white/10">
                        <div className="flex-1">
                          <div className="text-sm text-white/80">{p.label}</div>
                          {p.detail && <div className="text-xs text-white/40 mt-1">{locked ? "Locked in Estimate mode" : p.detail}</div>}
                        </div>
                        <div className="text-xs text-white/40">{locked ? "🔒" : "✓"}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-white/50">No intro paths detected yet.</div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, tone, children }: { title: string; tone: "blue" | "green" | "yellow" | "purple" | "red"; children: React.ReactNode }) {
  const border = {
    blue: "border-blue-500/20",
    green: "border-green-500/20",
    yellow: "border-yellow-500/20",
    purple: "border-purple-500/20",
    red: "border-red-500/20",
  }[tone];

  return (
    <div className={`bg-white/5 border ${border} rounded-lg p-4`}>
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      {children}
    </div>
  );
}

function Pill({ value, tone }: { value: string; tone: "good" | "mid" | "bad" }) {
  const cls = tone === "good" ? "text-green-400 bg-green-500/10" : tone === "mid" ? "text-yellow-400 bg-yellow-500/10" : "text-white/60 bg-white/10";
  return <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${cls}`}>{value}</span>;
}
