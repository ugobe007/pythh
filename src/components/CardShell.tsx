/**
 * CARD SHELL - Single Source of Truth for Card Design
 * 
 * All cards use identical specs with only accent color variable.
 * This prevents drift and ensures perfect symmetry.
 * 
 * NON-NEGOTIABLE SPECS:
 * - border-radius: 18px
 * - padding: 22px
 * - min-height: 150px
 * - title: 22px, line-height 1.15, weight 700
 * - subtitle: 14px, line-height 1.4
 */

import React from 'react';

interface CardShellProps {
  variant: 'investor' | 'startup';
  title: string;
  subtitle: string;
  metaItems: Array<{ label: string; value: string; color?: string }>;
  className?: string;
}

const ACCENT_COLORS = {
  investor: {
    border: 'border-cyan-500/40',
    bg: 'bg-gradient-to-br from-cyan-500/10 to-cyan-500/5',
    shadow: 'shadow-lg shadow-cyan-500/20',
    metaColor: 'text-cyan-400',
  },
  startup: {
    border: 'border-green-500/40',
    bg: 'bg-gradient-to-br from-green-500/10 to-green-500/5',
    shadow: 'shadow-lg shadow-green-500/20',
    metaColor: 'text-violet-400',
  },
};

export default function CardShell({
  variant,
  title,
  subtitle,
  metaItems,
  className = '',
}: CardShellProps) {
  const colors = ACCENT_COLORS[variant];

  return (
    <div
      className={`
        rounded-[18px] 
        border ${colors.border} 
        ${colors.bg} 
        p-[22px] 
        min-h-[150px] 
        transition-all duration-500 
        ${colors.shadow}
        ${className}
      `}
    >
      <div className="flex flex-col h-full justify-between">
        {/* Title + Subtitle */}
        <div className="space-y-1">
          <h3 className="text-[22px] leading-[1.15] font-bold text-white">
            {title}
          </h3>
          <p className="text-[14px] leading-[1.4] text-white/75 line-clamp-1">
            {subtitle}
          </p>
        </div>

        {/* Meta Row - Always one line, same gap */}
        <div className="flex items-center gap-3 text-sm mt-4">
          {metaItems.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <div className="w-px h-3 bg-white/10" />}
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">{item.label}:</span>
                <span className={item.color || colors.metaColor}>{item.value}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
