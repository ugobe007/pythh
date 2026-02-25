#!/usr/bin/env node
/**
 * TARGETED STARTUP ENRICHMENT - Full Inference Pipeline
 *
 * Uses the SAME two-step inference engine as the URL submission bar:
 *   Step 1: Re-scrape website HTML → extractInferenceData (fast, local)
 *   Step 2: If still sparse → quickEnrich (Google News RSS fallback queries)
 *
 * Process:
 * 1. Identify Phase 2-4 startups (scores < 70, missing key data)
 * 2. For each: fetch website HTML → extractInferenceData
 * 3. If still sparse after HTML: quickEnrich via news (3-query cascade)
 * 4. Merge enriched data + promote to top-level columns
 * 5. Mark for GOD score recalculation
 *
 * Run: node scripts/enrich-sparse-startups.js [--limit=50] [--dry-run] [--no-url-only]
 *
 * --no-url-only  Only target startups with no website OR company_website field.
 *               These 1,592 entries need news-based enrichment to recover data.
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Shared inference engine — same functions used by instantSubmit.js
const { extractInferenceData } = require('../lib/inference-extractor');
const { quickEnrich, isDataSparse } = require('../server/services/inferenceService');

// ============================================================================
// JUNK URL DETECTION
// Scraper stores article URLs in 'website' field. Skip HTML for these.
// ============================================================================
const JUNK_URL_DOMAINS = [
  // Major tech/business news
  'techcrunch.com', 'venturebeat.com', 'forbes.com', 'bloomberg.com', 'reuters.com',
  'cnbc.com', 'wsj.com', 'nytimes.com', 'theverge.com', 'wired.com', 'businessinsider.com',
  'inc.com', 'axios.com', 'businesswire.com', 'prnewswire.com', 'globenewswire.com',
  // Crypto / tech
  'decrypt.co', 'cision.com', 'yahoo.com', 'google.com',
  // Regional & funding news
  'contxto.com', 'euronews.com', 'sifted.eu', 'startupnews.fyi', 'techeu.eu',
  'silicon.co.uk', 'theregister.com', 'analyticsindiamag.com', 'pymnts.com',
  'arcticstartup.com', 'techfundingnews.com', 'finsmes.com', 'geekwire.com',
  'eu-startups.com', 'tech.eu', 'startupbeat.com', 'venturebeat.com',
  // Aggregators & directories (not startup own sites)
  'news.ycombinator.com', 'ycombinator.com', 'producthunt.com', 'crunchbase.com',
  'angellist.com', 'f6s.com', 'startupblink.com', 'pitchbook.com',
  // Social & content platforms
  'medium.com', 'substack.com', 'linkedin.com', 'twitter.com', 'x.com',
  'instagram.com', 'facebook.com', 'reddit.com', 'youtube.com',
  // Job boards
  'venturefizz.com', 'lever.co', 'greenhouse.io', 'workable.com', 'jobs.ashbyhq.com',
];

function isJunkUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    const hostname = u.hostname.replace('www.', '');
    const isNewsHost = JUNK_URL_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    // Also flag deep article paths like /2026/01/26/some-article (3+ path segments)
    const deepPath = u.pathname.split('/').filter(Boolean).length >= 3;
    return isNewsHost || deepPath;
  } catch {
    return false;
  }
}

// ============================================================================
// CONCURRENCY LIMIT — process N startups in parallel
// Google News RSS rate-limits at ~4-5 concurrent connections reliably
// ============================================================================
const CONCURRENCY_LIMIT = 4;

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// CLASSIFY DATA RICHNESS (same as recalculate-scores.ts)
// ============================================================================
function classifyDataRichness(startup) {
  let signalCount = 0;
  
  // Count available data signals (matching startup_uploads columns)
  if (startup.pitch?.length > 50) signalCount++;
  if (startup.website) signalCount++;
  if (startup.sectors?.length > 0) signalCount++;
  if (startup.stage) signalCount++;
  if (startup.raise_amount) signalCount++;
  if (startup.customer_count || startup.mrr || startup.arr) signalCount++;
  if (startup.team_size) signalCount++;
  if (startup.location) signalCount++;
  
  // Phase classification
  if (signalCount >= 8) return { phase: 1, label: 'Data Rich' };
  if (signalCount >= 5) return { phase: 2, label: 'Good Data' };
  if (signalCount >= 2) return { phase: 3, label: 'Medium' };
  return { phase: 4, label: 'Sparse' };
}

// ============================================================================
// FETCH WEBSITE HTML (Step 1 of pipeline)
// ============================================================================
async function fetchWebsiteHtml(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 5000,   // 5s — faster fail for slow/blocking sites
      maxRedirects: 3, // limit redirect chains
    });
    return response.data?.toString() || null;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// ENRICH ONE STARTUP — Two-step pipeline
//   Step 1: Re-scrape website HTML → extractInferenceData (skip junk URLs)
//   Step 2: ALWAYS search news for traction signals (funding, ARR, customers)
//           — HTML gives website copy; news gives press coverage with numbers
// ============================================================================
async function enrichOneStartup(startup, dryRun = false) {
  const currentExtracted = startup.extracted_data || {};
  let inferenceData = { ...currentExtracted };
  const stepLog = [];
  let htmlEnriched = false;

  const urlToUse = startup.website || startup.company_website;

  // ── Step 1: Re-scrape website HTML (skip junk/article URLs) ──
  if (!urlToUse) {
    stepLog.push('HTML: no URL');
  } else if (isJunkUrl(urlToUse)) {
    stepLog.push('HTML: skipped (news article URL — not a startup site)');
  } else {
    const html = await fetchWebsiteHtml(urlToUse);
    if (html && html.length >= 50) {
      const htmlData = extractInferenceData(html, urlToUse);
      if (htmlData) {
        for (const [key, val] of Object.entries(htmlData)) {
          if (val !== null && val !== undefined && val !== '' &&
              !(Array.isArray(val) && val.length === 0)) {
            if (!inferenceData[key]) {
              inferenceData[key] = val;
              htmlEnriched = true;
            }
          }
        }
        stepLog.push(`HTML: Tier ${htmlData.confidence?.tier || '?'}${htmlEnriched ? ' (new data)' : ' (no new fields)'}`);
      }
    } else {
      stepLog.push('HTML: failed/empty');
    }
  }

  // ── Step 2: News — ALWAYS run if traction/funding fields are missing ──
  // HTML extracts website copy; news extracts press coverage (ARR, customers,
  // funding rounds). These are the GOD score-critical signals we need.
  const hasTraction = !!(inferenceData.raise_amount || inferenceData.funding_amount
    || inferenceData.arr || inferenceData.mrr || inferenceData.revenue
    || inferenceData.customer_count || inferenceData.customers);
  const hasSectors = !!(inferenceData.sectors && inferenceData.sectors.length > 0);
  const runNews = !hasTraction || !hasSectors || isDataSparse({ extracted_data: inferenceData });

  if (runNews) {
    // Pass null for junk URLs — don't let news use an article URL as domain query
    const newsUrl = urlToUse && !isJunkUrl(urlToUse) ? urlToUse : null;
    const newsResult = await quickEnrich(startup.name, inferenceData, newsUrl, 4000);
    if (newsResult.enrichmentCount > 0) {
      inferenceData = { ...inferenceData, ...newsResult.enrichedData };
      stepLog.push(`News: +${newsResult.enrichmentCount} fields (${newsResult.fieldsEnriched.join(', ')}) from ${newsResult.articlesFound} articles`);
    } else {
      stepLog.push(`News: 0 fields (${newsResult.articlesFound} articles)`);
    }
  } else {
    stepLog.push('News: skipped (traction + sectors present from HTML)');
  }

  // Count net-new fields
  const newFieldCount = Object.keys(inferenceData).filter(k =>
    !currentExtracted[k] && inferenceData[k] !== null && inferenceData[k] !== undefined
  ).length;

  if (newFieldCount === 0 && !htmlEnriched) {
    if (!dryRun) {
      // Track failed attempt and set holding/waiting status
      const now = new Date().toISOString();
      const newAttemptCount = (startup.enrichment_attempts || 0) + 1;
      const goToHolding = newAttemptCount >= 3;

      await supabase
        .from('startup_uploads')
        .update({
          last_enrichment_attempt: now,
          enrichment_attempts: newAttemptCount,
          enrichment_status: goToHolding ? 'holding' : 'waiting',
          ...(goToHolding && !startup.holding_since ? { holding_since: now } : {}),
        })
        .eq('id', startup.id);
    }
    return { enriched: false, stepLog, newFieldCount: 0 };
  }

  if (dryRun) {
    return { enriched: true, stepLog, newFieldCount, dryRun: true };
  }

  // ── Build DB update payload ──
  const now = new Date().toISOString();
  const newAttemptCount = (startup.enrichment_attempts || 0) + 1;

  const updatePayload = {
    extracted_data: inferenceData,
    updated_at: now,
    last_enrichment_attempt: now,
    enrichment_attempts: newAttemptCount,
    enrichment_status: 'enriched',
  };

  // Promote critical fields to top-level columns
  if (inferenceData.raise_amount && !startup.raise_amount)
    updatePayload.raise_amount = inferenceData.raise_amount;
  if (inferenceData.raise_type && !startup.raise_type)
    updatePayload.raise_type = inferenceData.raise_type;
  if (inferenceData.sectors?.length && (!startup.sectors || startup.sectors.length === 0))
    updatePayload.sectors = inferenceData.sectors;
  if (inferenceData.customer_count && !startup.customer_count)
    updatePayload.customer_count = inferenceData.customer_count;
  if (inferenceData.arr && !startup.arr)
    updatePayload.arr = inferenceData.arr;
  if (inferenceData.mrr && !startup.mrr)
    updatePayload.mrr = inferenceData.mrr;
  if (inferenceData.description && !startup.pitch)
    updatePayload.pitch = inferenceData.description;

  const { error: updateError } = await supabase
    .from('startup_uploads')
    .update(updatePayload)
    .eq('id', startup.id);

  if (updateError) throw new Error(updateError.message);

  return { enriched: true, stepLog, newFieldCount };
}

// ============================================================================
// MAIN ENRICHMENT PROCESS
// ============================================================================
async function enrichSparseStartups() {
  console.log('=== STARTUP ENRICHMENT — Full Inference Pipeline ===\n');
  console.log('Pipeline: URL scrape (extractInferenceData) → news fallback (quickEnrich)\n');

  // Parse command line args
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  const dryRun = args.includes('--dry-run');
  const noUrlOnly = args.includes('--no-url-only');

  if (dryRun) console.log('🧪 DRY RUN — no database writes\n');
  if (noUrlOnly) console.log('🔍 NO-URL-ONLY mode — targeting startups with no website field\n');
  console.log(`Processing up to ${limit} startups\n`);

  // ── Load sparse startups ──
  console.log('Loading data-sparse startups...');
  let query = supabase
    .from('startup_uploads')
    .select('id, name, website, company_website, pitch, sectors, stage, raise_amount, raise_type, customer_count, mrr, arr, team_size, location, total_god_score, extracted_data, enrichment_attempts, enrichment_status, holding_since')
    .eq('status', 'approved');

  if (noUrlOnly) {
    // Target only startups with no URL — skip enrichment_status filter so we catch
    // holding entries too (their website was never recovered)
    query = query
      .is('website', null)
      .is('company_website', null)
      .order('enrichment_attempts', { ascending: true })
      .order('updated_at', { ascending: true })
      .limit(limit * 2);
  } else {
    query = query
      .or('enrichment_status.eq.waiting,enrichment_status.is.null')
      .order('enrichment_attempts', { ascending: true })
      .order('updated_at', { ascending: true })
      .limit(limit * 3);
  }

  const { data: startups, error } = await query;

  if (error) {
    console.error('Error loading startups:', error);
    return;
  }

  const sparseStartups = noUrlOnly
    ? startups.filter(s => s.total_god_score < 70).slice(0, limit)
    : startups.filter(s => {
        const { phase } = classifyDataRichness(s);
        return phase >= 2 && s.total_god_score < 70;
      }).slice(0, limit);

  const modeLabel = noUrlOnly ? 'no URL, score < 70' : 'status: waiting/null, score < 70';
  console.log(`Found ${sparseStartups.length} startups pending enrichment (${modeLabel})\n`);

  if (sparseStartups.length === 0) {
    console.log('No sparse startups found.');
    return;
  }

  // ── Process in concurrent batches ──
  let enriched = 0;
  let noData = 0;
  let errors = 0;

  for (let batchStart = 0; batchStart < sparseStartups.length; batchStart += CONCURRENCY_LIMIT) {
    const batch = sparseStartups.slice(batchStart, batchStart + CONCURRENCY_LIMIT);

    const results = await Promise.allSettled(batch.map(async (startup, batchIdx) => {
      const i = batchStart + batchIdx;
      const urlDisplay = startup.website || startup.company_website || '(no url)';
      console.log(`\n[${i + 1}/${sparseStartups.length}] ${startup.name} (score: ${startup.total_god_score})`);
      if (startup.website || startup.company_website) console.log(`  URL: ${urlDisplay}`);

      const result = await enrichOneStartup(startup, dryRun);
      for (const step of result.stepLog) console.log(`  ${step}`);

      if (result.enriched) {
        console.log(`  ✅ ${result.dryRun ? '[DRY RUN] Would add' : 'Added'} ${result.newFieldCount} new fields`);
        return { status: 'enriched' };
      } else {
        console.log('  ⚠️  No new data found');
        return { status: 'noData' };
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.status === 'enriched') enriched++;
        else noData++;
      } else {
        console.log(`  ❌ Error: ${r.reason?.message || r.reason}`);
        errors++;
      }
    }

    // Brief pause between batches (200ms) — respect news API rate limits
    if (batchStart + CONCURRENCY_LIMIT < sparseStartups.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // ── Summary ──
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STARTUP ENRICHMENT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Processed: ${sparseStartups.length}`);
  console.log(`  Enriched:  ${enriched} (${((enriched / sparseStartups.length) * 100).toFixed(1)}%)`);
  console.log(`  No Data:   ${noData}`);
  console.log(`  Errors:    ${errors}`);
  if (!dryRun && enriched > 0) {
    console.log('\n  Next: npx tsx scripts/recalculate-scores.ts');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

enrichSparseStartups().catch(console.error);
