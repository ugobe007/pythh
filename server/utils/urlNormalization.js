/**
 * URL Normalization - Canonical Rule
 * 
 * This must match the PostgreSQL normalize_url() function exactly.
 * Used everywhere to ensure consistent URL lookups.
 * 
 * Rules:
 * 1. Trim whitespace
 * 2. Lowercase
 * 3. Remove protocol (http:// or https://)
 * 4. Remove trailing slash
 * 
 * Examples:
 * "https://NucleoResearch.com/" → "nucleoresearch.com"
 * "HTTP://Example.COM" → "example.com"
 * "  stripe.com/  " → "stripe.com"
 */

export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

/**
 * Normalize and validate URL
 * Returns normalized URL or throws error
 */
export function normalizeAndValidateUrl(input) {
  const normalized = normalizeUrl(input);
  
  if (!normalized) {
    throw new Error('URL cannot be empty');
  }
  
  // Basic hostname validation
  if (!normalized.includes('.')) {
    throw new Error('Invalid URL format');
  }
  
  return normalized;
}

/**
 * Check if two URLs are equivalent after normalization
 */
export function urlsAreEqual(url1, url2) {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

// For CommonJS compatibility
module.exports = {
  normalizeUrl,
  normalizeAndValidateUrl,
  urlsAreEqual,
};
