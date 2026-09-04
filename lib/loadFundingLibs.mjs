/**
 * Load CJS funding helpers from ESM scripts.
 *
 * Prefer createRequire (always returns module.exports). A default-import fallback
 * remains for tsx / bundlers that wrap CJS as `{ default: … }`, which made
 * `const { canonicalRoundKey } = require(...)` undefined on some Mac runs.
 */
import { createRequire } from 'node:module';
import ledgerMod from '../server/lib/fundingEvidenceLedger.js';
import ontologyMod from '../server/lib/fundingParticipationOntology.js';

const require = createRequire(import.meta.url);

export function unwrapCjs(mod, label, requiredFns = []) {
  const fromDefault =
    mod &&
    typeof mod === 'object' &&
    mod.default &&
    typeof mod.default === 'object' &&
    !requiredFns.every((name) => typeof mod[name] === 'function');
  const bag = fromDefault ? { ...mod.default, ...mod } : mod;
  const out = bag && typeof bag === 'object' ? { ...bag } : bag;
  for (const name of requiredFns) {
    if (typeof out?.[name] !== 'function') {
      const keys = out && typeof out === 'object' ? Object.keys(out).join(', ') : String(out);
      throw new TypeError(`${name} is not a function (${label} keys: ${keys || 'none'})`);
    }
    out[name] = out[name].bind(out);
  }
  return out;
}

function loadCjs(relPath, fallbackMod, label, requiredFns) {
  let raw = fallbackMod;
  try {
    raw = require(relPath);
  } catch {
    raw = fallbackMod;
  }
  return unwrapCjs(raw, label, requiredFns);
}

export function loadFundingEvidenceLedger() {
  return loadCjs(
    '../server/lib/fundingEvidenceLedger.js',
    ledgerMod,
    'fundingEvidenceLedger',
    [
      'canonicalRoundKey',
      'resolveCanonicalEntity',
      'classifyFundingEvidence',
      'isPromotionSafeStartupName',
      'clusterCompatibleRoundEvents',
      'normalizeEntityName',
      'groupSourceOutcomesByRoundCluster',
      'isServeGradeStartupIdentity',
    ],
  );
}

export function loadFundingParticipationOntology() {
  return loadCjs(
    '../server/lib/fundingParticipationOntology.js',
    ontologyMod,
    'fundingParticipationOntology',
    [
      'extractKnownInvestorMentions',
      'extractExplicitParticipantMentions',
      'classifyNamedInvestorParticipation',
    ],
  );
}
