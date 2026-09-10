import { useState } from "react";
import { ArrowRight, ExternalLink, Mail } from "lucide-react";
import { BORDER, CARD, DIM, G, G_HOVER, MUTED, TEXT } from "@/lib/designTokens";

export const NEWSLETTER_JOIN_CTA = "Get daily matches";
export const PREVIEW_MATCHES_CTA = "Preview my matches";

export default function NewsletterJoinForm({
  source,
  id,
  requireUrl = true,
  cta,
  onJoined,
  className = "mx-auto",
  progressive = false,
  revealMatches = false,
}: {
  source: string;
  id?: string;
  requireUrl?: boolean;
  cta?: string;
  onJoined?: (payload: { email: string; url: string }) => void;
  className?: string;
  progressive?: boolean;
  /** After subscribe, the parent opens /matches?url= so the visitor sees their top 5. */
  revealMatches?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [urlReady, setUrlReady] = useState(!progressive);

  const buttonLabel = cta || (progressive ? PREVIEW_MATCHES_CTA : NEWSLETTER_JOIN_CTA);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireUrl && !url.trim()) {
      setError("Enter your startup website.");
      return;
    }
    if (progressive && !urlReady) {
      setError("");
      setUrlReady(true);
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email.");
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
      <p className="text-[15px] leading-relaxed" style={{ color: G }} id={id}>
        {revealMatches
          ? "Opening your first five investor matches…"
          : "You’re in. Your first ranked matches arrive in your inbox. Tomorrow’s brief adds funding news."}
      </p>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} className={`w-full max-w-lg ${className}`.trim()}>
      <div
        className="flex items-center gap-3 px-4 rounded-xl min-w-0 text-left mb-3"
        style={{
          backgroundColor: CARD,
          border: `1px solid ${error && !url.trim() && requireUrl ? "rgba(248,113,113,0.5)" : BORDER}`,
          minHeight: 52,
        }}
      >
        <ExternalLink size={15} className="flex-shrink-0" style={{ color: DIM }} />
        <input
          type="text"
          placeholder="Your startup website"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (error) setError(""); }}
          className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
          style={{ color: TEXT }}
          aria-label="Your startup URL"
          required={requireUrl}
        />
      </div>
      {urlReady && (
        <>
          {progressive && (
            <p className="text-[14px] mb-2 text-left" style={{ color: MUTED }}>
              Where should we send the full ranked list?
            </p>
          )}
          <div
            className="flex items-center gap-3 px-4 rounded-xl min-w-0 text-left mb-3"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, minHeight: 52 }}
          >
            <Mail size={15} className="flex-shrink-0" style={{ color: DIM }} />
            <input
              type="email"
              placeholder="founder@startup.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
              style={{ color: TEXT }}
              aria-label="Email"
              required={urlReady}
            />
          </div>
        </>
      )}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 w-full px-7 rounded-lg text-[15px] font-semibold"
        style={{
          backgroundColor: G,
          border: `1px solid ${G}`,
          color: "oklch(0.1 0.02 162.48)",
          opacity: loading ? 0.7 : 1,
          minHeight: 50,
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
        {loading
          ? revealMatches
            ? "Finding your matches…"
            : "Subscribing…"
          : urlReady && progressive
            ? revealMatches
              ? "See my matches"
              : "Send my matches"
            : buttonLabel}
        {!loading && <ArrowRight size={16} />}
      </button>
      {progressive && !urlReady && (
        <p className="text-[13px] mt-3 text-left" style={{ color: MUTED }}>
          We score the public site first. Email is only to deliver the ranked list — no account required.
        </p>
      )}
      {error && (
        <p className="text-[14px] mt-3 text-left" style={{ color: "#f87171" }}>{error}</p>
      )}
    </form>
  );
}
