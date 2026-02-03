/**
 * Analytics - Signal Science State Machine
 *
 * Batches events and writes to Supabase ai_logs.
 * Design goals:
 * - No event loss on transient failures
 * - Bulk insert (1 request per flush)
 * - Stable anon_id + session_id for funnel stitching
 */

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
  | 'drawer_closed';

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

// Circuit breaker state
let consecutiveFailures = 0;
let analyticsDisabled = true; // TEMPORARILY DISABLED FOR DEBUGGING
const MAX_CONSECUTIVE_FAILURES = 2; // Disable after 2 consecutive failures

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
  // Circuit breaker: don't track if disabled
  if (analyticsDisabled) {
    return;
  }

  // Throttle: don't fire same event twice in 10s
  const now = Date.now();
  const lastTime = lastEventTimes.get(name) || 0;
  if (now - lastTime < THROTTLE_MS) {
    return; // Skip duplicate event within throttle window
  }
  lastEventTimes.set(name, now);

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

  // Copy but DO NOT clear yet (avoid event loss)
  const events = eventQueue.slice();

  try {
    const { supabase } = await import('./supabase');

    const rows = events.map((event) => ({
      type: 'analytics',
      action: event.name,
      input: JSON.stringify(event.data),
      output: null,
      status: 'tracked',
      created_at: new Date(event.timestamp).toISOString(),
    }));

    const { error } = await (supabase as any).from('ai_logs').insert(rows);

    if (error) throw error;

    // Success: remove flushed events and reset failure count
    eventQueue.splice(0, events.length);
    consecutiveFailures = 0;
  } catch (error) {
    // Circuit breaker: track consecutive failures
    consecutiveFailures++;
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      // Disable analytics to prevent spam
      analyticsDisabled = true;
      // Clear queue to free memory
      eventQueue.length = 0;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[pyth.analytics] Circuit breaker tripped - analytics disabled after', consecutiveFailures, 'failures');
      }
      return; // Don't retry
    }

    // Keep queue (don't drop events). Try again soon with backoff.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[pyth.analytics] Failed to flush events (attempt', consecutiveFailures + '):', error);
    }
    // Backoff retry (5s * failure count)
    if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        void flushEvents();
      }, 5000 * consecutiveFailures);
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
