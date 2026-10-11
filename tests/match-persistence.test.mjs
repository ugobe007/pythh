import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildMatchFingerprint,
  isMatchFingerprintStale,
  materialMatchChange,
  readStoredMatchFingerprint,
} from '../server/lib/matchPersistence.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('match fingerprint', () => {
  it('is stable for the same material profile', () => {
    const a = buildMatchFingerprint({
      sectors: ['Robotics', 'AI/ML'],
      stage: 1,
      extracted_data: {
        funding_stage: 'seed',
        has_revenue: false,
        has_product: true,
        raise_priorities: ['customers', 'product'],
      },
    });
    const b = buildMatchFingerprint({
      sectors: ['AI/ML', 'Robotics'],
      stage: 1,
      extracted_data: {
        funding_stage: 'seed',
        has_revenue: false,
        has_product: true,
        raise_priorities: ['product', 'customers'],
      },
    });
    assert.equal(a, b);
  });

  it('changes when campaign stage or sectors change', () => {
    const base = {
      sectors: ['Robotics'],
      stage: 1,
      extracted_data: { funding_stage: 'seed', has_revenue: false },
    };
    const fp = buildMatchFingerprint(base);
    assert.notEqual(
      fp,
      buildMatchFingerprint({
        ...base,
        extracted_data: { ...base.extracted_data, funding_stage: 'series-a' },
      }),
    );
    assert.notEqual(
      fp,
      buildMatchFingerprint({ ...base, sectors: ['FinTech'] }),
    );
  });

  it('detects stale fingerprints and force rematch', () => {
    const startup = {
      sectors: ['Robotics'],
      stage: 1,
      extracted_data: {
        funding_stage: 'seed',
        match_fingerprint: buildMatchFingerprint({
          sectors: ['Robotics'],
          stage: 1,
          extracted_data: { funding_stage: 'seed' },
        }),
      },
    };
    assert.equal(isMatchFingerprintStale(startup), false);
    assert.equal(materialMatchChange(startup).material, false);
    assert.equal(materialMatchChange(startup, { forceGenerate: true }).reason, 'force');

    const drifted = {
      ...startup,
      extracted_data: {
        ...startup.extracted_data,
        funding_stage: 'series-a',
      },
    };
    assert.equal(isMatchFingerprintStale(drifted), true);
    assert.equal(materialMatchChange(drifted).reason, 'fingerprint_stale');
    assert.equal(readStoredMatchFingerprint(startup), startup.extracted_data.match_fingerprint);
  });
});

describe('submit / preview reuse wiring', () => {
  it('submit reuses stored matches when fingerprint is unchanged', () => {
    const submit = read('server/routes/instantSubmit.js');
    assert.match(submit, /cache_source: 'stored'/);
    assert.match(submit, /loadStoredSuggestedMatches/);
    assert.match(submit, /persistMatchFingerprint/);
    assert.match(submit, /materialMatchChange/);
    // Engine path remains for material changes.
    assert.match(submit, /cache_source: 'matching_engine'/);
  });

  it('preview prefers stored shortlist for matches_preview when fingerprint is fresh', () => {
    const preview = read('server/routes/previewRoute.js');
    assert.match(preview, /isMatchFingerprintStale/);
    assert.match(preview, /matches_preview/);
    assert.match(preview, /shouldPreferStoredMatches\(previewSource, eligibleRows\.length, rankedStartup\)/);
  });
});
