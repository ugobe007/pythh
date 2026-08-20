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

test('enqueue helper skips when no matches exist', async () => {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(table);
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
  assert.equal(calls[0], 'startup_investor_matches');
});

test('instant submit and match worker enqueue funding search after writes', () => {
  const instant = readFileSync(new URL('../server/routes/instantSubmit.js', import.meta.url), 'utf8');
  assert.match(instant, /enqueueFundingEvidenceSearchAsync/);
  assert.match(instant, /instant_sync/);
  assert.match(instant, /instant_bg_phase1/);
  assert.match(instant, /instant_bg_phase3/);

  const worker = readFileSync(new URL('../server/matchWorker.ts', import.meta.url), 'utf8');
  assert.match(worker, /enqueueFundingEvidenceSearchAsync/);

  const enhanced = readFileSync(new URL('../server/services/EnhancedMatchingService.js', import.meta.url), 'utf8');
  assert.match(enhanced, /enqueueFundingEvidenceSearchAsync/);
});

test('match outcome agent and admin UI are wired', () => {
  const agent = readFileSync(new URL('../scripts/agents/match-outcome-agent.mjs', import.meta.url), 'utf8');
  assert.match(agent, /search-startup-funding-evidence\.mjs/);
  assert.match(agent, /SLACK_WEBHOOK_URL/);
  assert.match(agent, /high_tier_pending/);

  const admin = readFileSync(new URL('../server/routes/adminMatchOutcomes.js', import.meta.url), 'utf8');
  assert.match(admin, /match-outcomes\/proof/);
  assert.match(admin, /match-outcomes\/pending/);
  assert.match(admin, /review_match_validation_evidence/);
  assert.match(admin, /isIssuerPrimary/);

  const page = readFileSync(new URL('../site/pages/admin/MatchOutcomes.tsx', import.meta.url), 'utf8');
  assert.match(page, /Match Outcomes Proof/);
  assert.match(page, /\/api\/admin\/match-outcomes\/proof/);

  const app = readFileSync(new URL('../site/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /\/admin\/match-outcomes/);

  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  assert.match(pkg, /"outcomes:agent"/);
});
