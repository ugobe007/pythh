/**
 * Homepage showcase for market movement the round-only discovery feed used to miss:
 * revenue breakouts, fast industrial growth, acquisitions, and new fund structures.
 */

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { curatedMarketMovements, type MarketMovementCard } from "@marketMovement";
import { BORDER, CARD, DIM, G, GOLD, MUTED, TEXT } from "@/lib/designTokens";

const LABEL_COLOR: Record<MarketMovementCard["kind"], string> = {
  revenue_breakout: G,
  growth: G,
  acquisition: GOLD,
  new_fund: "oklch(0.72 0.16 305)",
  funding_round: DIM,
};

export default function MarketMovementShowcase() {
  const [movements, setMovements] = useState<MarketMovementCard[]>(() => curatedMarketMovements());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/movement")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { movements?: MarketMovementCard[] } | null) => {
        if (!cancelled && Array.isArray(data?.movements) && data.movements.length > 0) {
          setMovements(data.movements);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-16 border-t" style={{ borderColor: BORDER, backgroundColor: "oklch(0.105 0.01 264)" }} aria-labelledby="market-movement-heading">
      <div className="container max-w-[1200px] mx-auto px-6">
        <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: G }}>
          Market movement
        </p>
        <h2
          id="market-movement-heading"
          className="font-display font-bold mb-2"
          style={{ color: TEXT, fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.03em" }}
        >
          The startups and funds moving the market
        </h2>
        <p className="text-[17px] leading-relaxed max-w-[62ch] mb-8" style={{ color: MUTED }}>
          Revenue breakouts, acquisitions, and new investors, each one tied to its source.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {movements.map((movement) => (
            <article
              key={movement.id}
              className="rounded-xl p-5 flex flex-col"
              style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: LABEL_COLOR[movement.kind] || DIM }}>
                  {movement.label}
                </p>
                <p className="text-[11px]" style={{ color: DIM }}>{movement.sector}</p>
              </div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: TEXT }}>{movement.name}</h3>
              <p className="text-sm font-medium mb-2" style={{ color: TEXT }}>{movement.headline}</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: MUTED }}>{movement.detail}</p>
              {movement.caveat && (
                <p className="text-[11px] leading-relaxed mb-4" style={{ color: DIM }}>{movement.caveat}</p>
              )}
              <a
                href={movement.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: G }}
              >
                {movement.sourceName}
                <ArrowUpRight size={13} />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
