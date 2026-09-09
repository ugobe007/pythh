import { useState } from "react";
import { ArrowRight, ExternalLink, Mail } from "lucide-react";
import { BORDER, CARD, DIM, G, G_HOVER, TEXT } from "@/lib/designTokens";

export const NEWSLETTER_JOIN_CTA = "Get daily matches";

export default function NewsletterJoinForm({
  source,
  id,
  requireUrl = true,
  cta = NEWSLETTER_JOIN_CTA,
  onJoined,
}: {
  source: string;
  id?: string;
  requireUrl?: boolean;
  cta?: string;
  onJoined?: (payload: { email: string; url: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (requireUrl && !url.trim()) {
      setError("Enter your startup website.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          url: url.trim() || undefined,
          source,
        }),
      });
      if (!response.ok) throw new Error("subscribe_failed");
      setSubmitted(true);
      onJoined?.({ email: email.trim(), url: url.trim() });
    } catch {
      setError("We could not save that. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <p className="text-sm" style={{ color: G }} id={id}>
        You&rsquo;re in. Tomorrow&rsquo;s brief includes funding news
        {url.trim() ? " and your matches." : "."} Open the email to inspect them on pythh.ai.
      </p>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="w-full max-w-lg mx-auto">
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl min-w-0 text-left mb-3"
        style={{ backgroundColor: CARD, border: `1px solid ${error && !url.trim() && requireUrl ? "rgba(248,113,113,0.5)" : BORDER}` }}
      >
        <ExternalLink size={15} className="flex-shrink-0" style={{ color: DIM }} />
        <input
          type="text"
          placeholder="Your startup website"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (error) setError(""); }}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          style={{ color: TEXT }}
          aria-label="Your startup URL"
          required={requireUrl}
        />
      </div>
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl min-w-0 text-left mb-4"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
      >
        <Mail size={15} className="flex-shrink-0" style={{ color: DIM }} />
        <input
          type="email"
          placeholder="founder@startup.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          style={{ color: TEXT }}
          aria-label="Email"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 w-full px-7 py-3.5 rounded-lg text-sm font-semibold"
        style={{
          backgroundColor: G,
          border: `1px solid ${G}`,
          color: "oklch(0.1 0.02 162.48)",
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = G_HOVER;
          e.currentTarget.style.borderColor = G_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = G;
          e.currentTarget.style.borderColor = G;
        }}
      >
        {loading ? "Subscribing…" : cta}
        {!loading && <ArrowRight size={16} />}
      </button>
      {error && (
        <p className="text-xs mt-3 text-left" style={{ color: "#f87171" }}>{error}</p>
      )}
    </form>
  );
}
