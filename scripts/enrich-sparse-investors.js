#!/usr/bin/env node
/**
 * INVESTOR ENRICHMENT - News Inference Engine
 * ============================================================================
 * 
 * Parallel to enrich-sparse-startups.js, this script enriches sparse investor
 * profiles by correlating their name/firm with Google News RSS.
 * 
 * Targets investors missing: sectors, stage, check_size, portfolio_companies
 * 
 * Run: node scripts/enrich-sparse-investors.js [--limit=50]
 * Run all: node scripts/enrich-sparse-investors.js --limit=5000
 * Test mode: node scripts/enrich-sparse-investors.js --limit=5 --dry-run
 * ============================================================================
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { searchInvestorNews, extractInvestorDataFromArticles } = require('../server/services/investorInferenceService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
const DRY_RUN = args.includes('--dry-run');

// ── Sparseness classifier ──
function isInvestorSparse(investor) {
  let missingCount = 0;
  if (!investor.sectors || investor.sectors.length === 0) missingCount++;
  if (!investor.stage || investor.stage.length === 0) missingCount++;
  if (!investor.check_size_min && !investor.check_size_max) missingCount++;
  if (!investor.portfolio_companies || investor.portfolio_companies.length === 0) missingCount++;
  if (!investor.investment_thesis && !investor.bio) missingCount++;
  return missingCount >= 2; // Sparse if 2+ key fields missing
}

async function enrichSparseInvestors() {
  console.log('=== INVESTOR ENRICHMENT — News Inference Engine ===\n');
  console.log(`Strategy: Search news for investor/firm name to fill sparse profiles`);
  if (DRY_RUN) console.log('DRY RUN MODE — no database writes\n');
  console.log(`Processing up to ${LIMIT} investors\n`);

  // ── Load sparse investors — filter in SQL to avoid scanning well-populated records ──
  console.log('Loading sparse investors...');
  const { data: allInvestors, error } = await supabase
    .from('investors')
    .select('id, name, firm, sectors, stage, check_size_min, check_size_max, portfolio_companies, investment_thesis, bio, geography_focus, linkedin_url, last_enrichment_date')
    // Target investors missing at least one of: check_size, bio/thesis, sectors
    .or('check_size_min.is.null,investment_thesis.is.null,bio.is.null')
    .order('created_at', { ascending: false })  // Newest first — these tend to be less complete
    .limit(LIMIT * 5);  // Cast wider net since we filter client-side

  if (error) {
    console.error('Failed to load investors:', error.message);
    process.exit(1);
  }

  const sparse = (allInvestors || []).filter(isInvestorSparse).slice(0, LIMIT);
  console.log(`Found ${sparse.length} sparse investors (missing 2+ key fields)\n`);

  if (sparse.length === 0) {
    console.log('All investors have sufficient data!');
    return;
  }

  let enriched = 0;
  let noData = 0;
  let errors = 0;

  for (let i = 0; i < sparse.length; i++) {
    const investor = sparse[i];
    const label = `${investor.name}${investor.firm ? ` (${investor.firm})` : ''}`;
    console.log(`\n[${i + 1}/${sparse.length}] ${label}`);

    // Show what's missing
    const missing = [];
    if (!investor.sectors?.length) missing.push('sectors');
    if (!investor.stage?.length) missing.push('stage');
    if (!investor.check_size_min) missing.push('check_size');
    if (!investor.portfolio_companies?.length) missing.push('portfolio');
    if (!investor.investment_thesis && !investor.bio) missing.push('thesis/bio');
    console.log(`  Missing: ${missing.join(', ')}`);

    try {
      const articles = await searchInvestorNews(investor.name, investor.firm);

      if (articles.length === 0) {
        console.log('  No articles found');
        noData++;
        continue;
      }

      console.log(`  Found ${articles.length} articles`);
      const { enrichedData, enrichmentCount } = extractInvestorDataFromArticles(articles, investor);

      if (enrichmentCount === 0) {
        console.log('  Articles found but no new data extracted');
        noData++;
        continue;
      }

      // Build update payload — only override empty fields
      const update = {};
      if (enrichedData.sectors?.length && (!investor.sectors?.length)) {
        update.sectors = enrichedData.sectors;
        console.log(`  Sectors: ${enrichedData.sectors.join(', ')}`);
      }
      if (enrichedData.stage?.length && (!investor.stage?.length)) {
        update.stage = enrichedData.stage;
        console.log(`  Stage: ${enrichedData.stage.join(', ')}`);
      }
      if (enrichedData.check_size_min && !investor.check_size_min) {
        update.check_size_min = enrichedData.check_size_min;
        update.check_size_max = enrichedData.check_size_max;
        console.log(`  Check size: $${(enrichedData.check_size_min / 1e6).toFixed(1)}M - $${(enrichedData.check_size_max / 1e6).toFixed(1)}M`);
      }
      if (enrichedData.portfolio_companies?.length && (!investor.portfolio_companies?.length)) {
        update.portfolio_companies = enrichedData.portfolio_companies;
        console.log(`  Portfolio: ${enrichedData.portfolio_companies.slice(0, 3).join(', ')}${enrichedData.portfolio_companies.length > 3 ? '...' : ''}`);
      }
      if (enrichedData.geography_focus?.length && (!investor.geography_focus?.length)) {
        update.geography_focus = enrichedData.geography_focus;
        console.log(`  Geography: ${enrichedData.geography_focus.join(', ')}`);
      }
      if (enrichedData.inferred_bio && !investor.bio && !investor.investment_thesis) {
        // Store inferred bio in investment_thesis field (closest match) with a marker
        update.investment_thesis = `[Inferred from news] ${enrichedData.inferred_bio}`;
        console.log('  Inferred thesis from news');
      }
      update.last_enrichment_date = new Date().toISOString();

      if (Object.keys(update).length <= 1) {
        // Only the date field — nothing actually enriched
        noData++;
        continue;
      }

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('investors')
          .update(update)
          .eq('id', investor.id);

        if (updateError) {
          console.log(`  Update failed: ${updateError.message}`);
          errors++;
        } else {
          console.log(`  Enriched ${Object.keys(update).length - 1} fields`);
          enriched++;
        }
      } else {
        console.log(`  [DRY RUN] Would update: ${Object.keys(update).filter(k => k !== 'last_enrichment_date').join(', ')}`);
        enriched++;
      }

      // Rate limit — be gentle with Google News
      await new Promise(r => setTimeout(r, 2000));

    } catch (e) {
      console.log(`  Error: ${e.message}`);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('INVESTOR ENRICHMENT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Processed:  ${sparse.length}`);
  console.log(`  Enriched:   ${enriched} (${((enriched / sparse.length) * 100).toFixed(1)}%)`);
  console.log(`  No Data:    ${noData}`);
  console.log(`  Errors:     ${errors}`);
  if (DRY_RUN) console.log('\n  Re-run without --dry-run to apply changes');
  console.log('═'.repeat(60) + '\n');
}

enrichSparseInvestors().catch(console.error);
