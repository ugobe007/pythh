/**
 * Shared helpers for startup URL recovery / duplicate detection.
 */

/** Compact name for duplicate detection: "X-Bow Systems" → "xbowsystems", "XBOW" → "xbow". */
export function compactStartupName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(inc|llc|ltd|corp|co|systems?|technologies|technology|labs?|ai|the)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * True when orphan name is the same company as the website owner
 * (case/hyphen/suffix variants), so we should park the orphan rather than steal the URL.
 */
export function namesLikelySameStartup(a, b) {
  const ca = compactStartupName(a);
  const cb = compactStartupName(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length >= 4 && cb.length >= 4 && (ca.startsWith(cb) || cb.startsWith(ca))) return true;
  return false;
}

/** Domain parking / for-sale landers — never a real company URL. */
export function isParkingOrForsaleHost(hostOrUrl) {
  const s = String(hostOrUrl || '').toLowerCase();
  return /\b(dynadot|godaddy|sedo|afternic|dan\.com|forsale|hugedomains|namecheap|parkingcrew)\b/i.test(s);
}

/**
 * Consumer platforms / media brands that clog recover-urls forever when their
 * .com is already claimed. Not useful as qualified URL cohort members.
 */
const NON_STARTUP_BRANDS = new Set([
  'instagram',
  'facebook',
  'twitter',
  'x',
  'linkedin',
  'youtube',
  'tiktok',
  'google',
  'apple',
  'amazon',
  'microsoft',
  'dropbox',
  'asana',
  'slack',
  'notion',
  'venturefizz',
  'crunchbase',
  'pitchbook',
  'mattermark',
  'techcrunch',
  'forbes',
  'bloomberg',
]);

export function isNonStartupBrandName(name) {
  const c = compactStartupName(name);
  if (!c) return false;
  if (NON_STARTUP_BRANDS.has(c)) return true;
  // "Instagram's", "Venture Fizz News", etc.
  for (const brand of NON_STARTUP_BRANDS) {
    if (brand.length >= 5 && (c === brand || c.startsWith(brand))) return true;
  }
  return false;
}

/**
 * When every recovered candidate domain is already owned, decide whether to
 * park the orphan so it stops clogging the recover queue every wave.
 *
 * @returns {{ park: boolean, gate: 'junk' | 'url_blocked', reason: string } | null}
 */
export function shouldParkWebsiteTaken({ name, takenByWebsite, takenByOwnerName } = {}) {
  if (isParkingOrForsaleHost(takenByWebsite)) {
    return { park: true, gate: 'url_blocked', reason: 'parking_or_forsale_host' };
  }
  if (isNonStartupBrandName(name)) {
    return { park: true, gate: 'junk', reason: 'non_startup_brand' };
  }
  // Domain owned by an unrelated polluted row (e.g. Mattermark.com on "Makes")
  // — keep re-trying forever is what stuck the Mac loop. Park as url_blocked.
  if (takenByOwnerName && !namesLikelySameStartup(name, takenByOwnerName)) {
    return { park: true, gate: 'url_blocked', reason: 'website_taken_unrelated' };
  }
  // Same-name weaker owner already holds the URL — orphan cannot claim it.
  if (takenByOwnerName && namesLikelySameStartup(name, takenByOwnerName)) {
    return { park: true, gate: 'url_blocked', reason: 'website_taken_same_name' };
  }
  return null;
}
