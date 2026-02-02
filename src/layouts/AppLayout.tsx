import React from "react";
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
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/80 hover:text-white transition">
              ← Back to Home
            </Link>
            <div className="text-white/30">/</div>
            <div className="font-semibold tracking-tight">Pythh App</div>
          </div>

          <nav className="flex items-center gap-2">
            <NavItem to="/app" label="Dashboard" />
            <NavItem to="/app/engine" label="Engine" />
            <NavItem to="/app/signals" label="Signals" />
            <NavItem to="/app/logs" label="Logs" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
