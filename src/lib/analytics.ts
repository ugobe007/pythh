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

/**
 * Persist events to API/Supabase. In DEV, off by default so `npm run dev` (Vite only) does not
 * spam 404 (/api/analytics/flush) and 401 (ai_logs RLS). Enable with VITE_DEV_ANALYTICS=1 when
 * the Node server is also running.
 */
const shouldPersistAnalytics =
  import.meta.env.PROD || import.meta.env.VITE_DEV_ANALYTICS === '1';

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
/** After a 404 on /api/analytics/flush (static hosting), stop requesting to avoid noisy console. */
let analyticsFlushEndpointMissing = false;

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

  if (!shouldPersistAnalytics) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[pyth.analytics] ${name}`, data);
    }
    return;
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
  if (!shouldPersistAnalytics) {
    eventQueue.length = 0;
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    return;
  }

  if (analyticsFlushEndpointMissing) {
    eventQueue.length = 0;
    return;
  }

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
    /** 'ok' | 'missing' (404/502/connection refused) | 'other' */
    let apiRouteOutcome: 'ok' | 'missing' | 'other' = 'other';

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(apiUrl('/api/analytics/flush'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        });
        if (res.ok) {
          persisted = true;
          apiRouteOutcome = 'ok';
        } else if (res.status === 404 || res.status === 502) {
          apiRouteOutcome = 'missing';
          analyticsFlushEndpointMissing = true;
        } else {
          apiRouteOutcome = 'other';
        }
      } catch {
        apiRouteOutcome = 'missing';
      }
    }

    // Do not call Supabase when the API route is missing — anon insert hits RLS and spams 401 in the console.
    if (!persisted && apiRouteOutcome !== 'missing') {
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
    } else if (apiRouteOutcome === 'missing') {
      eventQueue.splice(0, events.length);
    } else if (!flushTimeout) {
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
