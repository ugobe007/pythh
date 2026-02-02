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
          inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200
          ${showLoading
            ? 'bg-gray-700 text-gray-400 cursor-wait'
            : disabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40'
          }
          ${className}
        `}
      >
        {showLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Unlocking...</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
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
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
        bg-emerald-600 text-white hover:bg-emerald-500
        transition-all duration-200
        ${className}
      `}
    >
      <Unlock className="w-4 h-4" />
      <span>View</span>
    </button>
  );
}
