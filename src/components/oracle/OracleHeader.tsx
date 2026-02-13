import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';

type OracleHeaderProps = {
  onOpenMenu: () => void;
};

export default function OracleHeader({ onOpenMenu }: OracleHeaderProps) {
  return (
    <header className="w-full">
      <div className="flex w-full items-center justify-between">
        {/* Brand lockup (always visible) */}
        <Link to="/" className="group flex items-center gap-2.5">
          <img src="/pythia-square.png" alt="" className="w-6 h-6 rounded-full" />
          <span className="text-sm font-semibold tracking-wide text-white/90 group-hover:text-white">
            pythh.ai
          </span>
          <span className="text-xs tracking-[0.25em] text-white/40 group-hover:text-white/60">
            SIGNAL SCIENCE
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Sign in (visible, non-distracting) */}
          <Link
            to="/login"
            className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
          >
            Sign in
          </Link>

          {/* Hamburger (nav only) */}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 hover:bg-white/10 hover:text-white transition"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
