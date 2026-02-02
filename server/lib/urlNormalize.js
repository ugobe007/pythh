/**
 * URL Normalization (Server-Side)
 * 
 * MUST match DB normalize_url() function semantics exactly.
 * Single source of truth for all server-side URL normalization.
 */

function normalizeUrl(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

module.exports = { normalizeUrl };
