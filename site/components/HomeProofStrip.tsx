import { MUTED, TEXT, G, DIM, BORDER, CARD, PURPLE_ACCENT, PURPLE_BORDER, PURPLE_WASH } from "@/lib/designTokens";

function OutcomeCopy({
  hasPrimary,
  pairHits,
  pairStartups,
}: {
  hasPrimary: boolean;
  pairHits?: number;
  pairStartups?: number;
}) {
  return hasPrimary
    ? `${pairHits} of ${pairStartups} startups with a verified post-prediction funder later received a check from an investor we had already ranked in the top five.`
    : "Pair-layer outcomes appear here when the sealed sample is ready.";
}

function ScaleStats({
  startupsFunded,
  investors,
}: {
  startupsFunded?: number | null;
  investors?: number;
}) {
  return (
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
  );
}

export default function HomeProofStrip({
  pairRate,
  pairHits,
  pairStartups,
  startupsFunded,
  investors,
  variant = "strip",
}: {
  pairRate?: number | null;
  pairHits?: number;
  pairStartups?: number;
  startupsFunded?: number | null;
  investors?: number;
  variant?: "strip" | "panel";
}) {
  const rate = pairRate != null && Number.isFinite(pairRate) ? pairRate : null;
  const hasPrimary = Boolean(rate != null && pairHits && pairStartups);
  if (!hasPrimary && !startupsFunded && !investors && variant !== "panel") return null;

  if (variant === "panel") {
    return (
      <aside
        id="hero-status-bar"
        className="rounded-xl text-left p-6 lg:p-7 h-full"
        style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
        aria-label="Verified pair-layer outcome"
      >
        <p className="text-[12px] font-medium tracking-wide uppercase mb-3" style={{ color: PURPLE_ACCENT }}>
          Verified outcome
        </p>
        <p
          className="font-display font-bold tabular-nums leading-none mb-4"
          style={{ color: G, fontSize: "clamp(3rem, 6vw, 4.5rem)" }}
        >
          {hasPrimary ? `${rate}%` : "—"}
        </p>
        <p className="text-[16px] leading-relaxed" style={{ color: TEXT }}>
          <OutcomeCopy hasPrimary={hasPrimary} pairHits={pairHits} pairStartups={pairStartups} />
        </p>
        <p className="text-[14px] mt-3 leading-relaxed" style={{ color: MUTED }}>
          “Later funded” means a press-verified raise after our prediction clock.
          {" "}
          <a href="/methodology" className="underline underline-offset-2" style={{ color: MUTED }}>
            Methodology
          </a>
        </p>
        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
          <ScaleStats startupsFunded={startupsFunded} investors={investors} />
        </div>
        <p className="text-[13px] leading-relaxed mt-5" style={{ color: DIM }}>
          Database size is operating scale, not predictive quality. The percentage is the claim.
        </p>
      </aside>
    );
  }

  return (
    <section
      id="hero-status-bar"
      className="border-t"
      style={{ borderColor: BORDER, backgroundColor: PURPLE_WASH }}
      aria-label="Verified pair-layer outcome"
    >
      <div className="container max-w-[1200px] mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
        <div style={{ borderLeft: `3px solid ${PURPLE_BORDER}`, paddingLeft: 16 }}>
          <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: PURPLE_ACCENT }}>
            Verified outcome
          </p>
          <p className="font-display font-bold tabular-nums leading-none mb-3" style={{ color: G, fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}>
            {hasPrimary ? `${rate}%` : "—"}
          </p>
          <p className="text-[17px] leading-relaxed max-w-[46ch]" style={{ color: TEXT }}>
            <OutcomeCopy hasPrimary={hasPrimary} pairHits={pairHits} pairStartups={pairStartups} />
          </p>
          <p className="text-[14px] mt-3 leading-relaxed max-w-[46ch]" style={{ color: MUTED }}>
            “Later funded” means a press-verified raise after our prediction clock.
            {" "}
            <a href="/methodology" className="underline underline-offset-2" style={{ color: MUTED }}>
              Methodology
            </a>
          </p>
        </div>
        <ScaleStats startupsFunded={startupsFunded} investors={investors} />
        <p className="text-[13px] leading-relaxed mt-6" style={{ color: DIM }}>
          Database size is operating scale, not predictive quality. The percentage on the left is the claim.
        </p>
      </div>
    </section>
  );
}
