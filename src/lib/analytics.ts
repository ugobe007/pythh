/**
 * Analytics - Signal Science State Machine
 *
 * Batches events and writes to Supabase ai_logs.
 * Design goals:
 * - No event loss on transient failures
 * - Bulk insert (1 request per flush)
 * - Stable anon_id + session_id for funnel stitching
 */

import { apiUrl } from './apiConfig';

type EventName =
  | 'page_viewed'
  | 'oracle_viewed'
  | 'url_submitted'
  | 'scan_completed'
  | 'instant_matches_viewed'
  | 'match_saved'
  | 'detail_viewed'
  | 'role_toggled'
  | 'login_completed'
  | 'logout_completed'
  | 'paywall_shown'
  | 'checkout_started'
  | 'checkout_completed'
  | 'guard_blocked'
  | 'phase_advanced'
  | 'drawer_opened'
  | 'drawer_closed'
  | 'lookup_industry_selected'
  | 'lookup_top10_generated'
  | 'lookup_signup_cta_clicked'
  | 'lookup_signup_completed'
  | 'lookup_first_outreach_started'
  | 'lookup_save_list_clicked'
  | 'lookup_feedback_submitted';

interface EventData {
  [key: string]: string | number | boolean | null | undefined;
}

type QueuedEvent = {
  name: EventName;
  data: EventData;
  timestamp: number;
};

const eventQueue: QueuedEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

// Throttle state - prevent same event firing twice in 10s
const lastEventTimes: Map<EventName, number> = new Map();
const THROTTLE_MS = 10000; // 10 seconds

// IDs for funnel stitching
const ANON_ID_KEY = 'pyth_anon_id';
const SESSION_ID_KEY = 'pyth_session_id';

/** Generate a lightweight id (good enough for analytics) */
function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function getAnonId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  const created = genId('anon');
  localStorage.setItem(ANON_ID_KEY, created);
  return created;
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const created = genId('sess');
  sessionStorage.setItem(SESSION_ID_KEY, created);
  return created;
}

/**
 * Track an analytics event
 */
export function trackEvent(name: EventName, data: EventData = {}): void {
  // Throttle: don't fire same event twice in 10s (lookup funnel must never be dropped)
  const now = Date.now();
  if (!name.startsWith('lookup_')) {
    const lastTime = lastEventTimes.get(name) || 0;
    if (now - lastTime < THROTTLE_MS) {
      return; // Skip duplicate event within throttle window
    }
    lastEventTimes.set(name, now);
  }

  const anon_id = getAnonId();
  const session_id = getSessionId();

  const event: QueuedEvent = {
    name,
    data: {
      ...data,
      anon_id,
      session_id,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    },
    timestamp: Date.now(),
  };

  eventQueue.push(event);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[pyth.analytics] ${name}`, event.data);
  }

  // Flush after 2s (batch)
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      void flushEvents();
    }, 2000);
  }
}

/**
 * Flush events to Supabase (bulk insert)
 */
async function flushEvents(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length === 0) {
    isFlushing = false;
    return;
  }

  const events = eventQueue.slice();

  try {
    const rows = events.map((event) => ({
      operation: event.name,
      status: 'tracked',
      output: { ...event.data, event: event.name },
      created_at: new Date(event.timestamp).toISOString(),
    }));

    let persisted = false;

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(apiUrl('/api/analytics/flush'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        });
        if (res.ok) {
          persisted = true;
        }
      } catch {
        // Network / CORS — try direct insert below
      }
    }

    if (!persisted) {
      const { supabase } = await import('./supabase');
      const { error } = await (supabase as any).from('ai_logs').insert(rows);
      if (!error) {
        persisted = true;
      } else if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[pyth.analytics] Direct ai_logs insert failed:', error.message);
      }
    }

    if (persisted) {
      eventQueue.splice(0, events.length);
    } else if (!flushTimeout) {
      // Retry later; do not disable tracking or clear the queue (except bounded queue elsewhere)
      flushTimeout = setTimeout(() => {
        void flushEvents();
      }, 8000);
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[pyth.analytics] flush error (non-fatal):', e);
    }
    if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        void flushEvents();
      }, 8000);
    }
  } finally {
    isFlushing = false;
  }
}

/**
 * Flush when tab is backgrounded (more reliable than beforeunload)
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushEvents();
    }
  });
}

/**
 * Debug helper
 */
export function getAnalyticsSummary(): { pending: number; lastEvent: EventName | null } {
  return {
    pending: eventQueue.length,
    lastEvent: eventQueue.length > 0 ? eventQueue[eventQueue.length - 1].name : null,
  };
}

export function setAnalyticsDisabled(_disabled: boolean): void {
  /* no-op: legacy hook — circuit breaker removed so prod failures never silence tracking */
}
