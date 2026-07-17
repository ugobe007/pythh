'use strict';

/**
 * startup_investor_matches.why_you_match is string[] in Postgres; some fallbacks use string.
 * Always coerce to a single display string for API responses and UI.
 *
 * @param {string|string[]|null|undefined} raw
 * @returns {string}
 */
function normalizeWhyYouMatch(raw) {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean).join(' · ');
  }
  return String(raw).trim();
}

module.exports = { normalizeWhyYouMatch };
