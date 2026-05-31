#!/usr/bin/env node
/**
 * backfill-proprietary-tech.js
 *
 * Assess proprietary technology + patents for all approved startups.
 * Updates extracted_data.proprietary_tech_profile (SSOT: lib/proprietaryTechAssessment.js).
 *
 * Usage:
 *   node scripts/backfill-proprietary-tech.js [--dry-run] [--limit=N] [--force]
 *   node scripts/backfill-proprietary-tech.js --html-rescrape [--patents]
 *
 *   --dry-run         Preview changes, no writes
 *   --limit=N         Process only N startups
 *   --force           Re-assess even when profile exists
 *   --html-rescrape   Re-fetch website HTML for extractInferenceData (slower, more accurate)
 *   --patents         Query USPTO/EPO/WIPO per startup (slow; ~3s each, sequential)
 *   --status=approved Filter status (default: approved)
 *   --offset=N        Skip first N startups (ordered by id)
 *   --resume          Continue from logs/checkpoint-proprietary-tech.json
 *
 * After backfill:
 *   npx tsx scripts/recalculate-scores.ts
 *   node match-regenerator.js --full
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { extractInferenceData } = require('../lib/inference-extractor');
const {
  assessProprietaryTech,
  fetchPatentEvidence,
} = require('../lib/proprietaryTechAssessment');
const { isJunkUrl } = require('../lib/junk-url-config');

const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const HTML_RESCRAPE = process.argv.includes('--html-rescrape');
const PATENTS = process.argv.includes('--patents');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const statusArg = process.argv.find((a) => a.startsWith('--status='));
const STATUS = statusArg ? statusArg.split('=')[1] : 'approved';
const offsetArg = process.argv.find((a) => a.startsWith('--offset='));
const CHECKPOINT_FILE = path.join(__dirname, '../logs/checkpoint-proprietary-tech.json');
const RESUME = process.argv.includes('--resume');
let OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;
if (RESUME && fs.existsSync(CHECKPOINT_FILE)) {
  try {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    if (Number.isFinite(cp.processed) && cp.processed > OFFSET) {
      OFFSET = cp.processed;
      console.log(`Resuming from checkpoint: offset ${OFFSET}`);
    }
  } catch { /* ignore corrupt checkpoint */ }
}
const CONCURRENCY = HTML_RESCRAPE ? 2 : 12;
const PATENT_DELAY_MS = parseInt(process.env.PROPRIETARY_TECH_PATENT_DELAY_MS || '400', 10);
const PER_STARTUP_TIMEOUT_MS = parseInt(process.env.PROPRIETARY_TECH_TIMEOUT_MS || '15000', 10);
const HEARTBEAT_EVERY = parseInt(process.env.PROPRIETARY_TECH_HEARTBEAT_EVERY || '100', 10);

function writeCheckpoint(stats) {
  if (DRY_RUN) return;
  const globalProcessed = OFFSET + stats.assessed;
  try {
    fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
    fs.writeFileSync(
      CHECKPOINT_FILE,
      JSON.stringify({
        processed: globalProcessed,
        updated: stats.updated,
        withTech: stats.withTech,
        withoutTech: stats.withoutTech,
        htmlRescrape: HTML_RESCRAPE,
        updated_at: new Date().toISOString(),
      })
    );
  } catch { /* non-fatal */ }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms${label ? ` (${label})` : ''}`)), ms)
    ),
  ]);
}

async function fetchWebsiteHtml(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      timeout: 5000,
      maxRedirects: 3,
    });
    return response.data?.toString() || null;
  } catch {
    return null;
  }
}

function buildAssessmentText(startup, extracted) {
  return [
    startup.pitch,
    startup.description,
    startup.tagline,
    extracted.description,
    extracted.value_proposition,
    extracted.product_description,
    extracted.solution,
    extracted.about,
  ].filter(Boolean).join('\n');
}

function profilesEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.has_proprietary_tech === b.has_proprietary_tech &&
    a.confidence === b.confidence &&
    (a.patent_count || 0) === (b.patent_count || 0)
  );
}

async function assessStartup(startup) {
  const extracted = { ...(startup.extracted_data || {}) };
  let text = buildAssessmentText(startup, extracted);
  let htmlUsed = false;

  const url = startup.website || startup.company_website;
  if (HTML_RESCRAPE && url && !isJunkUrl(url)) {
    const html = await fetchWebsiteHtml(url);
    if (html && html.length >= 50) {
      const htmlData = extractInferenceData(html, url);
      if (htmlData) {
        htmlUsed = true;
        for (const [key, val] of Object.entries(htmlData)) {
          if (val !== null && val !== undefined && val !== '') {
            extracted[key] = val;
          }
        }
        text = [
          text,
          htmlData.description,
          htmlData.value_proposition,
          htmlData.product_description,
          htmlData.solution,
        ].filter(Boolean).join('\n');
      }
    }
  }

  let patentSignals = extracted.proprietary_tech_profile?.patent_signals || [];
  if (PATENTS && startup.name) {
    patentSignals = await fetchPatentEvidence(startup.name, 3500);
    if (PATENT_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, PATENT_DELAY_MS));
    }
  }

  const profile = assessProprietaryTech({
    text,
    companyName: startup.name,
    patentSignals: PATENTS ? patentSignals : null,
    existingProfile: extracted.proprietary_tech_profile,
  });

  if (PATENTS && patentSignals.length > 0) {
    profile.patent_signals = patentSignals;
  }

  const prev = extracted.proprietary_tech_profile;
  if (!FORCE && prev && profilesEqual(prev, profile) && !htmlUsed) {
    return null;
  }

  extracted.proprietary_tech_profile = profile;
  extracted.has_proprietary_tech = profile.has_proprietary_tech;
  extracted.proprietary_tech_confidence = profile.confidence;
  extracted.patent_count = profile.patent_count;
  extracted.patent_verified = profile.patent_verified;
  extracted.proprietary_tech_evidence = profile.evidence;
  extracted.unique_ip = profile.has_proprietary_tech && profile.confidence !== 'low';

  const updates = {
    extracted_data: extracted,
    updated_at: new Date().toISOString(),
  };

  return { updates, profile, htmlUsed };
}

async function processPage(startups, stats) {
  for (let i = 0; i < startups.length; i += CONCURRENCY) {
    const chunk = startups.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (startup) => {
        try {
          const result = await withTimeout(assessStartup(startup), PER_STARTUP_TIMEOUT_MS, startup.name);
          stats.assessed++;
          if (!result) return { skipped: true };
          if (result.profile.has_proprietary_tech) stats.withTech++;
          else stats.withoutTech++;
          return { id: startup.id, name: startup.name, ...result };
        } catch (e) {
          stats.errors++;
          return { error: e.message, name: startup.name };
        }
      })
    );

    const pageUpdates = [];
    for (const r of results) {
      if (r.error) {
        console.warn(`  ⚠ ${r.name}: ${r.error}`);
        continue;
      }
      if (r.skipped) {
        stats.skipped++;
        continue;
      }
      pageUpdates.push(r);
    }

    if (!DRY_RUN && pageUpdates.length > 0) {
      const writeResults = await Promise.all(
        pageUpdates.map(({ id, updates }) => sb.from('startup_uploads').update(updates).eq('id', id))
      );
      for (const wr of writeResults) {
        if (wr.error) stats.errors++;
        else stats.updated++;
      }
    } else if (DRY_RUN) {
      stats.pending += pageUpdates.length;
    }

    process.stdout.write(
      `\r  Processed ${stats.assessed}/${stats.total} | updated ${stats.updated} | with tech ${stats.withTech} | without ${stats.withoutTech}`
    );
    if (stats.assessed % HEARTBEAT_EVERY === 0 || stats.assessed === stats.total) {
      console.log(
        `\n[${new Date().toISOString()}] heartbeat ${stats.assessed}/${stats.total} updated=${stats.updated} withTech=${stats.withTech}`
      );
      writeCheckpoint(stats);
    }
  }
}

async function main() {
  console.log('\n=== Proprietary Tech Backfill ===');
  console.log(`  status=${STATUS} dryRun=${DRY_RUN} force=${FORCE}`);
  console.log(`  htmlRescrape=${HTML_RESCRAPE} patents=${PATENTS} concurrency=${CONCURRENCY}\n`);

  const { count, error: countError } = await sb
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', STATUS);

  if (countError) {
    console.error('Count error:', countError.message);
    process.exit(1);
  }

  const total = LIMIT ? Math.min(LIMIT, (count || 0) - OFFSET) : (count || 0) - OFFSET;
  if (total <= 0) {
    console.log('Nothing to process (offset >= total).');
    return;
  }
  console.log(`Found ${total} startups to process (offset ${OFFSET}, total approved ${count})\n`);

  const stats = {
    total,
    assessed: 0,
    updated: 0,
    skipped: 0,
    withTech: 0,
    withoutTech: 0,
    errors: 0,
    pending: 0,
  };

  let from = OFFSET;
  const PAGE = HTML_RESCRAPE ? 100 : 250;
  let processed = 0;

  while (processed < total) {
    const pageSize = Math.min(PAGE, total - processed);
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id, name, website, company_website, pitch, description, tagline, extracted_data')
      .eq('status', STATUS)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    await processPage(data, stats);
    processed += data.length;
    from += pageSize;
    if (data.length < pageSize) break;
  }

  console.log('\n');

  if (DRY_RUN) {
    console.log(`Dry run complete. Would update ${stats.pending} startups.`);
    return;
  }

  console.log('\n\n✓ Backfill complete');
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Skipped (unchanged): ${stats.skipped}`);
  console.log(`  With proprietary tech: ${stats.withTech}`);
  console.log(`  Without proprietary tech: ${stats.withoutTech}`);
  console.log(`  Errors: ${stats.errors}`);
  writeCheckpoint(stats);
  console.log('\nNext steps:');
  console.log('  npx tsx scripts/recalculate-scores.ts');
  console.log('  node match-regenerator.js --full');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
