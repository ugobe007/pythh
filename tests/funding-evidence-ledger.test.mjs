import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import ledger from '../server/lib/fundingEvidenceLedger.js';

const require = createRequire(import.meta.url);
const { buildInvestorHistoricalFeatures, scoreHistoricalFit, scoreRecentActivity } = require('../server/lib/investorHistoricalFeatures.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');

const { normalizeEntityName, normalizeStartupName, normalizeRoundType, canonicalRoundKey, resolveCanonicalEntity, resolveCanonicalStartup, isPlausibleStartupName, isPromotionSafeStartupName, isPlausibleInvestorEntityName, startupNameCandidates, participantNamesFromEvent, classifyFundingEvidence, startupNameFromFundingEvent, evaluateRecommendationSet, metricsForEvaluations } = ledger;

test('normalizes common investor firm suffixes for deterministic resolution', () => {
  assert.equal(normalizeEntityName('Acme Ventures, LLC'), 'acme llc');
  assert.equal(normalizeEntityName('Acme Capital Partners'), 'acme');
});

test('prefers exact canonical investor names and exposes normalization collisions', () => {
  const rows = [
    { id: '1', name: 'OpenAI', firm: 'OpenAI Startup Fund' },
    { id: '2', name: 'OpenAI Startup Fund', firm: 'OpenAI' },
    { id: '3', name: 'True Ventures', firm: 'True Ventures' },
  ];
  assert.equal(resolveCanonicalEntity(rows, 'True Ventures').row.id, '3');
  assert.equal(resolveCanonicalEntity(rows, 'OpenAI').status, 'ambiguous');
  assert.equal(resolveCanonicalEntity([{ id: '1', name: 'VaynerFund' }], 'Vayner Fund').confidence, 0.92);
});

test('rejects generic funding stages masquerading as canonical investors', () => {
  assert.equal(isPlausibleInvestorEntityName('Seed'), false);
  assert.equal(isPlausibleInvestorEntityName('Series A'), false);
  assert.equal(isPlausibleInvestorEntityName('Investing'), false);
  assert.equal(isPlausibleInvestorEntityName('Sound Ventures'), true);
  assert.equal(isPlausibleInvestorEntityName('a16z'), true);
});

test('builds stable candidate round keys without collapsing distinct months or amounts', () => {
  assert.equal(normalizeRoundType('Series A financing'), 'series-a');
  const base = { startupId: 'startup-1', roundType: 'Series A', amountUsd: 30000000 };
  assert.equal(canonicalRoundKey({ ...base, announcedAt: '2026-05-22' }), 'id:startup-1|series-a|30000000|2026-05');
  assert.notEqual(canonicalRoundKey({ ...base, announcedAt: '2026-06-01' }), canonicalRoundKey({ ...base, announcedAt: '2026-05-22' }));
});

test('normalizes startup aliases without stripping meaningful investor-like words', () => {
  assert.equal(normalizeStartupName('Acme Capital, Inc.'), 'acme capital');
  assert.deepEqual(startupNameCandidates({ source_title: 'Defense tech Hadrian raises $100M', subject: 'Hadrian' }, 'Hadrian'), ['Hadrian', 'Defense tech Hadrian']);
  assert.equal(isPlausibleStartupName('Gradient Labs'), true);
  assert.equal(isPlausibleStartupName('New Study'), false);
  assert.equal(isPlausibleStartupName('Startup'), false);
  assert.equal(isPromotionSafeStartupName('Edtech platform'), false);
  assert.equal(isPromotionSafeStartupName('Sam Altman’s biometric startup World'), false);
  assert.equal(isPromotionSafeStartupName('World Foundation'), true);
  assert.equal(isPlausibleStartupName('This startup used to raise $10 million'), false);
});

test('resolves canonical startups conservatively and exposes collisions', () => {
  const rows = [
    { id: '1', name: 'Passionfroot', extracted_data: { aliases: ['Passion Froot'] } },
    { id: '2', name: 'Enigma', extracted_data: {} },
    { id: '3', name: 'Enigma', extracted_data: {} },
  ];
  assert.deepEqual(resolveCanonicalStartup(rows, 'Passionfroot'), {
    row: rows[0], status: 'resolved', confidence: 1, matchKind: 'exact_name',
  });
  assert.equal(resolveCanonicalStartup(rows, 'Passion Froot').matchKind, 'exact_alias');
  assert.equal(resolveCanonicalStartup(rows, 'Enigma').status, 'ambiguous');
  assert.equal(resolveCanonicalStartup(rows, 'Insurance startup reportedly').status, 'unresolved');
});

test('reverses directional investment headlines into investor and funded company', () => {
  const event = { source_title: 'HongShan invests in ZXMOTO as Chinese motorcycle maker expands' };
  assert.equal(startupNameFromFundingEvent(event), 'ZXMOTO');
  assert.equal(startupNameCandidates(event, 'in')[0], 'ZXMOTO');
  assert.deepEqual(participantNamesFromEvent(event), ['HongShan']);
});

test('uses the immediate investor subject in directional headlines', () => {
  const event = { source_title: 'Two female-led UK FinTechs join forces as Cashflows invests in Blackpool’s Tap & Go' };
  assert.deepEqual(participantNamesFromEvent(event), ['Cashflows']);
});

test('recovers the company before raises instead of accepting a currency subject', () => {
  assert.equal(startupNameFromFundingEvent({ source_title: 'ideaForge raises Rs 500 Cr via QIP', subject: 'Rs' }), 'ideaForge');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Rs raises expectations', subject: 'Rs' }), null);
});

test('extracts and deduplicates funding participants from scraper evidence', () => {
  const names = participantNamesFromEvent({
    entities: [
      { role: 'SUBJECT', name: 'Startup One' },
      { role: 'COUNTERPARTY', name: 'Acme Ventures' },
    ],
    semantic_context: { resolver: { lead_investor: 'Acme Ventures', investors: ['Beta Capital'] } },
  });
  assert.deepEqual(names, ['Acme Ventures', 'Beta Capital']);
});

test('rejects unsafe or non-financing scraper classifications and separates debt', () => {
  const base = { event_type: 'FUNDING', frame_confidence: 0.9, extraction_meta: { decision: 'ACCEPT', graph_safe: true } };
  assert.deepEqual(classifyFundingEvidence({ ...base, source_title: 'Acme wins an order for 50 aircraft' }), {
    eligible: false, reason: 'non_financing_headline', financingType: 'unknown',
  });
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme receives three industry recognitions' }).eligible, false);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Roku raises streaming device prices by 60 percent' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'GCM raises $1.2 billion for inaugural credit secondaries fund' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme secures 31,826 orders in 24 hours' }).eligible, false);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Investor said to be in talks to invest in Acme' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises Rs 500 Cr via QIP' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Example Fund III reaches final close' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Accel raises $800M for ninth early-stage Europe fund' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Accel raises enlarged $800M early-stage fund' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Addi announces $85M Series D led by Citius' }).eligible, true);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Cast AI raises funds from Pacific Alliance Ventures at $1B valuation' }).eligible, true);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises annual revenue guidance' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme seeks to raise $20M next year' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises its stake in Beta Corp' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme acquisition backed by $20M financing' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme secures a $20M debt facility' }).financingType, 'debt');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises a $20M Series A led by Example Ventures' }).financingType, 'equity');
  assert.equal(classifyFundingEvidence({ ...base, extraction_meta: { graph_safe: false } }).eligible, false);
});

test('trusted funding sources can verify one report while unreviewed sources require corroboration', () => {
  assert.deepEqual(assessFundingSource({ source_url: 'https://techcrunch.com/example' }), {
    trusted: true, tier: 'specialist_editorial', identity: 'techcrunch.com', basis: 'domain',
  });
  assert.equal(assessFundingSource({ source_url: 'https://news.google.com/rss/articles/x', source_publisher: 'Reuters' }).trusted, true);
  assert.equal(assessFundingSource({ source_url: 'https://random-blog.example/post' }).trusted, false);
});

test('funding amount extraction separates the raise from valuation semantics', () => {
  const { extractFunding } = require('../lib/inference-extractor.js');
  assert.equal(extractFunding('Lovable valued at $13.3B with $400M raise').funding_amount, 400_000_000);
  assert.equal(extractFunding('Cast AI raises funds from Pacific Alliance Ventures at $1B valuation').funding_amount, null);
  assert.equal(extractFunding('Moment: $78 Million Raised for AI infrastructure').funding_amount, 78_000_000);
  assert.equal(extractFunding('Etched raises $300M at a $10.3B valuation').funding_amount, 300_000_000);
  assert.equal(extractFunding('Gradient Labs raises fresh $13M').funding_amount, 13_000_000);
  assert.equal(extractFunding('Crystalys raises $130M to bring late-stage gout drug to market').funding_stage, null);
});

test('scores top-five hits, non-hits, misses, and time horizons without causal overclaiming', () => {
  const impressions = [
    { id: 'i1', session_id: 's1', investor_id: 'a', model_version: 'm1', rank_position: 1, shown_at: '2026-01-01T00:00:00Z', context: { predicted_probability: 0.4, predicted_horizon_days: 90 } },
    { id: 'i2', session_id: 's1', investor_id: 'b', model_version: 'm1', rank_position: 2, shown_at: '2026-01-01T00:00:00Z' },
    { id: 'i3', session_id: 's1', investor_id: 'c', model_version: 'm1', rank_position: 6, shown_at: '2026-01-01T00:00:00Z' },
  ];
  const participants = [{ id: 'p1', investor_id: 'a' }, { id: 'p2', investor_id: 'z' }];
  const result = evaluateRecommendationSet({ impressions, participants, eventAt: '2026-03-01T00:00:00Z' });
  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations[0].attribution_kind, 'predicted_participant');
  assert.equal(result.recommendations[0].predicted_probability, 0.4);
  assert.equal(result.recommendations[1].attribution_kind, 'recommended_non_participant');
  assert.deepEqual(result.recommendations[0].horizons, [90, 180, 365]);
  assert.deepEqual(result.misses.map(row => row.investor_id), ['z']);
  assert.deepEqual(metricsForEvaluations(result.recommendations), {
    recommendations: 2,
    hits: 1,
    precision_at_k: 0.5,
    median_days_to_investment: 59,
  });
});

test('schema preserves evidence provenance and false negatives', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817030000_funding_evidence_prediction_ledger.sql', import.meta.url), 'utf8');
  assert.match(sql, /announced_at TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /occurred_at_precision/);
  assert.match(sql, /financing_type/);
  assert.match(sql, /discovered_at TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /funding_prediction_misses/);
  assert.match(sql, /precision_at_5/);
  assert.match(sql, /brier_score/);
  assert.match(sql, /REVOKE ALL ON public\.funding_evidence_events FROM anon, authenticated/);
});

test('canonical round migration preserves source evidence and participation relations', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817034000_funding_canonical_rounds.sql', import.meta.url), 'utf8');
  assert.match(sql, /canonical_round_key/);
  assert.match(sql, /participation_relation/);
  assert.match(sql, /evidence_phrase/);
  assert.match(sql, /PARTICIPATED_IN_SYNDICATE/);
});

test('backend service role can access the private ledger while browser roles cannot', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817031000_funding_evidence_service_role_grants.sql', import.meta.url), 'utf8');
  assert.match(sql, /TO service_role/);
  assert.match(sql, /FROM anon, authenticated/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('PostgREST visibility repair grants schema usage and reports effective privileges', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817032000_funding_evidence_postgrest_visibility.sql', import.meta.url), 'utf8');
  assert.match(sql, /GRANT USAGE ON SCHEMA public TO service_role/);
  assert.match(sql, /has_table_privilege\('service_role'/);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('sync withholds evaluation for partial participant lists and supports resolved-only cohorts', () => {
  const sync = readFileSync(new URL('../scripts/sync-funding-evidence-ledger.mjs', import.meta.url), 'utf8');
  assert.match(sync, /process\.argv\.includes\('--resolved-only'\)/);
  assert.match(sync, /process\.argv\.includes\('--equity-only'\)/);
  assert.match(sync, /magnitude === 'b'/);
  assert.match(sync, /inferredFunding\.funding_amount/);
  assert.match(sync, /participantListComplete && \['equity', 'mixed'\]/);
  assert.match(sync, /participant_list_complete/);
  assert.match(sync, /async function fetchFundingEvents/);
  assert.match(sync, /\.range\(start, end\)/);
  assert.match(sync, /resolved_preview: resolvedPreview/);
  assert.match(sync, /--event-ids=/);
  assert.match(sync, /classifyParticipationPhrase/);
  assert.match(sync, /extractKnownInvestorMentions/);
  assert.match(sync, /filter\(mention => mention\.relation && mention\.role !== 'unknown'\)/);
  assert.match(sync, /funding_evidence_excerpt/);
});

test('scheduled scraper pipeline feeds the evidence ledger non-fatally', () => {
  const pipeline = readFileSync(new URL('../scripts/cron/signal-pipeline.js', import.meta.url), 'utf8');
  assert.match(pipeline, /sync-funding-evidence-ledger\.mjs/);
  assert.match(pipeline, /funding-evidence-ledger',[\s\S]*fatal: false/);
  assert.match(pipeline, /FUNDING_EVIDENCE_RESOLVER_ENABLED/);
  assert.match(pipeline, /scripts\/event-resolver\.js/);
  assert.match(pipeline, /enrich-funding-ledger-participants\.mjs/);
  assert.match(pipeline, /scrub-funding-participant-chronology\.mjs/);
  assert.match(pipeline, /resolve-funding-startup-coverage\.mjs/);
  assert.match(pipeline, /resolve-funding-investor-coverage\.mjs/);
});

test('article evidence backfill is bounded, SSRF-aware, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/enrich-funding-evidence-excerpts.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /isPrivateIp/);
  assert.match(script, /redirect: 'error'/);
  assert.match(script, /2_000_000/);
  assert.match(script, /funding_evidence_excerpt_source: 'source_page'/);
});

test('GOD-score audit starts at the top and distinguishes impressions from legacy matches', () => {
  const script = readFileSync(new URL('../scripts/audit-top-god-funding-cohort.mjs', import.meta.url), 'utf8');
  assert.match(script, /order\('total_god_score', \{ ascending: false \}\)/);
  assert.match(script, /\.lte\('rank_position', 5\)/);
  assert.match(script, /ranking_impression/);
  assert.match(script, /legacy_current_state_not_historical_impression/);
  assert.match(script, /uniqueLegacyTopFive/);
  assert.match(script, /post_prediction/);
  assert.match(script, /predicted_investor_hits/);
  assert.match(script, /\.eq\('status', 'approved'\)/);
});

test('high-GOD identity repair is guarded, reversible in metadata, and dry-run first', () => {
  const script = readFileSync(new URL('../scripts/repair-top-god-identity-cohort.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /expectedName/);
  assert.match(script, /identity_changed/);
  assert.match(script, /previous: existingReview\?\.previous \|\| \{ website:/);
  assert.match(script, /existingReview\?\.previous \|\|/);
  assert.match(script, /Do not merge automatically with fal\.ai/);
});

test('startup insertion gate rejects publisher and investor URLs as canonical websites', () => {
  const gate = readFileSync(new URL('../lib/startupInsertGate.js', import.meta.url), 'utf8');
  const urls = readFileSync(new URL('../lib/junk-url-config.js', import.meta.url), 'utf8');
  assert.match(gate, /isJunkUrl\(data\.website\)/);
  assert.match(gate, /isJunkUrl\(record\.website\)/);
  assert.match(urls, /initialized\.com/);
  assert.match(urls, /fintechnews\.org/);
  assert.match(urls, /saastr\.com/);
});

test('prospective snapshots freeze approved top-five sets without changing live ranking', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817035000_funding_prediction_snapshots.sql', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../scripts/snapshot-funding-prediction-cohort.mjs', import.meta.url), 'utf8');
  assert.match(sql, /god_score_at_prediction/);
  assert.match(sql, /rank_position INTEGER NOT NULL CHECK \(rank_position BETWEEN 1 AND 5\)/);
  assert.match(sql, /prospective_shadow/);
  assert.match(sql, /REVOKE ALL .* FROM anon, authenticated/);
  assert.match(script, /\.eq\('status', 'approved'\)/);
  assert.match(script, /seenFirms/);
  assert.match(script, /isEligibleInvestor/);
  assert.match(script, /isGarbageInvestorName/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
});

test('prospective evaluator uses startup-level any-of-five hits and separates pending horizons', () => {
  const script = readFileSync(new URL('../scripts/evaluate-funding-hit-at-five.mjs', import.meta.url), 'utf8');
  assert.match(script, /predictions\.length !== 5/);
  assert.match(script, /matchedInvestorIds\.has/);
  assert.match(script, /matchedOrganizationIds\.has/);
  assert.match(script, /investor_organization_id/);
  assert.match(script, /hit_at_5_among_funded/);
  assert.match(script, /pending_snapshot_sets/);
  assert.match(script, /eventAt > predictedAt && eventAt <= horizonEnd/);
  assert.match(script, /participation_relation && row\.participant_role !== 'unknown'/);
});

test('prospective cohort monitor is free-search-first and cannot backdate evidence', () => {
  const monitor = readFileSync(new URL('../scripts/monitor-funding-prediction-cohort.mjs', import.meta.url), 'utf8');
  assert.match(monitor, /searchStartupNews/);
  assert.match(monitor, /inference_engine_free_news_search/);
  assert.match(monitor, /publishedAt > new Date\(predictedAt\)/);
  assert.match(monitor, /verification_status: 'observed'/);
  assert.match(monitor, /extractKnownInvestorMentions/);
  assert.doesNotMatch(monitor, /OpenAI|Anthropic/);
});

test('ledger quality audit measures formal evaluability without mutating evidence', () => {
  const audit = readFileSync(new URL('../scripts/audit-funding-ledger-quality.mjs', import.meta.url), 'utf8');
  assert.match(audit, /formally_evaluable_events/);
  assert.match(audit, /no_resolved_proven_participants/);
  assert.match(audit, /complete_top_five_sets/);
  assert.doesNotMatch(audit, /\.update\(|\.delete\(|\.upsert\(/);
});

test('verified participant enrichment is bounded, source-grounded, and preserves incomplete lists', () => {
  const script = readFileSync(new URL('../scripts/enrich-funding-ledger-participants.mjs', import.meta.url), 'utf8');
  assert.match(script, /verification_status', \['verified', 'corroborated'\]/);
  assert.match(script, /extractKnownInvestorMentions/);
  assert.match(script, /participant_list_complete: false/);
  assert.match(script, /isPrivateIp/);
  assert.match(script, /redirect: 'error'/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
});

test('audited event importer preserves explicit roles, evidence phrases, and incomplete lists', () => {
  const script = readFileSync(new URL('../scripts/ingest-audited-funding-events.mjs', import.meta.url), 'utf8');
  assert.match(script, /participantListComplete: false/);
  assert.match(script, /LED_ROUND/);
  assert.match(script, /CO_LED_ROUND/);
  assert.match(script, /evidence_phrase: participant\.phrase/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
});

test('delta analysis separates identity, candidate-generation, ranking, and temporal failures', () => {
  const script = readFileSync(new URL('../scripts/analyze-funding-match-deltas.mjs', import.meta.url), 'utf8');
  assert.match(script, /missing_from_investor_universe/);
  assert.match(script, /ambiguous_canonical_identity/);
  assert.match(script, /ranked_outside_top_five/);
  assert.match(script, /candidate_generation_miss/);
  assert.match(script, /!row\.participation_relation \|\| row\.participant_role === 'unknown'/);
  assert.match(script, /!participant\.investor_id && participant\.resolution_status === 'not_in_universe'/);
  assert.match(script, /partial_top_five_pre_event/);
  assert.match(script, /comparison_is_formal: false/);
  assert.match(script, /canonical_profile/);
});

test('candidate generation paginates the full investor universe before ranking and firm deduplication', () => {
  const batchMatcher = readFileSync(new URL('../scripts/matching/generate-matches.js', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../server/matchWorker.ts', import.meta.url), 'utf8');
  assert.match(batchMatcher, /fetchAllInvestors/);
  assert.match(batchMatcher, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(batchMatcher, /selectTopInvestorCandidates\(scoredCandidates, membershipByInvestor, 50\)/);
  assert.match(batchMatcher, /b\.match\.score - a\.match\.score/);
  assert.match(batchMatcher, /organization:\$\{organizationId\}/);
  assert.match(batchMatcher, /replace\(\/\^at\\s\+\/i, ''\)/);
  assert.match(batchMatcher, /Documented prior investor relationship \(\+20\)/);
  assert.match(batchMatcher, /investorFitPercent/);
  assert.match(batchMatcher, /startup_quality_score/);
  assert.match(batchMatcher, /relationshipWasObservable/);
  assert.match(batchMatcher, /portfolioWasObservable/);
  assert.doesNotMatch(batchMatcher, /startupMatchCount < 50/);
  assert.match(worker, /\.range\(offset, offset \+ 999\)/);
  assert.match(worker, /toLowerCase\(\)\.trim\(\)/);
});

test('funding-outcome investor enrichment is source-gated, additive, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/enrich-funding-outcome-investors.js', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /participant_role !== 'unknown'/);
  assert.match(script, /resolution_status === 'resolved'/);
  assert.match(script, /safeProfileUpdate/);
  assert.match(script, /investor_profile_enrichment/);
  assert.match(script, /eligible_sources: evidence/);
  assert.doesNotMatch(script, /update\.investment_thesis/);
});

test('funding outcome organization repair is exact, conflict-aware, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/repair-funding-outcome-organization-links.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /profileMatchesOrganization/);
  assert.match(script, /conflicting existing organization membership/);
  assert.match(script, /exact non-individual firm profile/);
  assert.match(script, /organization_resolution/);
  assert.match(script, /funding-outcome-organization-repair-v1/);
});

test('reviewed individual repair is identity-only and preserves the historical miss', () => {
  const script = readFileSync(new URL('../scripts/resolve-reviewed-individual-funding-investors.mjs', import.meta.url), 'utf8');
  const audit = readFileSync(new URL('../scripts/shadow-audit-funding-candidate-ranks.mjs', import.meta.url), 'utf8');
  const profileAudit = readFileSync(new URL('../scripts/audit-funding-investor-profile-fragmentation.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /matching_attributes_inferred: false/);
  assert.match(script, /historical_candidate_profile_preserved_as_missing: true/);
  assert.match(script, /sectors: \[\]/);
  assert.match(script, /check_size_min: null/);
  assert.match(script, /investment_thesis: null/);
  assert.doesNotMatch(script, /investor_organization_memberships/);
  assert.match(audit, /historically_missing_candidate_profile/);
  assert.match(audit, /profileExistedAtCutoff/);
  assert.match(profileAudit, /!row\.investor_organization_id && !row\.investor_id/);
});

test('historical investor features exclude events at or after the prediction cutoff', () => {
  const events = [
    { id: 'before', canonical_round_key: 'round-1', startup_id: 's1', round_type: 'Seed', announced_at: '2025-01-01', verification_status: 'verified' },
    { id: 'before-copy', canonical_round_key: 'round-1', startup_id: 's1', round_type: 'Seed', announced_at: '2025-01-02', verification_status: 'corroborated' },
    { id: 'after', startup_id: 's2', round_type: 'Series A', announced_at: '2025-07-01', verification_status: 'verified' },
    { id: 'weak', startup_id: 's1', round_type: 'Seed', announced_at: '2024-01-01', verification_status: 'observed' },
  ];
  const participants = events.map(event => ({
    funding_event_id: event.id,
    investor_organization_id: 'org1',
    participant_role: 'lead',
    participation_relation: 'LED_ROUND',
  }));
  const features = buildInvestorHistoricalFeatures({
    events,
    participants,
    startups: [{ id: 's1', sectors: ['SaaS'], stage: 'Seed' }, { id: 's2', sectors: ['FinTech'], stage: 'Series A' }],
    cutoffAt: '2025-06-01',
  });
  const feature = features.get('organization:org1');
  assert.equal(feature.deal_count, 1);
  assert.deepEqual(feature.evidence_event_ids, ['before']);
  assert.equal(feature.sectors.saas, 1);
  assert.ok(scoreHistoricalFit({ sectors: ['SaaS'], stage: 'Seed' }, feature, '2025-06-01').points > 0);
});

test('recent investor activity is evaluated relative to the prediction cutoff without future leakage', () => {
  assert.equal(scoreRecentActivity('2025-05-01', '2025-06-01').points, 3);
  assert.equal(scoreRecentActivity('2024-01-01', '2025-06-01').points, 0);
  assert.equal(scoreRecentActivity('2025-07-01', '2025-06-01').points, 0);
  assert.equal(scoreRecentActivity('not-a-date', '2025-06-01').points, 0);
});

test('corroboration requires two independent sources or one reviewed trusted source', () => {
  const script = readFileSync(new URL('../scripts/corroborate-funding-evidence-rounds.mjs', import.meta.url), 'utf8');
  assert.match(script, /domains\.length < 2/);
  assert.match(script, /trusted\.length === 0/);
  assert.match(script, /trusted_single_source/);
  assert.match(script, /canonical_round_key/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
});

test('missing funding investors are seeded only from reviewed first-party profiles', () => {
  const script = readFileSync(new URL('../scripts/seed-missing-funding-investor-profiles.mjs', import.meta.url), 'utf8');
  assert.match(script, /first_party_profile_review/);
  assert.match(script, /conservative_unknowns_preserved/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /existing_candidates/);
  assert.doesNotMatch(script, /\.delete\(/);
});

test('investor canonical audit checks aliases and downstream references before merging', () => {
  const script = readFileSync(new URL('../scripts/audit-funding-investor-canonicalization.mjs', import.meta.url), 'utf8');
  assert.match(script, /normalizeEntityName/);
  assert.match(script, /startup_investor_matches/);
  assert.match(script, /funding_evidence_participants/);
  assert.match(script, /funding_prediction_snapshots/);
  assert.doesNotMatch(script, /\.delete\(/);
  assert.doesNotMatch(script, /\.update\(/);
});

test('event resolver supports Anthropic with deterministic inference hints', () => {
  const resolver = readFileSync(new URL('../server/lib/eventResolver.js', import.meta.url), 'utf8');
  const runner = readFileSync(new URL('../scripts/event-resolver.js', import.meta.url), 'utf8');
  assert.match(resolver, /api\.anthropic\.com\/v1\/messages/);
  assert.match(resolver, /Deterministic inference hints/);
  assert.match(runner, /--provider/);
  assert.match(runner, /InferenceExtractor\.extractFunding/);
  assert.match(runner, /provider must be openai, anthropic, or inference/);
  assert.match(runner, /FUNDING_ONLY \? \['FUNDING', 'INVESTMENT'\]/);
  assert.match(runner, /INFERENCE_FIRST = !has\('--llm-all'\)/);
  assert.match(runner, /paid_fallback/);
});
