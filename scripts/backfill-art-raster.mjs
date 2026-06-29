#!/usr/bin/env node
/**
 * Backfill Gemini raster + thumbnail for an existing SVG-only art edition.
 *
 * Usage:
 *   node scripts/backfill-art-raster.mjs
 *   node scripts/backfill-art-raster.mjs --date=2026-06-29
 */

import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const { loadArtEdition, ensureArtEditionRaster } = require('../server/lib/pythhArtGenerator');
const { enrichArtRowFromFilesystem, repoRootFromHere } = require('../server/lib/artEditionLocal');

const dateArg = process.argv.find((a) => a.startsWith('--date='));
const editionDate = dateArg?.split('=')[1] || new Date().toISOString().slice(0, 10);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  let row = await loadArtEdition(editionDate);
  if (!row) {
    console.error(`[art-backfill] No edition for ${editionDate}`);
    process.exit(1);
  }

  row = enrichArtRowFromFilesystem(row, repoRoot);
  const before = row.raster_url ?? row.signal_snapshot?.raster_url;
  if (before) {
    console.log(`[art-backfill] ${editionDate} already has raster: ${before}`);
    return;
  }

  console.log(`[art-backfill] Generating raster for ${editionDate}…`);
  row = await ensureArtEditionRaster(row, { repoRoot });
  row = enrichArtRowFromFilesystem(row, repoRootFromHere());

  const raster = row.raster_url ?? row.signal_snapshot?.raster_url;
  const thumb = row.thumbnail_url ?? row.signal_snapshot?.thumbnail_url;
  if (raster) {
    console.log(`[art-backfill] OK raster=${raster}`);
    console.log(`[art-backfill]    thumb=${thumb || '(derived)'}`);
  } else {
    console.error('[art-backfill] Failed:', row.signal_snapshot?.raster_error || 'unknown');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[art-backfill] Fatal:', e.message || e);
  process.exit(1);
});
