/**
 * NOTIFICATION DRAWER — Sprint 4
 * ===============================
 * 
 * The slide-out panel showing weekly digest notifications.
 * 
 * Copy & Tone (LOCKED):
 * - Subject: "Your investor alignment just changed"
 * - Opening: "Something in your startup profile shifted this week."
 * - No marketing, no CTA stacking, no advice
 * - Calm, authoritative, informational
 * 
 * "When Pythh emails me, it matters."
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Bell, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  getUnreadDigests, 
  getDigestHistory,
  markDigestViewed,
  markDigestClicked,
  dismissDigest,
  markAllDigestsSeen
} from '../../services/weeklyDigestService';
import type { WeeklyDigest, DigestBullet } from '../../lib/database.types';

interface NotificationDrawerProps {
  startupUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  onViewChange?: () => void; // Callback when user clicks to view details
}

// =============================================================================
// BULLET RENDERING
// =============================================================================

function DigestBulletItem({ bullet }: { bullet: DigestBullet }) {
  const typeStyles = {
    positive: 'text-amber-400',
    neutral: 'text-gray-400',
    negative: 'text-gray-500'
  };
  
  const dotStyles = {
    positive: 'bg-amber-400',
    neutral: 'bg-gray-500',
    negative: 'bg-gray-600'
  };
  
  return (
    <li className="flex items-start gap-3">
      <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotStyles[bullet.type]}`} />
      <span className={`text-sm ${typeStyles[bullet.type]}`}>
        {bullet.text}
      </span>
    </li>
  );
}

// =============================================================================
// DIGEST CARD
// =============================================================================

function DigestCard({ 
  digest, 
  onView, 
  onDismiss 
}: { 
  digest: WeeklyDigest; 
  onView: () => void;
  onDismiss: () => void;
}) {
  const isUnread = digest.status === 'pending' || digest.status === 'delivered';
  const date = new Date(digest.created_at);
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return (
    <div 
      className={`p-4 rounded-xl border transition-all ${
        isUnread 
          ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' 
          : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
          <span className="text-xs text-gray-500">{formattedDate}</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Headline */}
      <p className="text-sm text-gray-300 mb-3">
        {digest.headline}
      </p>
      
      {/* Bullets */}
      <ul className="space-y-2 mb-4">
        {digest.bullets.slice(0, 3).map((bullet, i) => (
          <DigestBulletItem key={i} bullet={bullet} />
        ))}
      </ul>
      
      {/* CTA */}
      <button
        onClick={onView}
        className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors group"
      >
        <span>View what changed</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <Bell className="w-5 h-5 text-gray-600" />
      </div>
      <p className="text-gray-400 mb-2">No updates yet</p>
      <p className="text-xs text-gray-600 max-w-xs">
        When your investor alignment changes, you'll see it here.
      </p>
    </div>
  );
}

// =============================================================================
// MAIN DRAWER
// =============================================================================

export function NotificationDrawer({ 
  startupUrl, 
  isOpen, 
  onClose,
  onViewChange 
}: NotificationDrawerProps) {
  const [digests, setDigests] = useState<WeeklyDigest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // Fetch digests when opened
  useEffect(() => {
    if (!isOpen || !startupUrl) return;
    
    async function fetchDigests() {
      if (!startupUrl) return;
      setIsLoading(true);
      try {
        const data = showHistory 
          ? await getDigestHistory(startupUrl)
          : await getUnreadDigests(startupUrl);
        setDigests(data);
        
        // Mark as seen when opened (not clicked yet)
        if (!showHistory && data.length > 0) {
          await markAllDigestsSeen(startupUrl);
        }
      } catch (err) {
        console.error('[NotificationDrawer] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDigests();
  }, [isOpen, startupUrl, showHistory]);
  
  const handleView = async (digest: WeeklyDigest) => {
    await markDigestClicked(digest.id);
    onViewChange?.();
    // Could navigate to a detail page or expand inline
  };
  
  const handleDismiss = async (digestId: string) => {
    await dismissDigest(digestId);
    setDigests(prev => prev.filter(d => d.id !== digestId));
  };
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0a0a0a] border-l border-gray-800 z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Updates</h2>
            <p className="text-xs text-gray-500">Your investor alignment changes</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tab toggle */}
        <div className="flex gap-2 p-4 border-b border-gray-800">
          <button
            onClick={() => setShowHistory(false)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              !showHistory 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              showHistory 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            History
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-32 bg-gray-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : digests.length === 0 ? (
            <EmptyState />
          ) : (
            digests.map(digest => (
              <DigestCard
                key={digest.id}
                digest={digest}
                onView={() => handleView(digest)}
                onDismiss={() => handleDismiss(digest.id)}
              />
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 text-center italic">
            Pythh updates you when investor alignment actually changes.
            <br />
            Silence means nothing meaningful happened.
          </p>
        </div>
      </div>
    </>
  );
}

export default NotificationDrawer;
