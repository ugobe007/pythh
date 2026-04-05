'use strict';

/**
 * Single source of truth for RSS / enrichment / batch inference limits.
 * Scripts and inferenceService read resolved values (env overrides with safe defaults).
 */

function intEnv(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const v = parseInt(raw, 10);
  return Number.isFinite(v) ? v : def;
}

function numEnv(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
}

/** Defaults when env is unset — keep in sync with inferenceService / cron docs */
const DEFAULTS = {
  ENRICH_MAX_EXTENDED_SOURCES: 18,
  ENRICH_EXTENDED_CHUNK: 4,
  ENRICH_EXTENDED_PAUSE_MS: 350,
  SEARCH_MAX_ARTICLES: 8,
  QUICK_ENRICH_ARTICLES: 8,
  QUICK_ENRICH_VC_ARTICLES: 12,
  QUICK_ENRICH_VC_FALLBACK_ARTICLES: 10,
  ONTOLOGY_NEWS_MAX_CHARS: 28000,
  ONTOLOGY_NEWS_MAX_SENTENCES: 26,
  INFERENCE_BATCH_LIMIT: 500,
  RSS_ENRICH_DAYS_LOOKBACK: 180,
  STARTUP_TIGHTEN_SPARSE_DEFAULT: 100,
  INVESTOR_NEWS_MAX_ARTICLES: 8,
  INVESTOR_NEWS_FIRM_EXTRA: 5,
  FUNDING_NARRATIVE_AGREE_THRESHOLD: 0.5,
  FUNDING_ONTOLOGY_CERTAINTY: 0.65,
  /** Google News + query fallbacks only — skip extended RSS fan-out (fits quickEnrich / instant-submit timeouts). */
  QUICK_ENRICH_LITE: true,
  /** Default ms for batch sparse scripts calling quickEnrich (must exceed worst-case GN + retries). */
  SPARSE_ENRICH_NEWS_TIMEOUT_MS: 90000,
  /**
   * Wall clock for entire enrich-one-startup (HTML + quickEnrich). Must be >= SPARSE_ENRICH_NEWS_TIMEOUT_MS
   * plus headroom or the outer withTimeout kills the job while quickEnrich is still running.
   */
  SPARSE_ENRICH_PER_STARTUP_TIMEOUT_MS: 130000,
  /**
   * enrich-sparse --html-only: outer wall clock per startup (inferDomain + HTTP fetch + extract).
   * Must exceed worst-case inferDomainFromName probes + 4s axios fetch.
   */
  SPARSE_ENRICH_HTML_PER_STARTUP_TIMEOUT_MS: 120000,
};

function getResolved() {
  return {
    ENRICH_MAX_EXTENDED_SOURCES: intEnv('ENRICH_MAX_EXTENDED_SOURCES', DEFAULTS.ENRICH_MAX_EXTENDED_SOURCES),
    ENRICH_EXTENDED_CHUNK: intEnv('ENRICH_EXTENDED_CHUNK', DEFAULTS.ENRICH_EXTENDED_CHUNK),
    ENRICH_EXTENDED_PAUSE_MS: intEnv('ENRICH_EXTENDED_PAUSE_MS', DEFAULTS.ENRICH_EXTENDED_PAUSE_MS),
    SEARCH_MAX_ARTICLES: intEnv('SEARCH_MAX_ARTICLES', DEFAULTS.SEARCH_MAX_ARTICLES),
    QUICK_ENRICH_ARTICLES: intEnv('QUICK_ENRICH_ARTICLES', DEFAULTS.QUICK_ENRICH_ARTICLES),
    QUICK_ENRICH_VC_ARTICLES: intEnv('QUICK_ENRICH_VC_ARTICLES', DEFAULTS.QUICK_ENRICH_VC_ARTICLES),
    QUICK_ENRICH_VC_FALLBACK_ARTICLES: intEnv('QUICK_ENRICH_VC_FALLBACK_ARTICLES', DEFAULTS.QUICK_ENRICH_VC_FALLBACK_ARTICLES),
    ONTOLOGY_NEWS_MAX_CHARS: intEnv('ONTOLOGY_NEWS_MAX_CHARS', DEFAULTS.ONTOLOGY_NEWS_MAX_CHARS),
    ONTOLOGY_NEWS_MAX_SENTENCES: intEnv('ONTOLOGY_NEWS_MAX_SENTENCES', DEFAULTS.ONTOLOGY_NEWS_MAX_SENTENCES),
    INFERENCE_BATCH_LIMIT: Math.min(2000, Math.max(50, intEnv('INFERENCE_BATCH_LIMIT', DEFAULTS.INFERENCE_BATCH_LIMIT))),
    RSS_ENRICH_DAYS_LOOKBACK: intEnv('RSS_ENRICH_DAYS_LOOKBACK', DEFAULTS.RSS_ENRICH_DAYS_LOOKBACK),
    STARTUP_TIGHTEN_SPARSE_DEFAULT: intEnv('STARTUP_TIGHTEN_SPARSE_DEFAULT', DEFAULTS.STARTUP_TIGHTEN_SPARSE_DEFAULT),
    INVESTOR_NEWS_MAX_ARTICLES: intEnv('INVESTOR_NEWS_MAX_ARTICLES', DEFAULTS.INVESTOR_NEWS_MAX_ARTICLES),
    INVESTOR_NEWS_FIRM_EXTRA: intEnv('INVESTOR_NEWS_FIRM_EXTRA', DEFAULTS.INVESTOR_NEWS_FIRM_EXTRA),
    FUNDING_NARRATIVE_AGREE_THRESHOLD: numEnv('FUNDING_NARRATIVE_AGREE_THRESHOLD', DEFAULTS.FUNDING_NARRATIVE_AGREE_THRESHOLD),
    FUNDING_ONTOLOGY_CERTAINTY: numEnv('FUNDING_ONTOLOGY_CERTAINTY', DEFAULTS.FUNDING_ONTOLOGY_CERTAINTY),
    QUICK_ENRICH_LITE: process.env.QUICK_ENRICH_LITE === '0' || process.env.QUICK_ENRICH_LITE === 'false' ? false : DEFAULTS.QUICK_ENRICH_LITE,
    SPARSE_ENRICH_NEWS_TIMEOUT_MS: intEnv('SPARSE_ENRICH_NEWS_TIMEOUT_MS', DEFAULTS.SPARSE_ENRICH_NEWS_TIMEOUT_MS),
    SPARSE_ENRICH_PER_STARTUP_TIMEOUT_MS: Math.max(
      intEnv('SPARSE_ENRICH_NEWS_TIMEOUT_MS', DEFAULTS.SPARSE_ENRICH_NEWS_TIMEOUT_MS) + 15000,
      intEnv('SPARSE_ENRICH_PER_STARTUP_TIMEOUT_MS', DEFAULTS.SPARSE_ENRICH_PER_STARTUP_TIMEOUT_MS),
    ),
    SPARSE_ENRICH_HTML_PER_STARTUP_TIMEOUT_MS: Math.max(
      15000,
      intEnv('SPARSE_ENRICH_HTML_PER_STARTUP_TIMEOUT_MS', DEFAULTS.SPARSE_ENRICH_HTML_PER_STARTUP_TIMEOUT_MS),
    ),
  };
}

function getInferencePipelineSnapshot() {
  const r = getResolved();
  const keys = [
    'ENRICH_MAX_EXTENDED_SOURCES',
    'ENRICH_EXTENDED_CHUNK',
    'ENRICH_EXTENDED_PAUSE_MS',
    'SEARCH_MAX_ARTICLES',
    'QUICK_ENRICH_ARTICLES',
    'ONTOLOGY_NEWS_MAX_CHARS',
    'ONTOLOGY_NEWS_MAX_SENTENCES',
    'INFERENCE_BATCH_LIMIT',
    'RSS_ENRICH_DAYS_LOOKBACK',
    'INVESTOR_NEWS_MAX_ARTICLES',
    'QUICK_ENRICH_LITE',
    'SPARSE_ENRICH_NEWS_TIMEOUT_MS',
    'SPARSE_ENRICH_PER_STARTUP_TIMEOUT_MS',
    'SPARSE_ENRICH_HTML_PER_STARTUP_TIMEOUT_MS',
  ];
  const envOverrides = {};
  for (const k of keys) {
    if (process.env[k] !== undefined && process.env[k] !== '') envOverrides[k] = process.env[k];
  }
  return {
    defaults: { ...DEFAULTS },
    resolved: r,
    env_overrides: envOverrides,
  };
}

module.exports = {
  DEFAULTS,
  getResolved,
  getInferencePipelineSnapshot,
  intEnv,
  numEnv,
};
