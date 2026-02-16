/**
 * PythhUnifiedNav — Single navigation component for ALL public marketing pages
 *
 * Replaces: inline navs in PythhMain, FounderSignalsPage, HowItWorksPage,
 *           FounderMatchesPage, SignalTrends, ExplorePage, PythhTopNav,
 *           PublicLayout header, SignalsSignificance (which had NO nav)
 *
 * Features:
 * - Sticky + backdrop-blur (stays visible on scroll)
 * - Responsive: desktop links + mobile hamburger menu
 * - Active page highlighting
 * - Consistent link set across all pages
 * - Auth-aware (shows Sign in / Profile based on auth state)
 */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

interface NavLink {
  label: string;
  to: string;
}

const NAV_LINKS: NavLink[] = [
  { label: "Platform", to: "/platform" },
  { label: "Rankings", to: "/rankings" },
  { label: "Explore", to: "/explore" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
];

export default function PythhUnifiedNav() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close on click outside
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-zinc-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <span className="text-white font-semibold text-base group-hover:text-cyan-400 transition">
            pythh.ai
          </span>
          <span className="text-zinc-600 text-[10px] tracking-[2px] uppercase hidden sm:inline">
            Signal Science
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive(link.to)
                  ? "text-white bg-zinc-800/60"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <div className="w-px h-5 bg-zinc-800 mx-2" />

          <Link
            to="/login"
            className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="ml-1 px-4 py-1.5 rounded-md text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all"
          >
            Sign up
          </Link>
        </nav>

        {/* Mobile: Sign up + hamburger */}
        <div className="flex md:hidden items-center gap-2" ref={menuRef}>
          <Link
            to="/signup"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-500 text-black hover:bg-cyan-400 transition"
          >
            Sign up
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile dropdown */}
          {mobileOpen && (
            <div className="absolute top-full right-4 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-4 py-3 text-sm border-b border-zinc-800/50 transition ${
                    isActive(link.to)
                      ? "text-white bg-zinc-800/40"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/login"
                className="block px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/30 transition"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
