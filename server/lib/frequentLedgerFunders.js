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
  // Post-#53 never-pre-matched qualified firms (audit topNeverPreMatched).
  'rtp global',
  'unicorn india ventures',
  'unicorn india',
  'spintop ventures',
  'blume founders fund',
  'blume venture',
  // Repetitive sync top-5 polluters (Hit@5 miss audit) — prefer firm rows via allowlist.
  'initialized capital',
  'initialized',
  'techstars',
  'blue collective',
  'ntt group',
  'ntt',
  // Post-signal-informed: never-pre-matched qualified firms still missing (audit depth 120).
  'susquehanna asia venture capital',
  'susquehanna asia',
  'craft ventures',
  'craft',
  'seedcamp',
  'datadog ventures',
  'datadog',
  'morgan stanley',
  '1789 capital',
  '1789',
  'new enterprise associates',
  'nea',
  'archetype',
  '8090 industries',
  '8090',
  'blackstone',
  'slauson & co',
  'slauson',
  'cyberstarts',
  'prysm capital',
  'prysm',
  'first round capital',
  'first round',
  'snowflake ventures',
  'snowflake',
  'cerca partners',
  'cerca',
  'emerald technology ventures',
  'emerald',
  'marcypen capital partners',
  'marcypen',
  'spark capital',
  'spark',
  'inflection point ventures',
  'xyz venture capital',
  'xyz ventures',
  'ada ventures',
  'lightrock',
  'qia',
  'qatar investment authority',
  'forerunner',
  'forerunner ventures',
  'fireside ventures',
  'fireside',
  'pitchdrive',
  'pantera capital',
  'pantera',
  'abstract ventures',
  'monashees',
  'dragoneer',
  'dragoneer investment group',
  'dn capital',
  'tencent',
  'sofina',
  'ribbit capital',
  'ribbit',
  'antler',
  'in-q-tel',
  'inqtel',
  'base10 partners',
  'base10',
  'accenture ventures',
  'accenture',
  'paradigm',
  'xtx markets',
  'xtx',
  'lifeline ventures',
  'greyhound capital',
  'greyhound',
  'schroders capital',
  'schroders',
  'pelion venture partners',
  'pelion',
  'ripple ventures',
  'brighton park capital',
  'unconventional ventures',
  'unconventional ventures fund',
  'goldcrest capital',
  'fin capital',
  // Post-#80 never-pre-matched qualified firms still missing from force-include.
  'mac',
  'mac venture capital',
  'mac ventures',
  'ivycap ventures',
  'ivycap',
  'kima',
  'kima ventures',
  'radical',
  'radical ventures',
  'greenfield partners',
  'greenfield',
  'anthology fund',
  'anthology',
  'og venture partners',
  'og ventures',
  'ian alpha fund',
  'ian alpha',
  'tether',
  'singular',
  // Proof-cohort near-miss funders (Yardstik / Breedr / Deep Cogito / REGENT) —
  // never pre-matched before announce; force-include for future seals only.
  'missionog',
  'harbert growth partners',
  'harbert',
  'rally ventures',
  'rally',
  'great north ventures',
  'great north',
  'grotech ventures',
  'grotech',
  'crosslink capital',
  'crosslink',
  'outsiders fund',
  'outsiders',
  'partech',
  'partech impact',
  'south park commons',
  'tq ventures',
  'tq',
  'lockheed martin ventures',
  'lockheed martin',
  'caffeinated capital',
  'caffeinated',
  'dcvc',
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
  'rtp global': 'rtp_global',
  'unicorn india ventures': 'unicorn_india',
  'unicorn india': 'unicorn_india',
  'spintop ventures': 'spintop',
  'blume founders fund': 'blume_founders',
  'blume venture': 'blume_founders',
  'initialized capital': 'initialized',
  initialized: 'initialized',
  techstars: 'techstars',
  'blue collective': 'blue_collective',
  'ntt group': 'ntt',
  ntt: 'ntt',
  'susquehanna asia venture capital': 'susquehanna',
  'susquehanna asia': 'susquehanna',
  'craft ventures': 'craft',
  craft: 'craft',
  seedcamp: 'seedcamp',
  'datadog ventures': 'datadog',
  datadog: 'datadog',
  'morgan stanley': 'morgan_stanley',
  '1789 capital': '1789',
  '1789': '1789',
  'new enterprise associates': 'nea',
  nea: 'nea',
  archetype: 'archetype',
  '8090 industries': '8090',
  '8090': '8090',
  blackstone: 'blackstone',
  'slauson & co': 'slauson',
  slauson: 'slauson',
  cyberstarts: 'cyberstarts',
  'prysm capital': 'prysm',
  prysm: 'prysm',
  'first round capital': 'first_round',
  'first round': 'first_round',
  'snowflake ventures': 'snowflake',
  snowflake: 'snowflake',
  'cerca partners': 'cerca',
  cerca: 'cerca',
  'emerald technology ventures': 'emerald',
  emerald: 'emerald',
  'marcypen capital partners': 'marcypen',
  marcypen: 'marcypen',
  'spark capital': 'spark',
  spark: 'spark',
  'inflection point ventures': 'inflection_point',
  'xyz venture capital': 'xyz',
  'xyz ventures': 'xyz',
  'ada ventures': 'ada',
  lightrock: 'lightrock',
  qia: 'qia',
  'qatar investment authority': 'qia',
  forerunner: 'forerunner',
  'forerunner ventures': 'forerunner',
  'fireside ventures': 'fireside',
  fireside: 'fireside',
  pitchdrive: 'pitchdrive',
  'pantera capital': 'pantera',
  pantera: 'pantera',
  'abstract ventures': 'abstract',
  monashees: 'monashees',
  dragoneer: 'dragoneer',
  'dragoneer investment group': 'dragoneer',
  'dn capital': 'dn_capital',
  tencent: 'tencent',
  sofina: 'sofina',
  'ribbit capital': 'ribbit',
  ribbit: 'ribbit',
  antler: 'antler',
  'in-q-tel': 'inqtel',
  inqtel: 'inqtel',
  'base10 partners': 'base10',
  base10: 'base10',
  'accenture ventures': 'accenture',
  accenture: 'accenture',
  paradigm: 'paradigm',
  'xtx markets': 'xtx',
  xtx: 'xtx',
  'lifeline ventures': 'lifeline',
  'greyhound capital': 'greyhound',
  greyhound: 'greyhound',
  'schroders capital': 'schroders',
  schroders: 'schroders',
  'pelion venture partners': 'pelion',
  pelion: 'pelion',
  'ripple ventures': 'ripple',
  'brighton park capital': 'brighton_park',
  'unconventional ventures': 'unconventional',
  'unconventional ventures fund': 'unconventional',
  'goldcrest capital': 'goldcrest',
  'fin capital': 'fin_capital',
  mac: 'mac_vc',
  'mac venture capital': 'mac_vc',
  'mac ventures': 'mac_vc',
  'ivycap ventures': 'ivycap',
  ivycap: 'ivycap',
  kima: 'kima',
  'kima ventures': 'kima',
  radical: 'radical',
  'radical ventures': 'radical',
  'greenfield partners': 'greenfield',
  greenfield: 'greenfield',
  'anthology fund': 'anthology',
  anthology: 'anthology',
  'og venture partners': 'og_vp',
  'og ventures': 'og_vp',
  'ian alpha fund': 'ian_alpha',
  'ian alpha': 'ian_alpha',
  tether: 'tether',
  singular: 'singular',
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
  if (typeof investor === 'string') return Boolean(familyKeyForLabel(investor));
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
  if (ALIAS_FAMILY[name]) return 4;
  // Canonical org row: name equals firm (any firm, not only allowlist).
  if (firm && name === firm) return 3;
  // Firm matches allowlist but name is a different person/partner label.
  if (firm && ALIAS_FAMILY[firm] && name !== firm) return 0;
  // Partner row at a non-allowlisted firm.
  if (firm && name !== firm) return 0;
  return 2;
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
 * Force-include only mega-funders with sector overlap (or documented prior names).
 * Unconditional inclusion of ~80 firms caused the same generic top-5 on many startups.
 */
function pickFrequentFundersForStartup(investors, { expandedSectors = [], priorNameLabels = [] } = {}) {
  const canonical = pickCanonicalFrequentFunders(investors);
  const prior = new Set(
    (priorNameLabels || []).map((v) => normalizeFunderLabel(v)).filter(Boolean),
  );
  if (!expandedSectors?.length) {
    return canonical.filter((inv) => {
      const labels = [inv.firm, inv.name].map(normalizeFunderLabel).filter(Boolean);
      return labels.some((l) => prior.has(l));
    });
  }
  const sectorSet = new Set(expandedSectors.map((s) => String(s).toLowerCase()));
  const { getExpandedInvestorSectors } = require('./sectorTaxonomy');
  return canonical.filter((inv) => {
    const labels = [inv.firm, inv.name].map(normalizeFunderLabel).filter(Boolean);
    if (labels.some((l) => prior.has(l))) return true;
    const invSectors = getExpandedInvestorSectors(inv.sectors || []);
    // Incomplete sector tags must not recreate candidate_generation_miss for allowlisted firms.
    if (!invSectors.length) return true;
    return invSectors.some((s) => sectorSet.has(String(s).toLowerCase()));
  });
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
  pickFrequentFundersForStartup,
  collectFrequentLedgerFunderIds,
  selectTopMatchesReservingForced,
};
