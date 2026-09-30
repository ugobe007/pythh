import { Helmet } from "react-helmet-async";
import SharedNavbar from "@/components/SharedNavbar";

/**
 * Wednesday, September 30, 2026 edition.
 * Ten verified or corroborated pre-seed raises from June 19 through September 2.
 * Lines under the name are compressed from the press title. No city is shown
 * unless that round named one. Leads are the named lead, or Undisclosed.
 */
const ROWS: { name: string; line: string; amount: string; investor: string }[] = [
  { name: "Aranya", line: "AI infrastructure", amount: "$11M", investor: "Asylum Ventures" },
  { name: "DataAgent", line: "Kubernetes operations", amount: "$10M", investor: "Undisclosed" },
  { name: "Bluecore Energy", line: "Portable nuclear power", amount: "$10M", investor: "Slauson & Co" },
  { name: "Ki 13", line: "Synthetic fuels", amount: "$5M", investor: "HICO Investment Group" },
  { name: "Cast Insights", line: "Speech intelligence", amount: "$4.5M", investor: "Abstract Ventures" },
  { name: "Coverwatch", line: "Commercial insurance", amount: "$4.5M", investor: "CoFound" },
  { name: "Vikk AI", line: "Legal AI", amount: "$4.2M", investor: "Undisclosed" },
  { name: "Tonada", line: "Brand sound", amount: "$3M", investor: "Antler" },
  { name: "Ossprey", line: "Software supply chain", amount: "$2.65M", investor: "Episode 1 Ventures" },
  { name: "Sherpa", line: "External workforce", amount: "$2.2M", investor: "Undisclosed" },
];

const RULE = "rgba(255,255,255,0.16)";
const DIM = "rgba(255,255,255,0.55)";

export default function FreshRounds() {
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
        <p className="font-display font-semibold tracking-[0.18em] text-[15px]">FRESH ROUNDS</p>
        <p className="font-mono text-[12px] tracking-[0.16em] mt-2" style={{ color: DIM }}>
          WEDNESDAY // SEP 30, 2026
        </p>
        <h1
          className="font-display font-bold leading-[0.92] mt-6"
          style={{ fontSize: "clamp(4.2rem, 12vw, 7.4rem)", letterSpacing: "-0.045em" }}
        >
          Pre-Seed
        </h1>
        <p className="text-[18px] sm:text-[20px] mt-3" style={{ color: DIM }}>
          10 verified pre-seed raises, June 19 to September 2
        </p>

        <div className="mt-10" style={{ borderTop: `1px solid ${RULE}` }}>
          {ROWS.map((row, index) => (
            <div
              key={row.name}
              className="grid items-start gap-x-4 py-4"
              style={{
                gridTemplateColumns: "2.4rem minmax(0,1fr) auto",
                borderBottom: `1px solid ${RULE}`,
              }}
            >
              <span className="font-mono text-[13px] pt-1 tabular-nums" style={{ color: DIM }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="font-display font-bold text-[1.45rem] sm:text-[1.7rem] leading-tight">{row.name}</p>
                <p className="text-[13px] mt-1" style={{ color: DIM }}>{row.line}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-[1.45rem] sm:text-[1.7rem] leading-tight tabular-nums">{row.amount}</p>
                <p className="text-[13px] mt-1" style={{ color: DIM }}>{row.investor}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-8">
          <p className="font-display text-[12px] tracking-[0.16em]" style={{ color: DIM }}>FRESH ROUNDS</p>
          <p className="text-[13px]" style={{ color: DIM }}>New rounds. Every Mon / Wed / Fri.</p>
        </div>
        <p className="text-[12px] mt-4 max-w-[62ch]" style={{ color: "rgba(255,255,255,0.38)" }}>
          Amounts and leads come from verified press. Undisclosed means the round did not name a lead. A city is printed when the round names one.
        </p>
      </main>
    </div>
  );
}
