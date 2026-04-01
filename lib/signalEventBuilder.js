'use strict';

/**
 * lib/signalEventBuilder.js
 *
 * Canonical transformer: parseSignal() output → pythh_signal_events DB row.
 *
 * Why this exists:
 *   signalParser.js returns one object shape.
 *   pythh_signal_events has a different column set.
 *   Previously, every ingest script maintained its own field mapping —
 *   each with different (wrong) field names for the same data.
 *   This file is the single source of truth. The mapping lives here and
 *   nowhere else. When the schema changes, this is the only file to update.
 *
 * Exports:
 *   buildSignalEvent(sig, meta)    → pythh_signal_events row
 *   buildTimelineEvent(sig, meta)  → pythh_signal_timeline row
 *
 * Neither function writes to the database. They return plain objects.
 * Use lib/supabaseUtils.insertInBatches() to write them.
 */

/**
 * Build a pythh_signal_events row from a parsed signal and source metadata.
 *
 * @param {Object} sig         - Direct output from parseSignal() or parseMultiSignal()
 * @param {Object} meta        - Source metadata
 * @param {string} meta.entityId      - pythh_entities.id (UUID)
 * @param {string} meta.rawSentence   - The original text that was parsed
 * @param {string} meta.sourceType    - SOURCE_RELIABILITY key: 'rss_scrape' | 'startup_submission' |
 *                                      'llm_enrichment' | 'structured_metrics' | etc.
 * @param {string} [meta.source]      - Display name for source (defaults to sourceType)
 * @param {string} [meta.sourceUrl]   - URL of source article/page
 * @param {string} meta.detectedAt    - ISO 8601 timestamp
 * @param {number} [meta.sourceReliability] - Override source_reliability (default: from ontology)
 * @returns {Object|null}  Ready-to-insert DB row, or null if sig or entityId is missing
 */
function buildSignalEvent(sig, meta) {
  if (!sig || !meta?.entityId) return null;

  const {
    entityId,
    rawSentence,
    sourceType,
    source       = sourceType,
    sourceUrl    = null,
    detectedAt,
    sourceReliability = null,
  } = meta;

  return {
    entity_id:        entityId,
    raw_sentence:     rawSentence || sig.raw_text || null,

    // ── Source provenance ─────────────────────────────────────────────────────
    source,
    source_type:      sourceType,
    source_url:       sourceUrl,
    source_reliability: sourceReliability,
    detected_at:      detectedAt,

    // ── Signal object (full parse stored for future queries) ──────────────────
    signal_object:    sig,

    // ── Classification ────────────────────────────────────────────────────────
    primary_signal:   sig.primary_signal,
    signal_type:      sig.signal_type        || null,
    signal_strength:  sig.signal_strength    ?? null,
    confidence:       sig.confidence,
    evidence_quality: sig.evidence_quality,

    // ── Grammar ───────────────────────────────────────────────────────────────
    actor_type:       sig.actor              || null,
    action_tag:       sig._actions?.[0]?.action_tag || null,
    modality:         sig.modality?.class    || null,
    posture:          sig.posture?.[0]?.posture || null,

    // ── Enrichment arrays (JSONB) ─────────────────────────────────────────────
    intensity:        sig.intensity          || [],
    sub_signals:      sig.alternate_signals  || [],
    who_cares:        sig.who_cares          || {},

    // ── Flags ─────────────────────────────────────────────────────────────────
    is_costly_action: sig.costly_action      || false,
    is_ambiguous:     (sig.ambiguity_flags?.length > 0) || false,
    is_multi_signal:  (sig.alternate_signals?.length > 0) || false,
    has_negation:     sig.negation_detected  || false,

    // ── Inference ─────────────────────────────────────────────────────────────
    likely_stage:     sig.inference?.likely_stage  || null,
    likely_needs:     sig.inference?.likely_need   || [],
    urgency:          sig.inference?.urgency        || null,
  };
}

/**
 * Build a pythh_signal_timeline row from the same parsed signal.
 * The timeline table is a lightweight append-only log — one row per signal event.
 *
 * @param {Object} sig        - Direct output from parseSignal()
 * @param {Object} meta
 * @param {string} meta.entityId
 * @param {string} meta.sourceType
 * @param {string} [meta.source]
 * @param {string} [meta.sourceUrl]
 * @param {string} meta.eventDate   - YYYY-MM-DD date string
 * @returns {Object|null}
 */
function buildTimelineEvent(sig, meta) {
  if (!sig || !meta?.entityId) return null;

  const {
    entityId,
    sourceType,
    source    = sourceType,
    sourceUrl = null,
    eventDate,
  } = meta;

  return {
    entity_id:        entityId,
    event_date:       eventDate,
    signal_class:     sig.primary_signal,
    signal_type:      sig.signal_type        || null,
    signal_strength:  sig.signal_strength    ?? null,
    confidence:       sig.confidence,
    evidence_quality: sig.evidence_quality,
    is_costly_action: sig.costly_action      || false,
    summary:          sig._actions?.[0]?.meaning || sig.primary_signal,
    source,
    source_type:      sourceType,
    source_url:       sourceUrl,
  };
}

module.exports = { buildSignalEvent, buildTimelineEvent };
