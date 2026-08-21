/**
 * Frequent Hit@5 ledger funders that historically never entered the persisted
 * match pool (candidate_generation_miss). Force-include into the scored /
 * persisted candidate set — do not retune GOD/fit weights for these names.
 *
 * Prefer firm rows (is_individual !== true). Collapse alias variants to one
 * canonical firm per family (e.g. ICONIQ / ICONIQ Capital).
 */

const FREQUENT_LEDGER_FUNDER_ALIASES = Object.freeze([
  'general catalyst',
  'nvidia',
  'nvidia ventures',
  'uber',
  'baillie gifford',
  'iconiq',
  'iconiq capital',
  'founders fund',
  'premji invest',
  'microsoft',
  'dell technologies capital',
  'basis set ventures',
  'nexus venture partners',
  'notable capital',
  'boldcap',
  'luminar ventures',
]);

/** Alias → family key for de-duplicating multiple investor rows. */
const ALIAS_FAMILY = Object.freeze({
  'general catalyst': 'general_catalyst',
  nvidia: 'nvidia',
  'nvidia ventures': 'nvidia',
  uber: 'uber',
  'baillie gifford': 'baillie_gifford',
  iconiq: 'iconiq',
  'iconiq capital': 'iconiq',
  'founders fund': 'founders_fund',
  'premji invest': 'premji_invest',
  microsoft: 'microsoft',
  'dell technologies capital': 'dell_tech_capital',
  'basis set ventures': 'basis_set',
  'nexus venture partners': 'nexus_vp',
  'notable capital': 'notable',
  boldcap: 'boldcap',
  'luminar ventures': 'luminar',
});

function normalizeFunderLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function familyKeyForLabel(label) {
  const normalized = normalizeFunderLabel(label);
  return ALIAS_FAMILY[normalized] || null;
}

function investorFamilyKey(investor) {
  if (!investor || investor.is_individual === true) return null;
  const labels = [investor.firm, investor.name].map(normalizeFunderLabel).filter(Boolean);
  for (const label of labels) {
    const family = familyKeyForLabel(label);
    if (family) return family;
  }
  return null;
}

function isFrequentLedgerFunder(investor) {
  return Boolean(investorFamilyKey(investor));
}

/**
 * One best firm row per frequent-funder family (highest investor_score wins).
 */
function pickCanonicalFrequentFunders(investors) {
  const bestByFamily = new Map();
  for (const inv of investors || []) {
    const family = investorFamilyKey(inv);
    if (!family || !inv?.id) continue;
    const prev = bestByFamily.get(family);
    const score = Number(inv.investor_score) || 0;
    const prevScore = Number(prev?.investor_score) || 0;
    if (!prev || score > prevScore) bestByFamily.set(family, inv);
  }
  return [...bestByFamily.values()];
}

function collectFrequentLedgerFunderIds(investors) {
  return new Set(pickCanonicalFrequentFunders(investors).map((inv) => String(inv.id)));
}

/**
 * Reserve forced investor rows first, then fill remaining slots by existing order
 * (caller should pre-sort by match_score desc).
 *
 * @param {object[]} scoredRows
 * @param {Iterable<string>} forceInvestorIds
 * @param {number} limit
 * @param {(row: object) => string} getId
 */
function selectTopMatchesReservingForced(
  scoredRows,
  forceInvestorIds,
  limit,
  getId = (row) => row.investor_id || row.investor?.id,
) {
  const force = new Set([...forceInvestorIds].map(String));
  const selected = [];
  const seen = new Set();

  for (const row of scoredRows || []) {
    const id = String(getId(row) || '');
    if (!id || !force.has(id) || seen.has(id)) continue;
    seen.add(id);
    selected.push(row);
    if (selected.length >= limit) return selected;
  }

  for (const row of scoredRows || []) {
    const id = String(getId(row) || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(row);
    if (selected.length >= limit) break;
  }

  return selected;
}

module.exports = {
  FREQUENT_LEDGER_FUNDER_ALIASES,
  ALIAS_FAMILY,
  normalizeFunderLabel,
  familyKeyForLabel,
  investorFamilyKey,
  isFrequentLedgerFunder,
  pickCanonicalFrequentFunders,
  collectFrequentLedgerFunderIds,
  selectTopMatchesReservingForced,
};
