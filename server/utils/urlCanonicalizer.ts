/**
 * URL Canonicalization - SINGLE SOURCE OF TRUTH
 * 
 * This function MUST be used everywhere URL → startup_id happens.
 * Guarantees: same URL → same canonical_url → same domain_key → same startup_id
 */

/**
 * Canonicalize a URL to a normalized form
 * Rules:
 * - Lowercase hostname
 * - Strip protocol (http/https)
 * - Strip www. prefix
 * - Strip trailing slash
 * - Remove common tracking params
 * 
 * @param url - Raw URL string
 * @returns Canonical URL string
 */
export function canonicalizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    // Ensure URL has protocol for parsing
    let urlToParse = url.trim();
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = 'https://' + urlToParse;
    }
    
    const parsed = new URL(urlToParse);
    
    // Lowercase hostname
    let hostname = parsed.hostname.toLowerCase();
    
    // Strip www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Get pathname, strip trailing slash
    let pathname = parsed.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    // Remove common tracking params
    const cleanParams = new URLSearchParams();
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 
      'ref', 'source', '_ga'
    ]);
    
    parsed.searchParams.forEach((value, key) => {
      if (!trackingParams.has(key.toLowerCase())) {
        cleanParams.append(key, value);
      }
    });
    
    // Build canonical URL (no protocol, no www)
    let canonical = hostname;
    
    if (pathname && pathname !== '/') {
      canonical += pathname;
    }
    
    const queryString = cleanParams.toString();
    if (queryString) {
      canonical += '?' + queryString;
    }
    
    if (parsed.hash && parsed.hash !== '#') {
      canonical += parsed.hash;
    }
    
    return canonical;
  } catch (error) {
    // If parsing fails, return cleaned input
    return url
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '');
  }
}

/**
 * Extract domain key for deduplication
 * This is the most aggressive normalization - just the domain
 * 
 * @param url - Raw URL string
 * @returns Domain key (just the domain, no subdomain variants)
 */
export function extractDomainKey(url: string): string {
  const canonical = canonicalizeUrl(url);
  
  // Extract just the domain part (before first /)
  const domain = canonical.split('/')[0].split('?')[0].split('#')[0];
  
  return domain;
}

/**
 * Check if two URLs represent the same startup
 * 
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if they canonicalize to the same domain_key
 */
export function isSameStartup(url1: string, url2: string): boolean {
  return extractDomainKey(url1) === extractDomainKey(url2);
}

/**
 * Validate URL is acceptable for matching
 * 
 * @param url - URL to validate
 * @returns Object with { valid: boolean, reason?: string }
 */
export function validateStartupUrl(url: string): { valid: boolean; reason?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is required' };
  }
  
  const canonical = canonicalizeUrl(url);
  
  if (!canonical) {
    return { valid: false, reason: 'Invalid URL format' };
  }
  
  // Check for localhost/IP addresses
  if (canonical.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(canonical)) {
    return { valid: false, reason: 'Local URLs not supported' };
  }
  
  // Check for common invalid domains
  const invalidDomains = ['example.com', 'test.com', 'demo.com'];
  if (invalidDomains.some(d => canonical.includes(d))) {
    return { valid: false, reason: 'Invalid domain' };
  }
  
  return { valid: true };
}

// Test cases (run with: npx tsx server/utils/urlCanonicalizer.test.ts)
if (require.main === module) {
  const tests = [
    // Protocol variations
    ['https://example.com', 'example.com'],
    ['http://example.com', 'example.com'],
    ['example.com', 'example.com'],
    
    // www variations
    ['www.example.com', 'example.com'],
    ['https://www.example.com', 'example.com'],
    
    // Trailing slash
    ['example.com/', 'example.com'],
    ['example.com/about/', 'example.com/about'],
    
    // Case sensitivity
    ['Example.Com', 'example.com'],
    ['EXAMPLE.COM/About', 'example.com/About'],
    
    // Tracking params
    ['example.com?utm_source=twitter', 'example.com'],
    ['example.com?fbclid=123&foo=bar', 'example.com?foo=bar'],
    
    // Paths preserved
    ['example.com/products', 'example.com/products'],
    ['example.com/products?id=123', 'example.com/products?id=123'],
  ];
  
  console.log('Testing URL canonicalization:\n');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(([input, expected]) => {
    const result = canonicalizeUrl(input);
    const match = result === expected;
    if (match) {
      passed++;
      console.log(`✅ ${input} → ${result}`);
    } else {
      failed++;
      console.log(`❌ ${input}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Got:      ${result}`);
    }
  });
  
  console.log(`\n${passed} passed, ${failed} failed`);
  
  // Test domain key extraction
  console.log('\nDomain key extraction:');
  console.log(extractDomainKey('https://www.example.com/path?foo=bar')); // → example.com
  console.log(extractDomainKey('blog.example.com/post')); // → blog.example.com
}
