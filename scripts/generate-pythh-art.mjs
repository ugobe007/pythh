#!/usr/bin/env node
/**
 * Generate today's Pythh Signal Art edition (Gemini raster + SVG fallback + PYTHIA copy).
 *
 * Usage:
 *   node scripts/generate-pythh-art.mjs
 *   node scripts/generate-pythh-art.mjs --date=2026-06-27
 *   node scripts/generate-pythh-art.mjs --dry
 *   SIGNAL_ART_RASTER=0 node scripts/generate-pythh-art.mjs   # SVG only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { generateNewsletter } = require('../server/newsletter-generator');
const { generatePythhArtEdition, saveArtEdition } = require('../server/lib/pythhArtGenerator');

const DRY = process.argv.includes('--dry');
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const targetDate = dateArg ? dateArg.split('=')[1] : null;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'public', 'art');

async function main() {
  console.log('[pythh-art] Loading market signals…');
  const newsletter = await generateNewsletter({ bust: true });
  if (targetDate) newsletter.date = targetDate;

  const edition = await generatePythhArtEdition(newsletter, {
    repoRoot,
    generateRaster: !DRY,
  });
  console.log(`[pythh-art] Edition ${edition.edition_date} · seed=${edition.seed}`);
  if (edition.raster_url) {
    console.log(`[pythh-art] Raster (${edition.raster_provider || 'gemini'}): ${edition.raster_url}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const svgPath = path.join(outDir, `${edition.edition_date}.svg`);
  fs.writeFileSync(svgPath, edition.svg);
  console.log(`[pythh-art] SVG → ${svgPath}`);

  const metaPath = path.join(outDir, `${edition.edition_date}.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        edition_date: edition.edition_date,
        seed: edition.seed,
        copy: edition.copy,
        raster_url: edition.raster_url,
        raster_provider: edition.raster_provider,
        raster_model: edition.raster_model,
        signal_snapshot: edition.signal_snapshot,
        generated_at: edition.generated_at,
      },
      null,
      2,
    ),
  );

  if (DRY) {
    console.log('\n--- PYTHIA (process) ---\n', edition.copy.process.slice(0, 400));
    if (edition.signal_snapshot?.raster_error) {
      console.log('\n--- Raster ---\n', edition.signal_snapshot.raster_error);
    }
    console.log('\n[dry] Skipped Supabase upsert.');
    return;
  }

  try {
    await saveArtEdition(edition);
    console.log('[pythh-art] Saved to pythh_art_editions');
  } catch (e) {
    if (/does not exist/i.test(e.message || '')) {
      console.warn('[pythh-art] Table missing — run migration 20260627000000_pythh_art_editions.sql');
      console.warn(e.message);
      process.exitCode = 1;
    } else {
      throw e;
    }
  }
}

main().catch((e) => {
  console.error('[pythh-art] Fatal:', e.message || e);
  process.exit(1);
});
