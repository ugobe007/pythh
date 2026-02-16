#!/usr/bin/env node
/**
 * INVESTOR DATA ENRICHMENT TOOL
 * ==============================
 * Takes manually-researched investor data from a JSON file and updates the database.
 * Automatically re-scores investors after update.
 * 
 * USAGE:
 *   1. Add your research to: data/investor-enrichment.json (template below)
 *   2. Run: node scripts/enrich-investor-data.js
 *   3. Optional flags:
 *      --dry-run     Preview changes without writing to DB
 *      --file=PATH   Use a custom JSON file path
 *      --rescore     Re-calculate investor scores after update (default: true)
 * 
 * JSON FORMAT (data/investor-enrichment.json):
 * [
 *   {
 *     "lookup": "Sequoia Capital",         // REQUIRED: Name OR firm to find in DB (fuzzy match)
 *     "active_fund_size": 2250000000,      // Fund size in dollars (e.g., $2.25B)
 *     "total_investments": 1500,           // Number of portfolio companies
 *     "successful_exits": 300,             // IPOs + acquisitions
 *     "investment_thesis": "We help the daring build legendary companies.",
 *     "sectors": ["AI/ML", "Enterprise", "Fintech", "Healthcare", "Consumer"],
 *     "stage": ["Seed", "Series A", "Series B", "Growth"],
 *     "check_size_min": 500000,            // Min check in dollars
 *     "check_size_max": 100000000,         // Max check in dollars
 *     "geography_focus": ["US", "India", "Southeast Asia", "Europe"],
 *     "bio": "Founded in 1972, Sequoia Capital is one of the most successful VC firms...",
 *     "notable_investments": ["Apple", "Google", "Stripe", "Airbnb", "WhatsApp"],
 *     "portfolio_companies": ["Stripe", "DoorDash", "Instacart"],
 *     "leads_rounds": true,
 *     "url": "https://www.sequoiacap.com",
 *     "linkedin_url": "https://linkedin.com/company/sequoia-capital",
 *     "blog_url": "https://www.sequoiacap.com/article/",
 *     "partners": ["Roelof Botha", "Alfred Lin", "Pat Grady"],
 *     "portfolio_performance": "Top-decile returns across all vintages"
 *   }
 * ]
 * 
 * SHORTHAND for fund sizes:
 *   "active_fund_size": "2.25B"   → converts to 2250000000
 *   "active_fund_size": "500M"    → converts to 500000000
 *   "active_fund_size": "50M"     → converts to 50000000
 *   "check_size_min": "250K"      → converts to 250000
 * 
 * ENRICHABLE FIELDS (all optional — only include what you found):
 *   active_fund_size      - Fund AUM in dollars
 *   total_investments     - Number of deals done
 *   successful_exits      - IPOs + acquisitions
 *   investment_thesis     - Their stated investment thesis
 *   sectors               - Array of sectors they invest in
 *   stage                 - Array of stages (Seed, Series A, etc.)
 *   check_size_min        - Minimum check size in dollars
 *   check_size_max        - Maximum check size in dollars
 *   geography_focus       - Array of geographies
 *   bio                   - Firm/person description
 *   notable_investments   - Array of well-known companies invested in
 *   portfolio_companies   - Array of current portfolio companies
 *   leads_rounds          - true/false — do they lead rounds?
 *   url                   - Website URL
 *   linkedin_url          - LinkedIn URL
 *   blog_url              - Blog/newsletter URL
 *   twitter_url           - Twitter/X URL
 *   partners              - Array of partner names
 *   portfolio_performance - Text description of track record
 *   type                  - "VC", "Angel", "PE", "CVC", "Family Office"
 *   firm                  - Firm name (to correct/add)
 *   name                  - Individual name (to correct)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { runInferencePipeline, formatAmount: inferenceFormatAmount } = require('./fund-size-inference');

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const noRescore = args.includes('--no-rescore');
const fileArg = args.find(a => a.startsWith('--file='));
const enrichmentFile = fileArg
  ? path.resolve(fileArg.split('=')[1])
  : path.join(process.cwd(), 'data', 'investor-enrichment.json');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fields we can update
const UPDATABLE_FIELDS = [
  'active_fund_size', 'total_investments', 'successful_exits',
  'investment_thesis', 'sectors', 'stage', 'check_size_min', 'check_size_max',
  'geography_focus', 'bio', 'notable_investments', 'portfolio_companies',
  'leads_rounds', 'url', 'linkedin_url', 'blog_url', 'twitter_url',
  'partners', 'portfolio_performance', 'type', 'firm', 'name',
  // Inference engine fields (can also be manually supplied)
  'capital_type', 'fund_size_estimate_usd', 'fund_size_confidence',
  'estimation_method', 'capital_power_score',
];

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
 * Find investor by name/firm using fuzzy matching
 */
async function findInvestor(lookup) {
  // Try exact name match first
  let { data } = await supabase
    .from('investors')
    .select('id, name, firm, investor_score, investor_tier')
    .ilike('name', lookup)
    .limit(1);
  
  if (data && data.length > 0) return data[0];
  
  // Try exact firm match
  ({ data } = await supabase
    .from('investors')
    .select('id, name, firm, investor_score, investor_tier')
    .ilike('firm', lookup)
    .limit(1));
  
  if (data && data.length > 0) return data[0];
  
  // Try partial name match
  ({ data } = await supabase
    .from('investors')
    .select('id, name, firm, investor_score, investor_tier')
    .ilike('name', `%${lookup}%`)
    .limit(5));
  
  if (data && data.length === 1) return data[0];
  if (data && data.length > 1) {
    console.log(`   ⚠️  Multiple matches for "${lookup}":`);
    data.forEach(d => console.log(`      - ${d.name} (${d.firm || 'no firm'})`));
    console.log(`      → Using first match: ${data[0].name}`);
    return data[0];
  }
  
  // Try partial firm match
  ({ data } = await supabase
    .from('investors')
    .select('id, name, firm, investor_score, investor_tier')
    .ilike('firm', `%${lookup}%`)
    .limit(5));
  
  if (data && data.length === 1) return data[0];
  if (data && data.length > 1) {
    console.log(`   ⚠️  Multiple matches for "${lookup}":`);
    data.forEach(d => console.log(`      - ${d.name} (${d.firm || 'no firm'})`));
    console.log(`      → Using first match: ${data[0].name}`);
    return data[0];
  }
  
  return null;
}

/**
 * Calculate new investor score using the same algorithm as investorScoringService.ts
 */
function calculateInvestorScore(investor) {
  const signals = [];
  
  // PROFILE COMPLETENESS (0-3)
  let profileScore = 0;
  const bio = investor.bio || '';
  if (bio.length > 200) { profileScore += 0.8; signals.push('Detailed bio'); }
  else if (bio.length > 50) { profileScore += 0.5; }
  else if (bio.length > 0) { profileScore += 0.2; }
  
  if (investor.name && investor.firm) profileScore += 0.4;
  else if (investor.name || investor.firm) profileScore += 0.2;
  
  const geos = investor.geography_focus || [];
  if (geos.length >= 1) profileScore += 0.5;
  
  const thesis = investor.investment_thesis || '';
  if (thesis.length > 200) { profileScore += 0.8; signals.push('Deep investment thesis'); }
  else if (thesis.length > 50) { profileScore += 0.5; }
  else if (thesis.length > 0) { profileScore += 0.2; }
  
  let socialCount = 0;
  if (investor.linkedin_url) socialCount++;
  if (investor.twitter_url) socialCount++;
  if (investor.is_verified) socialCount++;
  profileScore += Math.min(socialCount * 0.25, 0.5);
  profileScore = Math.min(profileScore, 3);
  
  // INVESTMENT FOCUS (0-3)
  let focusScore = 0;
  const sectors = investor.sectors || [];
  if (sectors.length >= 1 && sectors.length <= 3) focusScore += 1.2;
  else if (sectors.length <= 6) focusScore += 0.9;
  else if (sectors.length > 6) focusScore += 0.5;
  
  const stages = investor.stage || [];
  if (stages.length >= 1 && stages.length <= 2) focusScore += 1.0;
  else if (stages.length <= 4) focusScore += 0.7;
  else if (stages.length > 0) focusScore += 0.4;
  
  const invType = investor.type || '';
  if (invType === 'VC' || invType === 'vc') focusScore += 0.6;
  else if (invType === 'Angel' || invType === 'angel') focusScore += 0.5;
  else if (['PE', 'CVC', 'Family Office'].includes(invType)) focusScore += 0.4;
  else if (invType) focusScore += 0.3;
  focusScore = Math.min(focusScore, 3);
  
  // CAPITAL READINESS (0-2)
  let capitalScore = 0;
  const minCheck = investor.check_size_min || 0;
  const maxCheck = investor.check_size_max || 0;
  if (minCheck > 0 && maxCheck > 0) capitalScore += 0.8;
  else if (minCheck > 0 || maxCheck > 0) capitalScore += 0.4;
  
  const fundSize = investor.active_fund_size || 0;
  if (fundSize >= 500_000_000) capitalScore += 0.7;
  else if (fundSize >= 100_000_000) capitalScore += 0.6;
  else if (fundSize >= 20_000_000) capitalScore += 0.4;
  else if (fundSize > 0) capitalScore += 0.2;
  
  if (investor.leads_rounds) capitalScore += 0.5;
  else if (investor.follows_rounds) capitalScore += 0.2;
  capitalScore = Math.min(capitalScore, 2);
  
  // TRACK RECORD (0-2)
  let trackScore = 0;
  const investments = investor.total_investments || 0;
  if (investments >= 100) trackScore += 1.0;
  else if (investments >= 50) trackScore += 0.8;
  else if (investments >= 20) trackScore += 0.6;
  else if (investments >= 5) trackScore += 0.3;
  
  const exits = investor.successful_exits || 0;
  if (exits >= 10) trackScore += 1.0;
  else if (exits >= 5) trackScore += 0.6;
  else if (exits >= 1) trackScore += 0.3;
  trackScore = Math.min(trackScore, 2);
  
  const total = Math.min(profileScore + focusScore + capitalScore + trackScore, 10);
  
  let tier;
  if (total >= 7) tier = 'elite';
  else if (total >= 5) tier = 'strong';
  else if (total >= 3) tier = 'solid';
  else tier = 'emerging';
  
  return {
    total: Math.round(total * 10) / 10,
    tier,
    breakdown: {
      profile_completeness: Math.round(profileScore * 10) / 10,
      investment_focus: Math.round(focusScore * 10) / 10,
      capital_readiness: Math.round(capitalScore * 10) / 10,
      track_record: Math.round(trackScore * 10) / 10,
    },
    signals,
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  INVESTOR DATA ENRICHMENT TOOL           ║');
  console.log('╚══════════════════════════════════════════╝\n');
  
  if (isDryRun) console.log('🔍 DRY RUN MODE — no database changes will be made\n');
  
  // Load enrichment data
  if (!fs.existsSync(enrichmentFile)) {
    console.log(`❌ Enrichment file not found: ${enrichmentFile}`);
    console.log(`\n📝 Creating template at data/investor-enrichment.json...\n`);
    
    const templateDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });
    
    const template = [
      {
        "_comment": "TEMPLATE — Replace with your research. Only include fields you found.",
        "lookup": "Sequoia Capital",
        "active_fund_size": "2.25B",
        "total_investments": 1500,
        "successful_exits": 300,
        "investment_thesis": "We help the daring build legendary companies from idea to IPO and beyond.",
        "sectors": ["AI/ML", "Enterprise", "Fintech", "Healthcare", "Consumer"],
        "stage": ["Seed", "Series A", "Series B", "Growth"],
        "check_size_min": "500K",
        "check_size_max": "100M",
        "geography_focus": ["US", "India", "Southeast Asia", "Europe"],
        "notable_investments": ["Apple", "Google", "Stripe", "Airbnb", "WhatsApp"],
        "leads_rounds": true,
        "url": "https://www.sequoiacap.com",
        "bio": "Founded in 1972 by Don Valentine..."
      }
    ];
    
    fs.writeFileSync(
      path.join(templateDir, 'investor-enrichment.json'),
      JSON.stringify(template, null, 2)
    );
    console.log('✅ Template created! Edit data/investor-enrichment.json and run again.\n');
    
    // Also generate priority list
    await generatePriorityList();
    return;
  }
  
  let enrichments;
  try {
    const raw = fs.readFileSync(enrichmentFile, 'utf8');
    enrichments = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ Failed to parse ${enrichmentFile}: ${e.message}`);
    return;
  }
  
  // Filter out template/comment-only entries
  enrichments = enrichments.filter(e => e.lookup && !e._comment);
  
  if (enrichments.length === 0) {
    console.log('⚠️  No enrichment entries found (template entries are ignored).');
    console.log('   Edit data/investor-enrichment.json with real investor data.\n');
    return;
  }
  
  console.log(`📦 Loaded ${enrichments.length} investor enrichment entries\n`);
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  let scoreChanges = [];
  
  for (const entry of enrichments) {
    const lookup = entry.lookup;
    console.log(`\n━━━ ${lookup} ━━━`);
    
    // Find investor in DB
    const investor = await findInvestor(lookup);
    if (!investor) {
      console.log(`   ❌ NOT FOUND in database`);
      notFound++;
      continue;
    }
    
    console.log(`   ✓ Found: ${investor.name} (${investor.firm || 'no firm'}) — current score: ${investor.investor_score}/10 [${investor.investor_tier}]`);
    
    // Build update object
    const updateData = {};
    const changes = [];
    
    for (const field of UPDATABLE_FIELDS) {
      if (entry[field] === undefined) continue;
      
      let value = entry[field];
      
      // Convert shorthand amounts
      if (['active_fund_size', 'check_size_min', 'check_size_max'].includes(field)) {
        value = parseAmount(value);
        if (value === null) continue;
      }
      
      updateData[field] = value;
      
      // Format for display
      if (['active_fund_size', 'check_size_min', 'check_size_max'].includes(field)) {
        changes.push(`   📝 ${field}: ${formatAmount(value)}`);
      } else if (Array.isArray(value)) {
        changes.push(`   📝 ${field}: [${value.slice(0, 4).join(', ')}${value.length > 4 ? '...' : ''}]`);
      } else if (typeof value === 'string' && value.length > 60) {
        changes.push(`   📝 ${field}: "${value.substring(0, 57)}..."`);
      } else {
        changes.push(`   📝 ${field}: ${value}`);
      }
    }
    
    if (changes.length === 0) {
      console.log('   ⚠️  No updatable fields found');
      continue;
    }
    
    changes.forEach(c => console.log(c));
    
    // Add metadata
    updateData.last_enrichment_date = new Date().toISOString();
    
    if (isDryRun) {
      // Calculate projected new score
      const { data: fullInvestor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor.id)
        .single();
      
      const merged = { ...fullInvestor, ...updateData };
      const newScore = calculateInvestorScore(merged);
      const oldScore = investor.investor_score || 0;
      const delta = newScore.total - oldScore;
      
      console.log(`   📊 Score: ${oldScore} → ${newScore.total} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}) [${newScore.tier}]`);
      console.log(`      Breakdown: profile=${newScore.breakdown.profile_completeness}, focus=${newScore.breakdown.investment_focus}, capital=${newScore.breakdown.capital_readiness}, track=${newScore.breakdown.track_record}`);
      
      scoreChanges.push({ name: lookup, old: oldScore, new: newScore.total, delta, tier: newScore.tier });
      updated++;
    } else {
      // Actually update
      const { error } = await supabase
        .from('investors')
        .update(updateData)
        .eq('id', investor.id);
      
      if (error) {
        console.log(`   ❌ Update failed: ${error.message}`);
        errors++;
        continue;
      }
      
      // Re-score if enabled
      if (!noRescore) {
        const { data: fullInvestor } = await supabase
          .from('investors')
          .select('*')
          .eq('id', investor.id)
          .single();
        
        const newScore = calculateInvestorScore(fullInvestor);
        const oldScore = investor.investor_score || 0;
        const delta = newScore.total - oldScore;
        
        // Run fund size inference pipeline on the updated investor
        const inference = runInferencePipeline(fullInvestor);
        
        const scoreUpdateData = {
          investor_score: newScore.total,
          investor_tier: newScore.tier,
          score_breakdown: newScore.breakdown,
          score_signals: newScore.signals,
          last_scored_at: new Date().toISOString(),
        };
        
        const { error: scoreError } = await supabase
          .from('investors')
          .update(scoreUpdateData)
          .eq('id', investor.id);
        
        // Write inference fields via raw SQL (bypasses PostGREST schema cache)
        const fundSizeVal = inference.fund_size_estimate_usd ? inference.fund_size_estimate_usd : 'NULL';
        const esc = (s) => (s || '').replace(/'/g, "''");
        const inferSql = `UPDATE investors SET 
          capital_type = '${esc(inference.capital_type)}',
          fund_size_estimate_usd = ${fundSizeVal},
          fund_size_confidence = ${inference.fund_size_confidence || 0},
          estimation_method = '${esc(inference.estimation_method)}',
          capital_power_score = ${inference.capital_power_score}
        WHERE id = '${investor.id}'`;
        await supabase.rpc('exec_sql', { sql_query: inferSql });
        
        if (scoreError) {
          console.log(`   ⚠️  Score update failed: ${scoreError.message}`);
        } else {
          const cpLabel = inference.capital_power_score > 0 ? ` ⚡${inference.capital_power_score.toFixed(1)}` : '';
          const typeLabel = inference.capital_type !== 'single_fund' ? ` [${inference.capital_type}]` : '';
          const confLabel = inference.fund_size_confidence < 1 && inference.fund_size_estimate_usd ? ` ~${(inference.fund_size_confidence * 100).toFixed(0)}%` : '';
          console.log(`   ✅ Updated + re-scored: ${oldScore} → ${newScore.total} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}) [${newScore.tier}]${typeLabel}${cpLabel}${confLabel}`);
          scoreChanges.push({ name: lookup, old: oldScore, new: newScore.total, delta, tier: newScore.tier, capitalPower: inference.capital_power_score, capitalType: inference.capital_type });
        }
      } else {
        console.log(`   ✅ Updated (scoring skipped)`);
      }
      
      updated++;
    }
  }
  
  // Summary
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  SUMMARY${isDryRun ? ' (DRY RUN)' : ''}                              ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Updated:   ${updated}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);
  
  if (scoreChanges.length > 0) {
    const avgDelta = scoreChanges.reduce((a, b) => a + b.delta, 0) / scoreChanges.length;
    console.log(`\n  Score Impact:`);
    console.log(`  Avg change: ${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(2)} points`);
    scoreChanges.sort((a, b) => b.delta - a.delta);
    console.log(`  Biggest gain: ${scoreChanges[0].name} (+${scoreChanges[0].delta.toFixed(1)})`);
    if (scoreChanges[scoreChanges.length - 1].delta < scoreChanges[0].delta) {
      console.log(`  Smallest gain: ${scoreChanges[scoreChanges.length - 1].name} (+${scoreChanges[scoreChanges.length - 1].delta.toFixed(1)})`);
    }
  }
  
  console.log('');
}

/**
 * Generate a priority list of investors that would benefit most from enrichment
 */
async function generatePriorityList() {
  console.log('📋 Generating priority enrichment list...\n');
  
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm, investor_score, investor_tier, type, sectors, stage, check_size_min, check_size_max, active_fund_size, total_investments, successful_exits, bio, investment_thesis, leads_rounds, geography_focus, notable_investments')
    .order('investor_score', { ascending: true });
  
  if (error) { console.error('Error:', error); return; }
  
  // Calculate what's missing for each investor and potential score gain
  const priorities = investors.map(inv => {
    const missing = [];
    let potentialGain = 0;
    
    if (!inv.active_fund_size) { missing.push('fund_size'); potentialGain += 0.7; }
    if (!inv.total_investments) { missing.push('total_investments'); potentialGain += 1.0; }
    if (!inv.successful_exits) { missing.push('exits'); potentialGain += 1.0; }
    if (!inv.investment_thesis || inv.investment_thesis.length < 50) { missing.push('thesis'); potentialGain += 0.8; }
    if (!inv.bio || inv.bio.length < 50) { missing.push('bio'); potentialGain += 0.8; }
    if (!inv.sectors || inv.sectors.length === 0) { missing.push('sectors'); potentialGain += 1.2; }
    if (!inv.check_size_min) { missing.push('check_size'); potentialGain += 0.8; }
    if (!inv.geography_focus || inv.geography_focus.length === 0) { missing.push('geography'); potentialGain += 0.5; }
    if (!inv.notable_investments || inv.notable_investments.length === 0) { missing.push('notable_investments'); potentialGain += 0.3; }
    
    return {
      name: inv.name,
      firm: inv.firm,
      current_score: inv.investor_score,
      tier: inv.investor_tier,
      type: inv.type,
      missing,
      potentialGain: Math.min(potentialGain, 4), // Cap at 4-point potential
      missingCount: missing.length,
    };
  });
  
  // Sort by potential gain (highest first), then by investor type (VCs first)
  priorities.sort((a, b) => {
    // Prioritize VCs over angels and others
    const typeOrder = { VC: 0, Angel: 1, PE: 2, CVC: 3 };
    const aType = typeOrder[a.type] ?? 4;
    const bType = typeOrder[b.type] ?? 4;
    if (aType !== bType) return aType - bType;
    return b.potentialGain - a.potentialGain;
  });
  
  // Show top 30 priority investors
  console.log('━━━ TOP 30 PRIORITY INVESTORS FOR ENRICHMENT ━━━\n');
  console.log('These investors would benefit most from your research:\n');
  
  const top = priorities.slice(0, 30);
  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    console.log(`${(i + 1).toString().padStart(2)}. ${(p.name || 'Unknown').padEnd(35)} Score: ${(p.current_score || 0).toString().padStart(3)}/10  [${(p.tier || '?').padEnd(8)}]  Type: ${(p.type || '?').padEnd(6)}  Potential: +${p.potentialGain.toFixed(1)}`);
    console.log(`    Missing: ${p.missing.join(', ')}`);
  }
  
  // Export to CSV for easy reference
  const csvDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });
  
  const csvPath = path.join(csvDir, 'investor-enrichment-priorities.csv');
  const csvHeader = 'Priority,Name,Firm,Current Score,Tier,Type,Potential Gain,Missing Fields\n';
  const csvRows = priorities.slice(0, 100).map((p, i) => 
    `${i + 1},"${(p.name || '').replace(/"/g, '""')}","${(p.firm || '').replace(/"/g, '""')}",${p.current_score || 0},${p.tier || ''},${p.type || ''},+${p.potentialGain.toFixed(1)},"${p.missing.join(', ')}"`
  ).join('\n');
  
  fs.writeFileSync(csvPath, csvHeader + csvRows);
  console.log(`\n✅ Full priority list (top 100) exported to: data/investor-enrichment-priorities.csv`);
  
  // Summary stats
  const vcCount = priorities.filter(p => p.type === 'VC').length;
  const missingFundSize = priorities.filter(p => p.missing.includes('fund_size')).length;
  const missingTrackRecord = priorities.filter(p => p.missing.includes('total_investments')).length;
  
  console.log(`\n📊 Enrichment opportunity:`);
  console.log(`   ${missingFundSize} investors missing fund size`);
  console.log(`   ${missingTrackRecord} investors missing track record`);
  console.log(`   ${vcCount} total VCs in database`);
  console.log(`   Enriching top 30 could improve avg investor score by ~0.5-1.5 points`);
}

main().catch(console.error);
