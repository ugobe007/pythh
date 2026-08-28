import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isEligibleFirmInvestor,
  freezeTopFiveIfAbsent,
  SERVED_COHORT_KEY,
} = require('../server/lib/freezeFundingPredictionSnapshot.js');

test('Angel-mistagged VC firms remain claim-eligible', () => {
  assert.equal(isEligibleFirmInvestor({
    name: 'Accel',
    firm: 'Accel',
    type: 'Angel',
    investor_type: 'VC',
    is_individual: false,
  }), true);
  assert.equal(isEligibleFirmInvestor({
    name: 'Solo Angel',
    firm: 'Solo Angel',
    type: 'Angel',
    investor_type: 'Angel',
    is_individual: false,
  }), false);
  assert.equal(isEligibleFirmInvestor({
    name: 'Jane Doe',
    firm: 'Jane Doe',
    type: 'Individual',
    investor_type: 'Angel',
    is_individual: true,
  }), false);
});

test('freezeTopFiveIfAbsent is idempotent and uses min(match.created_at)', async () => {
  const upserts = [];
  let existingCalls = 0;
  const supabase = {
    from(table) {
      if (table === 'funding_prediction_snapshots') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async limit() {
                        existingCalls += 1;
                        return { data: existingCalls > 1 ? [{ id: 'x' }] : [], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          upsert(rows, opts) {
            upserts.push({ rows, opts });
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === 'startup_uploads') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: 'su1',
                        name: 'Acme Robotics',
                        website: 'https://acmerobotics.com',
                        company_domain: 'acmerobotics.com',
                        source_type: 'url',
                        entity_gate: 'qualified',
                        status: 'approved',
                        description: 'We raise venture capital to build industrial robots for factories.',
                        total_god_score: 72,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'startup_investor_matches') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      order() {
                        return {
                          async limit() {
                            return {
                              data: [
                                { id: 'm1', startup_id: 'su1', investor_id: 'i1', match_score: 90, algorithm_version: 'v3.5-instant-submit', created_at: '2026-02-01T00:00:00.000Z', status: 'suggested' },
                                { id: 'm2', startup_id: 'su1', investor_id: 'i2', match_score: 88, algorithm_version: 'v3.5-instant-submit', created_at: '2026-01-15T00:00:00.000Z', status: 'suggested' },
                                { id: 'm3', startup_id: 'su1', investor_id: 'i3', match_score: 85, algorithm_version: 'v3.5-instant-submit', created_at: '2026-02-10T00:00:00.000Z', status: 'suggested' },
                                { id: 'm4', startup_id: 'su1', investor_id: 'i4', match_score: 80, algorithm_version: 'v3.5-instant-submit', created_at: '2026-02-05T00:00:00.000Z', status: 'suggested' },
                                { id: 'm5', startup_id: 'su1', investor_id: 'i5', match_score: 78, algorithm_version: 'v3.5-instant-submit', created_at: '2026-02-02T00:00:00.000Z', status: 'suggested' },
                              ],
                              error: null,
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'investors') {
        return {
          select() {
            return {
              async in(_col, ids) {
                return {
                  data: ids.map((id, idx) => ({
                    id,
                    name: `Firm ${idx + 1}`,
                    firm: `Firm ${idx + 1} Ventures`,
                    type: 'VC',
                    investor_type: 'VC',
                    is_individual: false,
                  })),
                  error: null,
                };
              },
            };
          },
        };
      }
      if (table === 'investor_organization_memberships') {
        return {
          select() {
            return {
              async in() {
                return { data: [], error: null };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const first = await freezeTopFiveIfAbsent({
    supabase,
    startupId: 'su1',
    requirePredictionGradeStartup: false,
  });
  assert.equal(first.frozen, true);
  assert.equal(first.predicted_at, '2026-01-15T00:00:00.000Z');
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].opts.ignoreDuplicates, true);
  assert.equal(upserts[0].rows.length, 5);
  assert.equal(upserts[0].rows[0].cohort_key, SERVED_COHORT_KEY);
  assert.equal(upserts[0].rows[0].prediction_kind, 'served_impression');

  const second = await freezeTopFiveIfAbsent({
    supabase,
    startupId: 'su1',
    requirePredictionGradeStartup: false,
  });
  assert.equal(second.frozen, false);
  assert.equal(second.reason, 'already_frozen');
  assert.equal(upserts.length, 1);
});

test('instantSubmit preserves match created_at and instruments predictions', () => {
  const src = readFileSync(new URL('../server/routes/instantSubmit.js', import.meta.url), 'utf8');
  assert.match(src, /instrumentMatchOutcomesSafe/);
  assert.match(src, /Do NOT set created_at/);
  assert.match(src, /Never delete-all/);
  const rowFn = src.match(/function buildInstantMatchRow[\s\S]*?\n\}/);
  assert.ok(rowFn, 'buildInstantMatchRow present');
  assert.doesNotMatch(rowFn[0], /created_at\s*:/);
  assert.doesNotMatch(src, /from\('startup_investor_matches'\)\.delete\(\)\.eq\('startup_id'/);
  assert.equal((src.match(/created_at: new Date\(\)\.toISOString\(\)/g) || []).filter(() => false).length, 0);
  // Match upsert payloads in phase1/phase3 must not set created_at
  assert.doesNotMatch(src, /status: 'suggested',\s*created_at:/);
});

test('match created_at preserve trigger migration exists', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260821150000_preserve_match_created_at.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /preserve_startup_investor_match_created_at/);
  assert.match(sql, /BEFORE UPDATE ON public\.startup_investor_matches/);
});
