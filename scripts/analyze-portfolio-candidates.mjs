/**
 * Analyze portfolio candidates for curation
 * Understand data shape and identify best picks
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Known large/public companies to exclude
const KNOWN_LARGE_COMPANIES = new Set([
  'bloomberg', 'bingx', 'binance', 'coinbase', 'stripe', 'shopify', 'salesforce',
  'microsoft', 'google', 'apple', 'amazon', 'meta', 'netflix', 'uber', 'airbnb',
  'twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'snapchat',
  'openai', 'anthropic', 'deepmind', 'palantir', 'snowflake', 'databricks',
  'robinhood', 'chime', 'plaid', 'brex', 'ramp', 'mercury',
  'notion', 'figma', 'canva', 'slack', 'zoom', 'dropbox', 'box',
  'twilio', 'sendgrid', 'segment', 'amplitude', 'mixpanel',
  'doordash', 'instacart', 'lyft', 'grab', 'gojek',
  'revolut', 'monzo', 'wise', 'n26', 'nubank',
  'airtable', 'asana', 'clickup', 'monday', 'linear',
  'vercel', 'netlify', 'heroku', 'render',
]);

function isKnownLargeCompany(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  for (const known of KNOWN_LARGE_COMPANIES) {
    if (lower.includes(known)) return true;
  }
  return false;
}

function isActualStartup(row) {
  // Must have a reasonable stage (not Series C or beyond)
  const stageStr = String(row.stage || '').toLowerCase();
  if (stageStr.includes('series c') || stageStr.includes('series d') || 
      stageStr.includes('series e') || stageStr.includes('ipo') ||
      stageStr.includes('public') || stageStr === '5' || stageStr === '6') {
    return false;
  }
  // Exclude very large valuations (>$500M = likely not a startup pick)
  if (row.valuation_usd && row.valuation_usd > 500_000_000) return false;
  return true;
}

async function run() {
  const { data: all, error } = await supabase
    .from('startup_uploads')
    .select('id, name, stage, sectors, total_god_score, team_score, traction_score, market_score, product_score, vision_score, valuation_usd, website, tagline')
    .eq('status', 'approved')
    .gte('total_god_score', 65)
    .order('total_god_score', { ascending: false });

  if (error) { console.error(error); process.exit(1); }
  console.log(`Total approved GOD≥65: ${all.length}`);

  // Filter to real startups
  const candidates = all.filter(r => !isKnownLargeCompany(r.name) && isActualStartup(r));
  console.log(`After filtering known/large companies: ${candidates.length}`);

  // Show sector distribution
  const sectorCounts = {};
  for (const c of candidates) {
    for (const s of (c.sectors || ['Unknown'])) {
      sectorCounts[s] = (sectorCounts[s] || 0) + 1;
    }
  }
  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  console.log('\nTop sectors:');
  topSectors.forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  // Show top 20 candidates
  console.log('\nTop 20 candidates:');
  candidates.slice(0, 20).forEach(r => {
    console.log(`  [GOD:${r.total_god_score} team:${r.team_score} prod:${r.product_score} traction:${r.traction_score}] ${r.name} | stage:${r.stage} | ${(r.sectors||[]).join(',')} | ${r.tagline?.slice(0,60)}`);
  });

  // Score quality: GOD + team + product + traction weighted
  const scored = candidates.map(r => ({
    ...r,
    quality: (
      (r.total_god_score || 0) * 0.4 +
      (r.team_score || 0) * 0.25 +
      (r.product_score || 0) * 0.2 +
      (r.traction_score || 0) * 0.15
    )
  })).sort((a, b) => b.quality - a.quality);

  console.log('\nTop 20 by quality score:');
  scored.slice(0, 20).forEach(r => {
    console.log(`  [Q:${r.quality.toFixed(1)} GOD:${r.total_god_score}] ${r.name} | ${(r.sectors||[]).slice(0,2).join(',')} | ${r.tagline?.slice(0,50)}`);
  });
}

run().catch(console.error);
