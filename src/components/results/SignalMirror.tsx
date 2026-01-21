/**
 * SIGNAL MIRROR — Results Spatial Contract
 * =========================================
 * 
 * This must look like a "mirror," not a report.
 * 
 * FORMAT:
 * • 4–6 plain statements
 * • No numbers
 * • No advice tone
 * • No charts
 * 
 * EXAMPLE STYLE:
 * "You're being read as infrastructure, not application."
 * "Your proof is inferred, not explicit."
 * "Your category is legible to operators, less legible to thesis funds."
 */

interface SignalMirrorProps {
  statements: string[];
}

export function SignalMirror({ statements }: SignalMirrorProps) {
  if (!statements || statements.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="text-xl font-medium mb-6">How Capital Reads You</h2>

      <div className="space-y-3">
        {statements.map((statement, index) => (
          <div key={index} className="text-neutral-300 text-sm border-l-2 border-neutral-800 pl-4">
            {statement}
          </div>
        ))}
      </div>
    </section>
  );
}
