/**
 * LegalDoc — shared layout for legal pages (Privacy, Terms).
 * Renders in the pythh.ai data-noir palette with SharedNavbar + SEO.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import type { ReactNode } from "react";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import { PAGE, BORDER, CARD, MUTED, DIM, CYAN } from "@/lib/designTokens";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalDocProps {
  kind: string;            // e.g. "Legal"
  title: string;           // e.g. "Privacy Policy"
  path: string;            // e.g. "/privacy"
  description: string;
  lastUpdated: string;     // ISO date string
  intro?: ReactNode;
  sections: LegalSection[];
}

export default function LegalDoc({ kind, title, path, description, lastUpdated, intro, sections }: LegalDocProps) {
  const updated = new Date(lastUpdated).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>{title} — Pythh.ai</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${title} — Pythh.ai`} />
        <meta property="og:url" content={`https://pythh.ai${path}`} />
      </Helmet>

      <SharedNavbar activePath={path} />

      <main className="container pt-24 pb-16 max-w-3xl">
        <div className="mb-10">
          <SectionLabel className="mb-3">{kind}</SectionLabel>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">{title}</h1>
          <p className="text-xs font-mono" style={{ color: DIM }}>Last updated: {updated}</p>
          {intro && (
            <p className="text-base leading-relaxed mt-5" style={{ color: MUTED }}>{intro}</p>
          )}
        </div>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section
              key={s.heading}
              className="p-6 border"
              style={{ backgroundColor: CARD, borderColor: BORDER }}
            >
              <h2 className="text-lg font-semibold text-white mb-3">
                <span className="font-mono mr-2" style={{ color: CYAN }}>{i + 1}.</span>
                {s.heading}
              </h2>
              <div className="text-sm leading-relaxed space-y-3" style={{ color: MUTED }}>
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t py-8" style={{ borderColor: BORDER, backgroundColor: CARD }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Home", href: "/" },
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
            { label: "Support", href: "/support" },
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

/** Small helpers for consistent list/link styling inside legal bodies. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={{ color: CYAN }} className="hover:underline">{children}</a>
  );
}
