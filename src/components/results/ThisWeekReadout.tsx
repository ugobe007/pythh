/**
 * THIS WEEK READOUT — Results Spatial Contract
 * =============================================
 * 
 * Three actions, each with one reason.
 * No coaching lecture.
 * 
 * FORMAT:
 * • 3 rows, not 3 cards
 * • Each row: Action + "Why it moves capital"
 */

interface LeverageAction {
  action: string;
  whyItMoves: string;
}

interface ThisWeekReadoutProps {
  actions: LeverageAction[];
}

export function ThisWeekReadout({ actions }: ThisWeekReadoutProps) {
  if (!actions || actions.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="text-xl font-medium mb-6">This Week</h2>

      <div className="space-y-4">
        {actions.slice(0, 3).map((item, index) => (
          <div key={index} className="border-l-2 border-neutral-800 pl-4">
            <div className="font-medium text-neutral-200 mb-1">
              {item.action}
            </div>
            <div className="text-sm text-neutral-500">
              Why it moves capital: {item.whyItMoves}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
