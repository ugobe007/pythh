#!/usr/bin/env node
/**
 * Attach a raster image URL to an art edition (manual override).
 *
 * Usage:
 *   node scripts/art-attach-raster.mjs --date=2026-06-27 --url=https://...
 */

import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const { loadArtEdition, saveArtEdition } = require('../server/lib/pythhArtGenerator');

const dateArg = process.argv.find((a) => a.startsWith('--date='));
const urlArg = process.argv.find((a) => a.startsWith('--url='));
const editionDate = dateArg?.split('=')[1];
const rasterUrl = urlArg?.split('=')[1];

if (!editionDate || !rasterUrl) {
  console.error('Usage: node scripts/art-attach-raster.mjs --date=YYYY-MM-DD --url=https://...');
  process.exit(1);
}

const row = await loadArtEdition(editionDate);
if (!row) {
  console.error(`[art] No edition for ${editionDate}`);
  process.exit(1);
}

const edition = {
  edition_date: row.edition_date,
  seed: row.seed,
  svg: row.svg,
  copy: row.copy,
  generated_at: row.generated_at,
  signal_snapshot: {
    ...(row.signal_snapshot || {}),
    raster_url: rasterUrl,
    raster_attached_at: new Date().toISOString(),
  },
};

await saveArtEdition(edition);
console.log(`[art] Attached raster to ${editionDate}: ${rasterUrl}`);
