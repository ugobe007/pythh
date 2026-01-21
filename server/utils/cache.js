const { LRUCache } = require('lru-cache');

const matchesCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 min
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

const historyCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 1, // 60s
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

const resolveCache = new LRUCache({
  max: 2000,
  ttl: 1000 * 60 * 60 * 24, // 24h
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

function normalizeUrl(input) {
  if (!input) return null;
  
  try {
    // Handle URLs without protocol
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    const parsed = new URL(url);
    
    // Force lowercase host
    let normalized = `https://${parsed.hostname.toLowerCase()}${parsed.pathname}`;
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    // Handle LinkedIn/Crunchbase canonicalization
    if (parsed.hostname.includes('linkedin.com')) {
      normalized = normalized.replace(/\/+$/, '');
    }
    
    if (parsed.hostname.includes('crunchbase.com')) {
      normalized = normalized.replace(/\/+$/, '');
    }
    
    return normalized;
  } catch (e) {
    return null;
  }
}

module.exports = { matchesCache, historyCache, resolveCache, normalizeUrl };
