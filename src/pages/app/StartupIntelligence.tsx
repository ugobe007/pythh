import React from "react";
import { useParams } from "react-router-dom";

export default function StartupIntelligence() {
  const { id } = useParams();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-sm font-semibold text-white/85">Startup Intelligence</div>
      <div className="mt-2 text-sm text-white/60">
        Phase A placeholder for startup: <span className="text-white/80 font-semibold">{id}</span>
      </div>
      <div className="mt-4 text-sm text-white/60">
        Phase B: signals, alignment, recommendations, then internal scores.
      </div>
    </div>
  );
}
