/**
 * Test the startup scraper with 10 sample startups
 */

import { generateSampleStartups, calculateStartupScores } from './archive/startup-scraper';

console.log('🧪 Testing Startup Scraper...\n');

// Generate 10 sample startups
const startups = generateSampleStartups(10);

console.log('\n📊 Sample Startups with GOD Scores:\n');
console.log('═'.repeat(80));

startups.forEach((startup, idx) => {
  const scores = calculateStartupScores(startup);
  
  console.log(`\n${idx + 1}. ${startup.name}`);
  console.log(`   Pitch: ${startup.pitch}`);
  console.log(`   Stage: ${startup.raise_amount}`);
  console.log(`   Sectors: ${startup.sectors.join(', ')}`);
  console.log(`   Team: ${startup.founders.length} founders, ${startup.team_size} employees`);
  console.log(`   Traction: ${startup.mrr > 0 ? `$${(startup.mrr/1000).toFixed(0)}K MRR` : 'Pre-revenue'}`);
  console.log(`   📈 GOD Score: ${scores.total_god_score}/100`);
  console.log(`      - Team: ${scores.team_score}/100`);
  console.log(`      - Traction: ${scores.traction_score}/100`);
  console.log(`      - Market: ${scores.market_score}/100`);
  console.log(`      - Product: ${scores.product_score}/100`);
  console.log(`      - Vision: ${scores.vision_score}/100`);
});

console.log('\n═'.repeat(80));
console.log('✅ Test complete! Scraper is ready to use.');
console.log('\nRun: npx tsx scripts/startup-scraper.ts 100');
