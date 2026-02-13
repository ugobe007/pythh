/**
 * NOTIFICATIONS PAGE
 * ==================
 * Shows user's alert notifications
 * - List of all notifications with read/unread state
 * - Mark as read functionality
 * - Links to startup details
 * - Elite upsell if alerts not enabled
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Flame, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  Crown,
  Sparkles
} from 'lucide-react';
import { useNotifications, NotificationKind, Notification } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

// Icon and color mapping for notification kinds
const NOTIFICATION_STYLES: Record<NotificationKind, { icon: typeof Bell; color: string; bgColor: string }> = {
  startup_hot: { icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  momentum_spike: { icon: TrendingUp, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  system: { icon: Bell, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  promo: { icon: Sparkles, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  stage_advance: { icon: ArrowRight, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  deal_close: { icon: Check, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Render "Why" line for alert explainability (Prompt 15)
 * Shows context about what triggered the alert
 */
function renderWhyLine(notification: Notification): React.ReactNode {
  const payload = notification.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  
  const kind = notification.kind;
  
  // startup_hot: Show state transition
  if (kind === 'startup_hot' && payload.previous_state && payload.current_state) {
    const prevState = String(payload.previous_state).toUpperCase();
    const currState = String(payload.current_state).toUpperCase();
    const sector = payload.sector_key ? String(payload.sector_key) : '';
    const momentum = typeof payload.momentum_at_trigger === 'number' ? payload.momentum_at_trigger.toFixed(1) : '?';
    const evidence = typeof payload.evidence_at_trigger === 'number' ? payload.evidence_at_trigger.toFixed(1) : '?';
    
    return (
      <p className="text-xs text-orange-400/80 mt-1 italic">
        Why: {prevState} → {currState} transition{sector ? ` in ${sector}` : ''} (M:{momentum} E:{evidence})
      </p>
    );
  }
  
  // momentum_spike: Show threshold breach
  if (kind === 'momentum_spike') {
    const momentum = typeof payload.momentum_at_trigger === 'number' ? payload.momentum_at_trigger.toFixed(1) : '?';
    const evidence = typeof payload.evidence_at_trigger === 'number' ? payload.evidence_at_trigger.toFixed(1) : '?';
    const thresholds = payload.thresholds as { momentum?: number; evidence?: number } | undefined;
    const mThresh = thresholds?.momentum ?? 9.0;
    const eThresh = thresholds?.evidence ?? 7.0;
    
    return (
      <p className="text-xs text-green-400/80 mt-1 italic">
        Why: Momentum {momentum} ≥ {mThresh} and evidence {evidence} ≥ {eThresh}
      </p>
    );
  }
  
  return null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    alertsEnabled, 
    plan, 
    isLoading, 
    error, 
    markAsRead, 
    markAllAsRead,
    refresh
  } = useNotifications();
  
  const [markingAll, setMarkingAll] = useState(false);

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    await markAllAsRead();
    setMarkingAll(false);
  };

  // Handle notification click - mark as read and navigate
  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Navigate to startup detail if it's a startup notification
    if (notification.entity_type === 'startup' && notification.entity_id) {
      navigate(`/startup/${notification.entity_id}`);
    }
  };

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <LogoDropdownMenu />
        <div className="max-w-2xl mx-auto pt-24 px-4 text-center">
          <BellOff className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view notifications</h1>
          <p className="text-zinc-400 mb-6">
            Create an account to watch startups and receive alerts.
          </p>
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <LogoDropdownMenu />
      
      <div className="max-w-2xl mx-auto pt-20 px-4 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              {alertsEnabled 
                ? 'Alerts enabled for your watchlist'
                : 'Alerts available on Elite plan'}
            </p>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              {markingAll ? 'Marking...' : 'Mark all read'}
            </button>
          )}
        </div>

        {/* Elite Upsell Banner (if not Elite) */}
        {!alertsEnabled && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">
                  Unlock Real-Time Alerts
                </h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Elite members get instant notifications when watched startups heat up or show momentum spikes.
                </p>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Elite
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={refresh}
              className="text-sm text-zinc-400 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && notifications.length === 0 && (
          <div className="text-center py-16">
            <BellOff className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-zinc-400 mb-2">
              No notifications yet
            </h2>
            <p className="text-sm text-zinc-500 mb-4">
              {alertsEnabled 
                ? 'Watch some startups to receive alerts when they heat up.'
                : 'Upgrade to Elite and watch startups to receive alerts.'}
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm"
            >
              Find startups to watch <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Notifications List */}
        {!isLoading && !error && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map(notification => {
              const style = NOTIFICATION_STYLES[notification.kind as NotificationKind] || NOTIFICATION_STYLES.system;
              const IconComponent = style.icon;
              
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    w-full text-left p-4 rounded-xl border transition-all
                    ${notification.is_read 
                      ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900' 
                      : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${style.bgColor}`}>
                      <IconComponent className={`w-5 h-5 ${style.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium truncate ${notification.is_read ? 'text-zinc-300' : 'text-white'}`}>
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm line-clamp-2 ${notification.is_read ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {notification.body}
                      </p>
                      
                      {/* Why line - Explainability (Prompt 15) */}
                      {notification.payload && renderWhyLine(notification)}
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(notification.created_at)}
                      </div>
                    </div>
                    
                    {/* Arrow for clickable items */}
                    {notification.entity_type === 'startup' && (
                      <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
