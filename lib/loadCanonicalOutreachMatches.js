'use strict';

/**
 * Recorded, firm-deduped match shortlist shared by Peter email and in-app drafts.
 */

const {
  IN_APP_MATCH_COUNT,
  TOP_MATCH_COUNT,
  selectUniqueTopMatchRows,
  uniqueTopMatches,
} = require('./founderTopMatchesAgent');

const CANONICAL_INVESTOR_SELECT = [
  'id',
  'name',
  'firm',
  'title',
  'sectors',
  'stage',
  'linkedin_url',
  'twitter_url',
  'photo_url',
  'investor_tier',
  'investment_thesis',
  'bio',
  'notable_investments',
  'portfolio_companies',
  'check_size_min',
  'check_size_max',
  'email',
  'email_best_guess',
  'email_candidates',
  'email_status',
  'email_has_mx',
].join(', ');

async function fetchCanonicalMatchRows(db, startupId) {
  const { data, error } = await db
    .from('startup_investor_matches')
    .select(`investor_id, match_score, why_you_match, reasoning, investors (${CANONICAL_INVESTOR_SELECT})`)
    .eq('startup_id', startupId)
    .order('match_score', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadCanonicalOutreachMatches(db, startupId, opts = {}) {
  const rows = await fetchCanonicalMatchRows(db, startupId);
  return selectUniqueTopMatchRows(rows, {
    limit: opts.limit ?? IN_APP_MATCH_COUNT,
    minScore: opts.minScore ?? 0,
    eligible: opts.eligible,
  });
}

module.exports = {
  CANONICAL_INVESTOR_SELECT,
  IN_APP_MATCH_COUNT,
  TOP_MATCH_COUNT,
  fetchCanonicalMatchRows,
  loadCanonicalOutreachMatches,
  uniqueTopMatches,
};
