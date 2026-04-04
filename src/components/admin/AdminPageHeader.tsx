import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional icon shown beside the title area (decorative) */
  icon?: LucideIcon;
  actions?: React.ReactNode;
  /** Outer width constraint (wide tables use max-w-[1800px]) */
  maxWidthClass?: string;
  className?: string;
}

/**
 * Shared header for /admin/* pages — matches UnifiedAdminDashboardV2 (Pythh admin design).
 */
export function AdminPageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  maxWidthClass = 'max-w-7xl',
  className = '',
}: AdminPageHeaderProps) {
  return (
    <div className={`${maxWidthClass} mx-auto px-4 pt-8 pb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="mt-1 p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-amber-400 shrink-0">
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              {title}
            </h1>
            {subtitle && <p className="text-slate-400 mt-1 text-sm max-w-2xl">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default AdminPageHeader;
