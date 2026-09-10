import { Link } from 'wouter';
import { ArrowRight, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PAID_RAISE_SERVICES } from '@/lib/pricingPlans';
import { fetchDeckOutline } from '@/lib/matchLeadRelay';
import { G, G_HOVER, AMBER, DIM, MUTED, TEXT, BORDER, CARD } from '@/lib/designTokens';

type Outline = {
  startup_name: string;
  positioning: { thesis: string; say: string[]; avoid: string[] };
  slides: Array<{ n: number; title: string; shouldSay: string; position: string }>;
};

export default function PaidRaisePanel({
  isPaid,
  startupId,
}: {
  isPaid: boolean;
  startupId?: string | null;
}) {
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPaid || !startupId) return;
    let cancelled = false;
    setLoading(true);
    fetchDeckOutline(startupId)
      .then((data) => {
        if (!cancelled) setOutline(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load deck outline');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPaid, startupId]);

  if (isPaid) {
    return (
      <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
          PPT outline
        </p>
        <p className="text-sm" style={{ color: TEXT }}>
          What the investor deck should say, and how to position the pitch. Included on your monthly plan.
        </p>
        {loading && (
          <p className="text-xs inline-flex items-center gap-2" style={{ color: DIM }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Building outline…
          </p>
        )}
        {error && <p className="text-xs" style={{ color: AMBER }}>{error}</p>}
        {outline && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed" style={{ color: TEXT }}>{outline.positioning.thesis}</p>
            <ul className="space-y-2">
              {outline.slides.map((slide) => (
                <li key={slide.n} className="text-xs leading-relaxed">
                  <span className="font-mono mr-2" style={{ color: DIM }}>{slide.n}.</span>
                  <span className="font-semibold" style={{ color: TEXT }}>{slide.title}</span>
                  <span style={{ color: DIM }}> — {slide.shouldSay}</span>
                  <span className="block pl-6 mt-0.5" style={{ color: MUTED }}>{slide.position}</span>
                </li>
              ))}
            </ul>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Do not</p>
              <ul className="space-y-1">
                {outline.positioning.avoid.map((line) => (
                  <li key={line} className="text-xs" style={{ color: DIM }}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-medium" style={{ color: TEXT }}>
        Email, calls, term sheets, and the deck outline are on a monthly plan.
      </p>
      <ul className="space-y-1.5">
        {PAID_RAISE_SERVICES.map((service) => (
          <li key={service.id} className="text-xs leading-relaxed">
            <span style={{ color: TEXT }}>{service.label}</span>
            <span style={{ color: DIM }}> — {service.detail}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/pricing"
        className="inline-flex items-center justify-center gap-2 w-full px-5 rounded-lg text-sm font-semibold"
        style={{
          backgroundColor: G,
          border: `1px solid ${G}`,
          color: 'oklch(0.1 0.02 162.48)',
          minHeight: 44,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = G_HOVER;
          e.currentTarget.style.borderColor = G_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = G;
          e.currentTarget.style.borderColor = G;
        }}
      >
        <FileText className="w-4 h-4" />
        Start Scout — $19/mo
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
