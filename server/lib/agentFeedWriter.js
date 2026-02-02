/**
 * Agent Feed Writer
 * 
 * Writes normalized feed items to agent_feed_items table (SSOT).
 * Call this whenever generating signals or movements that should
 * appear in the agent API feeds.
 */

const { getSupabaseClient } = require('./supabaseClient');

/**
 * Clamp evidence to max 2 items with safe field lengths
 * @param {Array} evidence - Raw evidence array
 * @returns {Array|null} - Clamped evidence or null
 */
function clampEvidence(evidence) {
  if (!Array.isArray(evidence)) return null;
  const out = [];
  for (const item of evidence.slice(0, 2)) { // max 2 bullets per feed item (public-safe)
    out.push({
      claim: String(item.claim || '').slice(0, 140),
      source: String(item.source || 'other').slice(0, 40),
      confidence: item.confidence || 'medium',
      timestamp: item.timestamp || null,
      recency: item.recency || '',
      visibility: item.visibility || 'public',
    });
  }
  return out.length > 0 ? out : null;
}

/**
 * Write a feed item to agent_feed_items
 * 
 * @param {Object} payload
 * @param {'signal'|'movement'} payload.kind - Feed type
 * @param {string|null} payload.lens_id - Optional lens filter
 * @param {string|null} payload.sector - Optional sector
 * @param {string} payload.label - Human-readable label (required)
 * @param {number|null} payload.strength - 0-100 strength score
 * @param {'up'|'down'|'flat'|null} payload.velocity - Velocity indicator
 * @param {string|null} payload.timing_state - monitoring|warming|cooling|dormant|stable|hot|holding
 * @param {Array|null} payload.evidence - Evidence bullets (max 2)
 * @param {Object|null} payload.entity_refs - { startups:[{id,name}], investors:[{id,name}] }
 * @param {Object|null} payload.poke - { ui_paths:{...} }
 * @param {string} payload.source - Origin system (signals_engine, scoring_engine, ingest, etc)
 * @param {string|null} payload.created_at - Optional timestamp (defaults to now)
 * @returns {Promise<{id: string}|null>} - Inserted row id or null on error
 */
async function writeAgentFeedItem(payload) {
  const supabase = getSupabaseClient();

  // Validate required fields
  if (!payload.kind || !['signal', 'movement'].includes(payload.kind)) {
    console.error('[agent_feed_items] invalid kind:', payload.kind);
    return null;
  }
  if (!payload.label || typeof payload.label !== 'string') {
    console.error('[agent_feed_items] missing label');
    return null;
  }

  // Validate strength range
  let strength = payload.strength ?? null;
  if (strength !== null) {
    strength = Math.max(0, Math.min(100, Math.round(strength)));
  }

  // Validate velocity
  const validVelocities = ['up', 'down', 'flat', null];
  const velocity = validVelocities.includes(payload.velocity) ? payload.velocity : null;

  // Validate timing_state
  const validTimingStates = ['monitoring', 'warming', 'cooling', 'dormant', 'stable', 'hot', 'holding', null];
  const timing_state = validTimingStates.includes(payload.timing_state) ? payload.timing_state : null;

  const row = {
    kind: payload.kind,
    lens_id: payload.lens_id || null,
    sector: payload.sector || null,
    label: String(payload.label).slice(0, 255),
    strength,
    velocity,
    timing_state,
    evidence: payload.evidence ? clampEvidence(payload.evidence) : null,
    entity_refs: payload.entity_refs || null,
    poke: payload.poke || null,
    source: payload.source || 'system',
    created_at: payload.created_at || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('agent_feed_items')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[agent_feed_items] insert failed:', error);
    return null;
  }

  return data;
}

/**
 * Write multiple feed items in a batch
 * @param {Array} items - Array of payload objects
 * @returns {Promise<number>} - Count of successfully inserted items
 */
async function writeAgentFeedItems(items) {
  let successCount = 0;
  for (const item of items) {
    const result = await writeAgentFeedItem(item);
    if (result) successCount++;
  }
  return successCount;
}

module.exports = { writeAgentFeedItem, writeAgentFeedItems, clampEvidence };
