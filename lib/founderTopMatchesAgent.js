'use strict';

const crypto = require('crypto');

const TOP_MATCH_COUNT = 3;
const IN_APP_MATCH_COUNT = 5;

function matchInvestor(row) {
  const raw = row?.investors || row?.investor;
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Firm-deduped recorded matches in score order — shared by Peter email
 * and in-app outreach drafts so both surfaces send the same shortlist.
 */
function selectUniqueTopMatchRows(rows, { limit = TOP_MATCH_COUNT, minScore = 0, eligible } = {}) {
  const seenInvestors = new Set();
  const seenFirms = new Set();
  return (rows || [])
    .map((row) => ({ row, investor: matchInvestor(row) }))
    .filter(({ row, investor }) => (
      investor
      && Number.isFinite(Number(row.match_score))
      && Number(row.match_score) >= minScore
    ))
    .filter(({ row, investor }) => !eligible || eligible(investor, row))
    .sort((a, b) => Number(b.row.match_score) - Number(a.row.match_score))
    .filter(({ row, investor }) => {
      const investorId = String(row.investor_id || investor.id || '').trim();
      const firm = String(investor.firm || investor.name || '').trim().toLowerCase();
      if (!investorId || seenInvestors.has(investorId) || (firm && seenFirms.has(firm))) return false;
      seenInvestors.add(investorId);
      if (firm) seenFirms.add(firm);
      return true;
    })
    .slice(0, limit);
}

function uniqueTopMatches(rows, limit = TOP_MATCH_COUNT) {
  return selectUniqueTopMatchRows(rows, { limit }).map(({ row, investor }) => ({
    id: row.investor_id || investor.id,
    name: investor.name,
    firm: investor.firm,
    stage: investor.stage,
    check_size_min: investor.check_size_min,
    check_size_max: investor.check_size_max,
    investment_thesis: investor.investment_thesis,
    title: investor.title,
    linkedin_url: investor.linkedin_url,
    twitter_url: investor.twitter_url,
    photo_url: investor.photo_url,
    investor_tier: investor.investor_tier,
    bio: investor.bio,
    notable_investments: investor.notable_investments,
    portfolio_companies: investor.portfolio_companies,
    sectors: investor.sectors,
    why_you_match: row.why_you_match,
    match_score: Math.round(Number(row.match_score)),
    match_reason: normalizeMatchReason(row.why_you_match || row.reasoning),
    investor,
  }));
}

function normalizeMatchReason(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join('. ') || 'Matched by sector, stage, and investment thesis.';
  if (value && typeof value === 'object') {
    const parts = Object.values(value).filter((part) => typeof part === 'string' && part.trim());
    if (parts.length) return parts.join('. ');
  }
  const text = String(value || '').trim();
  return text || 'Matched by sector, stage, and investment thesis.';
}

function unsubscribeToken(email, secret) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !secret) return null;
  const payload = `unknown:${normalized}:unsubscribe`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`unknown:${normalized}:${signature}`).toString('base64url');
}

function unsubscribeUrl(email, secret, baseUrl = 'https://pythh.ai') {
  const token = unsubscribeToken(email, secret);
  return token ? `${baseUrl.replace(/\/$/, '')}/unsubscribe?token=${encodeURIComponent(token)}` : null;
}

module.exports = {
  TOP_MATCH_COUNT,
  IN_APP_MATCH_COUNT,
  matchInvestor,
  selectUniqueTopMatchRows,
  uniqueTopMatches,
  normalizeMatchReason,
  unsubscribeToken,
  unsubscribeUrl,
};
