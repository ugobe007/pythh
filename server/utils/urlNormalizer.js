/**
 * URL NORMALIZATION - Canonical startup lookup
 * ============================================
 * Strip protocol, www, trailing slash, lowercase
 */

function normalizeUrl(url) {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove www.
  normalized = normalized.replace(/^www\./, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Lowercase
  normalized = normalized.toLowerCase();
  
  // Remove path (keep only domain)
  normalized = normalized.split('/')[0];
  
  // Remove port
  normalized = normalized.split(':')[0];
  
  return normalized;
}

function extractDomain(url) {
  return normalizeUrl(url);
}

/**
 * Startup lookup with fuzzy matching
 * Tries: exact match → www variant → subdomain strip
 */
function generateLookupVariants(url) {
  const normalized = normalizeUrl(url);
  const variants = [normalized];
  
  // Add www variant
  variants.push(`www.${normalized}`);
  
  // Strip potential subdomain (if more than 2 parts)
  const parts = normalized.split('.');
  if (parts.length > 2) {
    variants.push(parts.slice(-2).join('.'));
  }
  
  return [...new Set(variants)];
}

module.exports = {
  normalizeUrl,
  extractDomain,
  generateLookupVariants
};

// Examples:
// https://www.foo.com/ → foo.com
// http://app.bar.com → bar.com
// baz.io → baz.io
