import { useEffect, useState } from "react";
import { MUTED, TEXT, PURPLE_ACCENT } from "@/lib/designTokens";

interface InvestorQuote {
  id?: string | null;
  firm: string;
  speaker?: string;
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

  const quote = quotes[index];
  if (!quote) return null;

  return (
    <p
      className="mt-6 mb-2 max-w-[58ch] text-[15px] leading-relaxed"
      data-testid="investor-quote-line"
      aria-live="polite"
    >
      <span className="block font-mono text-[11px] font-semibold tracking-[0.08em] uppercase mb-1 whitespace-nowrap" style={{ color: PURPLE_ACCENT }}>
        {quote.kind_label}
      </span>
      <span style={{ color: TEXT }}>&ldquo;{quote.quote}&rdquo;</span>
      <span style={{ color: MUTED }}> — {quote.speaker && quote.speaker !== quote.firm ? `${quote.speaker}, ${quote.firm}` : quote.firm}</span>
    </p>
  );
}
