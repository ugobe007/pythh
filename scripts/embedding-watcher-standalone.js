#!/usr/bin/env node
/**
 * EMBEDDING WATCHER (Standalone PM2 Process)
 * ===========================================
 * Continuously polls for startups AND investors missing embeddings,
 * then generates them via OpenAI text-embedding-3-small.
 * 
 * Runs as a long-lived PM2 process with 30s polling interval.
 * Rate-limited to avoid OpenAI quota issues.
 * 
 * Usage:
 *   node scripts/embedding-watcher-standalone.js
 *   pm2 start ecosystem.config.js --only embedding-watcher
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Config
const POLL_INTERVAL_MS = 30000;   // 30 seconds between polls
const BATCH_SIZE = 10;            // Process up to 10 records per poll
const RATE_LIMIT_MS = 200;        // 200ms between OpenAI calls (5 req/s)
const MODEL = 'text-embedding-3-small';
const MAX_TEXT_LENGTH = 8000;

let totalGenerated = { startups: 0, investors: 0 };
let errorCount = 0;
const MAX_CONSECUTIVE_ERRORS = 10;

/**
 * Generate embedding via OpenAI API
 */
async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Build embedding text from startup data
 */
function buildStartupText(startup) {
  const ed = startup.extracted_data || {};
  const parts = [
    startup.name,
    startup.tagline || '',
    startup.pitch || '',
    startup.description || '',
    ed.problem || '',
    ed.solution || '',
    ed.industry || '',
    ed.team || '',
  ];
  return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
}

/**
 * Build embedding text from investor data
 */
function buildInvestorText(investor) {
  const parts = [
    investor.name,
    investor.firm || '',
    investor.bio || '',
    investor.investment_thesis || '',
    investor.investment_firm_description || '',
    Array.isArray(investor.sectors) ? investor.sectors.join(', ') : '',
    Array.isArray(investor.stage) ? investor.stage.join(', ') : '',
    investor.focus_areas ? JSON.stringify(investor.focus_areas) : '',
  ];
  return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
}

/**
 * Process missing startup embeddings
 */
async function processStartups() {
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, tagline, pitch, description, extracted_data')
    .is('embedding', null)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('❌ Error fetching startups:', error.message);
    return 0;
  }

  if (!startups || startups.length === 0) return 0;

  let generated = 0;
  for (const startup of startups) {
    try {
      const text = buildStartupText(startup);
      if (text.length < 10) {
        console.log(`  ⏭️  Skipping startup "${startup.name}" — insufficient text (${text.length} chars)`);
        continue;
      }

      const embedding = await generateEmbedding(text);

      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({ embedding })
        .eq('id', startup.id);

      if (updateError) {
        console.error(`  ❌ Failed to save startup embedding for "${startup.name}": ${updateError.message}`);
        continue;
      }

      generated++;
      totalGenerated.startups++;
      console.log(`  ✅ Startup: "${startup.name}" (${embedding.length}-dim)`);

      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      console.error(`  ❌ Startup "${startup.name}": ${err.message}`);
      errorCount++;
    }
  }

  return generated;
}

/**
 * Process missing investor embeddings
 */
async function processInvestors() {
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm, bio, investment_thesis, investment_firm_description, sectors, stage, focus_areas')
    .is('embedding', null)
    .order('investor_score', { ascending: false, nullsFirst: false })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('❌ Error fetching investors:', error.message);
    return 0;
  }

  if (!investors || investors.length === 0) return 0;

  let generated = 0;
  for (const investor of investors) {
    try {
      const text = buildInvestorText(investor);
      if (text.length < 10) {
        console.log(`  ⏭️  Skipping investor "${investor.name}" — insufficient text (${text.length} chars)`);
        continue;
      }

      const embedding = await generateEmbedding(text);

      const { error: updateError } = await supabase
        .from('investors')
        .update({ embedding })
        .eq('id', investor.id);

      if (updateError) {
        console.error(`  ❌ Failed to save investor embedding for "${investor.name}": ${updateError.message}`);
        continue;
      }

      generated++;
      totalGenerated.investors++;
      console.log(`  ✅ Investor: "${investor.name}" (${embedding.length}-dim)`);

      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      console.error(`  ❌ Investor "${investor.name}": ${err.message}`);
      errorCount++;
    }
  }

  return generated;
}

/**
 * Main polling loop
 */
async function poll() {
  try {
    const startupCount = await processStartups();
    const investorCount = await processInvestors();

    if (startupCount > 0 || investorCount > 0) {
      console.log(`📊 Poll complete: ${startupCount} startups, ${investorCount} investors | Total: ${totalGenerated.startups}S + ${totalGenerated.investors}I`);
    }

    // Reset error counter on successful poll
    errorCount = 0;
  } catch (err) {
    console.error('❌ Poll error:', err.message);
    errorCount++;
  }

  if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
    console.error(`💀 Too many consecutive errors (${errorCount}). Exiting for PM2 restart.`);
    process.exit(1);
  }
}

/**
 * Get stats on embedding coverage
 */
async function printStats() {
  const [startupStats, investorStats] = await Promise.all([
    supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('investors').select('id', { count: 'exact', head: true }),
  ]);

  const [startupMissing, investorMissing] = await Promise.all([
    supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').is('embedding', null),
    supabase.from('investors').select('id', { count: 'exact', head: true }).is('embedding', null),
  ]);

  const totalStartups = startupStats.count || 0;
  const missingStartups = startupMissing.count || 0;
  const totalInvestors = investorStats.count || 0;
  const missingInvestors = investorMissing.count || 0;

  console.log('\n📊 EMBEDDING COVERAGE');
  console.log('═'.repeat(40));
  console.log(`  Startups:  ${totalStartups - missingStartups}/${totalStartups} (${missingStartups} missing)`);
  console.log(`  Investors: ${totalInvestors - missingInvestors}/${totalInvestors} (${missingInvestors} missing)`);
  console.log('═'.repeat(40) + '\n');
}

// Main
async function main() {
  console.log('\n👀 EMBEDDING WATCHER started');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Rate limit: ${RATE_LIMIT_MS}ms between calls\n`);

  await printStats();

  // Initial poll
  await poll();

  // Schedule recurring polls
  setInterval(poll, POLL_INTERVAL_MS);

  // Print stats every 10 minutes
  setInterval(printStats, 10 * 60 * 1000);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
