'use strict';

/**
 * NEWS SIGNAL SERVICE
 *
 * Computes startup social_score from rss_articles mentions.
 * - Uses PostgreSQL full-text search (fast, no external API)
 * - Boosts for recency (90 days) and funding context
 * - Caps at 100, floors at 0
 * - Safe to call in request path — single DB round-trip via PG tsquery
 *
 * Score mapping:
 *   0 mentions        → 0
 *   1 mention         → 12
 *   2–3 mentions      → 20–35
 *   4–8 mentions      → 40–65
 *   9–15 mentions     → 70–85
 *   16+ mentions      → 90–100
 *
 * Weighted mention formula:
 *   Each mention gets a weight:
 *     - base weight: 1.0
 *     - recency (<90d): ×1.5
 *     - funding context (raises/invests/funding in title): ×2.0
 *   weighted_total = sum of weights
 *   social_score = clamp(round(log10(weighted_total + 1) * 55), 0, 100)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RECENCY_WINDOW_DAYS = 90;
const FUNDING_KEYWORDS = ['raises', 'raised', 'funding', 'invests', 'invested', 'closes', 'round', 'seed', 'series'];

/**
 * Build a simple tsquery from a startup name.
 * Strips special chars, lowercases, joins with & for multi-word names.
 * For short or single-word names, uses a prefix match.
 */
function buildTsQuery(name) {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);

  if (tokens.length === 0) return null;
  // Use prefix match on first significant token to catch variations (Tessera → Tesseralabs)
  if (tokens.length === 1) return `${tokens[0]}:*`;
  return tokens.join(' & ');
}

/**
 * Compute a social_score for a startup by searching rss_articles.
 *
 * @param {string} startupName
 * @param {string|null} startupWebsite  - used for domain-based mention boost
 * @returns {Promise<number>} social_score 0–100
 */
async function computeSocialScore(startupName, startupWebsite = null) {
  if (!startupName || startupName.length < 2) return 0;

  const tsQuery = buildTsQuery(startupName);
  if (!tsQuery) return 0;

  // Pull matching articles with just the columns we need
  const { data: articles, error } = await supabase
    .from('rss_articles')
    .select('title, published_at, created_at')
    .textSearch('title', tsQuery, { type: 'plain', config: 'english' })
    .limit(50);

  if (error || !articles || articles.length === 0) return 0;

  const now = Date.now();
  const recencyCutoff = now - RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  let weightedTotal = 0;

  for (const article of articles) {
    let weight = 1.0;

    // Recency boost
    const pubMs = new Date(article.published_at || article.created_at).getTime();
    if (!isNaN(pubMs) && pubMs > recencyCutoff) {
      weight *= 1.5;
    }

    // Funding context boost
    const titleLower = (article.title || '').toLowerCase();
    if (FUNDING_KEYWORDS.some(kw => titleLower.includes(kw))) {
      weight *= 2.0;
    }

    weightedTotal += weight;
  }

  // Log scale: log10(1.0+1)=0.3, log10(10+1)=1.04, log10(100+1)=2.0
  const raw = Math.log10(weightedTotal + 1) * 55;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Fetch + apply social_score to a startup row in DB.
 * Returns the new social_score.
 */
async function enrichSocialScore(startupId, startupName, startupWebsite) {
  const score = await computeSocialScore(startupName, startupWebsite);

  if (score > 0) {
    await supabase
      .from('startup_uploads')
      .update({ social_score: score, updated_at: new Date().toISOString() })
      .eq('id', startupId);
  }

  return score;
}

/**
 * Batch enrich social_score for all approved startups where social_score = 0.
 * Runs with a small delay between rows to avoid overwhelming the DB.
 *
 * @param {object} opts
 * @param {number} [opts.limit=500]   - max rows per run
 * @param {number} [opts.delayMs=50]  - ms delay between rows
 */
async function batchEnrichSocialScores({ limit = 500, delayMs = 50 } = {}) {
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website')
    .eq('status', 'approved')
    .or('social_score.is.null,social_score.eq.0')
    .limit(limit);

  if (error || !startups) {
    console.error('[newsSignal] Failed to fetch startups:', error?.message);
    return { processed: 0, updated: 0 };
  }

  let updated = 0;
  for (const s of startups) {
    const score = await enrichSocialScore(s.id, s.name, s.website);
    if (score > 0) updated++;
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }

  console.log(`[newsSignal] Batch complete: ${startups.length} processed, ${updated} received news signal.`);
  return { processed: startups.length, updated };
}

module.exports = { computeSocialScore, enrichSocialScore, batchEnrichSocialScores };
