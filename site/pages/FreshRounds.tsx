import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import { fetchTimeoutSignal } from "@/lib/apiConfig";
import edition from "../../lib/freshRoundsEdition.json";

const RULE = "rgba(255,255,255,0.16)";
const DIM = "rgba(255,255,255,0.55)";

/** Same-origin path — Vite proxies `/api` in dev; Vercel→Fly in prod. */
const PDF_PATH = "/api/rounds/pdf";

export default function FreshRounds() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(PDF_PATH, {
        method: "GET",
        signal: fetchTimeoutSignal(45_000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `pythh-fresh-rounds-${edition.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#000", color: "#fff" }}>
      <Helmet>
        <title>Fresh Rounds — Pre-Seed — Pythh.ai</title>
        <meta
          name="description"
          content="Ten verified pre-seed raises. Aranya, DataAgent, Bluecore Energy, and seven more, with the amount and the lead."
        />
        <meta property="og:title" content="Fresh Rounds — Pre-Seed" />
        <meta property="og:description" content="10 verified pre-seed raises. Amounts and leads from the press." />
        <meta property="og:url" content="https://pythh.ai/rounds" />
        <link rel="canonical" href="https://pythh.ai/rounds" />
      </Helmet>
      <SharedNavbar activePath="/rounds" />

      <main className="max-w-[920px] mx-auto px-5 sm:px-8 pt-16 pb-20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display font-semibold tracking-[0.18em] text-[13px]">{edition.masthead}</p>
            <p className="font-mono text-[11px] tracking-[0.16em] mt-2" style={{ color: DIM }}>
              {edition.dateLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer disabled:opacity-50"
            style={{
              background: "transparent",
              border: `1px solid ${RULE}`,
              color: "#fff",
            }}
            title="Download this edition as PDF"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
        </div>
        {error && (
          <p className="text-[12px] mt-3" style={{ color: "oklch(0.75 0.18 25)" }}>
            {error}
          </p>
        )}

        <h1
          className="font-display font-bold leading-[0.92] mt-5"
          style={{ fontSize: "clamp(3.4rem, 10vw, 6rem)", letterSpacing: "-0.045em" }}
        >
          {edition.title}
        </h1>
        <p className="text-[15px] sm:text-[16px] mt-2.5" style={{ color: DIM }}>
          {edition.subtitle}
        </p>

        <div className="mt-8" style={{ borderTop: `1px solid ${RULE}` }}>
          {edition.rows.map((row, index) => (
            <div
              key={row.name}
              className="grid items-start gap-x-4 py-3.5"
              style={{
                gridTemplateColumns: "2.2rem minmax(0,1fr) auto",
                borderBottom: `1px solid ${RULE}`,
              }}
            >
              <span className="font-mono text-[11px] pt-1 tabular-nums" style={{ color: DIM }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="font-display font-bold text-[1.25rem] sm:text-[1.45rem] leading-tight">{row.name}</p>
                <p className="text-[12px] mt-0.5" style={{ color: DIM }}>
                  {row.line}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-[1.25rem] sm:text-[1.45rem] leading-tight tabular-nums">
                  {row.amount}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: DIM }}>
                  {row.investor}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-7">
          <p className="font-display text-[11px] tracking-[0.16em]" style={{ color: DIM }}>
            {edition.masthead}
          </p>
          <p className="text-[12px]" style={{ color: DIM }}>
            {edition.cadence}
          </p>
        </div>
        <p className="text-[11px] mt-3.5 max-w-[62ch]" style={{ color: "rgba(255,255,255,0.38)" }}>
          {edition.footnote}
        </p>
      </main>
    </div>
  );
}
