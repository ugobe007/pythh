import React from "react";

function getSignalInsights(signal: number): string[] {
  if (signal >= 85) {
    return [
      "🔥 **Elite match** — This investor is highly aligned with your startup's profile and stage",
      "✅ **Strong fit signals** — Multiple factors indicate this is a promising connection",
      "🎯 **High priority** — Focus your intro efforts here first",
      "📈 **Above average success probability** — Historical patterns suggest good alignment",
      "⚡ **Act fast** — Top-tier matches attract many founders"
    ];
  } else if (signal >= 70) {
    return [
      "✅ **Strong alignment** — This investor matches your sector, stage, and check size well",
      "🎯 **Good fit** — Several key criteria align with your startup",
      "📊 **Worth pursuing** — This represents a solid potential connection",
      "🔍 **Do your research** — Review their portfolio and thesis before reaching out",
      "💡 **Credible intro recommended** — Use portfolio founder connections if possible"
    ];
  } else if (signal >= 55) {
    return [
      "👍 **Decent match** — Some alignment exists, but not perfect",
      "🔍 **Review carefully** — Check their recent investments and focus areas",
      "⚠️ **Mixed signals** — Some criteria match well, others less so",
      "📝 **Tailor your approach** — Customize your intro to highlight alignment points",
      "🎲 **Moderate odds** — Worth a shot if you have a strong intro path"
    ];
  } else if (signal >= 40) {
    return [
      "⚠️ **Weaker alignment** — Limited overlap with this investor's typical focus",
      "🔍 **Dig deeper** — They may have adjacent interests not captured in the data",
      "📉 **Lower priority** — Focus on higher-scored matches first",
      "🎯 **Niche angle needed** — Find a specific reason why you're a fit",
      "💬 **Warm intro essential** — Cold outreach unlikely to succeed here"
    ];
  } else {
    return [
      "❌ **Poor fit** — Significant misalignment with investor profile",
      "🔄 **Consider alternatives** — Better matches likely exist",
      "📊 **Data-driven insight** — Our algorithm detected limited overlap",
      "💡 **Improve your signal** — Focus on traction, team, and product clarity",
      "⏭️ **Skip for now** — Prioritize higher-scored investors"
    ];
  }
}

export default function SignalExplainerModal(props: {
  open: boolean;
  onClose: () => void;
  signal: number;
  investorName: string;
}) {
  const { open, onClose, signal, investorName } = props;

  if (!open) return null;

  const insights = getSignalInsights(signal);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-lg my-8 rounded-2xl border border-white/10 bg-[#0b0b10] shadow-2xl">
        <div className="p-4 md:p-5 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base md:text-lg font-semibold text-white">
              Signal Score: {Math.round(signal)}
            </div>
            <div className="mt-1 text-xs md:text-sm text-white/65">
              What this means for {investorName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/8"
          >
            Close
          </button>
        </div>

        <div className="p-4 md:p-5">
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/60">
                  {idx + 1}
                </div>
                <div className="text-sm text-white/85 leading-relaxed">
                  {insight.split("**").map((part, i) => 
                    i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-medium text-white/75">How we calculate signal scores</div>
            <div className="mt-2 text-xs text-white/65 space-y-2">
              <p>
                Our GOD Algorithm (Growth, Opportunity, Defensibility) analyzes 47,000+ investors across:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li><span className="text-white/80">Sector alignment</span> — Your industry vs their focus</li>
                <li><span className="text-white/80">Stage fit</span> — Your funding stage vs their investment stage</li>
                <li><span className="text-white/80">Check size</span> — Your needs vs their typical check</li>
                <li><span className="text-white/80">Recent activity</span> — Investment velocity and patterns</li>
                <li><span className="text-white/80">Portfolio signals</span> — Similar companies in their portfolio</li>
              </ul>
              <p className="text-white/70">
                Higher scores = better alignment. Focus on 70+ for best results.
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
