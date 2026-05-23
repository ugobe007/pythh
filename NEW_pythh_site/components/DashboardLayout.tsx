import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

const NAV = [
  {
    group: "OVERVIEW",
    links: [
      { label: "Dashboard",       href: "/admin" },
      { label: "Analytics",       href: "/admin/analytics" },
    ],
  },
  {
    group: "SCORING",
    links: [
      { label: "GOD Score Manager", href: "/admin/god" },
      { label: "Signal Scores",     href: "/admin/signals" },
      { label: "ML Agent",          href: "/admin/ml" },
    ],
  },
  {
    group: "DATA",
    links: [
      { label: "RSS Feeds",       href: "/admin/rss" },
    ],
  },
  {
    group: "OUTREACH",
    links: [
      { label: "Outreach",        href: "/admin/outreach" },
      { label: "Meeting Pipeline",href: "/admin/calendar" },
    ],
  },
  {
    group: "PIPELINE",
    links: [
      { label: "Startups",        href: "/explore" },
      { label: "Investors",       href: "/investors" },
      { label: "Rankings",        href: "/rankings" },
      { label: "Matches",         href: "/matches" },
    ],
  },
  {
    group: "SITE",
    links: [
      { label: "← Home",          href: "/" },
      { label: "Account",         href: "/account" },
      { label: "Developers",      href: "/developers" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.92 0.005 264)" }}>
      <aside
        className="w-52 shrink-0 border-r p-4 flex flex-col gap-1 overflow-y-auto"
        style={{ borderColor: "oklch(0.22 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}
      >
        {/* Brand */}
        <div className="mb-4 pb-3 border-b" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
          <a href="/" className="text-sm font-bold tracking-widest" style={{ color: "oklch(0.696 0.17 162.48)", textDecoration: "none" }}>PYTHH</a>
          <div className="text-[9px] tracking-widest mt-0.5" style={{ color: "oklch(0.4 0.01 264)" }}>ADMIN CONSOLE</div>
        </div>

        {NAV.map(({ group, links }) => (
          <div key={group} className="mb-3">
            <div className="text-[9px] font-bold tracking-widest mb-1.5 px-2" style={{ color: "oklch(0.38 0.01 264)" }}>{group}</div>
            {links.map(({ label, href }) => {
              const active = location === href;
              return (
                <Link key={href} href={href}
                  className="block text-xs px-2 py-1.5 rounded transition-colors"
                  style={{
                    color: active ? "oklch(0.92 0.005 264)" : "oklch(0.55 0.01 264)",
                    backgroundColor: active ? "oklch(0.18 0.01 264)" : "transparent",
                    textDecoration: "none",
                  }}>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Email quick links */}
        <div className="mt-auto pt-3 border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
          <div className="text-[9px] font-bold tracking-widest mb-1.5 px-2" style={{ color: "oklch(0.38 0.01 264)" }}>QUICK ACCESS</div>
          <a href="https://mail.google.com" target="_blank" rel="noreferrer"
            className="block text-xs px-2 py-1.5 rounded hover:bg-white/5"
            style={{ color: "oklch(0.55 0.01 264)", textDecoration: "none" }}>Gmail →</a>
          <a href="https://calendar.google.com" target="_blank" rel="noreferrer"
            className="block text-xs px-2 py-1.5 rounded hover:bg-white/5"
            style={{ color: "oklch(0.55 0.01 264)", textDecoration: "none" }}>Google Calendar →</a>
          <a href="https://resend.com/emails" target="_blank" rel="noreferrer"
            className="block text-xs px-2 py-1.5 rounded hover:bg-white/5"
            style={{ color: "oklch(0.55 0.01 264)", textDecoration: "none" }}>Resend →</a>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
            className="block text-xs px-2 py-1.5 rounded hover:bg-white/5"
            style={{ color: "oklch(0.55 0.01 264)", textDecoration: "none" }}>Supabase →</a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
