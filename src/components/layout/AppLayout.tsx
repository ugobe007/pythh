/**
 * APP LAYOUT — Supabase Dashboard Style
 * 
 * Flat surfaces, quiet borders, no glow, no gradients.
 * If it feels cinematic, it's wrong. If it feels terminal-like, it's correct.
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../../styles/pythh-dashboard.css";

export type TopNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

export default function AppLayout({
  brand = "PYTHH",
  nav,
  children,
}: {
  brand?: string;
  nav: TopNavItem[];
  children: React.ReactNode;
}) {
  const location = useLocation();

  return (
    <div className="pythh-app">
      {/* Topbar: sticky, quiet border, no glow */}
      <header className="pythh-topbar">
        <Link to="/" className="pythh-topbar-brand">{brand}</Link>
        <nav className="pythh-topbar-nav">
          {nav.map((n) => {
            const isActive = n.active !== undefined ? n.active : location.pathname === n.href;
            return (
              <Link 
                key={n.href} 
                to={n.href} 
                className={`pythh-topbar-link${isActive ? " active" : ""}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {children}
    </div>
  );
}
