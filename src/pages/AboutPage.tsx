/**
 * ABOUT PYTHH.AI
 *
 * The story of pythh — named for Pythia, the Oracle of Delphi.
 * Pythia appears here in her true form: outline only, no background,
 * no circle, no button. Just the oracle.
 */

import { Link } from "react-router-dom";
import PythhUnifiedNav from "../components/PythhUnifiedNav";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <PythhUnifiedNav />

      {/* ── Hero: Pythia + Headline ── */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Pythia — outline only, no background, no circle, no button */}
          <div className="flex-shrink-0">
            <img
              src="/pythia-outline.png"
              alt="Pythia, the Oracle of Delphi"
              className="w-72 h-auto md:w-80 opacity-90"
              style={{ filter: "drop-shadow(0 0 40px rgba(255, 255, 255, 0.06))" }}
            />
          </div>

          {/* Headline */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Named for the Oracle.
              <br />
              <span className="text-zinc-400">Built for founders.</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-400 leading-relaxed max-w-lg">
              In ancient Delphi, Pythia was the high priestess of the Temple of Apollo — 
              the most powerful oracle in the ancient world. Kings and generals traveled 
              for weeks to seek her counsel before making their most consequential decisions.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Connection ── */}
      <section className="border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">Why Pythia?</h2>
          <div className="space-y-4 text-zinc-400 leading-relaxed">
            <p>
              Fundraising is the most consequential decision a founder makes. 
              Who you take money from shapes your company forever — the board you build, 
              the advice you get, the introductions that open (or close) doors.
            </p>
            <p>
              Yet most founders approach investors blind. They guess. They cold-email. 
              They waste months chasing firms that were never going to write a check.
            </p>
            <p>
              <span className="text-white font-medium">pythh.ai</span> is the modern oracle. 
              We read the signals that investors emit — deployment patterns, sector shifts, 
              portfolio gaps, timing cues — and translate them into actionable intelligence. 
              Not prophecy. <span className="text-white">Signal science.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── What We Do ── */}
      <section className="border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">What pythh does</h2>
          <div className="grid gap-5">
            {[
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
                desc: "Our matching engine pairs startups with investors based on thesis alignment, stage fit, sector overlap, and timing signals. Not spray-and-pray — precision targeting.",
              },
              {
                title: "Founder Timing",
                desc: "The difference between a 'pass' and a term sheet is often timing. We surface when investors are actively deploying, giving founders a structural advantage.",
              },
            ].map((item) => (
              <div key={item.title} className="border-l-2 border-white/10 pl-6">
                <h3 className="text-white font-medium text-lg">{item.title}</h3>
                <p className="mt-2 text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Name ── */}
      <section className="border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">The name</h2>
          <div className="space-y-4 text-zinc-400 leading-relaxed">
            <p>
              <span className="text-white font-medium">pythh</span> — deliberately spelled 
              with the double-h — is our nod to Pythia while being something entirely new. 
              She's in our DNA but we're not a replica. We're what happens when ancient 
              pattern-recognition meets modern machine intelligence.
            </p>
            <p>
              The oracle didn't tell you what to do. She told you what the signals meant. 
              The decision was always yours.
            </p>
            <p className="text-white font-medium">
              Same principle. Better data.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-3xl mx-auto px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">Ready to read the signals?</h2>
          <p className="text-zinc-400 mb-8">Submit your startup URL and see what the oracle sees.</p>
          <Link
            to="/"
            className="inline-block px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Try pythh.ai
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} pythh.ai — Signal science for founders.</p>
        <div className="mt-2">
          <Link to="/admin-login" className="text-zinc-700 hover:text-zinc-500 transition-colors">
            admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
