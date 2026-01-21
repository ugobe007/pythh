/**
 * MISALIGNMENT READOUT — Results Spatial Contract
 * ================================================
 * 
 * This is where trust becomes belief.
 * 
 * SHAPE:
 * • Same readout style, cooler tone
 * • Not hidden, not gated
 * 
 * SHOW:
 * • 3–8 misaligned investors
 * • Why-not line
 * • Missing signal list (short)
 * 
 * RULE:
 * • Never shame
 * • Never "too early"
 * • Never "not ready"
 * • Just "currently orthogonal because…"
 */

interface MisalignedInvestor {
  name: string;
  whyNot: string;
  missingSignals: string[];
}

interface MisalignmentReadoutProps {
  investors: MisalignedInvestor[];
}

export function MisalignmentReadout({ investors }: MisalignmentReadoutProps) {
  if (!investors || investors.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="text-xl font-medium mb-6 text-neutral-400">Currently Orthogonal</h2>

      <div className="space-y-4">
        {investors.map((investor, index) => (
          <div key={index} className="border-l-2 border-neutral-800 pl-4">
            <div className="font-medium text-neutral-300 mb-1">{investor.name}</div>
            <div className="text-sm text-neutral-500 mb-2">
              Why not: {investor.whyNot}
            </div>
            {investor.missingSignals && investor.missingSignals.length > 0 && (
              <div className="text-xs text-neutral-600">
                Missing: {investor.missingSignals.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
