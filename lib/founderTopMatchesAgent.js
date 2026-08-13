'use strict';

const crypto = require('crypto');

const TOP_MATCH_COUNT = 3;

function uniqueTopMatches(rows, limit = TOP_MATCH_COUNT) {
  const seenInvestors = new Set();
  const seenFirms = new Set();
  return (rows || [])
    .filter((row) => row && row.investors && Number.isFinite(Number(row.match_score)))
    .sort((a, b) => Number(b.match_score) - Number(a.match_score))
    .filter((row) => {
      const investorId = String(row.investor_id || row.investors.id || '').trim();
      const firm = String(row.investors.firm || row.investors.name || '').trim().toLowerCase();
      if (!investorId || seenInvestors.has(investorId) || (firm && seenFirms.has(firm))) return false;
      seenInvestors.add(investorId);
      if (firm) seenFirms.add(firm);
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.investor_id || row.investors.id,
      name: row.investors.name,
      firm: row.investors.firm,
      stage: row.investors.stage,
      check_size_min: row.investors.check_size_min,
      check_size_max: row.investors.check_size_max,
      investment_thesis: row.investors.investment_thesis,
      match_score: Math.round(Number(row.match_score)),
      match_reason: normalizeMatchReason(row.why_you_match || row.reasoning),
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

module.exports = { TOP_MATCH_COUNT, uniqueTopMatches, normalizeMatchReason, unsubscribeToken, unsubscribeUrl };
