/**
 * TOP BAR — Pythh Design Schema (Global)
 * ========================================
 * Consistent header across all pages
 * - Brand left
 * - Minimal links right
 * - Thin border bottom (white/10)
 * 
 * Usage:
 *   <TopBar 
 *     leftContent={<BrandMark />}
 *     rightLinks={[
 *       { label: 'Live', to: '/live' },
 *       { label: 'Signals', to: '/signals' },
 *     ]}
 *   />
 */

import { Link } from 'react-router-dom';
import { ReactNode } from 'react';

interface TopBarLink {
  label: string;
  to: string;
  external?: boolean;
}

interface TopBarProps {
  leftContent?: ReactNode;
  rightLinks?: TopBarLink[];
  rightContent?: ReactNode;
  variant?: 'standard' | 'dense';
}

export default function TopBar({ 
  leftContent, 
  rightLinks = [],
  rightContent,
  variant = 'standard'
}: TopBarProps) {
  const maxWidth = variant === 'dense' ? 'max-w-7xl' : 'max-w-6xl';
  
  return (
    <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
      <div className={`${maxWidth} mx-auto px-6 py-5`}>
        <div className="flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-4">
            {leftContent}
          </div>
          
          {/* Right */}
          <div className="flex items-center gap-6">
            {rightLinks.map((link) => (
              link.external ? (
                <a
                  key={link.to}
                  href={link.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/70 hover:text-white transition"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-white/70 hover:text-white transition"
                >
                  {link.label}
                </Link>
              )
            ))}
            {rightContent}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * BRAND MARK (for TopBar left)
 */
export function TopBarBrand() {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <img src="/images/pythh-logo-square.png" alt="pythh.ai" className="h-7 w-auto" style={{ filter: 'invert(1)' }} />
    </Link>
  );
}
