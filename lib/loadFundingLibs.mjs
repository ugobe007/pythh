/**
 * Load CJS funding helpers from ESM scripts.
 * Node / tsx / default-import interop can wrap `module.exports` as `{ default: … }`,
 * which makes `const { canonicalRoundKey } = require(...)` undefined.
 */
import ledgerMod from '../server/lib/fundingEvidenceLedger.js';
import ontologyMod from '../server/lib/fundingParticipationOntology.js';

export function unwrapCjs(mod, label, requiredFns = []) {
  const fromDefault =
    mod &&
    typeof mod === 'object' &&
    mod.default &&
    typeof mod.default === 'object' &&
    !requiredFns.every((name) => typeof mod[name] === 'function');
  const bag = fromDefault ? { ...mod.default, ...mod } : mod;
  for (const name of requiredFns) {
    if (typeof bag?.[name] !== 'function') {
      const keys = bag && typeof bag === 'object' ? Object.keys(bag).join(', ') : String(bag);
      throw new TypeError(`${name} is not a function (${label} keys: ${keys || 'none'})`);
    }
  }
  return bag;
}

export function loadFundingEvidenceLedger() {
  return unwrapCjs(ledgerMod, 'fundingEvidenceLedger', [
    'canonicalRoundKey',
    'resolveCanonicalEntity',
    'classifyFundingEvidence',
  ]);
}

export function loadFundingParticipationOntology() {
  return unwrapCjs(ontologyMod, 'fundingParticipationOntology', [
    'extractKnownInvestorMentions',
    'extractExplicitParticipantMentions',
    'classifyNamedInvestorParticipation',
  ]);
}
