#!/usr/bin/env node
/**
 * TARGETED ENRICHMENT PIPELINE — BACHELOR-TIER STARTUPS
 * ========================================================
 * Focuses AI enrichment on the ~3,200 C-Sparse "Bachelors" (GOD 45-59)
 * who have SOME data but are missing the PhD-differentiating fields.
 *
 * WHY THIS MATTERS:
 *   - 93.5% of PhDs have MRR/customer data vs 0% of Bachelors
 *   - The gap is often data availability, not startup quality
 *   - Enriching these fields lets the existing GOD scorer work fairly
 *
 * TARGET FIELDS (highest value for score differentiation):
 *   1. MRR / revenue / ARR
 *   2. customer_count / active_users
 *   3. growth_rate
 *   4. has_technical_cofounder
 *   5. founders_count / team_size
 *   6. is_launched / has_demo
 *   7. funding_amount / funding_stage
 *
 * USAGE:
 *   node scripts/enrich-bachelors.js                  # Dry run (shows what would be enriched)
 *   node scripts/enrich-bachelors.js --run             # Run enrichment
 *   node scripts/enrich-bachelors.js --run --limit=50  # Limit to 50 startups
 *   node scripts/enrich-bachelors.js --run --tier=freshman  # Target Freshman tier instead
 *   node scripts/enrich-bachelors.js --run --all-sparse     # All sparse startups (Bachelors + Freshman)
 *
 * SAFE: Does NOT modify scores. Only populates extracted_data JSONB.
 *       Score changes happen on next recalculate-scores.ts run.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const BATCH_SIZE = 5;        // Concurrent API calls per batch
const BATCH_DELAY_MS = 2000; // Delay between batches (rate limiting)
const DEFAULT_LIMIT = 100;   // Default batch size if not specified

// Fields we consider "high-value" for score differentiation
const HIGH_VALUE_FIELDS = [
  'mrr', 'revenue', 'arr',
  'customer_count', 'customers', 'active_users',
  'growth_rate',
  'has_technical_cofounder', 'technical_cofounders',
  'founders_count', 'team_size',
  'is_launched', 'has_demo',
  'funding_amount', 'funding_stage',
  'market_size',
  'nps_score',
];

// Degree tier boundaries
const TIERS = {
  phd:       { min: 80, max: 100, label: 'PhD (80+)' },
  masters:   { min: 60, max: 79,  label: 'Masters (60-79)' },
  bachelors: { min: 45, max: 59,  label: 'Bachelors (45-59)' },
  freshman:  { min: 40, max: 44,  label: 'Freshman (40-44)' },
};

// ═══════════════════════════════════════════════════════════════════════════
// DATA ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Count how many high-value fields are missing for a startup
 */
function getMissingHighValueFields(startup) {
  const ext = startup.extracted_data || {};
  const missing = [];
  
  // MRR/Revenue
  if (!startup.mrr && !ext.mrr && !startup.arr && !ext.arr && !ext.revenue) {
    missing.push('mrr/revenue');
  }
  
  // Customers
  if (!startup.customer_count && !ext.customer_count && !ext.customers && !ext.active_users) {
    missing.push('customers');
  }
  
  // Growth rate
  if (!startup.growth_rate_monthly && !ext.growth_rate) {
    missing.push('growth_rate');
  }
  
  // Technical cofounder
  if (startup.has_technical_cofounder === null && !ext.has_technical_cofounder && !ext.technical_cofounders) {
    missing.push('has_technical_cofounder');
  }
  
  // Team size
  if (!startup.team_size && !ext.founders_count && !ext.team_size) {
    missing.push('team_size');
  }
  
  // Launched / Demo
  if (!startup.is_launched && !ext.is_launched && !ext.launched) {
    missing.push('is_launched');
  }
  if (!startup.has_demo && !ext.has_demo && !ext.demo_available) {
    missing.push('has_demo');
  }
  
  // Funding
  if (!startup.latest_funding_amount && !ext.funding_amount) {
    missing.push('funding');
  }
  
  // Market size (not a direct column, only in extracted_data)
  if (!ext.market_size) {
    missing.push('market_size');
  }
  
  return missing;
}

/**
 * Check if a startup has enough context for AI to infer anything
 */
function hasEnoughContext(startup) {
  const hasName = !!startup.name;
  const hasDesc = (startup.description && startup.description.length > 20) ||
                  (startup.pitch && startup.pitch.length > 20) ||
                  (startup.tagline && startup.tagline.length > 10);
  return hasName && hasDesc;
}

/**
 * Check if existing extracted_data already covers the high-value fields
 */
function alreadyEnriched(startup) {
  const ext = startup.extracted_data || {};
  // Consider "already enriched" if we have at least 3 high-value fields populated
  let populated = 0;
  if (ext.mrr || ext.revenue || ext.arr) populated++;
  if (ext.customer_count || ext.customers || ext.active_users) populated++;
  if (ext.growth_rate) populated++;
  if (ext.has_technical_cofounder !== undefined || ext.technical_cofounders !== undefined) populated++;
  if (ext.is_launched !== undefined || ext.launched !== undefined) populated++;
  if (ext.funding_amount) populated++;
  if (ext.market_size) populated++;
  return populated >= 3;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI ENRICHMENT (targeted prompt for score-relevant data)
// ═══════════════════════════════════════════════════════════════════════════

async function inferHighValueData(startup) {
  if (!anthropic) {
    console.warn('⚠️  Anthropic API key not found — skipping AI inference');
    return null;
  }

  // Build context from all available fields
  const ext = startup.extracted_data || {};
  const context = [
    `Company: ${startup.name}`,
    startup.tagline ? `Tagline: ${startup.tagline}` : '',
    startup.description ? `Description: ${startup.description}` : '',
    startup.pitch ? `Pitch: ${startup.pitch}` : '',
    startup.website ? `Website: ${startup.website}` : '',
    startup.sectors?.length > 0 ? `Sectors: ${startup.sectors.join(', ')}` : '',
    ext.problem ? `Problem: ${ext.problem}` : '',
    ext.solution ? `Solution: ${ext.solution}` : '',
    ext.value_proposition ? `Value Prop: ${ext.value_proposition}` : '',
  ].filter(Boolean).join('\n');

  // Find what's missing
  const missing = getMissingHighValueFields(startup);

  const prompt = `You are a startup data analyst. Analyze this startup and extract ONLY the specific missing data fields listed below. Be conservative — only extract data you can reasonably infer from the context.

STARTUP CONTEXT:
${context}

MISSING FIELDS TO FILL (extract these ONLY):
${missing.map(f => `- ${f}`).join('\n')}

INSTRUCTIONS:
- If the text mentions "10K users" → extract active_users: 10000
- If it says "raised $5M seed" → extract funding_amount: 5000000, funding_stage: "Seed"  
- If it mentions MRR, revenue, ARR numbers → extract those
- If it mentions a team, founders, CTO → extract founders_count, has_technical_cofounder
- If it says "launched" or links a live product → is_launched: true
- If there's a demo link or "try it" → has_demo: true
- For growth_rate: only if explicitly stated (e.g., "15% MoM growth")
- For market_size: only if TAM/SAM is mentioned (e.g., "$10B market")
- DO NOT HALLUCINATE. Use null for anything you cannot reasonably infer.
- Return JSON only, no markdown.

Return JSON:
{
  "mrr": null or number (USD monthly),
  "revenue": null or number (USD annual),
  "arr": null or number (USD annual),
  "customer_count": null or number,
  "active_users": null or number,
  "growth_rate": null or number (monthly % e.g. 15 for 15%),
  "has_technical_cofounder": null or boolean,
  "founders_count": null or number,
  "is_launched": null or boolean,
  "has_demo": null or boolean,
  "funding_amount": null or number (USD),
  "funding_stage": null or string,
  "market_size": null or string or number,
  "nps_score": null or number
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = message.content[0];
    if (content.type !== 'text') return null;

    // Parse JSON response
    let parsed = {};
    try {
      parsed = JSON.parse(content.text);
    } catch {
      const jsonMatch = content.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = content.text.match(/\{[\s\S]*\}/);
        if (objectMatch) parsed = JSON.parse(objectMatch[0]);
      }
    }

    // Clean: remove nulls and undefined, normalize booleans
    const result = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== null && value !== undefined) {
        result[key] = value;
        // Also add normalized aliases the scorer expects
        if (key === 'has_technical_cofounder') {
          result.technical_cofounders = value ? 1 : 0;
        }
        if (key === 'is_launched') {
          result.launched = value;
        }
        if (key === 'has_demo') {
          result.demo_available = value;
        }
        if (key === 'customer_count') {
          result.customers = value;
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error(`   ❌ AI inference failed for ${startup.name}:`, error.message || error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : DEFAULT_LIMIT;
  const allSparse = args.includes('--all-sparse');
  const tierArg = args.find(a => a.startsWith('--tier='));
  const targetTier = tierArg ? tierArg.split('=')[1].toLowerCase() : 'bachelors';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TARGETED ENRICHMENT — BACHELOR-TIER STARTUPS');
  console.log(`  Mode: ${dryRun ? '🔍 DRY RUN (add --run to execute)' : '🚀 LIVE ENRICHMENT'}`);
  console.log(`  Target: ${allSparse ? 'All sparse (Bachelors + Freshman)' : TIERS[targetTier]?.label || targetTier}`);
  console.log(`  Limit: ${limit}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!anthropic && !dryRun) {
    console.error('❌ ANTHROPIC_API_KEY not set in .env — cannot run enrichment');
    process.exit(1);
  }

  // ── Step 1: Load all approved startups in the target tier(s) ──
  console.log('📊 Loading startups...');

  let allStartups = [];
  let page = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, tagline, description, pitch, website, sectors, extracted_data, mrr, arr, customer_count, growth_rate_monthly, has_technical_cofounder, team_size, founder_avg_age, is_launched, has_demo, latest_funding_amount, latest_funding_round, nps_score, created_at, updated_at')
      .eq('status', 'approved')
      .range(page * PS, (page + 1) * PS - 1);
    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    if (data.length < PS) break;
    page++;
  }

  // Filter to target tier(s)
  let targets;
  if (allSparse) {
    targets = allStartups.filter(s => s.total_god_score < 60);
  } else {
    const tier = TIERS[targetTier];
    if (!tier) {
      console.error(`❌ Unknown tier: ${targetTier}. Use: phd, masters, bachelors, freshman`);
      process.exit(1);
    }
    targets = allStartups.filter(s => s.total_god_score >= tier.min && s.total_god_score <= tier.max);
  }

  console.log(`   Total approved: ${allStartups.length}`);
  console.log(`   In target tier: ${targets.length}\n`);

  // ── Step 2: Analyze what's missing ──
  console.log('🔍 Analyzing missing fields...\n');

  const candidates = [];
  const skippedNoContext = [];
  const skippedAlreadyEnriched = [];
  const skippedNoMissing = [];

  for (const s of targets) {
    const missing = getMissingHighValueFields(s);
    
    if (missing.length === 0) {
      skippedNoMissing.push(s);
      continue;
    }
    
    if (alreadyEnriched(s)) {
      skippedAlreadyEnriched.push(s);
      continue;
    }
    
    if (!hasEnoughContext(s)) {
      skippedNoContext.push(s);
      continue;
    }
    
    candidates.push({ startup: s, missing, missingCount: missing.length });
  }

  // Sort: most missing fields first (highest enrichment potential)
  candidates.sort((a, b) => b.missingCount - a.missingCount);

  // ── Step 3: Report ──
  console.log('📋 ENRICHMENT CANDIDATES:');
  console.log(`   ✅ Ready to enrich:    ${candidates.length}`);
  console.log(`   ⏭️  Already enriched:  ${skippedAlreadyEnriched.length}`);
  console.log(`   ⚠️  No context (name only): ${skippedNoContext.length}`);
  console.log(`   ✓  No missing fields:  ${skippedNoMissing.length}`);
  console.log();

  // Missing field frequency
  const fieldFreq = {};
  for (const c of candidates) {
    for (const f of c.missing) {
      fieldFreq[f] = (fieldFreq[f] || 0) + 1;
    }
  }

  console.log('📊 MOST COMMONLY MISSING FIELDS:');
  const sortedFields = Object.entries(fieldFreq).sort((a, b) => b[1] - a[1]);
  for (const [field, count] of sortedFields) {
    const pct = ((count / candidates.length) * 100).toFixed(1);
    console.log(`   ${field}: ${count} (${pct}%)`);
  }
  console.log();

  // Top 10 candidates preview
  console.log('📋 TOP 10 ENRICHMENT CANDIDATES:');
  const preview = candidates.slice(0, 10);
  for (const c of preview) {
    console.log(`   GOD ${c.startup.total_god_score} | ${c.startup.name} | Missing: ${c.missing.join(', ')}`);
  }
  if (candidates.length > 10) {
    console.log(`   ... and ${candidates.length - 10} more\n`);
  }

  if (dryRun) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  DRY RUN COMPLETE — No changes made.');
    console.log('  To run enrichment: node scripts/enrich-bachelors.js --run');
    console.log('═══════════════════════════════════════════════════════════════');
    return;
  }

  // ── Step 4: Run enrichment ──
  const toProcess = candidates.slice(0, limit);
  console.log(`\n🚀 ENRICHING ${toProcess.length} startups (batch size: ${BATCH_SIZE})...\n`);

  let enriched = 0;
  let noData = 0;
  let errors = 0;
  let fieldsPopulated = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);
    
    console.log(`  📦 Batch ${batchNum}/${totalBatches}...`);

    const results = await Promise.all(
      batch.map(async ({ startup, missing }) => {
        try {
          const inferred = await inferHighValueData(startup);
          
          if (!inferred || Object.keys(inferred).length === 0) {
            console.log(`     ⚠️  ${startup.name} — No data inferred`);
            return { status: 'nodata', startup };
          }

          // Merge with existing extracted_data (preserve existing, add new)
          const existingData = startup.extracted_data || {};
          const mergedData = { ...existingData };

          // Only add new fields that don't already exist
          let newFields = 0;
          for (const [key, value] of Object.entries(inferred)) {
            if (existingData[key] === undefined || existingData[key] === null) {
              mergedData[key] = value;
              newFields++;
            }
          }

          if (newFields === 0) {
            console.log(`     ⏭️  ${startup.name} — All inferred fields already exist`);
            return { status: 'nodata', startup };
          }

          // Write to database
          const { error: updateError } = await supabase
            .from('startup_uploads')
            .update({
              extracted_data: mergedData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', startup.id);

          if (updateError) {
            console.error(`     ❌ ${startup.name} — DB error: ${updateError.message}`);
            return { status: 'error', startup };
          }

          console.log(`     ✅ ${startup.name} — +${newFields} fields (${Object.keys(inferred).filter(k => !['technical_cofounders','launched','demo_available','customers'].includes(k)).join(', ')})`);
          return { status: 'enriched', startup, newFields };
        } catch (err) {
          console.error(`     ❌ ${startup.name} — Error: ${err.message}`);
          return { status: 'error', startup };
        }
      })
    );

    // Tally
    for (const r of results) {
      if (r.status === 'enriched') { enriched++; fieldsPopulated += r.newFields; }
      else if (r.status === 'nodata') noData++;
      else errors++;
    }

    // Rate limiting
    if (i + BATCH_SIZE < toProcess.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // ── Step 5: Summary ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ENRICHMENT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   ✅ Enriched:        ${enriched}`);
  console.log(`   📊 Fields added:    ${fieldsPopulated}`);
  console.log(`   ⚠️  No data found:  ${noData}`);
  console.log(`   ❌ Errors:          ${errors}`);
  console.log(`   📊 Total processed: ${toProcess.length}`);
  console.log();
  console.log('  NEXT STEP: Run score recalculation to update GOD scores:');
  console.log('    npx tsx scripts/recalculate-scores.ts');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
