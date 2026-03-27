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
 * Run: node scripts/enrich-sparse-startups.js [--limit=50] [--dry-run] [--no-url-only] [--include-holding] [--run-all] [--html-only]
 *
 * --no-url-only     Only target startups with no website OR company_website field.
 * --include-holding Also include startups in 'holding' (3+ failed attempts). Use to retry after fixing issues.
 * --run-all         Loop until no sparse startups remain. Uses --limit per chunk (default 200).
 * --html-only       Skip Google News RSS (use when blocked). Enriches from website HTML + infers URL from name when missing.
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Shared inference engine — same functions used by instantSubmit.js
const { extractInferenceData } = require('../lib/inference-extractor');
const { quickEnrich, isDataSparse, inferDomainFromName, normalizeNameForSearch } = require('../server/services/inferenceService');
// Shared URL validation — SINGLE SOURCE OF TRUTH for junk domain detection
const { isJunkUrl } = require('../lib/junk-url-config');
const { isGarbage } = require('./cleanup-garbage');

// ============================================================================
// CONCURRENCY — 1 when hitting Google News (rate-limited), 4 when html-only
// ============================================================================
const CONCURRENCY_NEWS = 1;
const CONCURRENCY_HTML_ONLY = 4;

// Per-startup timeout — fail fast on slow sites (we lose them anyway)
const PER_STARTUP_TIMEOUT_MS_HTML = 8000;   // 8s for html-only
const PER_STARTUP_TIMEOUT_MS_FULL = 35000;  // 35s when news is enabled

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${(ms / 1000).toFixed(0)}s${label ? ` (${label})` : ''}`)), ms)
    ),
  ]);
}

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
      timeout: 4000,   // 4s — faster fail for slow/blocking sites
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
async function enrichOneStartup(startup, dryRun = false, htmlOnly = false) {
  const currentExtracted = startup.extracted_data || {};
  let inferenceData = { ...currentExtracted };
  const stepLog = [];
  let htmlEnriched = false;

  let urlToUse = startup.website || startup.company_website;

  // ── html-only: when no URL, try to discover via name→domain inference ──
  if (htmlOnly && !urlToUse) {
    const nameForInference = (typeof normalizeNameForSearch === 'function' ? normalizeNameForSearch(startup.name) : null) || startup.name;
    const inferred = await inferDomainFromName(nameForInference, 1500);
    if (inferred) {
      urlToUse = inferred;
      stepLog.push(`URL: inferred ${inferred} from name`);
    }
  }

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

  // ── Step 2: News — run if traction/funding fields are missing (skip when --html-only) ──
  // HTML extracts website copy; news extracts press coverage (ARR, customers,
  // funding rounds). These are the GOD score-critical signals we need.
  const hasTraction = !!(inferenceData.raise_amount || inferenceData.funding_amount
    || inferenceData.arr || inferenceData.mrr || inferenceData.revenue
    || inferenceData.customer_count || inferenceData.customers);
  const hasSectors = !!(inferenceData.sectors && inferenceData.sectors.length > 0);
  const runNews = !htmlOnly && (!hasTraction || !hasSectors || isDataSparse({ extracted_data: inferenceData }));

  if (runNews) {
    // Pass null for junk URLs — don't let news use an article URL as domain query
    const newsUrl = urlToUse && !isJunkUrl(urlToUse) ? urlToUse : null;
    const newsResult = await quickEnrich(startup.name, inferenceData, newsUrl, 25000);
    if (newsResult.enrichmentCount > 0) {
      inferenceData = { ...inferenceData, ...newsResult.enrichedData };
      stepLog.push(`News: +${newsResult.enrichmentCount} fields (${newsResult.fieldsEnriched.join(', ')}) from ${newsResult.articlesFound} articles`);
    } else {
      stepLog.push(`News: 0 fields (${newsResult.articlesFound} articles)`);
    }
  } else if (htmlOnly) {
    stepLog.push('News: skipped (--html-only mode)');
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
  // Promote discovered company URL to website column (skip if another startup already has it)
  const discoveredUrl = inferenceData.company_url || inferenceData.source_url || null;
  if (discoveredUrl && !startup.website && !startup.company_website && !isJunkUrl(discoveredUrl)) {
    try {
      const normalized = new URL(
        discoveredUrl.startsWith('http') ? discoveredUrl : `https://${discoveredUrl}`
      ).hostname.replace(/^www\./, '');
      const { data: existing, error: checkError } = await supabase
        .from('startup_uploads')
        .select('id')
        .eq('website', normalized)
        .neq('id', startup.id)
        .limit(1)
        .maybeSingle();
      if (!checkError && !existing) {
        updatePayload.website = normalized;
      }
      // else: another startup has this website or check failed — don't set (avoids unique constraint)
    } catch { /* malformed - skip */ }
  }

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
// ============================================================================
// SUPABASE QUERY WITH RETRY (handles intermittent DNS failures)
// ============================================================================
async function runWithRetry(fn, maxAttempts = 3, baseDelayMs = 5000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    if (!result.error) return result;
    const isNetworkError =
      result.error?.message?.includes('fetch failed') ||
      result.error?.message?.includes('ENOTFOUND') ||
      result.error?.message?.includes('ECONNREFUSED') ||
      result.error?.message?.includes('ETIMEDOUT');
    if (!isNetworkError || attempt === maxAttempts) return result;
    const delay = baseDelayMs * attempt;
    console.log(`[retry] Network error (attempt ${attempt}/${maxAttempts}), retrying in ${delay / 1000}s…`);
    await new Promise(r => setTimeout(r, delay));
  }
}

async function runOneChunk(opts) {
  const { limit, dryRun, noUrlOnly, includeHolding, htmlOnly } = opts;

  const buildQuery = () => {
    let q = supabase
      .from('startup_uploads')
      .select('id, name, website, company_website, pitch, sectors, stage, raise_amount, raise_type, customer_count, mrr, arr, team_size, location, total_god_score, extracted_data, enrichment_attempts, enrichment_status, holding_since')
      .eq('status', 'approved');

    if (noUrlOnly) {
      q = q
        .is('website', null)
        .is('company_website', null)
        .order('enrichment_attempts', { ascending: true })
        .order('updated_at', { ascending: true })
        .limit(limit * 2);
    } else {
      const statusFilter = includeHolding
        ? 'enrichment_status.eq.waiting,enrichment_status.is.null,enrichment_status.eq.holding'
        : 'enrichment_status.eq.waiting,enrichment_status.is.null';
      q = q
        .or(statusFilter)
        .order('enrichment_attempts', { ascending: true })
        .order('updated_at', { ascending: true })
        .limit(limit * 3);
    }
    return q;
  };

  const { data: startups, error } = await runWithRetry(buildQuery, 3, 5000);

  if (error) {
    console.error('Error loading startups:', error);
    return { processed: 0, enriched: 0, noData: 0, errors: 0 };
  }

  const sparseStartups = noUrlOnly
    ? startups.filter(s => s.total_god_score < 70).slice(0, limit)
    : startups.filter(s => {
        const { phase } = classifyDataRichness(s);
        return phase >= 2 && s.total_god_score < 70;
      }).slice(0, limit);

  const modeLabel = noUrlOnly
    ? 'no URL, score < 70'
    : htmlOnly
      ? `html-only (+ URL discovery), status: waiting/null${includeHolding ? '/holding' : ''}, score < 70`
      : `status: waiting/null${includeHolding ? '/holding' : ''}, score < 70`;
  console.log(`Found ${sparseStartups.length} startups pending enrichment (${modeLabel})\n`);

  if (sparseStartups.length === 0) {
    console.log('No sparse startups found.');
    console.log(`  Raw query returned ${startups.length} approved startup(s).`);
    if (startups.length > 0 && !noUrlOnly) {
      const byPhase = {};
      startups.forEach(s => {
        const { phase } = classifyDataRichness(s);
        byPhase[phase] = (byPhase[phase] || 0) + 1;
      });
      console.log(`  By phase: ${Object.entries(byPhase).map(([p, n]) => `phase ${p}: ${n}`).join(', ')}`);
      // Show why each was excluded (score >= 70 or phase < 2)
      const excluded = startups.filter(s => {
        const { phase } = classifyDataRichness(s);
        return phase < 2 || s.total_god_score >= 70;
      });
      if (excluded.length > 0) {
        console.log(`  Excluded by filter (phase>=2 and score<70): ${excluded.map(s => `"${s.name}" (phase ${classifyDataRichness(s).phase}, score ${s.total_god_score ?? 'null'})`).join('; ')}`);
      }
    }
    if (!includeHolding) console.log('Tip: try --include-holding to retry startups that previously failed.');
    if (!noUrlOnly) console.log('Tip: try --no-url-only to target startups with no website.');
    if (htmlOnly) console.log('Tip: HTML-only mode only processes startups WITH a website. Without --html-only, news fallback can enrich startups without URLs.');
    return { processed: 0, enriched: 0, noData: 0, errors: 0 };
  }

  // ── Process in concurrent batches ──
  const concurrency = htmlOnly ? CONCURRENCY_HTML_ONLY : CONCURRENCY_NEWS;
  let enriched = 0;
  let noData = 0;
  let errors = 0;

  for (let batchStart = 0; batchStart < sparseStartups.length; batchStart += concurrency) {
    const batch = sparseStartups.slice(batchStart, batchStart + concurrency);

    const timeoutMs = htmlOnly ? PER_STARTUP_TIMEOUT_MS_HTML : PER_STARTUP_TIMEOUT_MS_FULL;
    const results = await Promise.allSettled(batch.map(async (startup, batchIdx) => {
      const i = batchStart + batchIdx;
      console.log(`\n[${i + 1}/${sparseStartups.length}] ${startup.name} (score: ${startup.total_god_score})`);

      if (isGarbage(startup.name)) {
        console.log(`  ⏭️  Skipped (garbage name — run cleanup-garbage --delete to remove)`);
        return { status: 'skipped' };
      }

      const urlDisplay = startup.website || startup.company_website || '(no url)';
      if (startup.website || startup.company_website) console.log(`  URL: ${urlDisplay}`);

      const result = await withTimeout(
        enrichOneStartup(startup, dryRun, htmlOnly),
        timeoutMs,
        startup.name
      );
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
        else if (r.value.status === 'skipped') { /* not counted */ }
        else noData++;
      } else {
        console.log(`  ❌ Error: ${r.reason?.message || r.reason}`);
        errors++;
      }
    }

    // Pause between batches — 3s when hitting Google News, 150ms when html-only
    if (batchStart + concurrency < sparseStartups.length) {
      await new Promise(resolve => setTimeout(resolve, htmlOnly ? 150 : 3000));
    }
  }

  // ── Chunk summary ──
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CHUNK SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Processed: ${sparseStartups.length}`);
  console.log(`  Enriched:  ${enriched} (${((enriched / sparseStartups.length) * 100).toFixed(1)}%)`);
  console.log(`  No Data:   ${noData}`);
  console.log(`  Errors:    ${errors}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  return { processed: sparseStartups.length, enriched, noData, errors };
}

async function enrichSparseStartups() {
  console.log('=== STARTUP ENRICHMENT — Full Inference Pipeline ===\n');
  console.log('Pipeline: URL scrape (extractInferenceData) → news fallback (quickEnrich)\n');

  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  const dryRun = args.includes('--dry-run');
  const noUrlOnly = args.includes('--no-url-only');
  const includeHolding = args.includes('--include-holding');
  const runAll = args.includes('--run-all');
  const htmlOnly = args.includes('--html-only');

  const effectiveLimit = runAll && !limitArg ? 200 : limit;

  if (dryRun) console.log('🧪 DRY RUN — no database writes\n');
  if (noUrlOnly) console.log('🔍 NO-URL-ONLY mode — targeting startups with no website field\n');
  if (includeHolding) console.log('🔄 Including holding status (retry after previous failures)\n');
  if (htmlOnly) console.log('🌐 HTML-ONLY mode — skipping Google News (use when RSS is blocked)\n');
  if (runAll) console.log(`♻️  RUN-ALL mode — processing in chunks of ${effectiveLimit} until pool is empty\n`);
  else console.log(`Processing up to ${limit} startups\n`);

  const opts = { limit: effectiveLimit, dryRun, noUrlOnly, includeHolding, htmlOnly };

  let totalProcessed = 0;
  let totalEnriched = 0;
  let totalNoData = 0;
  let totalErrors = 0;
  let chunkNum = 0;

  while (true) {
    chunkNum++;
    if (runAll && chunkNum > 1) {
      console.log(`\n📦 CHUNK ${chunkNum} — loading next batch...\n`);
    }

    const result = await runOneChunk(opts);
    totalProcessed += result.processed;
    totalEnriched += result.enriched;
    totalNoData += result.noData;
    totalErrors += result.errors;

    if (result.processed === 0) break;

    if (runAll && result.processed > 0) {
      const pauseSec = htmlOnly ? 1 : 3;
      console.log(`  ⏳ Pausing ${pauseSec}s before next chunk...\n`);
      await new Promise(r => setTimeout(r, pauseSec * 1000));
    } else {
      break;
    }
  }

  if (runAll && chunkNum > 0) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('FULL RUN COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Chunks:    ${chunkNum}`);
    console.log(`  Processed: ${totalProcessed}`);
    console.log(`  Enriched:  ${totalEnriched} (${totalProcessed ? ((totalEnriched / totalProcessed) * 100).toFixed(1) : 0}%)`);
    console.log(`  No Data:   ${totalNoData}`);
    console.log(`  Errors:    ${totalErrors}`);
    console.log('═══════════════════════════════════════════════════════════════');
  }
  if (!dryRun && totalEnriched > 0) {
    console.log('\n  Next: npx tsx scripts/recalculate-scores.ts\n');
  }
}

enrichSparseStartups().catch(console.error);
