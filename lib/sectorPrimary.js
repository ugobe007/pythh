/**
 * Primary sector + portfolio overlap helpers (Growthsphere-style).
 * Uses canonical normalization from server/lib/sectorTaxonomy.js.
 *
 * DB overlap: public.candidate_portfolio_sector_overlap(uuid) uses sectors[1] and &&;
 * run scripts/normalize-sectors.js so SQL primaries align with canonical labels.
 */

const {
  getCanonicalSector,
  normalizeSectors,
} = require('../server/lib/sectorTaxonomy');

/**
 * First listed sector, mapped to canonical (matches portfolio_health primary convention).
 * @param {string[]|null|undefined} sectors
 * @returns {string|null}
 */
function getPrimarySector(sectors) {
  if (!Array.isArray(sectors) || sectors.length === 0) return null;
  const raw = sectors[0];
  return getCanonicalSector(raw) || null;
}

/**
 * @param {string[]|null|undefined} candidateSectors
 * @param {string[]|null|undefined} holdSectors
 * @returns {'same_primary'|'shared_sector'|'new_sector'|'unknown'}
 */
function overlapKind(candidateSectors, holdSectors) {
  const cp = getPrimarySector(candidateSectors);
  const hp = getPrimarySector(holdSectors);
  const cn = normalizeSectors(candidateSectors || []);
  const hn = normalizeSectors(holdSectors || []);
  if (!cn.length || !hn.length) return 'unknown';
  if (cp && hp && cp === hp) return 'same_primary';
  const shared = cn.filter((x) => hn.includes(x));
  if (shared.length) return 'shared_sector';
  return 'new_sector';
}

/**
 * @param {string[]|null|undefined} candidateSectors
 * @param {{ sectors?: string[] }[]} holdings
 * @returns {Record<'same_primary'|'shared_sector'|'new_sector'|'unknown', number>}
 */
function summarizePortfolioOverlap(candidateSectors, holdings) {
  const counts = {
    same_primary: 0,
    shared_sector: 0,
    new_sector: 0,
    unknown: 0,
  };
  for (const h of holdings) {
    const k = overlapKind(candidateSectors, h.sectors);
    counts[k] += 1;
  }
  return counts;
}

module.exports = {
  getPrimarySector,
  overlapKind,
  summarizePortfolioOverlap,
};
