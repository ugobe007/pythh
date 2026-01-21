/**
 * NOTIFICATION BELL — Sprint 4
 * ============================
 * 
 * The in-app notification indicator.
 * Shows unread count badge when there are new digests.
 * 
 * Design:
 * - Subtle, not attention-grabbing
 * - Only shows badge when something meaningful happened
 * - Clicking opens the NotificationDrawer
 */

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { getNotificationIndicator } from '../../services/weeklyDigestService';

interface NotificationBellProps {
  startupUrl?: string;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({ startupUrl, onClick, className = '' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!startupUrl) {
      setIsLoading(false);
      return;
    }
    
    async function fetchIndicator() {
      if (!startupUrl) return;
      try {
        const indicator = await getNotificationIndicator(startupUrl);
        setUnreadCount(indicator.unreadCount);
      } catch (err) {
        console.error('[NotificationBell] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchIndicator();
    
    // Poll every 60 seconds for new notifications
    const interval = setInterval(fetchIndicator, 60000);
    return () => clearInterval(interval);
  }, [startupUrl]);
  
  const hasUnread = unreadCount > 0;
  
  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-lg transition-all ${
        hasUnread 
          ? 'text-amber-400 hover:bg-amber-500/10' 
          : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800'
      } ${className}`}
      title={hasUnread ? `${unreadCount} new update${unreadCount > 1 ? 's' : ''}` : 'No new updates'}
    >
      <Bell className={`w-5 h-5 ${hasUnread ? 'fill-amber-400/20' : ''}`} />
      
      {/* Unread badge */}
      {hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75 animate-ping" />
          <span className="relative inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-[10px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </span>
      )}
    </button>
  );
}

export default NotificationBell;
