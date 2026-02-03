// ============================================================================
// UnlockButton - Handles unlock with loading + idempotent path
// ============================================================================

import { useState } from 'react';
import { Lock, Unlock, Loader2 } from 'lucide-react';

interface UnlockButtonProps {
  investorId: string;
  isLocked: boolean;
  isPending: boolean;
  onUnlock: (investorId: string) => Promise<void>;
  onView: (investorId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function UnlockButton({
  investorId,
  isLocked,
  isPending,
  onUnlock,
  onView,
  disabled = false,
  className = '',
}: UnlockButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    if (isLocked) {
      setIsSubmitting(true);
      try {
        await onUnlock(investorId);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onView(investorId);
    }
  };

  const showLoading = isSubmitting || isPending;

  if (isLocked) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled || showLoading}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
          border rounded transition-colors
          ${showLoading
            ? 'bg-zinc-800 text-gray-400 border-zinc-700 cursor-wait'
            : disabled
              ? 'bg-zinc-800 text-gray-500 border-zinc-700 cursor-not-allowed'
              : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500 hover:border-emerald-500'
          }
          ${className}
        `}
      >
        {showLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Unlocking</span>
          </>
        ) : (
          <>
            <Lock className="w-3.5 h-3.5" />
            <span>Unlock</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
        text-gray-300 border border-zinc-700 rounded hover:text-white hover:border-zinc-600
        transition-colors
        ${className}
      `}
    >
      <Unlock className="w-3.5 h-3.5" />
      <span>View</span>
    </button>
  );
}
