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

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreVideoCandidate({ entityName, entityDomain, title, description, channelTitle, kind }) {
  const name = normalizeName(entityName);
  const haystack = normalizeName(`${title || ''} ${description || ''}`);
  const channel = normalizeName(channelTitle);
  if (!name || !haystack.includes(name)) return { score: 0, reasons: ['entity_name_missing'] };
  const nameTokens = name.split(/\s+/).filter(Boolean);
  const channelIdentity = Boolean(channel && (channel === name || channel.startsWith(`${name} `) || name.startsWith(`${channel} `)));
  if (nameTokens.length === 1 && !channelIdentity) {
    return { score: 0, reasons: ['ambiguous_single_token_without_channel_identity'] };
  }
  let score = 0.55;
  const reasons = ['exact_entity_name'];
  const intent = kind === 'startup'
    ? /\b(demo|product|founder|pitch|interview|walkthrough)\b/
    : /\b(invest|investment|thesis|portfolio|founder|startup|interview)\b/;
  const hasIntent = intent.test(haystack);
  if (nameTokens.length === 1 && !hasIntent) {
    return { score: 0, reasons: ['ambiguous_single_token_without_content_intent'] };
  }
  if (hasIntent) { score += 0.18; reasons.push('content_intent'); }
  if (channelIdentity) { score += 0.17; reasons.push('entity_channel'); }
  const domainStem = normalizeName(String(entityDomain || '').split('.')[0]);
  if (domainStem && (haystack.includes(domainStem) || channel.includes(domainStem))) { score += 0.1; reasons.push('domain_identity'); }
  return { score: Math.min(1, Number(score.toFixed(3))), reasons };
}

function discoveryQueries(entity) {
  const quoted = `"${String(entity.name || '').trim()}"`;
  return entity.entityType === 'startup'
    ? [`${quoted} product demo`, `${quoted} founder interview`]
    : [`${quoted} investment thesis interview`, `${quoted} what we invest in`];
}

module.exports = { youtubeEmbedUrl, evidenceHash, validateSnippet, graphPredicates, scoreVideoCandidate, discoveryQueries };
