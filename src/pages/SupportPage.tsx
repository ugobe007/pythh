/**
 * SUPPORT — pythh.ai
 *
 * Contact and help page for founders, investors, and admins.
 */

import { useState } from "react";
import { Link } from "react-router-dom";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, mailto fallback — can wire to backend later
    const subject = encodeURIComponent(`pythh.ai support: ${name}`);
    const body = encodeURIComponent(`From: ${name} (${email})\n\n${message}`);
    window.location.href = `mailto:support@pythh.ai?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link to="/" className="text-lg font-semibold tracking-tight text-white hover:text-cyan-400 transition-colors">
          pythh.ai
        </Link>
        <div className="flex items-center gap-6 text-sm text-zinc-400">
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
          <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <h1 className="text-4xl font-bold tracking-tight">Support</h1>
        <p className="mt-4 text-lg text-zinc-400 leading-relaxed">
          Questions, feedback, or something not working? We're here to help.
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-semibold mb-8">Common questions</h2>
        <div className="space-y-6">
          {[
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
              a: "Basic signal intelligence is free. Premium features like investor reveals, timing maps, and coaching are available through our paid plans.",
            },
            {
              q: "I found a bug or something looks wrong.",
              a: "Use the contact form below or email us directly. Include what you were doing, what you expected, and what happened instead.",
            },
          ].map((item) => (
            <div key={item.q} className="border-l-2 border-white/10 pl-6">
              <h3 className="text-white font-medium">{item.q}</h3>
              <p className="mt-2 text-zinc-400 leading-relaxed text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact form */}
      <section className="border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-xl font-semibold mb-8">Get in touch</h2>

          {submitted ? (
            <div className="text-center py-12">
              <p className="text-lg text-white font-medium">Thanks for reaching out.</p>
              <p className="mt-2 text-zinc-400">Your email client should have opened with the message. If not, email us directly at <a href="mailto:support@pythh.ai" className="text-cyan-400 hover:text-cyan-300">support@pythh.ai</a>.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm text-zinc-400 mb-2">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm text-zinc-400 mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm text-zinc-400 mb-2">Message</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors resize-none"
                  placeholder="How can we help?"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Send message
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} pythh.ai — Signal science for founders.
      </footer>
    </div>
  );
}
