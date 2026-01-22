import React, { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

function TopLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "text-sm px-3 py-2 rounded-lg border transition",
          isActive
            ? "border-white/25 bg-white/10 text-white"
            : "border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // close menu on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-white/90 font-semibold tracking-tight">pythh.ai</span>
            <span className="text-white/30 text-xs tracking-widest uppercase">Signal Science</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <TopLink to="/" label="Home" />
            <TopLink to="/live" label="Live" />
            <TopLink to="/signals" label="Signals" />
            <Link
              to="/app"
              className="text-sm px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20 transition"
            >
              Sign in
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white/80 hover:text-white border border-white/10 bg-white/5 rounded-lg px-3 py-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            ☰
          </button>
        </div>

        {/* Mobile menu panel */}
        {open && (
          <div className="md:hidden border-t border-white/10 bg-black/90">
            <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col gap-2">
              <TopLink to="/" label="Home" />
              <TopLink to="/live" label="Live" />
              <TopLink to="/signals" label="Signals" />
              <Link
                to="/app"
                className="text-sm px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20 transition"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </header>

      <Outlet />
    </div>
  );
}
