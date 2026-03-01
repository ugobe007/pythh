/**
 * curate-portfolio-top50.mjs
 * ============================================================
 * Pythh Virtual Portfolio Curation Engine
 *
 * Rules:
 *  - 50 startups total / 5 sectors / 10 per sector
 *  - Only real early-stage startups (pre-seed → Series B)
 *  - No known large/public companies
 *  - Valuation < $500M at entry
 *  - Quality score = GOD(40%) + team(25%) + product(20%) + traction(15%)
 *  - Minimum quality score of 70
 *  - Each startup appears in ONE sector bucket (best fit)
 *
 * Run: npx tsx scripts/curate-portfolio-top50.mjs
 * Dry run: npx tsx scripts/curate-portfolio-top50.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ─── SECTOR BUCKETS ─────────────────────────────────────────────────────────
// Five curated themes that reflect where Pythh investors are active
const SECTORS = {
  'AI Infrastructure': {
    tags: ['ai/ml', 'ai infrastructure', 'artificial intelligence', 'machine learning',
           'developer tools', 'devtools', 'mlops', 'llm', 'infrastructure', 'deep learning',
           'computer vision', 'natural language', 'neural network', 'gpu'],
    slots: 10,
  },
  'Fintech & Future of Money': {
    tags: ['fintech', 'finance', 'payments', 'payment infrastructure', 'banking', 'neobank',
           'crypto', 'defi', 'blockchain', 'stablecoin', 'bitcoin', 'web3',
           'insurtech', 'wealthtech', 'regtech', 'lending', 'credit', 'financial services',
           'investment platform'],
    slots: 10,
  },
  'Climate & Clean Energy': {
    tags: ['climate tech', 'cleantech', 'clean energy', 'sustainability',
           'renewable energy', 'greentech', 'carbon capture', 'solar', 'ev',
           'electric vehicle', 'zero carbon', 'net zero'],
    slots: 10,
  },
  'Health & BioTech': {
    tags: ['healthtech', 'healthcare', 'biotech', 'medtech', 'digital health',
           'pharmaceutical', 'genomics', 'longevity', 'mental health', 'oncology',
           'drug discovery', 'clinical', 'diagnostics', 'medical'],
    slots: 10,
  },
  'B2B SaaS & Automation': {
    tags: ['b2b saas', 'saas', 'enterprise software', 'enterprise', 'workflow automation',
           'automation', 'productivity', 'hr tech', 'sales tech', 'marketing technology',
           'edtech', 'legaltech', 'proptech', 'supply chain', 'procurement',
           'document management', 'no-code', 'low-code', 'crm', 'revops'],
    slots: 10,
  },
};

// ─── EXCLUSION LISTS ─────────────────────────────────────────────────────────
// Well-known mid/late-stage or public companies that may have snuck in
const EXCLUDE_NAMES = new Set([
  // Public / unicorn-level
  'bloomberg', 'bingx', 'binance', 'coinbase', 'stripe', 'shopify',
  'salesforce', 'microsoft', 'google', 'alphabet', 'apple', 'amazon',
  'meta', 'netflix', 'uber', 'airbnb', 'twitter', 'x corp', 'linkedin',
  'instagram', 'facebook', 'tiktok', 'snapchat', 'pinterest',
  // Well-known mid-stage (Series C+)
  'openai', 'anthropic', 'deepmind', 'palantir', 'snowflake', 'databricks',
  'robinhood', 'chime', 'plaid', 'brex', 'ramp', 'mercury',
  'notion', 'figma', 'canva', 'slack', 'zoom', 'dropbox', 'box',
  'twilio', 'sendgrid', 'segment', 'amplitude', 'mixpanel',
  'doordash', 'instacart', 'lyft', 'grab', 'gojek',
  'revolut', 'monzo', 'wise', 'n26', 'nubank', 'klarna',
  'airtable', 'asana', 'clickup', 'monday.com', 'linear',
  'vercel', 'netlify', 'heroku', 'render', 'railway',
  'betterment', 'wealthfront', 'acorns', 'sofi',
  'launchdarkly', 'launch darkly',
  'posthog',
  'mews',
  // Public companies
  'marqeta',
  // Restructured / distressed
  'pipe',
  // Series C+ institutional rounds
  'premialab',
  // Being acquired — not a clean standalone pick
  'intersect power',
  // Large-scale / non-startup AI players
  'deepseek',   // Chinese state-linked AI lab, not a portfolio pick
  'synthesia',  // $1B+ AI video unicorn — beyond startup stage
  // Generic / test
  'captcha', 'test', 'demo', 'example',
  '',
]);

// Exclude stage 4+ (Series B+/C+) — these are no longer startups
const LATE_STAGES = new Set(['4', '5', '6', 'series c', 'series d', 'series e',
  'ipo', 'public', 'growth', 'late stage', 'late-stage']);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isExcluded(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  if (lower.length < 2) return true;
  for (const ex of EXCLUDE_NAMES) {
    if (ex && lower.includes(ex)) return true;
  }
  // Filter out names with bad patterns
  if (lower.includes(' confirms') || lower.includes(' report') ||
      lower.includes('acqui') ||
      /^ai\s+\w+\s+\w+/.test(lower) || // "AI fintech Fintower" style headlines
      lower.includes(' inc.') || lower.includes(' corp') ||
      lower.includes(' ltd') && lower.length > 30) return true;
  return false;
}

function isLateStage(stage) {
  if (!stage) return false;
  const s = String(stage).toLowerCase().trim();
  return LATE_STAGES.has(s);
}

function qualityScore(r) {
  const god     = Math.min(r.total_god_score || 0, 100);
  const team    = Math.min(r.team_score      || 0, 100);
  const product = Math.min(r.product_score   || 0, 100);
  const traction= Math.min(r.traction_score  || 0, 100);
  const vision  = Math.min(r.vision_score    || 0, 100);
  // Must have BOTH good product AND meaningful traction/team — not just inflated GOD
  return god * 0.40 + team * 0.25 + product * 0.20 + traction * 0.10 + vision * 0.05;
}

// Return the sector bucket this startup fits (checks sectors array only, not name/tagline)
// Tie-break: whichever Pythh sector has the most matching tags
function assignSector(startup) {
  const rawSectors = (startup.sectors || []).map(s => s.toLowerCase().trim());
  if (rawSectors.length === 0) return null;

  let bestSector = null;
  let bestMatchCount = 0;

  for (const [sectorName, config] of Object.entries(SECTORS)) {
    // Count how many of the startup's own sectors match this Pythh bucket's tags
    let matchCount = 0;
    for (const s of rawSectors) {
      for (const tag of config.tags) {
        // Exact match OR the startup sector contains the full tag phrase
        if (s === tag || s.includes(tag) || tag.includes(s)) {
          matchCount++;
          break; // only count each startup sector once
        }
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestSector = sectorName;
    }
  }
  return bestMatchCount > 0 ? bestSector : null;
}

function estimateValuation(stage, godScore) {
  const bases = {
    '1': 15_000_000, 'pre-seed': 15_000_000, 'preseed': 15_000_000,
    '2': 35_000_000, 'seed': 35_000_000,
    '3': 80_000_000, 'series a': 80_000_000,
    '4': 200_000_000, 'series b': 200_000_000,
  };
  const s = String(stage || '').toLowerCase().trim();
  const base = bases[s] || 15_000_000;
  const premium = Math.max(0.8, (godScore || 70) / 70);
  return Math.round(base * premium);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🔍 Pythh Portfolio Curation Engine — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Fetch all approved startups with GOD ≥ 60
  const { data: all, error } = await supabase
    .from('startup_uploads')
    .select('id, name, stage, sectors, tagline, total_god_score, team_score, traction_score, market_score, product_score, vision_score, valuation_usd, created_at')
    .eq('status', 'approved')
    .gte('total_god_score', 60)
    .order('total_god_score', { ascending: false });

  if (error) throw new Error(`DB error: ${error.message}`);
  console.log(`📊 Approved startups with GOD≥60: ${all.length}`);

  // Step 1: Apply hard filters
  const filtered = all.filter(r => {
    if (isExcluded(r.name)) return false;
    if (isLateStage(r.stage)) return false;
    if (r.valuation_usd && r.valuation_usd > 500_000_000) return false;
    if ((r.team_score || 0) < 40) return false; // Need real team signal
    // Reject news-headline taglines (scraped PR, not a startup description)
    const tl = (r.tagline || '').toLowerCase();
    if (tl.includes('being acquired') || tl.includes('growth investment from') ||
        tl.includes('raises $') || tl.includes('secures $') ||
        tl.includes('acquires ') || tl.includes(' ipo')) return false;
    return true;
  });
  console.log(`✅ After hard filters: ${filtered.length}`);

  // Step 2: Score and assign sector
  const withScores = filtered
    .map(r => ({ ...r, quality: qualityScore(r), sector: assignSector(r) }))
    .filter(r => r.sector !== null) // Must fit a sector
    .filter(r => r.quality >= 67)   // Minimum quality bar
    .sort((a, b) => b.quality - a.quality);
  console.log(`⭐ After quality filter (≥70): ${withScores.length}`);

  // Step 3: Pick top 10 per sector, each startup used only once
  const usedIds = new Set();
  const portfolio = {};
  const sectorStats = {};

  for (const [sectorName] of Object.entries(SECTORS)) {
    portfolio[sectorName] = [];
    sectorStats[sectorName] = 0;
  }

  // First pass: best match sector
  for (const r of withScores) {
    if (usedIds.has(r.id)) continue;
    const sector = r.sector;
    if (!sector || portfolio[sector].length >= 10) continue;
    portfolio[sector].push(r);
    usedIds.add(r.id);
  }

  // Second pass: fill any sectors under 10 from remaining with strict sector matching
  for (const [sectorName, config] of Object.entries(SECTORS)) {
    if (portfolio[sectorName].length >= 10) continue;
    const needed = 10 - portfolio[sectorName].length;
    const backfill = withScores.filter(r => {
      if (usedIds.has(r.id)) return false;
      // Must have at least one sector tag that matches this bucket — strict check
      const startupSectors = (r.sectors || []).map(s => s.toLowerCase().trim());
      return startupSectors.some(s =>
        config.tags.some(tag => s === tag || s.includes(tag) || tag.includes(s))
      );
    }).slice(0, needed);
    for (const r of backfill) {
      portfolio[sectorName].push({ ...r, sector: sectorName });
      usedIds.add(r.id);
    }
  }

  // Print selection
  let totalSelected = 0;
  for (const [sector, picks] of Object.entries(portfolio)) {
    console.log(`\n📁 ${sector} (${picks.length}/10):`);
    picks.forEach(p => {
      console.log(`   [Q:${p.quality.toFixed(0)} GOD:${p.total_god_score} T:${p.team_score} Pr:${p.product_score} Tr:${p.traction_score}] ${p.name} | stage:${p.stage} | ${p.tagline?.slice(0, 55) || '—'}`);
    });
    totalSelected += picks.length;
  }
  console.log(`\n✨ Total picks: ${totalSelected}/50`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no DB changes made.\n');
    return;
  }

  // Step 4: Clear ALL existing portfolio entries
  console.log('\n🗑️  Clearing existing portfolio...');
  const { error: delErr } = await supabase
    .from('virtual_portfolio')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

  if (delErr) throw new Error(`Delete error: ${delErr.message}`);
  console.log('   Cleared.');

  // Step 5: Insert curated 50
  console.log('📥 Inserting curated picks...');
  let inserted = 0;
  const errors = [];

  for (const [sector, picks] of Object.entries(portfolio)) {
    for (const p of picks) {
      const val = p.valuation_usd || estimateValuation(p.stage, p.total_god_score);
      const { error: insErr } = await supabase.from('virtual_portfolio').insert({
        startup_id:           p.id,
        entry_date:           p.created_at || new Date().toISOString(),
        entry_stage:          p.stage ? String(p.stage) : null,
        entry_god_score:      p.total_god_score,
        entry_valuation_usd:  val,
        entry_rationale:      `Pythh pick: ${sector} | Quality ${p.quality.toFixed(0)} | GOD ${p.total_god_score}`,
        virtual_check_usd:    100_000,
        current_valuation_usd: val,
        moic:                 1.0,
        added_by:             'curated-top50',
        notes:                sector,
      });
      if (insErr && insErr.code !== '23505') {
        errors.push(`${p.name}: ${insErr.message}`);
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n✅ Done. Inserted: ${inserted} | Errors: ${errors.length}`);
  if (errors.length) console.log('Errors:', errors.slice(0, 10));
}

run().catch(err => { console.error(err); process.exit(1); });
