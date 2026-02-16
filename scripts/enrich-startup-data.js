#!/usr/bin/env node
/**
 * STARTUP DATA ENRICHMENT TOOL
 * ==============================
 * Takes manually-researched startup data from a JSON file and updates the database.
 * Mirrors the investor enrichment workflow but for startup_uploads.
 *
 * USAGE:
 *   1. Add your research to: data/startup-enrichment.json (template below)
 *   2. Run: node scripts/enrich-startup-data.js
 *   3. Optional flags:
 *      --dry-run      Preview changes without writing to DB
 *      --file=PATH    Use a custom JSON file path
 *      --no-rescore   Skip triggering GOD score recalculation
 *      --priority     Generate enrichment priority list (no enrichment)
 *      --top=N        How many to show in priority list (default: 50)
 *
 * JSON FORMAT (data/startup-enrichment.json):
 * [
 *   {
 *     "lookup": "Stripe",                    // REQUIRED: Name to find in DB (fuzzy match)
 *
 *     // TEAM (high impact on GOD score — team_execution weight = 3/17)
 *     "founders": "Patrick Collison, John Collison",
 *     "team_size": 8000,
 *     "has_technical_cofounder": true,
 *     "is_repeat_founder": true,
 *     "previous_exits": 0,
 *     "team_companies": ["MIT", "Auctomatic (acq by Live Current Media)"],
 *
 *     // TRACTION (high impact — traction weight = 3/17)
 *     "has_revenue": true,
 *     "mrr": 100000,                         // Monthly recurring revenue ($)
 *     "arr": 1200000,                         // Annual recurring revenue ($)
 *     "customer_count": 50,
 *     "growth_rate_monthly": 15,              // MoM growth %
 *     "has_customers": true,
 *
 *     // PRODUCT (weight = 2/17)
 *     "is_launched": true,
 *     "has_demo": true,
 *
 *     // MARKET (weight = 2/17 + 1.5 market_insight)
 *     "sectors": ["Fintech", "Payments"],
 *     "stage": "Growth",
 *     "location": "San Francisco, CA",
 *     "tam_estimate": "10B",                 // TAM in shorthand (10B = $10 billion)
 *
 *     // VISION / NARRATIVE (weight = 2/17)
 *     "value_proposition": "Payments infrastructure for the internet",
 *     "problem": "Online payments are too complex",
 *     "solution": "Simple API for payment processing",
 *     "why_now": "E-commerce explosion, API-first development trend",
 *     "contrarian_belief": "Payments should be a developer tool, not a finance product",
 *     "unfair_advantage": "Developer ecosystem moat",
 *
 *     // FUNDRAISING
 *     "raise_amount": "2M",                  // Shorthand: 2M = $2,000,000
 *     "raise_type": "Seed",
 *     "backed_by": ["Y Combinator", "Sequoia Capital"],
 *
 *     // LINKS
 *     "website": "https://stripe.com",
 *     "linkedin": "https://linkedin.com/company/stripe",
 *
 *     // ECOSYSTEM
 *     "advisors": [{"name": "Peter Thiel", "background": "PayPal co-founder", "role": "Advisor"}],
 *     "strategic_partners": [{"name": "Shopify", "type": "integration", "relationship_stage": "revenue_generating"}],
 *
 *     // EXTRA CONTEXT (helps scoring but lower direct weight)
 *     "description": "Stripe builds economic infrastructure for the internet.",
 *     "pitch": "Financial infrastructure platform that enables businesses to accept payments online.",
 *     "tagline": "Payments infrastructure for the internet"
 *   }
 * ]
 *
 * SHORTHAND for amounts:
 *   "raise_amount": "2M"    → 2000000
 *   "tam_estimate": "10B"   → 10000000000
 *   "mrr": "50K"            → 50000
 *
 * ALL FIELDS ARE OPTIONAL except "lookup". Only include what you researched.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const noRescore = args.includes('--no-rescore');
const wantPriority = args.includes('--priority');
const fileArg = args.find(a => a.startsWith('--file='));
const topArg = args.find(a => a.startsWith('--top='));
const topN = topArg ? parseInt(topArg.split('=')[1]) : 50;
const enrichmentFile = fileArg
  ? path.resolve(fileArg.split('=')[1])
  : path.join(process.cwd(), 'data', 'startup-enrichment.json');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// ENRICHABLE FIELDS
// ============================================================================
// Fields that directly influence GOD score are marked with their weight
const ENRICHABLE_FIELDS = {
  // TEAM (team_execution: 3/17, team_age: 1/17)
  founders: 'text',
  team_size: 'number',
  has_technical_cofounder: 'boolean',
  is_repeat_founder: 'boolean',
  previous_exits: 'number',
  team_companies: 'json_array',      // feeds team_signals
  founder_avg_age: 'number',
  founder_youngest_age: 'number',

  // TRACTION (3/17)
  has_revenue: 'boolean',
  mrr: 'number',                     // requires parseAmount
  arr: 'number',                     // requires parseAmount
  revenue: 'number',
  customer_count: 'number',
  growth_rate_monthly: 'number',
  has_customers: 'boolean',
  active_users: 'number',
  retention_rate: 'number',
  churn_rate: 'number',
  nrr: 'number',                     // Net revenue retention %

  // PRODUCT (2/17)
  is_launched: 'boolean',
  has_demo: 'boolean',

  // MARKET (market: 2/17, market_insight: 1.5/17)
  sectors: 'array',
  stage: 'text',
  location: 'text',
  market_size: 'text',               // TAM — stored as text (e.g., "$10B")
  tam_estimate: 'text',              // Alternative TAM field

  // VISION / PRODUCT_VISION (2/17)
  value_proposition: 'text',
  problem: 'text',
  solution: 'text',
  why_now: 'text',
  contrarian_belief: 'text',
  unfair_advantage: 'text',
  vision_statement: 'text',

  // FUNDRAISING
  raise_amount: 'text',
  raise_type: 'text',
  backed_by: 'array',

  // LINKS
  website: 'text',
  linkedin: 'text',
  twitter_url: 'text',

  // NARRATIVE / DESCRIPTION
  description: 'text',
  pitch: 'text',
  tagline: 'text',

  // ECOSYSTEM
  advisors: 'json',                  // Array of {name, background, role}
  strategic_partners: 'json',        // Array of {name, type, relationship_stage}

  // GRIT
  pivots_made: 'number',

  // PSYCHOLOGICAL SIGNALS
  is_oversubscribed: 'boolean',
  oversubscription_multiple: 'number',
  has_followon: 'boolean',
  is_competitive: 'boolean',
  term_sheet_count: 'number',

  // FOUNDER ATTRIBUTES
  founder_courage: 'text',           // low/moderate/high/exceptional
  founder_intelligence: 'text',      // low/moderate/high/exceptional
};

// Fields that require amount parsing (shorthand like "2M", "50K")
const AMOUNT_FIELDS = ['mrr', 'arr', 'revenue', 'raise_amount', 'tam_estimate', 'market_size'];

/**
 * Convert shorthand amounts like "2.25B", "500M", "250K" to numbers
 */
function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return null;

  const match = val.match(/([\d.]+)\s*([BMKbmk])?/);
  if (!match) return null;

  let num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();

  if (suffix === 'B') num *= 1_000_000_000;
  else if (suffix === 'M') num *= 1_000_000;
  else if (suffix === 'K') num *= 1_000;

  return num;
}

function formatAmount(n) {
  if (!n) return 'N/A';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

/**
 * Find startup by name using fuzzy matching
 */
async function findStartup(lookup) {
  // Try exact name match first
  let { data } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status')
    .ilike('name', lookup)
    .limit(1);

  if (data && data.length > 0) return data[0];

  // Try partial name match
  ({ data } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status')
    .ilike('name', `%${lookup}%`)
    .limit(5));

  if (data && data.length === 1) return data[0];
  if (data && data.length > 1) {
    console.log(`   ⚠️  Multiple matches for "${lookup}":`);
    data.forEach(d => console.log(`      - ${d.name} (GOD: ${d.total_god_score}, status: ${d.status})`));
    console.log(`      → Using first match: ${data[0].name}`);
    return data[0];
  }

  // Try description/tagline search as last resort
  ({ data } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status')
    .ilike('tagline', `%${lookup}%`)
    .limit(1));

  if (data && data.length > 0) return data[0];

  return null;
}

/**
 * Build update object from enrichment data
 */
function buildUpdatePayload(enrichment) {
  const update = {};
  const changes = [];

  for (const [key, value] of Object.entries(enrichment)) {
    if (key === 'lookup') continue;
    if (!(key in ENRICHABLE_FIELDS)) {
      console.log(`   ⚠️  Unknown field "${key}" — skipping`);
      continue;
    }

    const fieldType = ENRICHABLE_FIELDS[key];
    let processedValue = value;

    // Parse amount fields
    if (AMOUNT_FIELDS.includes(key) && typeof value === 'string') {
      const parsed = parseAmount(value);
      if (parsed !== null) {
        processedValue = fieldType === 'text' ? value : parsed;
        changes.push(`${key}: ${formatAmount(parsed)}`);
      } else {
        processedValue = value;
        changes.push(`${key}: ${value}`);
      }
    } else if (fieldType === 'number') {
      processedValue = Number(value) || 0;
      changes.push(`${key}: ${processedValue}`);
    } else if (fieldType === 'boolean') {
      processedValue = Boolean(value);
      changes.push(`${key}: ${processedValue}`);
    } else if (fieldType === 'array' || fieldType === 'json_array') {
      if (typeof value === 'string') processedValue = value.split(',').map(s => s.trim());
      changes.push(`${key}: [${(processedValue || []).length} items]`);
    } else if (fieldType === 'json') {
      changes.push(`${key}: [JSON data]`);
    } else {
      const displayVal = typeof value === 'string' && value.length > 60
        ? value.substring(0, 57) + '...'
        : value;
      changes.push(`${key}: ${displayVal}`);
    }

    update[key] = processedValue;
  }

  return { update, changes };
}

/**
 * Enrich a single startup
 */
async function enrichStartup(enrichment, index, total) {
  const lookup = enrichment.lookup;
  if (!lookup) {
    console.log(`\n❌ Entry ${index + 1}/${total}: Missing "lookup" field — skipping`);
    return { success: false, name: 'unknown', reason: 'no lookup' };
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 [${index + 1}/${total}] Looking up: "${lookup}"`);

  // Find startup
  const found = await findStartup(lookup);
  if (!found) {
    console.log(`   ❌ Not found in database`);
    return { success: false, name: lookup, reason: 'not found' };
  }

  console.log(`   ✅ Found: ${found.name} (GOD: ${found.total_god_score}, status: ${found.status})`);
  console.log(`   📈 Current: Team=${found.team_score} Traction=${found.traction_score} Market=${found.market_score} Product=${found.product_score} Vision=${found.vision_score}`);

  // Build update
  const { update, changes } = buildUpdatePayload(enrichment);

  if (Object.keys(update).length === 0) {
    console.log(`   ⚠️  No valid fields to update`);
    return { success: false, name: found.name, reason: 'no valid fields' };
  }

  console.log(`   📝 Changes:`);
  changes.forEach(c => console.log(`      • ${c}`));

  if (isDryRun) {
    console.log(`   🔍 DRY RUN — no changes written`);
    return { success: true, name: found.name, changes: changes.length, dryRun: true };
  }

  // Write to database
  const { error } = await supabase
    .from('startup_uploads')
    .update(update)
    .eq('id', found.id);

  if (error) {
    console.log(`   ❌ Update failed: ${error.message}`);
    // Try raw SQL as fallback
    const setClauses = Object.entries(update).map(([k, v]) => {
      if (v === null || v === undefined) return `${k} = NULL`;
      if (typeof v === 'boolean') return `${k} = ${v}`;
      if (typeof v === 'number') return `${k} = ${v}`;
      if (Array.isArray(v) || typeof v === 'object') return `${k} = '${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
      return `${k} = '${String(v).replace(/'/g, "''")}'`;
    }).join(', ');

    const sql = `UPDATE startup_uploads SET ${setClauses} WHERE id = '${found.id}'`;
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (sqlError) {
      console.log(`   ❌ SQL fallback also failed: ${sqlError.message}`);
      return { success: false, name: found.name, reason: 'update failed' };
    }
    console.log(`   ✅ Updated via SQL fallback`);
  } else {
    console.log(`   ✅ Updated ${changes.length} fields`);
  }

  return { success: true, name: found.name, changes: changes.length, oldScore: found.total_god_score };
}

/**
 * Generate enrichment priority list — startups most likely to benefit from manual research
 */
async function generatePriorityList() {
  console.log('\n📋 Generating startup enrichment priority list...\n');

  // Get all approved startups
  // NOTE: value_proposition, problem, solution may not be visible via PostGREST (stored in extracted_data JSONB)
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status, website, linkedin, description, founders, team_size, has_revenue, mrr, arr, customer_count, sectors, stage, location, raise_amount, raise_type, source_type, created_at')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false });

  if (error || !startups) {
    console.error('Error fetching startups:', error?.message);
    return;
  }

  console.log(`Found ${startups.length} approved startups\n`);

  // Calculate data completeness score for each startup
  const scored = startups.map(s => {
    let dataScore = 0;
    let maxScore = 0;

    // High-impact fields (weight 3)
    const highImpact = ['founders', 'team_size', 'has_revenue', 'description'];
    for (const f of highImpact) {
      maxScore += 3;
      if (s[f] && s[f] !== '' && s[f] !== 0 && s[f] !== false) dataScore += 3;
    }

    // Medium-impact fields (weight 2)
    const medImpact = ['mrr', 'arr', 'customer_count', 'sectors', 'stage', 'location', 'raise_amount', 'website'];
    for (const f of medImpact) {
      maxScore += 2;
      const val = s[f];
      if (val && val !== '' && val !== 0) {
        if (Array.isArray(val) && val.length === 0) continue;
        dataScore += 2;
      }
    }

    // Low-impact fields (weight 1)
    const lowImpact = ['linkedin', 'raise_type', 'description'];
    for (const f of lowImpact) {
      maxScore += 1;
      if (s[f] && s[f] !== '' && s[f] !== 0) dataScore += 1;
    }

    const completeness = maxScore > 0 ? (dataScore / maxScore) * 100 : 0;

    // Priority = potential upside from enrichment
    // Lower completeness = more potential uplift
    // Higher current GOD score = more worth investing time into (already promising)
    // Weight both factors
    const potentialUplift = 100 - completeness;
    const worthiness = Math.min(s.total_god_score || 0, 100);

    // Priority formula: startups that are somewhat good but missing data
    // A startup with GOD=60 and 30% data has more potential than GOD=40 with 30% data
    const priority = (potentialUplift * 0.6) + (worthiness * 0.4);

    return {
      ...s,
      dataScore,
      maxScore,
      completeness: Math.round(completeness),
      priority: Math.round(priority),
    };
  });

  // Sort by priority (highest first — most benefit from enrichment)
  scored.sort((a, b) => b.priority - a.priority);

  // Take top N
  const top = scored.slice(0, topN);

  // Print table
  console.log(`  TOP ${topN} ENRICHMENT PRIORITIES (sorted by expected uplift):\n`);
  console.log(`  ${'#'.padStart(4)}  ${pad('Name', 35)} ${'GOD'.padStart(4)} ${'Data%'.padStart(5)} ${'Prio'.padStart(5)}  ${pad('Missing', 60)}`);
  console.log('  ' + '─'.repeat(120));

  top.forEach((s, i) => {
    const missing = [];
    if (!s.founders) missing.push('founders');
    if (!s.team_size) missing.push('team_size');
    if (!s.has_revenue && !s.mrr && !s.arr) missing.push('revenue');
    if (!s.customer_count) missing.push('customers');
    if (!s.description) missing.push('description');
    if (!s.website) missing.push('website');
    if (!s.sectors || s.sectors.length === 0) missing.push('sectors');
    if (!s.stage) missing.push('stage');
    if (!s.location) missing.push('location');
    if (!s.raise_amount) missing.push('raise');
    if (!s.linkedin) missing.push('linkedin');

    console.log(`  ${(i + 1).toString().padStart(4)}  ${pad(s.name, 35)} ${(s.total_god_score || 0).toString().padStart(4)} ${(s.completeness + '%').padStart(5)} ${s.priority.toString().padStart(5)}  ${missing.join(', ').substring(0, 60)}`);
  });

  // Export to CSV
  const csvPath = path.join(process.cwd(), 'data', 'startup-enrichment-priorities.csv');
  const header = 'Rank,Name,GOD Score,Data Completeness %,Priority,Status,Website,Missing Fields\n';
  const rows = top.map((s, i) => {
    const missing = [];
    if (!s.founders) missing.push('founders');
    if (!s.team_size) missing.push('team_size');
    if (!s.has_revenue && !s.mrr && !s.arr) missing.push('revenue');
    if (!s.customer_count) missing.push('customers');
    if (!s.description) missing.push('description');
    if (!s.website) missing.push('website');
    if (!s.sectors || s.sectors.length === 0) missing.push('sectors');
    if (!s.stage) missing.push('stage');
    if (!s.location) missing.push('location');

    return [
      i + 1,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      s.total_god_score || 0,
      s.completeness,
      s.priority,
      s.status,
      `"${(s.website || '').replace(/"/g, '""')}"`,
      `"${missing.join(', ')}"`,
    ].join(',');
  }).join('\n');

  fs.writeFileSync(csvPath, header + rows);
  console.log(`\n✅ Exported to data/startup-enrichment-priorities.csv`);
}

function pad(s, n) { return (s || '').toString().substring(0, n).padEnd(n); }

/**
 * Main entry point
 */
async function main() {
  if (wantPriority) {
    await generatePriorityList();
    return;
  }

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  STARTUP DATA ENRICHMENT                  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (isDryRun) console.log('🔍 DRY RUN MODE — no changes will be written\n');

  // Read enrichment file
  if (!fs.existsSync(enrichmentFile)) {
    console.log(`❌ Enrichment file not found: ${enrichmentFile}`);
    console.log(`\nCreate it with template:`);
    console.log(`  ${enrichmentFile}`);
    console.log(`\nFormat: array of objects with "lookup" + enrichment fields (see script header for full docs)`);

    // Create template
    const template = [
      {
        lookup: "Example Startup",
        founders: "Jane Doe, John Smith",
        team_size: 5,
        has_technical_cofounder: true,
        has_revenue: true,
        mrr: "10K",
        customer_count: 50,
        sectors: ["AI/ML", "Enterprise"],
        stage: "Seed",
        location: "San Francisco, CA",
        website: "https://example.com",
        value_proposition: "AI-powered analytics for SMBs",
        raise_amount: "2M",
        raise_type: "Seed",
      }
    ];
    const templatePath = path.join(process.cwd(), 'data', 'startup-enrichment.json');
    if (!fs.existsSync(path.dirname(templatePath))) fs.mkdirSync(path.dirname(templatePath), { recursive: true });
    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
    console.log(`\n✅ Template written to: data/startup-enrichment.json`);
    return;
  }

  let enrichments;
  try {
    enrichments = JSON.parse(fs.readFileSync(enrichmentFile, 'utf8'));
    if (!Array.isArray(enrichments)) enrichments = [enrichments];
  } catch (e) {
    console.error(`❌ Failed to parse JSON: ${e.message}`);
    return;
  }

  console.log(`📂 Loaded ${enrichments.length} enrichment entries from ${path.basename(enrichmentFile)}\n`);

  // Process each enrichment
  const results = [];
  for (let i = 0; i < enrichments.length; i++) {
    const result = await enrichStartup(enrichments[i], i, enrichments.length);
    results.push(result);
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`  ✅ Succeeded: ${succeeded.length}`);
  console.log(`  ❌ Failed:    ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\n  Failed entries:`);
    failed.forEach(f => console.log(`    • ${f.name}: ${f.reason}`));
  }

  if (succeeded.length > 0 && !isDryRun) {
    console.log(`\n  Updated startups:`);
    succeeded.forEach(s => console.log(`    • ${s.name}: ${s.changes} fields updated (was GOD: ${s.oldScore})`));
  }

  // Trigger re-score
  if (succeeded.length > 0 && !isDryRun && !noRescore) {
    console.log('\n📊 GOD scores will be recalculated on next PM2 cycle (hourly).');
    console.log('   To recalculate immediately: npx tsx scripts/recalculate-scores.ts');
  }
}

main().catch(console.error);
