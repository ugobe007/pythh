import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import StartupCTA from "@/components/design/StartupCTA";

const PRODUCT_GROUPS: { heading: string; links: { label: string; href: string; note?: string }[] }[] = [
  {
    heading: "Founders",
    links: [
      { label: "How it works", href: "/oracle", note: "Score, match, raise" },
      { label: "Start your raise", href: "/matches", note: "Paste a URL" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Investors",
    links: [
      { label: "Portfolio", href: "/portfolio", note: "Public Oracle book" },
      { label: "Rankings", href: "/rankings" },
      { label: "Investors", href: "/investors" },
      { label: "Platform", href: "/platform" },
    ],
  },
  {
    heading: "More",
    links: [
      { label: "Pythiam Ventures", href: "/pythiam" },
      { label: "Daily Signal", href: "/newsletter" },
      { label: "Signal Art", href: "/art" },
      { label: "About", href: "/about" },
    ],
  },
];

const PRODUCT_HREFS = PRODUCT_GROUPS.flatMap((g) => g.links.map((l) => l.href));

export default function SharedNavbar({
  activePath,
  variant = "default",
  heroCta,
}: {
  activePath?: string;
  variant?: "default" | "hero";
  heroCta?: { label: string; targetId: string };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const isHero = variant === "hero";
  const { user, isAuthenticated } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const productActive = Boolean(activePath && PRODUCT_HREFS.includes(activePath));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > (isHero ? 20 : 12));
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHero]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!productRef.current?.contains(e.target as Node)) setProductOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProductOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const navBg = isHero && !scrolled
    ? "transparent"
    : scrolled
      ? "oklch(0.12 0.01 264 / 0.96)"
      : "oklch(0.09 0.01 264 / 0.92)";
  const navBorder = isHero && !scrolled
    ? "transparent"
    : "oklch(0.18 0.01 264)";
  const linkColor = (active: boolean) => (active ? "oklch(0.88 0.01 264)" : "oklch(0.62 0.01 264)");

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
          <a href="/" className="flex flex-col leading-none min-w-0">
            <span className="font-display font-bold text-base text-white tracking-tight">pythh.ai</span>
            <span className="text-[10px] truncate" style={{ color: "oklch(0.55 0.01 264)" }}>
              AI for capital alignment
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            <div ref={productRef} className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors"
                style={{ color: linkColor(productActive || productOpen) }}
                aria-expanded={productOpen}
                aria-haspopup="menu"
                onClick={() => setProductOpen((o) => !o)}
              >
                Product
                <ChevronDown size={14} className={productOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {productOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-3 w-[34rem] rounded-xl p-4 grid grid-cols-3 gap-4 shadow-xl"
                  style={{
                    backgroundColor: "oklch(0.11 0.01 264)",
                    border: "1px solid oklch(0.22 0.01 264)",
                  }}
                >
                  {PRODUCT_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "oklch(0.48 0.01 264)" }}>
                        {group.heading}
                      </p>
                      <div className="flex flex-col gap-1">
                        {group.links.map(({ label, href, note }) => (
                          <a
                            key={href}
                            href={href}
                            role="menuitem"
                            className="rounded-md px-2 py-1.5 transition-colors"
                            style={{ color: activePath === href ? "oklch(0.92 0.01 264)" : "oklch(0.78 0.01 264)" }}
                            onClick={() => setProductOpen(false)}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "oklch(0.16 0.01 264)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <span className="block text-sm font-medium">{label}</span>
                            {note ? (
                              <span className="block text-[11px]" style={{ color: "oklch(0.5 0.01 264)" }}>{note}</span>
                            ) : null}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <a
              href="/pricing"
              className="text-sm font-medium transition-colors"
              style={{ color: linkColor(activePath === "/pricing") }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.88 0.01 264)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = linkColor(activePath === "/pricing"); }}
            >
              Pricing
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <a href="/admin" className="text-xs" style={{ color: "oklch(0.5 0.01 264)", textDecoration: "none" }}>
                    Admin
                  </a>
                )}
                <Link href="/account">
                  <span className="text-sm font-medium cursor-pointer" style={{ color: "oklch(0.62 0.01 264)" }}>
                    {user?.name?.split(" ")[0] ?? "Account"}
                  </span>
                </Link>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="text-sm"
                  style={{ color: "oklch(0.48 0.01 264)" }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="text-sm font-medium"
                style={{ color: "oklch(0.62 0.01 264)" }}
              >
                Sign in
              </button>
            )}
            {heroCta ? (
              <button
                onClick={() => {
                  const el = document.getElementById(heroCta.targetId);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="text-sm font-semibold px-4 py-1.5 rounded-md"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
              >
                {heroCta.label}
              </button>
            ) : (
              <StartupCTA href="/newsletter" size="sm" className="px-4 py-1.5">
                Get daily matches
              </StartupCTA>
            )}
          </div>

          <button
            type="button"
            className="md:hidden p-2"
            style={{ color: "oklch(0.68 0.01 264)" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden py-4 border-t" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
            <div className="flex flex-col gap-5">
              {PRODUCT_GROUPS.map((group) => (
                <div key={group.heading}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "oklch(0.48 0.01 264)" }}>
                    {group.heading}
                  </p>
                  <div className="flex flex-col gap-2">
                    {group.links.map(({ label, href }) => (
                      <a
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className="text-sm font-medium"
                        style={{ color: activePath === href ? "oklch(0.9 0.01 264)" : "oklch(0.68 0.01 264)" }}
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-4 pt-2 border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                {isAuthenticated ? (
                  <>
                    {user?.role === "admin" && (
                      <a href="/admin" onClick={() => setMenuOpen(false)} className="text-sm" style={{ color: "oklch(0.7 0.01 264)" }}>Admin</a>
                    )}
                    <Link href="/account" onClick={() => setMenuOpen(false)}>
                      <span className="text-sm font-medium" style={{ color: "oklch(0.78 0.01 264)" }}>
                        {user?.name?.split(" ")[0] ?? "Account"}
                      </span>
                    </Link>
                    <button onClick={() => { setMenuOpen(false); logoutMutation.mutate(); }} className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setMenuOpen(false); window.location.href = getLoginUrl(); }} className="text-sm font-medium" style={{ color: "oklch(0.62 0.01 264)" }}>
                    Sign in
                  </button>
                )}
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
                  <StartupCTA href="/newsletter" size="sm" className="text-left">
                    Get daily matches
                  </StartupCTA>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
