/**
 * DATA COLLECTOR — Pythh Signal Intelligence Orchestrator
 *
 * Runs all data sources in parallel for a given company and feeds the
 * unified signal set into the signal detector to produce composite scores.
 *
 * Data sources:
 *   1. News articles      — Google News RSS (existing inferenceService)
 *   2. GitHub API         — repo activity, commits, stars, SDK detection
 *   3. USPTO Patents      — patent filings, domains, citation momentum
 *   4. Govt Grants        — SBIR/STTR, DARPA, DOE, NIH, USASpending
 *   5. Job postings       — LinkedIn (via Google) + HN Who Is Hiring
 *
 * Each source produces typed signals with:
 *   { signal, category, strength, detectedAt, source, evidence }
 *
 * All signals flow into detectSignals() which applies:
 *   · Compound corroboration scoring (strength × √count)
 *   · Time-based decay per signal category half-life
 *   · Conflict detection (contradictory signal combinations)
 *   · Weighted composite scores → PYTHH_SCORE
 *
 * Usage:
 *   const { collectSignals } = require('./dataCollector');
 *   const report = await collectSignals('Stripe', { githubOrg: 'stripe' });
 *   console.log(report.scores.pythh_score);
 *   console.log(report.conflicts);
 */

'use strict';

const { detectSignals, formatSignalReport } = require('./signalDetector');
const { fetchGithubSignals }    = require('./dataSources/githubSource');
const { fetchPatentSignals }    = require('./dataSources/patentSource');
const { fetchGovGrantSignals }  = require('./dataSources/govGrantSource');
const { fetchLinkedinJobSignals } = require('./dataSources/linkedinJobsSource');

// Import the existing news search from inferenceService
const { searchStartupNews } = require('./inferenceService');

const DEBUG = process.env.DEBUG_INFERENCE === '1';

/**
 * Run all data sources for a company and return the full signal report.
 *
 * @param {string} companyName — canonical company name
 * @param {Object} [opts]
 * @param {string}   [opts.githubOrg]       — known GitHub org/username
 * @param {boolean}  [opts.skipGithub]      — skip GitHub (default false)
 * @param {boolean}  [opts.skipPatents]     — skip USPTO (default false)
 * @param {boolean}  [opts.skipGrants]      — skip govt grants (default false)
 * @param {boolean}  [opts.skipJobs]        — skip job postings (default false)
 * @param {boolean}  [opts.skipNews]        — skip news articles (default false)
 * @param {Array}    [opts.existingArticles] — pass pre-fetched articles to skip news fetch
 * @returns {Promise<SignalReport>}
 */
async function collectSignals(companyName, opts = {}) {
  const {
    githubOrg,
    skipGithub  = false,
    skipPatents = false,
    skipGrants  = false,
    skipJobs    = false,
    skipNews    = false,
    existingArticles = null,
  } = opts;

  const startMs = Date.now();
  if (DEBUG) console.log(`[dataCollector] Starting collection for: ${companyName}`);

  // ── Run all sources in parallel ──────────────────────────────────────────
  const [
    newsResult,
    githubResult,
    patentResult,
    grantResult,
    jobsResult,
  ] = await Promise.allSettled([
    // 1. News articles
    skipNews || existingArticles
      ? Promise.resolve(existingArticles || [])
      : searchStartupNews(companyName).catch(() => []),

    // 2. GitHub signals
    skipGithub
      ? Promise.resolve([])
      : fetchGithubSignals(companyName, { githubOrg }).catch(e => {
          if (DEBUG) console.error(`[dataCollector] GitHub error: ${e.message}`);
          return [];
        }),

    // 3. Patent signals
    skipPatents
      ? Promise.resolve([])
      : fetchPatentSignals(companyName).catch(e => {
          if (DEBUG) console.error(`[dataCollector] Patents error: ${e.message}`);
          return [];
        }),

    // 4. Government grant signals
    skipGrants
      ? Promise.resolve([])
      : fetchGovGrantSignals(companyName).catch(e => {
          if (DEBUG) console.error(`[dataCollector] Grants error: ${e.message}`);
          return [];
        }),

    // 5. Job postings / LinkedIn signals
    skipJobs
      ? Promise.resolve([])
      : fetchLinkedinJobSignals(companyName).catch(e => {
          if (DEBUG) console.error(`[dataCollector] Jobs error: ${e.message}`);
          return [];
        }),
  ]);

  const articles        = newsResult.status    === 'fulfilled' ? newsResult.value    : [];
  const githubSignals   = githubResult.status  === 'fulfilled' ? githubResult.value  : [];
  const patentSignals   = patentResult.status  === 'fulfilled' ? patentResult.value  : [];
  const grantSignals    = grantResult.status   === 'fulfilled' ? grantResult.value   : [];
  const jobSignals      = jobsResult.status    === 'fulfilled' ? jobsResult.value    : [];

  const prebuiltSignals = [...githubSignals, ...patentSignals, ...grantSignals, ...jobSignals];
  const elapsedMs       = Date.now() - startMs;

  if (DEBUG) {
    console.log(`[dataCollector] ${companyName} collected in ${elapsedMs}ms:`);
    console.log(`  Articles: ${articles.length}, GitHub: ${githubSignals.length}, Patents: ${patentSignals.length}, Grants: ${grantSignals.length}, Jobs: ${jobSignals.length}`);
  }

  // ── Detect signals with all data sources combined ────────────────────────
  const report = detectSignals(articles, companyName, { prebuiltSignals });

  // Attach collection metadata
  report.meta = {
    companyName,
    collectedAt: Date.now(),
    elapsedMs,
    sourceCounts: {
      articles:  articles.length,
      github:    githubSignals.length,
      patents:   patentSignals.length,
      grants:    grantSignals.length,
      jobs:      jobSignals.length,
    },
  };

  return report;
}

/**
 * Convenience: collect signals and write scores + conflicts back to the
 * startup_uploads table in Supabase.
 *
 * @param {Object} supabase — Supabase client instance
 * @param {string} startupId — row id in startup_uploads
 * @param {string} companyName
 * @param {Object} [opts] — passed to collectSignals
 * @returns {Promise<{scores, conflicts, pythh_score}>}
 */
async function collectAndSave(supabase, startupId, companyName, opts = {}) {
  const report = await collectSignals(companyName, opts);
  const { scores, conflicts } = report;

  // Build the market_signals JSONB payload
  const marketSignals = {
    updatedAt:    new Date().toISOString(),
    pythh_score:  scores.pythh_score,
    scores:       {
      fundraising:  scores.fundraisingProbability,
      momentum:     scores.momentumScore,
      product:      scores.productVelocityScore,
      talent:       scores.talentMagnetScore,
      investor:     scores.investorInterestScore,
      hype:         scores.hypeScore,
      distress:     scores.distressScore,
      acquisition:  scores.acquisitionScore,
      pmf:          scores.pmfScore,
      sector:       scores.sectorHeatScore,
      deeptech:     scores.deepTechScore,
      visibility:   scores.visibilityScore,
    },
    primarySignal: report.primarySignal
      ? { signal: report.primarySignal.signal, category: report.primarySignal.category, meaning: report.primarySignal.meaning }
      : null,
    conflicts:     conflicts || [],
    topSignals:    report.signals.slice(0, 10).map(s => ({
      signal:     s.signal,
      category:   s.category,
      score:      Math.round(s.score * 100),
      count:      s.count,
      source:     s.source,
      detectedAt: s.detectedAt,
    })),
    sourceCounts:  report.meta?.sourceCounts || {},
  };

  const { error } = await supabase
    .from('startup_uploads')
    .update({ market_signals: marketSignals })
    .eq('id', startupId);

  if (error) throw error;

  if (DEBUG) {
    console.log(`[dataCollector] Saved signals for ${companyName}: PYTHH=${scores.pythh_score}`);
    console.log(formatSignalReport(report));
  }

  return { scores, conflicts, pythh_score: scores.pythh_score };
}

module.exports = { collectSignals, collectAndSave };
