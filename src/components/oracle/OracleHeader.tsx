import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { PYTHH_ICON_GLYPH } from '@/lib/brandAssets';

type OracleHeaderProps = {
  onOpenMenu: () => void;
};

export default function OracleHeader({ onOpenMenu }: OracleHeaderProps) {
  return (
    <header className="w-full">
      <div className="flex w-full items-center justify-between">
        {/* Brand lockup (always visible) */}
        <Link to="/" className="group flex items-center gap-2" aria-label="pythh.ai home">
          <img
            src={PYTHH_ICON_GLYPH}
            alt=""
            className="h-9 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
          />
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
