import React from "react";
import type { MacroShift } from "../signalsContextEngine";

function badgeGlyph(b?: MacroShift["badge"]) {
  if (b === "UP") return "↑";
  if (b === "DOWN") return "↓";
  return "→";
}

export default function MacroShiftCard({ shift, onClick }: { shift: MacroShift; onClick?: () => void }) {
  return (
    <button className="macroCard" onClick={onClick} type="button">
      <div className="macroTop">
        <div className="macroTitle">{shift.sector}</div>
        <div className={`macroBadge ${shift.badge?.toLowerCase() ?? "flat"}`}>
          <span className="macroGlyph">{badgeGlyph(shift.badge)}</span>
        </div>
      </div>

      <div className="macroSub">{shift.beliefShift}</div>

      <div className="macroGrid">
        {shift.impacts.slice(0, 3).map((imp) => (
          <div key={`${shift.id}_${imp.channelId}`} className="macroMetric">
            <div className="macroMetricLabel">{imp.label}</div>
            <div className={`macroMetricValue ${imp.delta > 0 ? "up" : imp.delta < 0 ? "down" : "flat"}`}>
              {imp.delta > 0 ? `+${imp.delta}` : `${imp.delta}`}
            </div>
          </div>
        ))}
      </div>

      <div className="macroWhy">
        {shift.why.slice(0, 3).map((w, i) => (
          <div key={`${shift.id}_why_${i}`} className="macroWhyItem">
            • {w}
          </div>
        ))}
      </div>
    </button>
  );
}
