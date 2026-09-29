import { useEffect, useState } from "react";
import { MUTED, TEXT, PURPLE_ACCENT } from "@/lib/designTokens";

interface InvestorQuote {
  id?: string | null;
  firm: string;
  speaker?: string;
  kind?: string;
  kind_label: string;
  quote: string;
}

export default function InvestorQuoteLine() {
  const [quotes, setQuotes] = useState<InvestorQuote[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/investor-quotes?limit=24")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.quotes)) return;
        setQuotes(data.quotes.filter((quote: InvestorQuote) => quote?.quote && quote?.firm));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (quotes.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % quotes.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [quotes.length]);

  const investing = quotes.filter((quote) => quote.kind === "investing_in" || quote.kind_label === "Investing in");
  const insights = quotes.filter((quote) => quote.kind === "invested_in" || quote.kind_label === "Investor insights");
  const visible = [investing[index % Math.max(investing.length, 1)], insights[index % Math.max(insights.length, 1)]].filter(Boolean);
  if (!visible.length) return null;

  return (
    <div className="mt-6 mb-2 max-w-[58ch] space-y-4" data-testid="investor-quote-line" aria-live="polite">
      {visible.map((quote) => (
        <div key={quote.kind || quote.kind_label}>
          <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase mb-1" style={{ color: PURPLE_ACCENT }}>
            {quote.kind_label}
          </div>
          <p className="text-[15px] leading-relaxed">
            <span style={{ color: TEXT }}>&ldquo;{quote.quote}&rdquo;</span>
            <span style={{ color: MUTED }}> — {quote.speaker && quote.speaker !== quote.firm ? `${quote.speaker}, ${quote.firm}` : quote.firm}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
