import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

function NavItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/app" && pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={[
        "text-sm px-3 py-2 rounded-lg border transition",
        active
          ? "border-white/25 bg-white/10 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close mobile nav on route change
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/80 hover:text-white transition text-sm sm:text-base">
              ← <span className="hidden sm:inline">Back to </span>Home
            </Link>
            <div className="text-white/30 hidden sm:block">/</div>
            <div className="font-semibold tracking-tight hidden sm:block">Pythh App</div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <NavItem to="/app/signals-dashboard" label="Dashboard" />
            <NavItem to="/app/signal-matches" label="Matches" />
            <NavItem to="/app/engine" label="Engine" />
            <NavItem to="/app/oracle" label="Oracle" />
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden text-white/70 hover:text-white p-2"
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileNavOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/95 px-4 py-3">
            <nav className="flex flex-col gap-2">
              <NavItem to="/app/signals-dashboard" label="Dashboard" />
              <NavItem to="/app/signal-matches" label="Matches" />
              <NavItem to="/app/engine" label="Engine" />
              <NavItem to="/app/oracle" label="Oracle" />
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
