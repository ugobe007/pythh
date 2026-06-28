import { G, DIM, TEXT, BORDER } from "@/lib/designTokens";

export interface StatStripItem {
  value: string;
  label: string;
  sub?: string;
  accent?: boolean;
  href?: string | null;
  suffix?: string;
  /** Override value color (e.g. multi-accent home strip) */
  color?: string;
}

export default function StatStrip({
  items,
  cols = 6,
  className = "",
  compact = false,
}: {
  items: StatStripItem[];
  cols?: 2 | 3 | 4 | 6;
  className?: string;
  compact?: boolean;
}) {
  const colClass =
    cols === 2
      ? "grid-cols-2"
      : cols === 3
      ? "grid-cols-2 md:grid-cols-3"
      : cols === 4
      ? "grid-cols-2 md:grid-cols-4"
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";

  const valueSize = compact
    ? "text-xl md:text-2xl"
    : "text-2xl md:text-3xl";

  return (
    <div
      className={`grid ${colClass} gap-0 py-6 border-y divide-x divide-white/5 ${className}`}
      style={{ borderColor: BORDER }}
    >
      {items.map((s) => {
        const valueColor = s.color ?? (s.accent ? G : TEXT);
        const inner = (
          <>
            <div
              className={`font-display font-bold ${valueSize} tabular-nums mb-1`}
              style={{ color: valueColor, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {s.value}
              {s.suffix}
            </div>
            <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>
              {s.label}
            </div>
            {s.sub && (
              <div className="text-[10px] font-mono" style={{ color: DIM }}>
                {s.sub}
              </div>
            )}
          </>
        );
        return (
          <div key={s.label} className="px-4 py-2 text-center first:pl-0">
            {s.href ? (
              <a href={s.href} className="block transition-opacity hover:opacity-90">
                {inner}
              </a>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </div>
  );
}
