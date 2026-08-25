/**
 * Public portfolio eligibility — hide quarantined, junk, and rejected entities.
 */
'use strict';

const { ENTITY_QUARANTINE_BY_NAME } = require('./portfolioOutreachGate.mjs');

const JOURNALIST_PREFIX_RE =
  /^(?:[A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*)*\s*\/\s*)+/;
const OUTLET_PREFIX_RE = /^[A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*)*:\s*/;

function stripJournalistPrefix(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  if (!t) return null;
  for (let i = 0; i < 6; i++) {
    let next = t.replace(JOURNALIST_PREFIX_RE, '').trim();
    if (next === t) next = t.replace(OUTLET_PREFIX_RE, '').trim();
    if (next === t) break;
    t = next;
  }
  return t || null;
}

function normalizeNarrativeText(text) {
  const stripped = stripJournalistPrefix(text);
  if (!stripped) return null;
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  if (!collapsed || collapsed.length < 12) return null;
  return collapsed;
}

/**
 * @param {object} entry — portfolio_health / portfolio_summary row
 * @param {object} [startup] — startup_uploads row (optional)
 */
function isPortfolioPublicEligible(entry, startup = null) {
  if (!entry) return false;

  if (String(entry.status || '').toLowerCase() === 'written_off') return false;

  if (entry.entity_quarantined) return false;

  const name = (startup?.name || entry.startup_name || '').trim();
  if (name && ENTITY_QUARANTINE_BY_NAME[name]) return false;

  const gate = String(startup?.entity_gate || '').toLowerCase();
  if (gate === 'junk') return false;

  const suStatus = String(startup?.status || '').toLowerCase();
  if (suStatus === 'rejected') return false;

  return true;
}

function buildPortfolioNarrativeFields(startupRow = {}) {
  const rawSummary = (startupRow.description || '').trim();
  const rawPitch = (startupRow.pitch || startupRow.tagline || '').trim();

  const summary = normalizeNarrativeText(rawSummary);
  const pitch = normalizeNarrativeText(rawPitch);

  let company_summary = summary || null;
  let value_proposition = null;

  if (pitch && summary && pitch === summary) {
    value_proposition = null;
  } else if (pitch && summary && pitch.startsWith(summary.slice(0, 40))) {
    value_proposition = null;
  } else if (pitch) {
    value_proposition = pitch;
  } else if (startupRow.tagline) {
    const tag = normalizeNarrativeText(startupRow.tagline);
    if (tag && tag !== company_summary) value_proposition = tag;
  }

  return { company_summary, value_proposition };
}

module.exports = {
  isPortfolioPublicEligible,
  buildPortfolioNarrativeFields,
  normalizeNarrativeText,
  stripJournalistPrefix,
};
