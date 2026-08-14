'use strict';

const crypto = require('crypto');

const STARTUP_TYPES = new Set(['product_demo', 'product_capability', 'customer_problem', 'traction_claim', 'team_claim', 'market_claim', 'fundraising_claim', 'timing_signal']);
const INVESTOR_TYPES = new Set(['investment_thesis', 'stage_preference', 'sector_preference', 'check_size', 'geography_preference', 'portfolio_reasoning', 'timing_signal']);

function youtubeEmbedUrl(videoId, startSeconds = 0) {
  const id = String(videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  const start = Math.max(0, Math.floor(Number(startSeconds) || 0));
  return `https://www.youtube.com/embed/${id}?start=${start}`;
}

function evidenceHash({ platform, externalVideoId, entityType, entityId, startSeconds, endSeconds, evidenceType, excerpt }) {
  const canonical = [platform, externalVideoId, entityType, entityId, startSeconds, endSeconds, evidenceType, String(excerpt || '').trim()].join('|').toLowerCase();
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function validateSnippet(snippet) {
  const allowed = snippet.entityType === 'startup' ? STARTUP_TYPES : snippet.entityType === 'investor' ? INVESTOR_TYPES : null;
  if (!allowed || !allowed.has(snippet.evidenceType)) return { ok: false, reason: 'evidence_type_not_allowed_for_entity' };
  const start = Number(snippet.startSeconds);
  const end = Number(snippet.endSeconds);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end - start > 90) return { ok: false, reason: 'invalid_timestamp_window' };
  if (!String(snippet.excerpt || '').trim()) return { ok: false, reason: 'missing_excerpt' };
  return { ok: true };
}

function graphPredicates(snippet) {
  const subject = `${snippet.entityType}:${snippet.entityId}`;
  return [
    { subject, predicate: 'has_video_evidence', object: `video:${snippet.platform}:${snippet.externalVideoId}`, confidence: snippet.confidence },
    { subject, predicate: `states_${snippet.evidenceType}`, object: snippet.normalizedClaim || {}, confidence: snippet.confidence },
  ];
}

module.exports = { youtubeEmbedUrl, evidenceHash, validateSnippet, graphPredicates };
