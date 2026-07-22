import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import StartupCTA from "@/components/design/StartupCTA";

const NAV_LINKS = [
  { label: "How it works", href: "/oracle" },
  { label: "Rankings",     href: "/rankings" },
  { label: "Matches",      href: "/matches" },
  { label: "Investors",    href: "/investors" },
  { label: "Portfolio",    href: "/portfolio" },
  { label: "Platform",     href: "/platform" },
  { label: "Pythiam",      href: "/pythiam" },
  { label: "Pricing",      href: "/pricing" },
];

export default function SharedNavbar({
  activePath,
  variant = "default",
  heroCta,
  heroSecondaryCta,
}: {
  activePath?: string;
  variant?: "default" | "hero";
  heroCta?: { label: string; targetId: string };
  heroSecondaryCta?: { label: string; targetId: string };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHero = variant === "hero";
  const { user, isAuthenticated } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.reload(); },
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > (isHero ? 20 : 12));
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHero]);

  const navBg = isHero && !scrolled
    ? "transparent"
    : scrolled
      ? "oklch(0.12 0.01 264 / 0.96)"
      : "oklch(0.09 0.01 264 / 0.92)";
  const navBorder = isHero && !scrolled
    ? "transparent"
    : scrolled
      ? "oklch(0.22 0.01 264)"
      : "oklch(0.16 0.01 264)";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: navBg,
        backdropFilter: isHero && !scrolled ? "none" : "blur(14px)",
        borderBottom: `1px solid ${navBorder}`,
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <a href="/" className="flex flex-col leading-none">
            <span className="font-display font-bold text-base text-white tracking-tight">pythh.ai</span>
            <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: "oklch(0.696 0.17 162.48)" }}>
              Signal Science
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium transition-colors duration-150"
                style={{ color: activePath === href ? "oklch(0.85 0.01 264)" : "oklch(0.55 0.01 264)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.85 0.01 264)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = activePath === href ? "oklch(0.85 0.01 264)" : "oklch(0.55 0.01 264)")}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Daily Signal — prominent, accented (shows on every page) */}
            <a
              href="/newsletter"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                color: "oklch(0.769 0.188 70.08)",
                border: "1px solid oklch(0.769 0.188 70.08 / 0.4)",
                backgroundColor: activePath === "/newsletter"
                  ? "oklch(0.769 0.188 70.08 / 0.18)"
                  : "oklch(0.769 0.188 70.08 / 0.08)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "oklch(0.769 0.188 70.08 / 0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = activePath === "/newsletter" ? "oklch(0.769 0.188 70.08 / 0.18)" : "oklch(0.769 0.188 70.08 / 0.08)"; }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
              Daily Signal
            </a>
            <a
              href="/art"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                color: "oklch(0.696 0.17 162.48)",
                border: "1px solid oklch(0.696 0.17 162.48 / 0.4)",
                backgroundColor: activePath === "/art"
                  ? "oklch(0.696 0.17 162.48 / 0.18)"
                  : "oklch(0.696 0.17 162.48 / 0.08)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "oklch(0.696 0.17 162.48 / 0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = activePath === "/art" ? "oklch(0.696 0.17 162.48 / 0.18)" : "oklch(0.696 0.17 162.48 / 0.08)"; }}
            >
              Signal Art
            </a>
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <a href="/admin" className="text-xs font-mono px-2 py-1 rounded"
                    style={{ border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.5 0.01 264)", textDecoration: "none" }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "oklch(0.75 0.15 270)"; el.style.borderColor = "oklch(0.35 0.01 264)"; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "oklch(0.5 0.01 264)"; el.style.borderColor = "oklch(0.25 0.01 264)"; }}>
                    Admin
                  </a>
                )}
                <Link href="/account">
                  <span className="text-sm font-medium cursor-pointer transition-colors" style={{ color: "oklch(0.55 0.01 264)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.85 0.01 264)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.55 0.01 264)")}>
                    {user?.name?.split(" ")[0] ?? "Account"}
                  </span>
                </Link>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="text-sm font-medium transition-colors"
                  style={{ color: "oklch(0.45 0.01 264)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.7 0.01 264)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.45 0.01 264)")}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  className="text-sm font-medium transition-colors"
                  style={{ color: "oklch(0.55 0.01 264)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.85 0.01 264)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.55 0.01 264)")}
                >
                  Sign in
                </button>
                {heroCta ? (
                  <>
                    {heroSecondaryCta ? (
                      <button
                        onClick={() => {
                          const el = document.getElementById(heroSecondaryCta.targetId);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="hidden lg:inline-flex text-sm font-medium px-3 py-1.5 rounded-md transition-all"
                        style={{
                          color: "oklch(0.769 0.188 70.08)",
                          border: "1px solid oklch(0.769 0.188 70.08 / 0.4)",
                        }}
                      >
                        {heroSecondaryCta.label}
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        const el = document.getElementById(heroCta.targetId);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="text-sm font-semibold px-4 py-1.5 rounded-md transition-all"
                      style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
                    >
                      {heroCta.label}
                    </button>
                  </>
                ) : (
                  <StartupCTA href="/matches" size="sm" className="px-4 py-1.5">
                    Preview matches
                  </StartupCTA>
                )}
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2" style={{ color: "oklch(0.6 0.01 264)" }} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-5 border-t" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
            <div className="flex flex-col gap-4">
              {/* Daily Signal — accented, top of mobile menu */}
              <a
                href="/newsletter"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: "oklch(0.769 0.188 70.08)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
                Daily Signal
              </a>
              <a
                href="/art"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: "oklch(0.696 0.17 162.48)" }}
              >
                Signal Art
              </a>
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium"
                  style={{ color: activePath === href ? "oklch(0.85 0.01 264)" : "oklch(0.58 0.01 264)" }}
                >
                  {label}
                </a>
              ))}
              <div className="flex gap-4 pt-2 border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                {isAuthenticated ? (
                  <>
                    {user?.role === "admin" && (
                      <a href="/admin" onClick={() => setMenuOpen(false)} className="text-sm font-medium" style={{ color: "oklch(0.75 0.15 270)" }}>Admin</a>
                    )}
                    <Link href="/account" onClick={() => setMenuOpen(false)}>
                      <span className="text-sm font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                        {user?.name?.split(" ")[0] ?? "Account"}
                      </span>
                    </Link>
                    <button onClick={() => { setMenuOpen(false); logoutMutation.mutate(); }} className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setMenuOpen(false); window.location.href = getLoginUrl(); }} className="text-sm font-medium" style={{ color: "oklch(0.55 0.01 264)" }}>Sign in</button>
                    {heroCta ? (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          const el = document.getElementById(heroCta.targetId);
                          if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
                        }}
                        className="text-sm font-semibold px-4 py-2 rounded-md"
                        style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
                      >
                        {heroCta.label}
                      </button>
                    ) : (
                      <StartupCTA href="/matches" size="sm" className="text-left">
                        Preview matches
                      </StartupCTA>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
