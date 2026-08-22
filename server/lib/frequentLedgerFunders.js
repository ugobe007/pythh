/**
 * Frequent Hit@5 ledger funders that historically never entered the persisted
 * match pool (candidate_generation_miss). Force-include into the scored /
 * persisted candidate set — do not retune GOD/fit weights for these names.
 *
 * Prefer true firm profiles (name ≈ firm / name is an allowlisted alias) over
 * high-scoring partner rows mis-tagged is_individual=false. Collapse alias
 * variants to one canonical firm per family.
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
  // Expanded from never-pre-matched qualified firm ledger (post-#33).
  'sequoia',
  'sequoia capital',
  'eqt',
  'eqt ventures',
  'thrive',
  'thrive capital',
  'lightspeed',
  'lightspeed venture partners',
  'wndrco',
  'coatue',
  'coatue management',
  'menlo ventures',
  'insight partners',
  'y combinator',
  'yc',
  'accel',
  'peak xv',
  'peak xv partners',
  // Post-#37 never-pre-matched qualified firms still missing from force-include.
  'andreessen horowitz',
  'a16z',
  'susquehanna',
  'greenoaks',
  'greenoaks capital',
  'general atlantic',
  'elevation',
  'elevation capital',
  'dabur ventures',
  'dabur',
  'aker asa',
  'aker',
  // Post-#38 never-pre-matched labels still missing from force-include.
  'dell',
  'dell technologies',
  // Sovereign wealth / state-linked funds (country-associated brands — do not geo-delete).
  'temasek',
  'temasek holdings',
  'gic',
  'mubadala',
  'mubadala capital',
  // Post-#40 long-tail institutions still missing from pre-match pools.
  'goldman sachs',
  'goldman',
  'kleiner perkins',
  'bessemer venture partners',
  'bessemer',
  'hongshan',
  'northzone',
  'balderton capital',
  'balderton',
  'citadel',
  'bain capital',
  // Post-#42 never-pre-matched + indeterminate seed firms still missing from force-include.
  'advent international',
  'advent',
  'rainmatter',
  'rainmatter capital',
  'jane street',
  'us innovative technology fund',
  'usit',
  'eclipse',
  'eclipse ventures',
  'riot ventures',
  'georgian',
  'georgian partners',
  // Post-#44 miss-actual / near-miss firms still missing from force-include.
  'greylock',
  'greylock partners',
  'khosla',
  'khosla ventures',
  'benchmark',
  'redpoint',
  'redpoint ventures',
  'intel capital',
  'softbank',
  'softbank vision fund',
  'dst global',
  'dst',
  'tcv',
  'nfx',
  'pear',
  'pear vc',
  'kindred',
  'kindred ventures',
  'norwest',
  'norwest venture partners',
  'qed',
  'qed investors',
  'sands capital',
  'sands',
  'wellington',
  'wellington management',
  'openai',
  'google',
  'stripe',
  'left lane capital',
  'left lane',
  'true ventures',
  'goodwater',
  'goodwater capital',
  'designer fund',
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
  'basis set ventures': 'basis_set',
  'nexus venture partners': 'nexus_vp',
  'notable capital': 'notable',
  boldcap: 'boldcap',
  'luminar ventures': 'luminar',
  sequoia: 'sequoia',
  'sequoia capital': 'sequoia',
  eqt: 'eqt',
  'eqt ventures': 'eqt',
  thrive: 'thrive',
  'thrive capital': 'thrive',
  lightspeed: 'lightspeed',
  'lightspeed venture partners': 'lightspeed',
  wndrco: 'wndrco',
  coatue: 'coatue',
  'coatue management': 'coatue',
  'menlo ventures': 'menlo',
  'insight partners': 'insight',
  'y combinator': 'y_combinator',
  yc: 'y_combinator',
  accel: 'accel',
  'peak xv': 'peak_xv',
  'peak xv partners': 'peak_xv',
  'andreessen horowitz': 'a16z',
  a16z: 'a16z',
  susquehanna: 'susquehanna',
  greenoaks: 'greenoaks',
  'greenoaks capital': 'greenoaks',
  'general atlantic': 'general_atlantic',
  elevation: 'elevation',
  'elevation capital': 'elevation',
  'dabur ventures': 'dabur',
  dabur: 'dabur',
  'aker asa': 'aker',
  aker: 'aker',
  dell: 'dell',
  'dell technologies': 'dell',
  'dell technologies capital': 'dell',
  temasek: 'temasek',
  'temasek holdings': 'temasek',
  gic: 'gic',
  mubadala: 'mubadala',
  'mubadala capital': 'mubadala',
  'goldman sachs': 'goldman',
  goldman: 'goldman',
  'kleiner perkins': 'kleiner_perkins',
  'bessemer venture partners': 'bessemer',
  bessemer: 'bessemer',
  hongshan: 'hongshan',
  northzone: 'northzone',
  'balderton capital': 'balderton',
  balderton: 'balderton',
  citadel: 'citadel',
  'bain capital': 'bain_capital',
  'advent international': 'advent',
  advent: 'advent',
  rainmatter: 'rainmatter',
  'rainmatter capital': 'rainmatter',
  'jane street': 'jane_street',
  'us innovative technology fund': 'usit',
  usit: 'usit',
  eclipse: 'eclipse',
  'eclipse ventures': 'eclipse',
  'riot ventures': 'riot',
  georgian: 'georgian',
  'georgian partners': 'georgian',
  greylock: 'greylock',
  'greylock partners': 'greylock',
  khosla: 'khosla',
  'khosla ventures': 'khosla',
  benchmark: 'benchmark',
  redpoint: 'redpoint',
  'redpoint ventures': 'redpoint',
  'intel capital': 'intel_capital',
  softbank: 'softbank',
  'softbank vision fund': 'softbank',
  'dst global': 'dst',
  dst: 'dst',
  tcv: 'tcv',
  nfx: 'nfx',
  pear: 'pear',
  'pear vc': 'pear',
  kindred: 'kindred',
  'kindred ventures': 'kindred',
  norwest: 'norwest',
  'norwest venture partners': 'norwest',
  qed: 'qed',
  'qed investors': 'qed',
  'sands capital': 'sands',
  sands: 'sands',
  wellington: 'wellington',
  'wellington management': 'wellington',
  openai: 'openai',
  google: 'google',
  stripe: 'stripe',
  'left lane capital': 'left_lane',
  'left lane': 'left_lane',
  'true ventures': 'true_ventures',
  goodwater: 'goodwater',
  'goodwater capital': 'goodwater',
  'designer fund': 'designer_fund',
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
 * Prefer true firm org rows over partner/person profiles that share a firm label.
 * Higher is better. Negative = skip.
 */
function firmProfileRank(investor) {
  if (!investor || investor.is_individual === true) return -1;
  const rawName = String(investor.name || '');
  if (/\([^)]+\)/.test(rawName)) return -1; // "Hemant Taneja (General Catalyst)"
  const name = normalizeFunderLabel(investor.name);
  const firm = normalizeFunderLabel(investor.firm);
  if (!name) return -1;
  // Name itself is an allowlisted firm alias.
  if (ALIAS_FAMILY[name]) return 3;
  // Name equals firm and firm is allowlisted (canonical org row).
  if (firm && name === firm && ALIAS_FAMILY[firm]) return 2;
  // Firm matches allowlist but name is a different person/partner label.
  if (firm && ALIAS_FAMILY[firm] && name !== firm) return 0;
  return 1;
}

/**
 * One best firm row per frequent-funder family.
 * Firm-profile rank beats investor_score so partner rows cannot win.
 */
function pickCanonicalFrequentFunders(investors) {
  const bestByFamily = new Map();
  for (const inv of investors || []) {
    const family = investorFamilyKey(inv);
    if (!family || !inv?.id) continue;
    const rank = firmProfileRank(inv);
    if (rank < 0) continue;
    const prev = bestByFamily.get(family);
    if (!prev) {
      bestByFamily.set(family, inv);
      continue;
    }
    const prevRank = firmProfileRank(prev);
    if (rank > prevRank) {
      bestByFamily.set(family, inv);
      continue;
    }
    if (rank === prevRank) {
      const score = Number(inv.investor_score) || 0;
      const prevScore = Number(prev.investor_score) || 0;
      if (score > prevScore) bestByFamily.set(family, inv);
    }
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
  firmProfileRank,
  pickCanonicalFrequentFunders,
  collectFrequentLedgerFunderIds,
  selectTopMatchesReservingForced,
};
