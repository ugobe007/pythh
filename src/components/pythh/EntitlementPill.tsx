// ============================================================================
// EntitlementPill - Shows unlock balance
// ============================================================================

import { StartupContext } from '@/lib/pythh-types';

interface EntitlementPillProps {
  entitlements: StartupContext['entitlements'];
  className?: string;
}

export function EntitlementPill({ entitlements, className = '' }: EntitlementPillProps) {
  if (!entitlements) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-500 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        Loading...
      </div>
    );
  }

  const { unlocks_remaining, daily_unlock_limit, plan } = entitlements;
  const isLow = unlocks_remaining <= 1;
  const isEmpty = unlocks_remaining === 0;

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
        ${isEmpty 
          ? 'bg-red-50 text-red-700 border border-red-200' 
          : isLow 
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }
        ${className}
      `}
    >
      <span className={`w-2 h-2 rounded-full ${isEmpty ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      <span>
        {unlocks_remaining}/{daily_unlock_limit} unlocks
      </span>
      {plan !== 'free' && (
        <span className="text-xs uppercase opacity-70">{plan}</span>
      )}
    </div>
  );
}
