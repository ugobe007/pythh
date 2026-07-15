#!/usr/bin/env node
/**
 * Backfill raster previews for editions missing raster (Gemini first; SVG only when SIGNAL_ART_SVG_FALLBACK=1).
 *
 * Usage:
 *   node scripts/backfill-art-svg-preview.mjs
 *   node scripts/backfill-art-svg-preview.mjs --date=2026-07-14
 *   node scripts/backfill-art-svg-preview.mjs --days=7
 */

import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { loadArtEdition, ensureArtEditionRaster, saveArtEdition } = require('../server/lib/pythhArtGenerator');
const { enrichArtRowFromFilesystem } = require('../server/lib/artEditionLocal');

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const onlyDate = dateArg?.split('=')[1] || null;
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 14;

async function listDates(sb) {
  if (onlyDate) return [onlyDate];
  const { data, error } = await sb
    .from('pythh_art_editions')
    .select('edition_date, signal_snapshot')
    .order('edition_date', { ascending: false })
    .limit(days);
  if (error) throw error;
  return (data || []).map((r) => r.edition_date);
}

async function main() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const dates = await listDates(sb);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const date of dates) {
    let row = await loadArtEdition(date);
    if (!row?.svg) {
      console.warn(`[art-svg-backfill] Skip ${date}: no SVG`);
      skip++;
      continue;
    }
    row = enrichArtRowFromFilesystem(row, repoRoot);
    const hasThumb = row.thumbnail_url ?? row.signal_snapshot?.thumbnail_url;
    const hasRaster = row.raster_url ?? row.signal_snapshot?.raster_url;
    const provider = row.raster_provider ?? row.signal_snapshot?.raster_provider;
    const svgOnly =
      provider === 'svg_fallback' && hasThumb && hasRaster && process.env.SIGNAL_ART_SVG_FALLBACK !== '1';
    if (hasThumb && hasRaster && !svgOnly) {
      console.log(`[art-svg-backfill] ${date} already has preview`);
      skip++;
      continue;
    }

    console.log(`[art-svg-backfill] ${date}…`);
    const updated = await ensureArtEditionRaster(row, { repoRoot });
    const raster = updated.raster_url ?? updated.signal_snapshot?.raster_url;
    const thumb = updated.thumbnail_url ?? updated.signal_snapshot?.thumbnail_url;
    if (raster || thumb) {
      try {
        await saveArtEdition(updated);
      } catch (e) {
        console.warn(`[art-svg-backfill] save failed ${date}:`, e.message);
      }
      console.log(`[art-svg-backfill] OK ${date} raster=${raster ? 'yes' : 'no'} thumb=${thumb ? 'yes' : 'no'}`);
      ok++;
    } else {
      console.error(`[art-svg-backfill] FAIL ${date}:`, updated.signal_snapshot?.raster_error);
      fail++;
    }
  }

  console.log(`[art-svg-backfill] Done — ok=${ok} skip=${skip} fail=${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[art-svg-backfill] Fatal:', e.message || e);
  process.exit(1);
});
