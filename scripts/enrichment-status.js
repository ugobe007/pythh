#!/usr/bin/env node
/**
 * Enrichment status & GOD score distribution
 * Run: node scripts/enrichment-status.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbage } = require('./cleanup-garbage');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

function classifyDataRichness(startup) {
  let signalCount = 0;
  if (startup.pitch?.length > 50) signalCount++;
  if (startup.website) signalCount++;
  if (startup.sectors?.length > 0) signalCount++;
  if (startup.stage) signalCount++;
  if (startup.raise_amount) signalCount++;
  if (startup.customer_count || startup.mrr || startup.arr) signalCount++;
  if (startup.team_size) signalCount++;
  if (startup.location) signalCount++;
  if (signalCount >= 8) return { phase: 1, label: 'Data Rich' };
  if (signalCount >= 5) return { phase: 2, label: 'Good Data' };
  if (signalCount >= 2) return { phase: 3, label: 'Medium' };
  return { phase: 4, label: 'Sparse' };
}

function bucket(score) {
  if (score == null) return 'null';
  if (score < 40) return '0-39';
  if (score < 50) return '40-49';
  if (score < 60) return '50-59';
  if (score < 70) return '60-69';
  if (score < 80) return '70-79';
  if (score < 90) return '80-89';
  return '90+';
}

async function main() {
  let all = [];
  const PAGE = 1000;
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, enrichment_status, website, company_website, pitch, sectors, stage, raise_amount, customer_count, mrr, arr, team_size, location')
      .eq('status', 'approved')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }
    all = all.concat(data);
    if (data.length < PAGE) break;
    page++;
  }

  const total = all.length;

  // GOD score distribution
  const dist = {};
  all.forEach(s => {
    const b = bucket(s.total_god_score);
    dist[b] = (dist[b] || 0) + 1;
  });

  const buckets = ['null', '0-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90+'];
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  GOD SCORE DISTRIBUTION (approved startups)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Total approved: ${total}\n`);
  buckets.forEach(b => {
    const n = dist[b] || 0;
    const pct = total ? ((n / total) * 100).toFixed(1) : 0;
    const bar = '█'.repeat(Math.round(n / total * 40)) + '░'.repeat(40 - Math.round(n / total * 40));
    console.log(`  ${String(b).padEnd(8)} ${String(n).padStart(6)} (${String(pct).padStart(5)}%) ${bar}`);
  });

  // Need enrichment: phase >= 2, score < 70, status in waiting/null/holding
  const pendingPool = all.filter(s => {
    const status = s.enrichment_status || 'null';
    const okStatus = ['waiting', 'holding'].includes(status) || status === null;
    const { phase } = classifyDataRichness(s);
    return okStatus && phase >= 2 && (s.total_god_score ?? 0) < 70;
  });

  const garbageCount = pendingPool.filter(s => isGarbage(s.name)).length;
  const needEnrichment = pendingPool.length - garbageCount;  // exclude garbage we'll skip

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ENRICHMENT BACKLOG');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`  Pending (status: waiting/null/holding, phase≥2, score<70): ${pendingPool.length}`);
  console.log(`  Garbage (will skip): ${garbageCount}`);
  console.log(`  To enrich: ${needEnrichment}`);
  console.log('\n  With --include-holding: same pool (holding included above)');
  console.log('  With --html-only: URL inferred from name when missing\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
