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
 *
 * After backfill:
 *   npx tsx scripts/recalculate-scores.ts
 *   node match-regenerator.js --full
 */

require('dotenv').config();
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
const CONCURRENCY = HTML_RESCRAPE ? 2 : 8;
const PATENT_DELAY_MS = parseInt(process.env.PROPRIETARY_TECH_PATENT_DELAY_MS || '400', 10);

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

  const updates = {
    extracted_data: extracted,
    updated_at: new Date().toISOString(),
  };

  if (profile.has_proprietary_tech && profile.confidence !== 'low' && !startup.unique_ip) {
    updates.unique_ip = true;
  } else if (
    !profile.has_proprietary_tech &&
    (profile.confidence === 'high' || profile.confidence === 'medium') &&
    startup.unique_ip
  ) {
    updates.unique_ip = false;
  }

  return { updates, profile, htmlUsed };
}

async function main() {
  console.log('\n=== Proprietary Tech Backfill ===');
  console.log(`  status=${STATUS} dryRun=${DRY_RUN} force=${FORCE}`);
  console.log(`  htmlRescrape=${HTML_RESCRAPE} patents=${PATENTS} concurrency=${CONCURRENCY}\n`);

  let allStartups = [];
  let from = 0;
  const PAGE = 500;

  while (true) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id, name, website, company_website, pitch, description, tagline, unique_ip, extracted_data')
      .eq('status', STATUS)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (LIMIT) allStartups = allStartups.slice(0, LIMIT);
  console.log(`Found ${allStartups.length} startups to process\n`);

  let assessed = 0;
  let updated = 0;
  let skipped = 0;
  let withTech = 0;
  let withoutTech = 0;
  let errors = 0;
  const pendingUpdates = [];

  for (let i = 0; i < allStartups.length; i += CONCURRENCY) {
    const chunk = allStartups.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (startup) => {
        try {
          const result = await assessStartup(startup);
          assessed++;
          if (!result) return { skipped: true };
          if (result.profile.has_proprietary_tech) withTech++;
          else withoutTech++;
          return { id: startup.id, name: startup.name, ...result };
        } catch (e) {
          errors++;
          return { error: e.message, name: startup.name };
        }
      })
    );

    for (const r of results) {
      if (r.error) {
        console.warn(`  ⚠ ${r.name}: ${r.error}`);
        continue;
      }
      if (r.skipped) {
        skipped++;
        continue;
      }
      pendingUpdates.push(r);
    }

    process.stdout.write(
      `\r  Assessed ${assessed}/${allStartups.length} | pending writes ${pendingUpdates.length} | with tech ${withTech} | without ${withoutTech}`
    );
  }

  console.log('\n');

  if (DRY_RUN) {
    console.log(`Dry run complete. Would update ${pendingUpdates.length} startups.`);
    const sample = pendingUpdates.slice(0, 5);
    for (const s of sample) {
      console.log(
        `  ${s.name}: has_proprietary_tech=${s.profile.has_proprietary_tech} confidence=${s.profile.confidence} patents=${s.profile.patent_count}`
      );
    }
    return;
  }

  for (let i = 0; i < pendingUpdates.length; i += CONCURRENCY) {
    const chunk = pendingUpdates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(({ id, updates }) => sb.from('startup_uploads').update(updates).eq('id', id))
    );
    for (const r of results) {
      if (r.error) errors++;
      else updated++;
    }
    process.stdout.write(`\r  Written ${updated}/${pendingUpdates.length} (${errors} errors)...`);
  }

  console.log('\n\n✓ Backfill complete');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (unchanged): ${skipped}`);
  console.log(`  With proprietary tech: ${withTech}`);
  console.log(`  Without proprietary tech: ${withoutTech}`);
  console.log(`  Errors: ${errors}`);
  console.log('\nNext steps:');
  console.log('  npx tsx scripts/recalculate-scores.ts');
  console.log('  node match-regenerator.js --full');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
