import React from "react";

export default function ProofPanel(props: {
  signalsObserved: string[];
  evidenceSources: string[];
  lastUpdated?: string;
  confidence?: "low" | "med" | "high";
}) {
  const { signalsObserved, evidenceSources, lastUpdated, confidence } = props;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm md:text-base font-semibold text-white">
            Proof (why this is real)
          </div>
          <div className="mt-1 text-xs md:text-sm text-white/65">
            Signals observed → matched to investor focus + stage + check size.
          </div>
        </div>
        <div className="text-[11px] text-white/60 rounded-full border border-white/10 bg-white/4 px-3 py-1">
          Confidence: {confidence || "med"}{lastUpdated ? ` • Updated ${lastUpdated}` : ""}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/4 p-3">
          <div className="text-xs font-medium text-white">Signals observed</div>
          <ul className="mt-2 space-y-1 text-xs text-white/70 list-disc pl-5">
            {signalsObserved.slice(0, 8).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/4 p-3">
          <div className="text-xs font-medium text-white">Evidence sources</div>
          <ul className="mt-2 space-y-1 text-xs text-white/70 list-disc pl-5">
            {evidenceSources.slice(0, 8).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-white/55">
        Reminder: if you want better investors, improve the signal (market clarity, team strength, product defensibility, traction).
      </div>
    </div>
  );
}
