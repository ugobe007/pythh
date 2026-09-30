import { Helmet } from "react-helmet-async";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import { BAR_GREY, BORDER, CARD, DIM, G, MUTED, PAGE, PURPLE_ACCENT, TEXT } from "@/lib/designTokens";

const AS_OF = "September 30, 2026";
const STARTUPS = 45;
const TOP_50 = 19;
const TOP_5 = 12;
const OUTSIDE = STARTUPS - TOP_50;

type RecordRow = {
  startup: string;
  rank: number;
  sealed: boolean;
  investors: string;
  confirmed: string;
};

/** Named funders inside the current top 50. Etched is counted in the 19 and explained below, not listed here. */
const ROWS: RecordRow[] = [
  { startup: "Coder", rank: 1, sealed: false, investors: "Andreessen Horowitz", confirmed: "Apr 1, 2026" },
  { startup: "Saronic", rank: 1, sealed: true, investors: "Andreessen Horowitz, Kleiner Perkins", confirmed: "Mar 31, 2026" },
  { startup: "Solidroad", rank: 1, sealed: false, investors: "First Round Capital", confirmed: "Apr 16, 2026" },
  { startup: "Form Energy", rank: 2, sealed: true, investors: "Energy Impact Partners, Breakthrough Energy Ventures", confirmed: "Aug 12, 2026" },
  { startup: "Rillet", rank: 2, sealed: false, investors: "Andreessen Horowitz", confirmed: "Apr 17, 2026" },
  { startup: "Flock Safety", rank: 3, sealed: true, investors: "Andreessen Horowitz", confirmed: "Apr 17, 2026" },
  { startup: "Parallel", rank: 3, sealed: false, investors: "Alfred Lin, Kleiner Perkins", confirmed: "Apr 29, 2026" },
  { startup: "AIRMO", rank: 4, sealed: false, investors: "Antler", confirmed: "Apr 13, 2026" },
  { startup: "Cognition", rank: 4, sealed: true, investors: "Joel Cutler (General Catalyst)", confirmed: "May 27, 2026" },
  { startup: "Runable", rank: 4, sealed: true, investors: "Nexus Venture Partners, Susquehanna", confirmed: "Aug 26, 2026" },
  { startup: "Shapes", rank: 4, sealed: false, investors: "Barry Eggers (Lightspeed)", confirmed: "Apr 29, 2026" },
  { startup: "Currents", rank: 19, sealed: false, investors: "Andrew Chen", confirmed: "Jun 11, 2026" },
  { startup: "Emerald AI", rank: 23, sealed: false, investors: "Energy Impact Partners, General Catalyst", confirmed: "Aug 25, 2026" },
  { startup: "Pocket", rank: 27, sealed: false, investors: "Pierce Daly (Accel)", confirmed: "Jun 29, 2026" },
  { startup: "OpenRouter", rank: 29, sealed: false, investors: "Andreessen Horowitz", confirmed: "May 26, 2026" },
  { startup: "Northwood", rank: 40, sealed: false, investors: "Andreessen Horowitz", confirmed: "Feb 18, 2026" },
  { startup: "Lance", rank: 48, sealed: false, investors: "Y Combinator", confirmed: "Apr 29, 2026" },
  { startup: "Fireworks", rank: 50, sealed: false, investors: "Menlo Ventures", confirmed: "Jul 16, 2026" },
];

const BANDS = [
  { label: "Ranks 1–5", count: TOP_5 },
  { label: "Ranks 6–20", count: 1 },
  { label: "Ranks 21–50", count: 6 },
  { label: "Outside the top 50", count: OUTSIDE },
];

function pct(n: number) {
  return Math.round((n / STARTUPS) * 1000) / 10;
}

export default function FundingRecord() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE, color: TEXT }}>
      <Helmet>
        <title>Funding record — Pythh.ai</title>
        <meta
          name="description"
          content="19 of 45 startups later raised from an investor Pythh ranked in the top fifty. Record as of September 30, 2026."
        />
        <meta property="og:title" content="Top 50 funding record — Pythh.ai" />
        <meta
          property="og:description"
          content="19 of 45 startups later raised from an investor ranked in the top fifty."
        />
        <meta property="og:url" content="https://pythh.ai/record" />
        <link rel="canonical" href="https://pythh.ai/record" />
      </Helmet>
      <SharedNavbar activePath="/record" />

      <main className="container max-w-4xl pt-24 pb-20 px-6">
        <SectionLabel className="mb-4">Verified funding · {AS_OF}</SectionLabel>
        <h1 className="font-display font-bold text-4xl tracking-tight mb-4">Top 50 match record</h1>
        <p className="text-[17px] leading-relaxed max-w-[62ch] mb-10" style={{ color: MUTED }}>
          Of the startups where a matched investor later showed up in a confirmed round,{" "}
          <span style={{ color: TEXT }}>{TOP_50} of {STARTUPS}</span> had that investor inside the top fifty.
          {" "}{TOP_5} of those {STARTUPS} were inside the top five. The median startup’s best matched funder sits at rank 53.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          <div className="rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-display font-bold tabular-nums text-4xl" style={{ color: G }}>{pct(TOP_50)}%</p>
            <p className="text-[12px] font-medium tracking-wide uppercase mt-2" style={{ color: PURPLE_ACCENT }}>Top 50</p>
            <p className="text-[14px] mt-1" style={{ color: MUTED }}>{TOP_50} of {STARTUPS} startups</p>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-display font-bold tabular-nums text-4xl" style={{ color: G }}>{pct(TOP_5)}%</p>
            <p className="text-[12px] font-medium tracking-wide uppercase mt-2" style={{ color: PURPLE_ACCENT }}>Top 5</p>
            <p className="text-[14px] mt-1" style={{ color: MUTED }}>{TOP_5} of {STARTUPS} startups</p>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-display font-bold tabular-nums text-4xl" style={{ color: TEXT }}>53</p>
            <p className="text-[12px] font-medium tracking-wide uppercase mt-2" style={{ color: PURPLE_ACCENT }}>Median rank</p>
            <p className="text-[14px] mt-1" style={{ color: MUTED }}>Best funder on each startup</p>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="font-display font-semibold text-xl mb-4">Where the funder sat</h2>
          <ul className="space-y-3">
            {BANDS.map((band) => (
              <li key={band.label}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span>{band.label}</span>
                  <span className="tabular-nums" style={{ color: MUTED }}>{band.count} of {STARTUPS}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: BAR_GREY }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(band.count / STARTUPS) * 100}%`, backgroundColor: band.count === OUTSIDE ? DIM : G }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="font-display font-semibold text-xl mb-2">Startups with a named funder in the top 50</h2>
          <p className="text-[14px] leading-relaxed mb-4" style={{ color: MUTED }}>
            Rank is the best place that funder held. Sealed means the top five was frozen when it was first served. Other ranks are the live list as of {AS_OF}.
          </p>
          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
            <table className="w-full text-left text-[14px]">
              <thead style={{ backgroundColor: CARD, color: DIM }}>
                <tr>
                  <th className="px-4 py-3 font-medium">Startup</th>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Investor in the round</th>
                  <th className="px-4 py-3 font-medium">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.startup} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td className="px-4 py-3 font-medium">{row.startup}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {row.rank}
                      {row.sealed ? <span className="ml-2 text-[11px] uppercase tracking-wide" style={{ color: PURPLE_ACCENT }}>Sealed</span> : null}
                    </td>
                    <td className="px-4 py-3" style={{ color: MUTED }}>{row.investors}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: MUTED }}>{row.confirmed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[14px] leading-relaxed mt-4" style={{ color: MUTED }}>
            Etched is the 19th startup in the top-50 count. Its top-five row is an unresolved person record, so that name is not published. Peter Thiel is verified on the same round at rank 99, outside the top 50.
          </p>
        </section>

        <section className="max-w-[68ch]">
          <h2 className="font-display font-semibold text-xl mb-3">How a raise gets on this page</h2>
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: MUTED }}>
            A raise counts when the press confirms it after the match, and the investor on the round is the same firm we ranked. The page only includes startups that have a confirmed raise. Startups we matched that have not raised yet are not in the {STARTUPS}.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: MUTED }}>
            The homepage uses this same top-five and top-fifty count.{" "}
            <a href="/methodology" className="underline underline-offset-2" style={{ color: TEXT }}>Methodology</a>
          </p>
        </section>
      </main>
    </div>
  );
}
