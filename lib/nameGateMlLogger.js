'use strict';

/**
 * Log name-gating features + labels to entity_gate_ml_events for ML training.
 * Opt-in: ENTITY_GATE_ML_LOG=1 or per-script --ml-log
 */

const { isValidStartupName } = require('./startupNameValidator');
const { classifyEntityTrack } = require('./startupNameLogicEngine');
const { ontologyJunkReason } = require('./pendingNameOntology');

const ENABLED =
  process.env.ENTITY_GATE_ML_LOG === '1' ||
  process.env.ENTITY_GATE_ML_LOG === 'true';

function mlLogEnabled(argv = process.argv) {
  if (ENABLED) return true;
  return Array.isArray(argv) && argv.includes('--ml-log');
}

function snapshotName(name) {
  const n = String(name || '').trim();
  if (!n) {
    return {
      validator_valid: false,
      validator_reason: 'empty',
      logic_track: 'descriptor',
      logic_reason: 'empty_name',
      ontology_hint: null,
    };
  }
  const v = isValidStartupName(n);
  const eng = classifyEntityTrack(n);
  const ont = ontologyJunkReason(n);
  return {
    validator_valid: v.isValid,
    validator_reason: v.isValid ? null : v.reason || 'invalid',
    logic_track: eng.track,
    logic_reason: eng.reason || '',
    ontology_hint: ont || null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} row
 */
async function insertEntityGateMlEvent(supabase, row) {
  const { error } = await supabase.from('entity_gate_ml_events').insert({
    startup_id: row.startup_id || null,
    name: row.name,
    event_source: row.event_source,
    entity_gate: row.entity_gate ?? null,
    bucket: row.bucket ?? null,
    enrichment_result: row.enrichment_result ?? null,
    validator_valid: row.validator_valid,
    validator_reason: row.validator_reason ?? null,
    logic_track: row.logic_track,
    logic_reason: row.logic_reason ?? null,
    ontology_hint: row.ontology_hint ?? null,
    training_label: row.training_label,
    meta: row.meta || {},
  });
  if (error) throw error;
}

/**
 * Batch insert (max ~200 rows per call for Supabase comfort).
 */
async function insertEntityGateMlEventsBatch(supabase, rows) {
  if (!rows.length) return;
  const BATCH = 150;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => ({
      startup_id: row.startup_id || null,
      name: row.name,
      event_source: row.event_source,
      entity_gate: row.entity_gate ?? null,
      bucket: row.bucket ?? null,
      enrichment_result: row.enrichment_result ?? null,
      validator_valid: row.validator_valid,
      validator_reason: row.validator_reason ?? null,
      logic_track: row.logic_track,
      logic_reason: row.logic_reason ?? null,
      ontology_hint: row.ontology_hint ?? null,
      training_label: row.training_label,
      meta: row.meta || {},
    }));
    const { error } = await supabase.from('entity_gate_ml_events').insert(chunk);
    if (error) throw error;
  }
}

function buildRowFromSnapshot({
  startup_id,
  name,
  event_source,
  entity_gate,
  bucket,
  enrichment_result,
  training_label,
  meta,
}) {
  const s = snapshotName(name);
  return {
    startup_id,
    name: String(name || '').trim() || '(empty)',
    event_source,
    entity_gate,
    bucket: bucket ?? null,
    enrichment_result: enrichment_result ?? null,
    validator_valid: s.validator_valid,
    validator_reason: s.validator_reason,
    logic_track: s.logic_track,
    logic_reason: s.logic_reason,
    ontology_hint: s.ontology_hint,
    training_label,
    meta: meta || {},
  };
}

module.exports = {
  mlLogEnabled,
  snapshotName,
  insertEntityGateMlEvent,
  insertEntityGateMlEventsBatch,
  buildRowFromSnapshot,
};
