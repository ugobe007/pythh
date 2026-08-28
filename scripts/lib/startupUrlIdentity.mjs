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
