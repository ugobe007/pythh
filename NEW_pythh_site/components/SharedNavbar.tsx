import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

const NAV_LINKS = [
  { label: "Oracle",    href: "/oracle" },
  { label: "Rankings",  href: "/rankings" },
  { label: "Matches",   href: "/matches" },
  { label: "Investors", href: "/investors" },
  { label: "Platform",  href: "/platform" },
  { label: "Pricing",   href: "/pricing" },
];

const ADMIN_LINKS = [
  { label: "Outreach",  href: "/outreach" },
  { label: "Calendar",  href: "/calendar" },
];

export default function SharedNavbar({ activePath }: { activePath?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.reload(); },
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "oklch(0.12 0.01 264 / 0.96)" : "oklch(0.09 0.01 264 / 0.92)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${scrolled ? "oklch(0.22 0.01 264)" : "oklch(0.16 0.01 264)"}`,
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

          {/* Admin links — small, after main nav */}
          <div className="hidden md:flex items-center gap-4 border-l border-white/5 pl-4">
            {ADMIN_LINKS.map(({ label, href }) => (
              <a key={href} href={href}
                className="text-xs font-mono transition-colors duration-150"
                style={{ color: activePath === href ? "oklch(0.75 0.15 270)" : "oklch(0.4 0.01 264)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.75 0.15 270)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = activePath === href ? "oklch(0.75 0.15 270)" : "oklch(0.4 0.01 264)")}>
                {label}
              </a>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
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
                <a
                  href="/activate"
                  className="text-sm font-semibold px-4 py-1.5 rounded-md transition-all"
                  style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
                >
                  Activate
                </a>
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
                    <a href="/activate" onClick={() => setMenuOpen(false)} className="text-sm font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>Activate PYTHIA</a>
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
