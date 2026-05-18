import { useState } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ArrowRight, Mail, Zap } from "lucide-react";

function PageNav() {
  const { user, isAuthenticated } = useAuth();
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "oklch(0.11 0.01 264 / 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid oklch(0.2 0.01 264)",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-14">
          <Link href="/">
            <div className="flex flex-col leading-none cursor-pointer">
              <span className="font-display font-bold text-base text-white tracking-tight">pythh.ai</span>
              <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>SIGNAL SCIENCE</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: "Platform", href: "/platform" },
              { label: "Rankings", href: "/rankings" },
              { label: "Pricing", href: "/pricing" },
            ].map(({ label, href }) => (
              <Link key={href} href={href}>
                <span className="text-sm font-medium cursor-pointer transition-colors"
                  style={{ color: "oklch(0.55 0.01 264)" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "oklch(0.55 0.01 264)")}
                >{label}</span>
              </Link>
            ))}
          </div>
          <div>
            {isAuthenticated ? (
              <Link href="/account">
                <span className="text-sm font-medium cursor-pointer" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                  {user?.name?.split(" ")[0] ?? "Account"}
                </span>
              </Link>
            ) : (
              <a href={getLoginUrl()} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}>
                Sign in
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

const WHAT_YOU_GET = [
  { label: "Top investor moves", desc: "Which VCs wrote checks this week, what sectors they're loading up on, and the signals that preceded each deal." },
  { label: "VC thesis shifts", desc: "When a fund's investment pace changes, we notice first. Capital flow rotation before it hits TechCrunch." },
  { label: "Hidden capital flows", desc: "Emerging investors flying under the radar — pre-brand, post-thesis, actively deploying." },
  { label: "PYTHIA's watch list", desc: "The 5 investors she's tracking most closely this week and the startups they're circling." },
  { label: "Weekly GOD score movers", desc: "Startups that jumped or fell in signal score — and what drove the change." },
];

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)", fontFamily: "'Inter', sans-serif" }}>
      <Helmet>
        <title>The Daily Signal — Pythh.ai Newsletter</title>
        <meta name="description" content="Weekly VC intelligence for founders. Thesis shifts, capital flows, and the investors PYTHIA is watching — delivered every week." />
        <meta property="og:title" content="The Daily Signal — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/newsletter" />
      </Helmet>

      <PageNav />

      <div className="container pt-24 pb-20">

        {/* ── Hero ── */}
        <div className="max-w-2xl mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.769 0.188 70.08)" }}>
              THE DAILY SIGNAL
            </span>
          </div>
          <h1 className="font-display font-bold mb-4 leading-tight" style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: "oklch(0.97 0.005 264)" }}>
            Get the signal<br />
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>before the noise.</span>
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: "oklch(0.6 0.01 264)" }}>
            Weekly breakdown of VC thesis shifts, hidden capital flows, and the investors
            PYTHIA is watching right now. Delivered every week to 12,000+ founders.
          </p>

          {/* Subscribe form */}
          <div className="p-6 rounded-2xl mb-6" style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}>
            {submitted ? (
              <div className="flex items-center gap-3 py-4 px-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
                <Zap size={16} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>You're in.</p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>First signal drops this week. Check your inbox.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ backgroundColor: "oklch(0.11 0.01 264)", border: "1px solid oklch(0.28 0.01 264)" }}>
                  <Mail size={15} style={{ color: "oklch(0.45 0.01 264)" }} />
                  <input
                    type="email"
                    placeholder="founder@startup.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "oklch(0.94 0.005 264)" }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap"
                  style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)", opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? "Subscribing…" : <><span>Subscribe</span><ArrowRight size={14} /></>}
                </button>
              </form>
            )}
            <p className="text-xs mt-3" style={{ color: "oklch(0.35 0.01 264)" }}>No spam. Unsubscribe anytime.</p>
          </div>
        </div>

        {/* ── What you get ── */}
        <section className="mb-16 max-w-3xl">
          <h2 className="font-display font-semibold text-xl mb-6" style={{ color: "oklch(0.85 0.01 264)" }}>
            What's in every issue
          </h2>
          <div className="space-y-3">
            {WHAT_YOU_GET.map((item) => (
              <div key={item.label}
                className="flex gap-4 p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
              >
                <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
                <div>
                  <p className="text-sm font-medium mb-0.5" style={{ color: "oklch(0.85 0.01 264)" }}>{item.label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Social proof ── */}
        <div className="max-w-3xl p-6 rounded-2xl" style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}>
          <p className="text-sm italic mb-3" style={{ color: "oklch(0.6 0.01 264)" }}>
            "The Daily Signal gave me the context I needed to time my Sequoia outreach perfectly.
            Closed the meeting within a week of getting the alert."
          </p>
          <p className="text-xs font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>— Founder, Series A · AI Infrastructure</p>
        </div>

      </div>

      <footer className="border-t py-8 mt-4" style={{ borderColor: "oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Platform", href: "/platform" },
            { label: "Rankings", href: "/rankings" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing", href: "/pricing" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span className="text-xs cursor-pointer transition-colors"
                style={{ color: "oklch(0.35 0.01 264)" }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "oklch(0.6 0.01 264)")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "oklch(0.35 0.01 264)")}
              >{label}</span>
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
