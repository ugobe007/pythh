#!/usr/bin/env node
/**
 * Backfill pythh_art_editions from public/art/{date}.json (raster + thumbnail URLs).
 *
 * Usage:
 *   node scripts/sync-art-editions-local.mjs
 *   node scripts/sync-art-editions-local.mjs --date=2026-06-28
 */

import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const { loadArtEdition, saveArtEdition } = require('../server/lib/pythhArtGenerator');
const {
  listLocalArtEditionDates,
  readLocalArtEditionMeta,
  enrichArtRowFromFilesystem,
  repoRootFromHere,
} = require('../server/lib/artEditionLocal');

const repoRoot = repoRootFromHere();
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const onlyDate = dateArg?.split('=')[1] || null;

const dates = onlyDate ? [onlyDate] : listLocalArtEditionDates(repoRoot);

if (!dates.length) {
  console.log('[art-sync] No local editions found under public/art/');
  process.exit(0);
}

for (const date of dates) {
  const local = readLocalArtEditionMeta(date, repoRoot);
  if (!local) {
    console.warn(`[art-sync] Skip ${date}: invalid local json`);
    continue;
  }

  const existing = await loadArtEdition(date);
  const snap = { ...(existing?.signal_snapshot || local.signal_snapshot || {}) };
  const localSnap = local.signal_snapshot || {};

  if (localSnap.raster_url || local.raster_url) {
    snap.raster_url = localSnap.raster_url ?? local.raster_url;
  }
  if (localSnap.thumbnail_url || local.thumbnail_url) {
    snap.thumbnail_url = localSnap.thumbnail_url ?? local.thumbnail_url;
  }
  if (localSnap.raster_provider || local.raster_provider) {
    snap.raster_provider = localSnap.raster_provider ?? local.raster_provider;
  }

  const edition = {
    edition_date: date,
    seed: existing?.seed ?? local.seed,
    svg: existing?.svg ?? local.svg,
    copy: existing?.copy ?? local.copy,
    generated_at: existing?.generated_at ?? local.generated_at ?? new Date().toISOString(),
    signal_snapshot: snap,
  };

  const preview = enrichArtRowFromFilesystem(edition, repoRoot);
  await saveArtEdition(preview);
  console.log(
    `[art-sync] ${date} → raster=${preview.signal_snapshot?.raster_url ? 'yes' : 'no'} thumb=${preview.signal_snapshot?.thumbnail_url ? 'yes' : 'no'}`,
  );
}

console.log('[art-sync] Done.');
