/**
 * SUPPORT — Pythh.ai
 * Contact and help page for founders, investors, and admins.
 */
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { MessageSquare, Mail, ArrowUpRight } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import { G, PAGE, BORDER, CARD, MUTED, DIM, CYAN, SEPARATOR } from "@/lib/designTokens";

const FAQ = [
  {
    q: "How does pythh.ai match startups with investors?",
    a: "We use signal intelligence — real-time investor behavior data combined with our GOD scoring algorithm — to identify which investors are most likely to be a fit based on thesis, stage, sector, and timing.",
  },
  {
    q: "How do I submit my startup?",
    a: "Enter your startup's URL on the homepage. Our system scrapes your site, scores your startup, and generates investor matches — typically within 10 seconds.",
  },
  {
    q: "What is the GOD score?",
    a: "The GOD score (0–100) evaluates startups across five dimensions: Team, Traction, Market, Product, and Vision. It determines match quality and investor fit.",
  },
  {
    q: "Is pythh.ai free?",
    a: "Basic signal intelligence is free. Premium features like investor reveals, timing maps, and full pipeline automation are available through our paid plans.",
  },
  {
    q: "I found a bug or something looks wrong.",
    a: "Use the contact form below or email us directly at support@pythh.ai. Include what you were doing, what you expected, and what happened instead.",
  },
  {
    q: "What is the Oracle plan?",
    a: "The Oracle plan unlocks the full PYTHIA pipeline — unlimited startup analysis, complete investor profiles, AI-written outreach drafts, and our monthly intelligence brief.",
  },
];

export default function Support() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`pythh.ai support: ${name}`);
    const body = encodeURIComponent(`From: ${name} (${email})\n\n${message}`);
    window.location.href = `mailto:support@pythh.ai?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>Support — Pythh.ai</title>
        <meta
          name="description"
          content="Get help with pythh.ai — investor matching, GOD scores, subscription, and more. Contact our team or browse common questions."
        />
        <meta property="og:title" content="Support — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/support" />
      </Helmet>

      <SharedNavbar activePath="/support" />

      <main className="container pt-24 pb-16 max-w-3xl">
        <div className="mb-12">
          <SectionLabel className="mb-3">Help</SectionLabel>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">Support</h1>
          <p className="text-lg" style={{ color: MUTED }}>
            Questions, feedback, or something not working? We're here to help.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <a
            href="mailto:support@pythh.ai"
            className="flex items-center gap-3 p-4 border transition-colors"
            style={{ backgroundColor: CARD, borderColor: BORDER }}
          >
            <Mail size={18} style={{ color: G }} />
            <div>
              <p className="text-sm font-medium text-white">Email us</p>
              <p className="text-xs" style={{ color: DIM }}>support@pythh.ai</p>
            </div>
            <ArrowUpRight size={14} className="ml-auto" style={{ color: DIM }} />
          </a>
          <Link href="/methodology">
            <div
              className="flex items-center gap-3 p-4 border cursor-pointer h-full"
              style={{ backgroundColor: CARD, borderColor: BORDER }}
            >
              <MessageSquare size={18} style={{ color: CYAN }} />
              <div>
                <p className="text-sm font-medium text-white">Read the methodology</p>
                <p className="text-xs" style={{ color: DIM }}>How GOD scores and matching work</p>
              </div>
              <ArrowUpRight size={14} className="ml-auto" style={{ color: DIM }} />
            </div>
          </Link>
        </div>

        <section className="mb-12">
          <SectionLabel className="mb-2">FAQ</SectionLabel>
          <h2 className="text-xl font-semibold text-white mb-6">Common questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="p-5 border"
                style={{ borderLeft: `2px solid ${SEPARATOR}`, backgroundColor: CARD, borderColor: BORDER }}
              >
                <h3 className="text-white font-medium mb-2">{item.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t pt-10" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Contact</SectionLabel>
          <h2 className="text-xl font-semibold text-white mb-6">Get in touch</h2>

          {submitted ? (
            <div className="text-center py-12 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
              <p className="text-lg text-white font-medium">Thanks for reaching out.</p>
              <p className="mt-2 text-sm" style={{ color: DIM }}>
                Your email client should have opened with the message. If not, email us directly at{" "}
                <a href="mailto:support@pythh.ai" style={{ color: CYAN }}>support@pythh.ai</a>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { id: "name", label: "Name", type: "text", value: name, onChange: setName, placeholder: "Your name" },
                { id: "email", label: "Email", type: "email", value: email, onChange: setEmail, placeholder: "you@startup.com" },
              ].map((f) => (
                <div key={f.id}>
                  <label htmlFor={f.id} className="block text-sm mb-2" style={{ color: MUTED }}>
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 text-sm text-white outline-none transition-colors border"
                    style={{ backgroundColor: CARD, borderColor: SEPARATOR }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = MUTED; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = SEPARATOR; }}
                  />
                </div>
              ))}
              <div>
                <label htmlFor="message" className="block text-sm mb-2" style={{ color: MUTED }}>
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder="What can we help you with?"
                  className="w-full px-4 py-3 text-sm text-white outline-none resize-none transition-colors border"
                  style={{ backgroundColor: CARD, borderColor: SEPARATOR }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = MUTED; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = SEPARATOR; }}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold font-mono border transition-all"
                style={{ color: G, borderColor: G_BORDER, backgroundColor: "transparent" }}
              >
                Send message
                <ArrowUpRight size={14} />
              </button>
            </form>
          )}
        </section>
      </main>

      <footer className="border-t py-8" style={{ borderColor: BORDER, backgroundColor: CARD }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Home", href: "/" },
            { label: "Platform", href: "/platform" },
            { label: "Newsletter", href: "/newsletter" },
            { label: "About", href: "/about" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing", href: "/pricing" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span className="text-xs cursor-pointer hover:text-white transition-colors" style={{ color: DIM }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
