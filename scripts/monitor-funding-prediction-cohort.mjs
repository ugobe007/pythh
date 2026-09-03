#!/usr/bin/env node
import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

import { loadFundingEvidenceLedger, loadFundingParticipationOntology } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { searchStartupNews } = require('../server/services/inferenceService.js');
const { extractFunding } = require('../lib/inference-extractor.js');
const ledger = loadFundingEvidenceLedger();
const { extractKnownInvestorMentions } = loadFundingParticipationOntology();

const apply = process.argv.includes('--apply');
const cohortArg = process.argv.find(arg => arg.startsWith('--cohort-key='));
const daysArg = process.argv.find(arg => arg.startsWith('--lookback-days='));
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const cohortKey = cohortArg?.slice('--cohort-key='.length) || null;
const lookbackDays = Math.min(Math.max(Number(daysArg?.split('=')[1] || 14), 1), 90);
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 250), 1), 1000);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const FUNDING_WORDS = /\b(rais(?:e|es|ed|ing)|funding|financing|series\s+[a-z]|pre[- ]seed|seed round|investment|invests?\s+in|led\s+by|participation\s+from)\b/i;
const RUMOR_WORDS = /\b(reportedly|rumou?red|in talks|seeks? to raise|plans? to raise|could raise|may raise|targets? a raise)\b/i;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function sourceKey(startupId, link, title) {
  return `cohort_monitor:${startupId}:${crypto.createHash('sha256').update(`${link}\0${title}`).digest('hex').slice(0, 32)}`;
}
function publisherFromTitle(title, fallback) {
  const parts = String(title || '').split(/\s+-\s+/);
  return parts.length > 1 ? parts.at(-1).trim() : fallback || null;
}
function cleanHeadline(title) {
  return String(title || '').replace(/\s+-\s+[^-]{2,80}$/, '').trim();
}
function eligibleArticle(article, startupName, predictedAt) {
  const title = cleanHeadline(article.title);
  const publishedAt = new Date(article.pubDate || 0);
  const cutoff = new Date(Date.now() - lookbackDays * 86_400_000);
  return title && FUNDING_WORDS.test(title) && !RUMOR_WORDS.test(title)
    && Number.isFinite(publishedAt.getTime()) && publishedAt >= cutoff
    && publishedAt > new Date(predictedAt)
    && ledger.normalizeStartupName(title).includes(ledger.normalizeStartupName(startupName));
}

async function main() {
  const activeCutoff = new Date(Date.now() - 365 * 86_400_000).toISOString();
  let snapshotQuery = db.from('funding_prediction_snapshots')
    .select('cohort_key,startup_id,predicted_at,context')
    .gte('predicted_at', activeCutoff).order('predicted_at').limit(5000);
  if (cohortKey) snapshotQuery = snapshotQuery.eq('cohort_key', cohortKey);
  const { data: snapshots, error } = await snapshotQuery;
  if (error) throw error;
  if (!snapshots?.length) throw new Error('No active prospective funding prediction cohort exists');

  const targetsById = new Map();
  for (const row of snapshots) {
    const existing = targetsById.get(row.startup_id);
    if (!existing) targetsById.set(row.startup_id, {
      startupId: row.startup_id,
      startupName: row.context?.startup_name,
      predictedAt: row.predicted_at,
      cohortKeys: new Set([row.cohort_key]),
    });
    else {
      existing.cohortKeys.add(row.cohort_key);
      if (new Date(row.predicted_at) < new Date(existing.predictedAt)) existing.predictedAt = row.predicted_at;
    }
  }
  const candidateTargets = [...targetsById.values()].filter(row => row.startupName);
  const { data: startupIdentities, error: identityError } = await db.from('startup_uploads')
    .select('id,name,description,source_type,website,company_domain').in('id', candidateTargets.map(row => row.startupId));
  if (identityError) throw identityError;
  const predictionGradeStartupIds = new Set((startupIdentities || [])
    .filter(ledger.isPredictionGradeStartupIdentity).map(row => row.id));
  const targets = candidateTargets.filter(row => predictionGradeStartupIds.has(row.startupId)).slice(0, limit);
  const { data: investors, error: investorError } = await db.from('investors').select('id,name,firm').limit(10000);
  if (investorError) throw investorError;
  const candidates = [];
  const failures = [];

  for (const target of targets) {
    try {
      const articles = await searchStartupNews(target.startupName, null, 8, 'funding OR raises OR investment', { lite: true });
      for (const article of articles) {
        if (!eligibleArticle(article, target.startupName, target.predictedAt)) continue;
        const headline = cleanHeadline(article.title);
        const inferred = extractFunding(headline) || {};
        const announcedAt = new Date(article.pubDate).toISOString();
        const amount = Number(inferred.funding_amount) > 0 ? Math.round(Number(inferred.funding_amount)) : null;
        candidates.push({
          source_event_key: sourceKey(target.startupId, article.link, headline),
          startup_id: target.startupId,
          startup_name_raw: target.startupName,
          financing_type: 'equity',
          round_type: inferred.funding_round || inferred.funding_stage || null,
          amount_usd: amount,
          canonical_round_key: ledger.canonicalRoundKey({ startupId: target.startupId, startupName: target.startupName, roundType: inferred.funding_round || inferred.funding_stage, amountUsd: amount, announcedAt }),
          announced_at: announcedAt,
          occurred_at: null,
          occurred_at_precision: 'announcement_proxy',
          source_url: article.link,
          source_publisher: publisherFromTitle(article.title, article.source),
          source_title: headline,
          evidence_confidence: 0.7,
          verification_status: 'observed',
          extraction_version: 'prospective-cohort-monitor-v1',
          metadata: { cohort_keys: [...target.cohortKeys], predicted_at: target.predictedAt, discovery_method: 'inference_engine_free_news_search', participant_list_complete: false },
          updated_at: new Date().toISOString(),
        });
      }
    } catch (cause) {
      failures.push({ startup: target.startupName, error: cause.message });
    }
    await sleep(500);
  }

  const unique = [...new Map(candidates.map(row => [row.source_event_key, row])).values()];
  if (apply && unique.length) {
    const { data: written, error: writeError } = await db.from('funding_evidence_events')
      .upsert(unique, { onConflict: 'source_event_key' }).select('id,source_event_key,source_title');
    if (writeError) throw writeError;
    const sourceRow = new Map((written || []).map(row => [row.source_event_key, row]));
    const participants = [];
    for (const candidate of unique) {
      const event = sourceRow.get(candidate.source_event_key);
      if (!event) continue;
      for (const mention of extractKnownInvestorMentions(candidate.source_title, investors || [])) {
        if (!mention.relation || mention.role === 'unknown') continue;
        participants.push({
          funding_event_id: event.id,
          investor_name_raw: mention.investorNameRaw,
          investor_id: mention.investor.id,
          participant_role: mention.role,
          participation_relation: mention.relation,
          evidence_phrase: mention.evidencePhrase,
          resolution_status: 'resolved',
          resolution_confidence: 1,
          evidence: { extraction_version: 'prospective-cohort-monitor-v1', source: 'headline' },
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (participants.length) {
      const { error: participantError } = await db.from('funding_evidence_participants')
        .upsert(participants, { onConflict: 'funding_event_id,investor_name_raw' });
      if (participantError) throw participantError;
    }
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run', cohort_scope: cohortKey || 'all_active_365_day_cohorts',
    targets_monitored: targets.length, candidates_found: unique.length,
    failures, preview: unique.slice(0, 20).map(row => ({ startup: row.startup_name_raw, title: row.source_title, amount_usd: row.amount_usd, published_at: row.announced_at, publisher: row.source_publisher })),
  }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
