/**
 * SaveToSignalCard Component
 * 
 * Global save button used across Trends, Startup Intelligence, Matches, and Score Drawer.
 * Icon-only with tooltip. No labels. Adults know what save means.
 */

import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { 
  toggleSaveToSignalCard, 
  isEntitySaved,
  type SavePayload,
  type LensId,
  type TimeWindow,
  type EntityType
} from '../services/signalCardService';

interface SaveToSignalCardProps {
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  lensId?: LensId;
  window?: TimeWindow;
  scoreValue?: number;
  rank?: number;
  rankDelta?: number;
  context?: string;
  
  // Optional: external control of saved state (for list optimization)
  initialSaved?: boolean;
  onSaveChange?: (saved: boolean) => void;
  
  // Styling
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const buttonSizeClasses = {
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2',
};

export default function SaveToSignalCard({
  entityType,
  entityId,
  entityName,
  lensId,
  window,
  scoreValue,
  rank,
  rankDelta,
  context,
  initialSaved,
  onSaveChange,
  size = 'md',
  className = '',
}: SaveToSignalCardProps) {
  const [isSaved, setIsSaved] = useState(initialSaved ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Check saved state on mount if not provided externally
  useEffect(() => {
    if (initialSaved === undefined) {
      checkSavedState();
    }
  }, [entityId, lensId]);

  // Sync with external state changes
  useEffect(() => {
    if (initialSaved !== undefined) {
      setIsSaved(initialSaved);
    }
  }, [initialSaved]);

  const checkSavedState = async () => {
    const { saved } = await isEntitySaved(entityType, entityId, lensId);
    setIsSaved(saved);
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setIsLoading(true);

    const payload: SavePayload = {
      entityType,
      entityId,
      entityName,
      lensId,
      window,
      scoreValue,
      rank,
      rankDelta,
      context,
    };

    const result = await toggleSaveToSignalCard(payload);

    setIsLoading(false);

    if (!result.error) {
      setIsSaved(result.saved);
      onSaveChange?.(result.saved);
      
      // Show toast
      setToastMessage(result.saved ? 'Saved to Signal Card' : 'Removed from Signal Card');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          ${buttonSizeClasses[size]}
          rounded-md transition-all duration-150
          ${isSaved 
            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10' 
            : 'text-slate-400 hover:text-amber-500 hover:bg-slate-700/50'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-amber-500/50
          group
        `}
        title={isSaved ? 'Saved to Signal Card' : 'Save to Signal Card'}
      >
        {isLoading ? (
          <Loader2 className={`${sizeClasses[size]} animate-spin`} />
        ) : isSaved ? (
          <BookmarkCheck className={sizeClasses[size]} />
        ) : (
          <Bookmark className={sizeClasses[size]} />
        )}
      </button>

      {/* Tooltip on hover */}
      <div className={`
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2
        px-2 py-1 text-xs font-medium rounded-md
        bg-slate-800 text-slate-200 border border-slate-700
        opacity-0 group-hover:opacity-100 pointer-events-none
        transition-opacity duration-150 whitespace-nowrap z-50
        ${showToast ? 'opacity-0' : ''}
      `}>
        {isSaved ? 'Saved' : 'Save to Signal Card'}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className={`
          fixed bottom-4 left-1/2 -translate-x-1/2
          px-4 py-2 rounded-lg shadow-lg
          bg-slate-800 text-white text-sm font-medium
          border border-slate-700
          animate-fade-in-up z-[100]
        `}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage saved state for a list of entities
 * Use this for efficient rendering of save buttons in tables
 */
export function useSavedEntities(entityType: EntityType, entityIds: string[]) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedIds();
  }, [entityIds.join(',')]);

  const loadSavedIds = async () => {
    setIsLoading(true);
    const { getSavedEntityIds } = await import('../services/signalCardService');
    const ids = await getSavedEntityIds(entityType);
    setSavedIds(ids);
    setIsLoading(false);
  };

  const updateSaved = (entityId: string, lensId: string | undefined, saved: boolean) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      const key = lensId ? `${entityId}:${lensId}` : entityId;
      if (saved) {
        next.add(entityId);
        next.add(key);
      } else {
        next.delete(entityId);
        next.delete(key);
      }
      return next;
    });
  };

  const isSaved = (entityId: string, lensId?: string) => {
    if (lensId) {
      return savedIds.has(`${entityId}:${lensId}`);
    }
    return savedIds.has(entityId);
  };

  return { savedIds, isSaved, updateSaved, isLoading, refresh: loadSavedIds };
}
