'use strict';

/**
 * Name-only gate for startup-like strings (logic engine → ontology → entity → legacy).
 * Shared by entityResolutionGate and startupCorrelatePolicy (avoids circular requires).
 */

const { isGarbage } = require('../scripts/cleanup-garbage.js');
const { ontologyJunkReason } = require('./pendingNameOntology');
const { isNonStartupEntity } = require('./nameEntityOntology');
const { classifyEntityTrack } = require('./startupNameLogicEngine');

/**
 * @param {string|null|undefined} name
 * @returns {{ ok: boolean, reason: string|null }}
 */
function evaluateStartupNameForPipeline(name) {
  if (!name || !String(name).trim()) {
    return { ok: false, reason: 'empty_name' };
  }
  const n = String(name).trim();

  const engine = classifyEntityTrack(n);
  if (engine.track === 'investor') {
    return { ok: false, reason: `logic_engine/investor:${engine.reason}` };
  }
  if (engine.track === 'headline' || engine.track === 'descriptor') {
    return { ok: false, reason: `logic_engine/${engine.track}:${engine.reason}` };
  }

  const ont = ontologyJunkReason(n);
  if (ont) {
    return { ok: false, reason: `ontology:${ont}` };
  }

  if (isNonStartupEntity(n)) {
    return { ok: false, reason: 'entity_ontology:non_startup_entity' };
  }

  if (isGarbage(n)) {
    return { ok: false, reason: 'legacy_safety_net:garbage_patterns_or_validator' };
  }

  return { ok: true, reason: null };
}

module.exports = {
  evaluateStartupNameForPipeline,
};
