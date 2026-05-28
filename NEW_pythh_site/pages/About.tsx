/**
 * ABOUT PYTHH.AI — Production Site
 * Named for Pythia, the Oracle of Delphi.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import SharedNavbar from "@/components/SharedNavbar";
import StartupCTA from "@/components/design/StartupCTA";
import SectionLabel from "@/components/design/SectionLabel";
import StrokeButton from "@/components/design/StrokeButton";
import { PAGE, BORDER, CARD, MUTED, DIM, G_BORDER, SEPARATOR } from "@/lib/designTokens";


const WHAT_WE_DO = [
  {
    title: "Signal Intelligence",
    desc: "We continuously monitor investor behavior — fund announcements, portfolio moves, hiring patterns, public signals — and distill them into a real-time readiness score.",
  },
  {
    title: "GOD Score",
    desc: "Every startup is evaluated across five dimensions: Team, Traction, Market, Product, and Vision. The composite score (0–100) determines match quality and investor fit.",
  },
  {
    title: "AI-Powered Matching",
    desc: "Rank investors by likelihood and fit from behavior and signals — then layer outreach angles so lists become leverage.",
  },
  {
    title: "Founder Timing",
    desc: "The difference between a 'pass' and a term sheet is often timing. We surface when investors are actively deploying, giving founders a structural advantage.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Enter your URL",
    desc: "Drop your startup website. We read your public page and build your profile.",
  },
  {
    step: "2",
    title: "Get matched",
    desc: "The GOD score (0–100) ranks fundamentals; the matching engine surfaces investors by fit, thesis, and stage — not spray-and-pray.",
  },
  {
    step: "3",
    title: "See signals and intro lines",
    desc: "Signal scores reflect investor timing and intent. Use copy-ready intro lines to start real conversations.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>About — Pythh.ai</title>
        <meta
          name="description"
          content="pythh.ai is named for Pythia, the Oracle of Delphi. We are signal science for founders — real-time VC intelligence that turns fundraising guesswork into precision."
        />
        <meta property="og:title" content="About — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/about" />
      </Helmet>

      <SharedNavbar activePath="/about" />

      <main className="container pt-20 pb-16 max-w-4xl">

        {/* ── Hero ── */}
        <section className="pt-8 pb-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="flex-shrink-0">
              <img
                src="/pythia-outline.png"
                alt="Pythia, the Oracle of Delphi"
                className="w-56 md:w-72 h-auto opacity-90"
                style={{ filter: "drop-shadow(0 0 40px rgba(255,255,255,0.06))" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="flex-1">
              <SectionLabel className="mb-3">About Pythh</SectionLabel>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-white mb-6">
                Named for the Oracle.
                <br />
                <span style={{ color: MUTED }}>Built for founders.</span>
              </h1>
              <p className="text-lg leading-relaxed" style={{ color: MUTED }}>
                In ancient Delphi, Pythia was the high priestess of the Temple of Apollo — the most
                powerful oracle in the ancient world. Kings and generals traveled for weeks to seek
                her counsel before making their most consequential decisions.
              </p>
            </div>
          </div>
        </section>

        {/* ── Why Pythia ── */}
        <section className="border-t py-10" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Origin</SectionLabel>
          <h2 className="text-2xl font-semibold text-white mb-5">Why Pythia?</h2>
          <div className="space-y-4 text-base leading-relaxed" style={{ color: MUTED }}>
            <p>
              Fundraising is the most consequential decision a founder makes. Who you take money from
              shapes your company forever — the board you build, the advice you get, the introductions
              that open (or close) doors.
            </p>
            <p>
              Yet most founders approach investors blind. They guess. They cold-email. They waste
              months chasing firms that were never going to write a check.
            </p>
            <p>
              <span className="text-white font-medium">pythh.ai</span> is the modern oracle. We read
              the signals that investors emit — deployment patterns, sector shifts, portfolio gaps,
              timing cues — and translate them into actionable intelligence. Today that shows up as{" "}
              <span className="text-white">Pythh Capital</span>: fundraising intelligence (live
              analysis + the <span className="text-white">Fundraising Brief</span>) so you see who to
              pitch first, why they fit, and how to respond — not prophecy.{" "}
              <span className="text-white font-medium">Signal science.</span>
            </p>
          </div>
        </section>

        {/* ── What we do ── */}
        <section className="border-t py-10" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Product</SectionLabel>
          <h2 className="text-2xl font-semibold text-white mb-6">What pythh does</h2>
          <div className="grid gap-5">
            {WHAT_WE_DO.map((item) => (
              <div
                key={item.title}
                className="p-5 border"
                style={{
                  borderLeft: `2px solid ${G_BORDER}`,
                  backgroundColor: CARD,
                  borderColor: BORDER,
                }}
              >
                <h3 className="text-white font-medium mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-pythh-works" className="border-t py-10 scroll-mt-24" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Workflow</SectionLabel>
          <h2 className="text-2xl font-semibold text-white mb-2">How pythh works</h2>
          <p className="text-sm mb-8" style={{ color: DIM }}>
            Three steps from URL to investor-ready signals.
          </p>
          <ol className="space-y-8">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.step} className="flex gap-4">
                <span
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-mono border"
                  style={{
                    borderColor: SEPARATOR,
                    color: MUTED,
                    backgroundColor: CARD,
                  }}
                >
                  {s.step}
                </span>
                <div>
                  <h3 className="text-white font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── The Name ── */}
        <section className="border-t py-10" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Brand</SectionLabel>
          <h2 className="text-2xl font-semibold text-white mb-5">The name</h2>
          <div className="space-y-4 text-base leading-relaxed" style={{ color: MUTED }}>
            <p>
              <span className="text-white font-medium">pythh</span> — deliberately spelled with the
              double-h — is our nod to Pythia while being something entirely new. She's in our DNA
              but we're not a replica. We're what happens when ancient pattern-recognition meets
              modern machine intelligence.
            </p>
            <p>
              The oracle didn't tell you what to do. She told you what the signals meant. The
              decision was always yours.
            </p>
            <p className="text-white font-medium">Same principle. Better data.</p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t py-10 text-center" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2 justify-center">Get started</SectionLabel>
          <h2 className="text-2xl font-semibold text-white mb-4">
            Ready to read the signals?
          </h2>
          <p className="mb-8" style={{ color: MUTED }}>
            Submit your startup URL and see what the oracle sees.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <StartupCTA href="/activate" size="lg">
              Get Started Free
            </StartupCTA>
            <StrokeButton href="/platform" muted showArrow>
              How the platform works
            </StrokeButton>
          </div>
        </section>
      </main>

      <footer className="border-t py-8" style={{ borderColor: BORDER, backgroundColor: CARD }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Platform", href: "/platform" },
            { label: "Signal Trends", href: "/signal-trends" },
            { label: "Rankings", href: "/rankings" },
            { label: "Methodology", href: "/methodology" },
            { label: "Newsletter", href: "/newsletter" },
            { label: "Support", href: "/support" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span className="text-xs cursor-pointer hover:text-white transition-colors" style={{ color: DIM }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
        <p className="text-center mt-4 text-xs" style={{ color: DIM }}>
          © {new Date().getFullYear()} pythh.ai — Signal science for founders.
        </p>
      </footer>
    </div>
  );
}
