import { MUTED, TEXT, G, DIM, BORDER, PAGE } from "@/lib/designTokens";

export default function HomeProofStrip({
  pairRate,
  pairHits,
  pairStartups,
  startupsFunded,
  investors,
}: {
  pairRate?: number | null;
  pairHits?: number;
  pairStartups?: number;
  startupsFunded?: number | null;
  investors?: number;
}) {
  const rate = pairRate != null && Number.isFinite(pairRate) ? pairRate : null;
  const hasPrimary = rate != null && pairHits && pairStartups;
  if (!hasPrimary && !startupsFunded && !investors) return null;

  return (
    <section
      id="hero-status-bar"
      className="border-t"
      style={{ borderColor: BORDER, backgroundColor: PAGE }}
      aria-label="Verified pair-layer outcome"
    >
      <div className="container max-w-[1200px] mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
        <div>
          <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: MUTED }}>
            Verified outcome
          </p>
          <p className="font-display font-bold tabular-nums leading-none mb-3" style={{ color: G, fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}>
            {hasPrimary ? `${rate}%` : "—"}
          </p>
          <p className="text-[17px] leading-relaxed max-w-[46ch]" style={{ color: TEXT }}>
            {hasPrimary
              ? `${pairHits} of ${pairStartups} startups with a verified post-prediction funder later received a check from an investor we had already ranked in the top five.`
              : "Pair-layer outcomes appear here when the sealed sample is ready."}
          </p>
          <p className="text-[14px] mt-3 leading-relaxed max-w-[46ch]" style={{ color: MUTED }}>
            “Later funded” means a press-verified raise after our prediction clock.
            {" "}
            <a href="/methodology" className="underline underline-offset-2" style={{ color: MUTED }}>
              Methodology
            </a>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-6">
          <div>
            <dt className="text-[13px] mb-1" style={{ color: MUTED }}>Startups funded (scale)</dt>
            <dd className="font-display font-bold tabular-nums text-2xl" style={{ color: TEXT }}>
              {startupsFunded ? startupsFunded.toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] mb-1" style={{ color: MUTED }}>Investors in the network</dt>
            <dd className="font-display font-bold tabular-nums text-2xl" style={{ color: TEXT }}>
              {investors ? investors.toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-[13px] leading-relaxed mt-6" style={{ color: DIM }}>
          Database size is operating scale, not predictive quality. The percentage on the left is the claim.
        </p>
      </div>
    </section>
  );
}
