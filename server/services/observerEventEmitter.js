/**
 * OBSERVER EVENT EMITTER
 * ======================
 * Canonical interface for all scrapers to emit observer events
 * 
 * Usage:
 *   await emitObserverEvent({
 *     investor_id: '...',
 *     startup_id: '...',
 *     source: 'portfolio_overlap',
 *     weight: 1.5,
 *     meta: { url: '...', context: '...' }
 *   });
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Standard event weights (keep stable for 30 days)
 */
const EVENT_WEIGHTS = {
  partner_view: 2.0,       // Direct investor attention
  portfolio_overlap: 1.5,  // Portfolio page listing
  browse_similar: 1.2,     // Category/sector browsing
  search: 1.0,             // Search result appearance
  forum: 0.8,              // Forum/HN mention
  news: 0.6                // News/blog mention
};

/**
 * Emit observer event (with automatic dedup via DB function)
 * 
 * @param {Object} event
 * @param {string} event.investor_id - UUID
 * @param {string} event.startup_id - UUID
 * @param {string} event.source - Event type (see EVENT_WEIGHTS)
 * @param {number} [event.weight] - Override default weight
 * @param {Object} [event.meta] - Additional context
 * @returns {Promise<string|null>} Event ID or null if deduped
 */
async function emitObserverEvent({ investor_id, startup_id, source, weight, meta = {} }) {
  // Use standard weight if not provided
  const eventWeight = weight !== undefined ? weight : EVENT_WEIGHTS[source] || 1.0;

  try {
    const { data, error } = await supabase.rpc('insert_observer_event', {
      p_investor_id: investor_id,
      p_startup_id: startup_id,
      p_source: source,
      p_weight: eventWeight,
      p_meta: meta
    });

    if (error) {
      console.error('[Observer Event] Error:', error);
      return null;
    }

    if (!data) {
      // Deduped (event within 6h window)
      console.log('[Observer Event] Deduped:', { investor_id, startup_id, source });
      return null;
    }

    console.log('[Observer Event] Emitted:', {
      id: data,
      investor_id,
      startup_id,
      source,
      weight: eventWeight
    });

    return data;
  } catch (err) {
    console.error('[Observer Event] Exception:', err);
    return null;
  }
}

/**
 * Emit startup signal event (phase-change tracking)
 * 
 * @param {Object} signal
 * @param {string} signal.startup_id - UUID
 * @param {string} signal.signal_type - Signal type
 * @param {number} [signal.weight] - Signal weight (default 1.0)
 * @param {Object} [signal.meta] - Additional context
 * @returns {Promise<string|null>} Signal ID
 */
async function emitStartupSignal({ startup_id, signal_type, weight = 1.0, meta = {} }) {
  try {
    const { data, error } = await supabase.rpc('insert_startup_signal', {
      p_startup_id: startup_id,
      p_signal_type: signal_type,
      p_weight: weight,
      p_meta: meta
    });

    if (error) {
      console.error('[Startup Signal] Error:', error);
      return null;
    }

    console.log('[Startup Signal] Emitted:', {
      id: data,
      startup_id,
      signal_type,
      weight
    });

    return data;
  } catch (err) {
    console.error('[Startup Signal] Exception:', err);
    return null;
  }
}

/**
 * Batch emit observer events (for bulk scraping)
 * 
 * @param {Array} events - Array of event objects
 * @returns {Promise<number>} Count of emitted events
 */
async function emitObserverEventsBatch(events) {
  const results = await Promise.all(
    events.map(event => emitObserverEvent(event))
  );

  const emittedCount = results.filter(id => id !== null).length;
  console.log(`[Observer Events] Batch: ${emittedCount}/${events.length} emitted`);

  return emittedCount;
}

module.exports = {
  emitObserverEvent,
  emitStartupSignal,
  emitObserverEventsBatch,
  EVENT_WEIGHTS
};
