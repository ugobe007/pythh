import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sourceTier, isIssuerPrimary } = require('../server/lib/matchEvidenceSourceTier.js');
const { enqueueFundingEvidenceSearch } = require('../server/lib/enqueueFundingEvidenceSearch.js');

test('source tier classifies issuer-primary URLs as high', () => {
  assert.equal(sourceTier('https://www.businesswire.com/news/home/x'), 'high');
  assert.equal(sourceTier('https://www.prnewswire.com/news-releases/x'), 'high');
  assert.equal(sourceTier('https://resend.com/blog/series-a'), 'high');
  assert.equal(isIssuerPrimary('https://company.io/newsroom/raise'), true);
  assert.equal(sourceTier('https://news.google.com/rss/articles/x'), 'low');
  assert.equal(isIssuerPrimary('https://vertexaisearch.cloud.google.com/x'), false);
});

test('enqueue helper skips junk entity_gate', async () => {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(table);
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      id: '00000000-0000-0000-0000-000000000001',
                      status: 'approved',
                      entity_gate: 'junk',
                      source_type: 'url',
                      website: 'https://example.com',
                    },
                    error: null,
                  };
                },
                order() {
                  return {
                    limit() {
                      return {
                        async maybeSingle() {
                          return { data: null, error: null };
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
    },
  };
  const result = await enqueueFundingEvidenceSearch(supabase, '00000000-0000-0000-0000-000000000001');
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.error, 'junk_entity_gate');
  assert.equal(calls[0], 'startup_uploads');
});

test('instant submit and match worker enqueue funding search after writes', () => {
  const instant = readFileSync(new URL('../server/routes/instantSubmit.js', import.meta.url), 'utf8');
  assert.match(instant, /enqueueFundingEvidenceSearchAsync/);

  const worker = readFileSync(new URL('../server/matchWorker.ts', import.meta.url), 'utf8');
  assert.match(worker, /enqueueFundingEvidenceSearchAsync/);

  const enhanced = readFileSync(new URL('../server/services/EnhancedMatchingService.js', import.meta.url), 'utf8');
  assert.match(enhanced, /enqueueFundingEvidenceSearchAsync/);
  assert.match(enhanced, /isPollutedInvestorIdentity/);
  assert.match(enhanced, /junk_entity_gate/);
  assert.match(enhanced, /minScore = 50/);
});

test('continual agent loop recovers URLs, triages, promotes, and searches', () => {
  const agent = readFileSync(new URL('../scripts/agents/match-outcome-agent.mjs', import.meta.url), 'utf8');
  assert.match(agent, /recover-startup-urls\.mjs/);
  assert.match(agent, /triage-funding-evidence-queue\.mjs/);
  assert.match(agent, /search-startup-funding-evidence\.mjs/);
  assert.match(agent, /promote-ledger-funding-evidence\.mjs/);
  // promote runs after search so ledger-seeded issuer URLs get verified
  const searchIdx = agent.indexOf('search-startup-funding-evidence.mjs');
  const promoteIdx = agent.lastIndexOf('promote-ledger-funding-evidence.mjs');
  assert.ok(promoteIdx > searchIdx, 'promote should run after search');
  assert.match(agent, /resolved_count/);

  const triage = readFileSync(new URL('../scripts/triage-funding-evidence-queue.mjs', import.meta.url), 'utf8');
  assert.match(triage, /boost_qualified_url/);
  assert.match(triage, /parked_weak_identity/);
  assert.match(triage, /earliest_match_at_rectified/);
  assert.match(triage, /boost_post_match_ledger/);
  assert.match(triage, /Alchemist Accelerator/);

  const search = readFileSync(new URL('../scripts/search-startup-funding-evidence.mjs', import.meta.url), 'utf8');
  assert.match(search, /\.gt\('priority', 0\)/);
  assert.match(search, /syncQueueEarliestMatchAt/);
  assert.match(search, /parked_missing_or_publisher_url/);
  assert.match(search, /earliest_match_at', \{ ascending: true \}/);

  const recover = readFileSync(new URL('../scripts/recover-startup-urls.mjs', import.meta.url), 'utf8');
  assert.match(recover, /url_recovered:boost/);
  assert.match(recover, /syncQueueEarliestMatchAt/);

  const promote = readFileSync(new URL('../scripts/promote-ledger-funding-evidence.mjs', import.meta.url), 'utf8');
  assert.match(promote, /fetchEarliestMatchAt/);
  assert.doesNotMatch(promote, /earliest_match_at: announcedAt/);

  const workflow = readFileSync(
    new URL('../.github/workflows/funding-evidence-search.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /BATCH_LIMIT: \$\{\{ inputs\.limit \|\| '400' \}\}/);
  assert.match(workflow, /DATABASE_URL/);

  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  assert.match(pkg, /"outcomes:triage-queue"/);
  assert.match(pkg, /"outcomes:promote-ledger"/);
  assert.match(pkg, /"outcomes:recover-urls"/);
});

test('syncQueueEarliestMatchAt always uses min(match.created_at)', async () => {
  const { syncQueueEarliestMatchAt, fetchEarliestMatchAt } = require('../server/lib/syncQueueEarliestMatchAt.js');
  const updates = [];
  const supabase = {
    from(table) {
      if (table === 'startup_investor_matches') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          async maybeSingle() {
                            return { data: { created_at: '2024-01-15T12:00:00.000Z' }, error: null };
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
      if (table === 'funding_evidence_search_queue') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        startup_id: 's1',
                        earliest_match_at: '2025-06-01T00:00:00.000Z', // polluted funding date
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update(payload) {
            updates.push(payload);
            return {
              eq() {
                return { error: null };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const earliest = await fetchEarliestMatchAt(supabase, 's1');
  assert.equal(earliest, '2024-01-15T12:00:00.000Z');
  const sync = await syncQueueEarliestMatchAt(supabase, 's1');
  assert.equal(sync.ok, true);
  assert.equal(sync.earliest_match_at, '2024-01-15T12:00:00.000Z');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].earliest_match_at, '2024-01-15T12:00:00.000Z');
});
