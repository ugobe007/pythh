import { MUTED, TEXT, G, DIM, BORDER, CARD, PURPLE_ACCENT, PURPLE_BORDER, PURPLE_WASH } from "@/lib/designTokens";

function topFiveCopy(hits?: number, startups?: number) {
  return `${hits} of ${startups} startups later raised from an investor we ranked in the top five.`;
}

function topFiftyCopy(hits?: number, startups?: number) {
  return `${hits} of ${startups} startups later raised from an investor we ranked in the top fifty.`;
}

function FundingRate({
  rate,
  label,
  copy,
  size,
}: {
  rate: number;
  label: string;
  copy: string;
  size: "lg" | "sm";
}) {
  const fontSize =
    size === "lg" ? "clamp(3rem, 6vw, 4.5rem)" : "clamp(1.65rem, 3.2vw, 2.35rem)";
  const copySize = size === "lg" ? "text-[16px]" : "text-[14px]";
  return (
    <div>
      <p
        className="font-display font-bold tabular-nums leading-none"
        style={{ color: G, fontSize }}
      >
        {rate}%
      </p>
      <p
        className="text-[12px] font-medium tracking-wide uppercase mt-2 mb-2"
        style={{ color: PURPLE_ACCENT }}
      >
        {label}
      </p>
      <p className={`${copySize} leading-relaxed`} style={{ color: TEXT }}>
        {copy}
      </p>
    </div>
  );
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
  pairRateTop50,
  pairHitsTop50,
  startupsFunded,
  investors,
  variant = "strip",
}: {
  pairRate?: number | null;
  pairHits?: number;
  pairStartups?: number;
  pairRateTop50?: number | null;
  pairHitsTop50?: number;
  startupsFunded?: number | null;
  investors?: number;
  variant?: "strip" | "panel";
}) {
  const rate = pairRate != null && Number.isFinite(pairRate) ? pairRate : null;
  const rate50 = pairRateTop50 != null && Number.isFinite(pairRateTop50) ? pairRateTop50 : null;
  const hasPrimary = Boolean(rate != null && pairHits && pairStartups);
  const hasTop50 = Boolean(hasPrimary && rate50 != null && pairHitsTop50 && pairStartups);
  if (!hasPrimary && !startupsFunded && !investors && variant !== "panel") return null;

  const methodology = (
    <p className="text-[14px] mt-3 leading-relaxed" style={{ color: MUTED }}>
      A raise counts when the press confirms it after we ranked the match.
      {" "}
      <a href="/methodology" className="underline underline-offset-2" style={{ color: MUTED }}>
        Methodology
      </a>
    </p>
  );

  const rates = (
    <>
      {hasPrimary ? (
        <FundingRate
          rate={rate as number}
          label="top 5"
          copy={topFiveCopy(pairHits, pairStartups)}
          size="lg"
        />
      ) : (
        <p
          className="font-display font-bold tabular-nums leading-none mb-4"
          style={{ color: G, fontSize: "clamp(3rem, 6vw, 4.5rem)" }}
        >
          —
        </p>
      )}
      {hasTop50 ? (
        <div className="mt-5">
          <FundingRate
            rate={rate50 as number}
            label="top 50"
            copy={topFiftyCopy(pairHitsTop50, pairStartups)}
            size="sm"
          />
        </div>
      ) : null}
      {!hasPrimary ? (
        <p className="text-[16px] leading-relaxed" style={{ color: TEXT }}>
          Verified funding appears here when the sample is ready.
        </p>
      ) : null}
    </>
  );

  if (variant === "panel") {
    return (
      <aside
        id="hero-status-bar"
        className="rounded-xl text-left p-6 lg:p-7 h-full"
        style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
        aria-label="Verified funding"
      >
        <p className="text-[12px] font-medium tracking-wide uppercase mb-3" style={{ color: PURPLE_ACCENT }}>
          Verified funding
        </p>
        {rates}
        {methodology}
        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
          <ScaleStats startupsFunded={startupsFunded} investors={investors} />
        </div>
        <p className="text-[13px] leading-relaxed mt-5" style={{ color: DIM }}>
          Database size is operating scale, not predictive quality. The percentages are the claim.
        </p>
      </aside>
    );
  }

  return (
    <section
      id="hero-status-bar"
      className="border-t"
      style={{ borderColor: BORDER, backgroundColor: PURPLE_WASH }}
      aria-label="Verified funding"
    >
      <div className="container max-w-[1200px] mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
        <div style={{ borderLeft: `3px solid ${PURPLE_BORDER}`, paddingLeft: 16 }}>
          <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: PURPLE_ACCENT }}>
            Verified funding
          </p>
          {rates}
          <div className="max-w-[46ch]">{methodology}</div>
        </div>
        <ScaleStats startupsFunded={startupsFunded} investors={investors} />
        <p className="text-[13px] leading-relaxed mt-6" style={{ color: DIM }}>
          Database size is operating scale, not predictive quality. The percentages on the left are the claim.
        </p>
      </div>
    </section>
  );
}
