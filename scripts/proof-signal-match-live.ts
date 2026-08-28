/**
 * End-to-end proof: GOD weight rebalance + multi-factor match + force-include.
 * Run: npx tsx scripts/proof-signal-match-live.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import * as scoring from '../server/services/startupScoringService';

const require = createRequire(import.meta.url);
const { calculateMatchScore } = require('../lib/outreachMatch.js');
const {
  isFrequentLedgerFunder,
  pickCanonicalFrequentFunders,
  selectTopMatchesReservingForced,
} = require('../server/lib/frequentLedgerFunders.js');

const { calculateHotScore, GOD_SCORE_CONFIG } = scoring as any;
const W = GOD_SCORE_CONFIG.componentWeights;
const M = GOD_SCORE_CONFIG.componentMaxPoints;

function coreFromBreakdown(b: any) {
  const teamRaw = b.team_execution + b.founder_courage + b.team_age;
  const marketRaw = b.market + b.market_insight;
  const oldCore =
    b.team_execution +
    b.product_vision +
    b.founder_courage +
    b.market_insight +
    b.team_age +
    b.traction +
    b.market +
    b.product;
  const coreBudget = M.team + M.traction + M.market + M.product + M.vision;
  const weightedCore =
    ((Math.min(teamRaw, M.team) / M.team) * W.team +
      (Math.min(b.traction, M.traction) / M.traction) * W.traction +
      (Math.min(marketRaw, M.market) / M.market) * W.market +
      (Math.min(b.product, M.product) / M.product) * W.product +
      (Math.min(b.product_vision, M.vision) / M.vision) * W.vision) *
    coreBudget;
  return {
    oldCore: +oldCore.toFixed(3),
    weightedCore: +weightedCore.toFixed(3),
    delta: +(weightedCore - oldCore).toFixed(3),
  };
}

const tractionProfile = {
  name: 'TractionCo',
  website: 'https://traction.example',
  founders_count: 1,
  technical_cofounders: 0,
  team: [{ name: 'A', role: 'CEO' }],
  revenue: 2000000,
  mrr: 150000,
  active_users: 80000,
  growth_rate: 25,
  customers: 500,
  has_revenue: true,
  has_customers: true,
  launched: true,
  industries: ['SaaS'],
};
const pedigreeProfile = {
  name: 'PedigreeCo',
  website: 'https://pedigree.example',
  founders_count: 3,
  technical_cofounders: 2,
  team: [
    { name: 'A', role: 'CEO', background: 'Ex-Google' },
    { name: 'B', role: 'CTO', background: 'Ex-Meta' },
    { name: 'C', role: 'COO', background: 'Ex-Stripe' },
  ],
  team_companies: ['Google', 'Meta', 'Stripe'],
  founder_courage: 'exceptional',
  vision_statement: 'Contrarian long-horizon thesis with deep insight into category structure',
  pitch: 'A'.repeat(400),
  market_size: 'A'.repeat(80),
  launched: false,
  industries: ['AI/ML'],
};

const tractionScore = calculateHotScore(tractionProfile);
const pedigreeScore = calculateHotScore(pedigreeProfile);
const tractionGod = +(tractionScore.total * 10).toFixed(1);
const pedigreeGod = +(pedigreeScore.total * 10).toFixed(1);

const proofGod = {
  live_componentWeights: W,
  claim: 'traction-heavy outscores pedigree/thesis-only under live weights',
  traction_heavy: {
    god_0_100: tractionGod,
    breakdown: tractionScore.breakdown,
    core_old_vs_weighted: coreFromBreakdown(tractionScore.breakdown),
  },
  pedigree_thin_traction: {
    god_0_100: pedigreeGod,
    breakdown: pedigreeScore.breakdown,
    core_old_vs_weighted: coreFromBreakdown(pedigreeScore.breakdown),
  },
  traction_wins: tractionGod > pedigreeGod,
  margin_points: +(tractionGod - pedigreeGod).toFixed(1),
};

const startupSameGod = {
  name: 'FitCo',
  sectors: ['SaaS', 'Fintech'],
  stage: 'Seed',
  total_god_score: 66,
};
const invSectorFit = {
  name: 'SaaS Seed Fund',
  firm: 'SaaS Seed Fund',
  sectors: ['SaaS', 'Enterprise'],
  stage: ['Seed', 'Series A'],
  investor_score: 66,
  investor_tier: 'strong',
};
const invSectorMiss = {
  name: 'Climate Growth PE',
  firm: 'Climate Growth PE',
  sectors: ['CleanTech', 'Climate'],
  stage: ['Series B', 'Growth'],
  investor_score: 66,
  investor_tier: 'elite',
};
const invLowGodHighFit = {
  name: 'Niche SaaS Angels',
  firm: 'Niche SaaS Angels',
  sectors: ['SaaS', 'Fintech'],
  stage: ['Seed'],
  investor_score: 40,
  investor_tier: 'emerging',
};

const mFit = calculateMatchScore(startupSameGod, invSectorFit, 6, {
  top_themes: ['saas', 'fintech', 'enterprise'],
  avg_conviction: 0.85,
});
const mMiss = calculateMatchScore(startupSameGod, invSectorMiss, 6, {
  top_themes: ['climate', 'energy'],
  avg_conviction: 0.9,
});
const mLowGod = calculateMatchScore(startupSameGod, invLowGodHighFit, 6, {
  top_themes: ['saas', 'fintech'],
  avg_conviction: 0.8,
});

const proofMatch = {
  claim: 'Equal GOD scores do not imply equal match; sector/stage/faith dominate',
  startup_god: 66,
  cases: [
    { label: 'same_god_sector_fit', investor_god: 66, score: mFit.score, fit: mFit.fitAnalysis },
    { label: 'same_god_sector_miss', investor_god: 66, score: mMiss.score, fit: mMiss.fitAnalysis },
    {
      label: 'lower_investor_god_but_sector_fit',
      investor_god: 40,
      score: mLowGod.score,
      fit: mLowGod.fitAnalysis,
    },
  ],
  same_god_scores_differ: mFit.score !== mMiss.score,
  fit_beats_miss_margin: +(mFit.score - mMiss.score).toFixed(1),
  low_god_fit_beats_high_god_miss: mLowGod.score > mMiss.score,
};

async function main() {
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

const targetNames = [
  'Craft Ventures',
  'First Round Capital',
  'New Enterprise Associates',
  'Spark Capital',
  'Paradigm',
  'Seedcamp',
  'Blackstone',
  'Pantera Capital',
  'Susquehanna Asia Venture Capital',
];

const { rows: investors } = await pool.query(
  `SELECT id, name, firm, investor_score, is_individual, entity_gate, status
   FROM investors
   WHERE COALESCE(status,'active') NOT IN ('inactive','rejected','deleted')
     AND (
       lower(coalesce(firm,'')) = ANY($1::text[])
       OR lower(coalesce(name,'')) = ANY($1::text[])
       OR lower(coalesce(firm,'')) LIKE ANY($2::text[])
       OR lower(coalesce(name,'')) LIKE ANY($2::text[])
     )
   LIMIT 200`,
  [
    targetNames.map((n) => n.toLowerCase()),
    [
      '%craft venture%',
      '%first round%',
      '%new enterprise%',
      '%spark capital%',
      '%paradigm%',
      '%seedcamp%',
      '%blackstone%',
      '%pantera%',
      '%susquehanna asia%',
    ],
  ]
);

const aliasChecks = Object.fromEntries(
  targetNames.map((n) => [n, isFrequentLedgerFunder({ name: n, firm: n })])
);

const forced = pickCanonicalFrequentFunders(investors);
const decoys = Array.from({ length: 20 }, (_, i) => ({
  investor_id: `decoy-${i}`,
  name: `Decoy Fund ${i}`,
  firm: `Decoy Fund ${i}`,
  score: 90 - i,
}));
// Sort high→low as the matcher would: decoys first, forced buried at bottom with low scores
const weakForced = forced.map((f: any, i: number) => ({
  investor_id: f.id,
  name: f.name,
  firm: f.firm,
  score: 20 - i,
}));
const mixed = [...decoys, ...weakForced];
const forceIds = weakForced.map((f: any) => f.investor_id);
const selected = selectTopMatchesReservingForced(mixed, forceIds, 10);
const reservedPresent = selected.filter((r: any) => forceIds.includes(r.investor_id));

const { rows: neverRows } = await pool.query(`
  SELECT COALESCE(NULLIF(i.firm,''), i.name) AS firm_label, COUNT(*)::int AS n
  FROM funding_evidence_participants p
  JOIN funding_evidence_events e ON e.id = p.funding_event_id
  JOIN investors i ON i.id = p.investor_id
  JOIN startup_uploads su ON su.id = e.startup_id
  WHERE p.investor_id IS NOT NULL
    AND p.participation_relation IS NOT NULL
    AND p.participant_role IS DISTINCT FROM 'unknown'
    AND COALESCE(i.is_individual, false) = false
    AND COALESCE(i.entity_gate, '') = 'qualified'
    AND COALESCE(su.entity_gate, '') <> 'junk'
    AND NOT EXISTS (
      SELECT 1 FROM startup_investor_matches m
      WHERE m.startup_id = e.startup_id AND m.investor_id = p.investor_id
        AND m.created_at < COALESCE(e.announced_at, e.occurred_at, e.discovered_at)
    )
  GROUP BY 1 ORDER BY n DESC LIMIT 80
`);
const missing = neverRows.filter(
  (r: any) => !isFrequentLedgerFunder({ name: r.firm_label, firm: r.firm_label })
);

await pool.end();

const proofForce = {
  claim: 'new aliases are allowlisted; force-reserve keeps them in top-N even with low scores',
  alias_checks_all_true: Object.values(aliasChecks).every(Boolean),
  alias_checks: aliasChecks,
  db_rows_matched: investors.length,
  canonical_forced_picked: forced.map((f: any) => ({
    id: f.id,
    name: f.name,
    firm: f.firm,
    score: f.investor_score,
  })),
  reservation_sim: {
    topN: 10,
    decoys_scoring_90_to_71: 20,
    forced_with_artificially_low_scores: weakForced.length,
    without_force_top10_would_be_only_decoys: true,
    selected: selected.map((r: any) => ({
      id: r.investor_id,
      name: r.name,
      score: r.score,
      forced: forceIds.includes(r.investor_id),
    })),
    reserved_forced_in_top10: reservedPresent.map((r: any) => r.name || r.firm),
    reserved_count: reservedPresent.length,
    works:
      reservedPresent.length === Math.min(forceIds.length, 10) &&
      reservedPresent.every((r: any) => (r.score as number) <= 20),
  },
  never_pre_matched_top80: {
    total: neverRows.length,
    still_missing_allowlist: missing.length,
    still_missing_sample: missing.slice(0, 8),
  },
};

const report = {
  generated_at: new Date().toISOString(),
  branch: 'cursor/signal-informed-god-b98d',
  verdict: {
    god_weight_rebalance_works: proofGod.traction_wins === true,
    match_not_god_lookup:
      proofMatch.same_god_scores_differ && proofMatch.low_god_fit_beats_high_god_miss,
    force_include_works: proofForce.alias_checks_all_true && proofForce.reservation_sim.works,
  },
  proof_god: proofGod,
  proof_match: proofMatch,
  proof_force_include: proofForce,
};
(report as any).all_proofs_pass = Object.values(report.verdict).every(Boolean);

const out = '/opt/cursor/artifacts/proof-end-to-end.json';
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.error(`\nWrote ${out}`);
if (!(report as any).all_proofs_pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
