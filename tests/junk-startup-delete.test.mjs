import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deleteStartupDependents } = require('../server/lib/deleteStartupDependents.js');

test('junk delete path chunks matches and evidence before startup delete', () => {
  const lib = readFileSync(new URL('../server/lib/deleteStartupDependents.js', import.meta.url), 'utf8');
  assert.match(lib, /deleteEvidenceForStartup/);
  assert.match(lib, /deleteMatchesForStartup/);
  assert.match(lib, /match_validation_evidence/);
  assert.match(lib, /MATCH_CHUNK/);

  const route = readFileSync(new URL('../server/routes/adminJunkStartups.js', import.meta.url), 'utf8');
  assert.match(route, /DELETE_BATCH = 8/);
  assert.match(route, /MAX_IDS = 2000/);
  assert.match(route, /statement timeout/);

  const ui = readFileSync(new URL('../site/pages/admin/JunkStartups.tsx', import.meta.url), 'utf8');
  assert.match(ui, /CHUNK = action === \"delete\" \? 25 : 200/);
  assert.match(ui, /applyProgress/);
});

test('chunked purge deletes evidence then match pages then light tables', async () => {
  const calls = [];
  const evidenceIds = Array.from({ length: 120 }, (_, i) => `e${i}`);
  const matchIds = Array.from({ length: 150 }, (_, i) => `m${i}`);
  let evidenceCursor = 0;
  let matchCursor = 0;

  const supabase = {
    rpc() {
      return Promise.resolve({
        data: null,
        error: { message: 'canceling statement due to statement timeout', code: '57014' },
      });
    },
    from(table) {
      calls.push({ op: 'from', table });
      return {
        select() {
          return {
            eq() {
              return {
                limit(n) {
                  return {
                    async then(resolve) {
                      if (table === 'match_validation_evidence') {
                        const slice = evidenceIds.slice(evidenceCursor, evidenceCursor + n).map((id) => ({ id }));
                        evidenceCursor += slice.length;
                        return resolve({ data: slice, error: null });
                      }
                      if (table === 'startup_investor_matches') {
                        const slice = matchIds.slice(matchCursor, matchCursor + n).map((id) => ({ id }));
                        matchCursor += slice.length;
                        return resolve({ data: slice, error: null });
                      }
                      return resolve({ data: [], error: null });
                    },
                  };
                },
              };
            },
            in() {
              return {
                async then(resolve) {
                  // countSocialSignals head path
                  return resolve({ count: 0, error: null });
                },
              };
            },
          };
        },
        delete() {
          return {
            in(col, ids) {
              calls.push({ op: 'delete', table, col, n: ids.length });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  // Force chunked path (ids.length > 3)
  const result = await deleteStartupDependents(supabase, [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
  ]);
  assert.equal(result.ok, true);
  assert.ok(calls.some((c) => c.op === 'delete' && c.table === 'match_validation_evidence'));
  assert.ok(calls.some((c) => c.op === 'delete' && c.table === 'startup_investor_matches'));
});
