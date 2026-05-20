/**
 * SUPPORT — Pythh.ai
 * Contact and help page for founders, investors, and admins.
 */
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { MessageSquare, Mail, ArrowUpRight } from "lucide-react";

import SharedNavbar from "@/components/SharedNavbar";


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
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
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

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">Support</h1>
          <p className="text-lg" style={{ color: "oklch(0.6 0.01 264)" }}>
            Questions, feedback, or something not working? We're here to help.
          </p>
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <a
            href="mailto:support@pythh.ai"
            className="flex items-center gap-3 p-4 rounded-xl transition-colors group"
            style={{
              backgroundColor: "oklch(0.12 0.01 264)",
              border: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            <Mail size={18} style={{ color: "oklch(0.696 0.17 162.48)" }} />
            <div>
              <p className="text-sm font-medium text-white">Email us</p>
              <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                support@pythh.ai
              </p>
            </div>
            <ArrowUpRight size={14} className="ml-auto" style={{ color: "oklch(0.4 0.01 264)" }} />
          </a>
          <Link href="/methodology">
            <div
              className="flex items-center gap-3 p-4 rounded-xl cursor-pointer"
              style={{
                backgroundColor: "oklch(0.12 0.01 264)",
                border: "1px solid oklch(0.22 0.01 264)",
              }}
            >
              <MessageSquare size={18} style={{ color: "#22d3ee" }} />
              <div>
                <p className="text-sm font-medium text-white">Read the methodology</p>
                <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                  How GOD scores and matching work
                </p>
              </div>
              <ArrowUpRight size={14} className="ml-auto" style={{ color: "oklch(0.4 0.01 264)" }} />
            </div>
          </Link>
        </div>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">Common questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="p-5 rounded-xl"
                style={{
                  borderLeft: "2px solid oklch(0.3 0.01 264)",
                  backgroundColor: "oklch(0.12 0.01 264)",
                }}
              >
                <h3 className="text-white font-medium mb-2">{item.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section
          className="border-t pt-10"
          style={{ borderColor: "oklch(0.18 0.01 264)" }}
        >
          <h2 className="text-xl font-semibold text-white mb-6">Get in touch</h2>

          {submitted ? (
            <div
              className="text-center py-12 rounded-xl"
              style={{
                backgroundColor: "oklch(0.12 0.01 264)",
                border: "1px solid oklch(0.22 0.01 264)",
              }}
            >
              <p className="text-lg text-white font-medium">Thanks for reaching out.</p>
              <p className="mt-2 text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>
                Your email client should have opened with the message. If not, email us directly at{" "}
                <a
                  href="mailto:support@pythh.ai"
                  style={{ color: "#22d3ee" }}
                >
                  support@pythh.ai
                </a>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { id: "name", label: "Name", type: "text", value: name, onChange: setName, placeholder: "Your name" },
                { id: "email", label: "Email", type: "email", value: email, onChange: setEmail, placeholder: "you@startup.com" },
              ].map((f) => (
                <div key={f.id}>
                  <label
                    htmlFor={f.id}
                    className="block text-sm mb-2"
                    style={{ color: "oklch(0.55 0.01 264)" }}
                  >
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
                    className="w-full rounded-lg px-4 py-3 text-sm text-white outline-none transition-colors"
                    style={{
                      backgroundColor: "oklch(0.12 0.01 264)",
                      border: "1px solid oklch(0.25 0.01 264)",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "oklch(0.45 0.01 264)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "oklch(0.25 0.01 264)")}
                  />
                </div>
              ))}
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm mb-2"
                  style={{ color: "oklch(0.55 0.01 264)" }}
                >
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder="What can we help you with?"
                  className="w-full rounded-lg px-4 py-3 text-sm text-white outline-none resize-none transition-colors"
                  style={{
                    backgroundColor: "oklch(0.12 0.01 264)",
                    border: "1px solid oklch(0.25 0.01 264)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "oklch(0.45 0.01 264)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "oklch(0.25 0.01 264)")}
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-lg font-semibold text-sm transition-opacity"
                style={{
                  backgroundColor: "oklch(0.696 0.17 162.48)",
                  color: "oklch(0.1 0.01 162)",
                }}
              >
                Send message
              </button>
            </form>
          )}
        </section>
      </main>

      <footer
        className="border-t py-8"
        style={{ borderColor: "oklch(0.18 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}
      >
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Home", href: "/" },
            { label: "Platform", href: "/platform" },
            { label: "About", href: "/about" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing", href: "/pricing" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span className="text-xs cursor-pointer" style={{ color: "oklch(0.35 0.01 264)" }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
