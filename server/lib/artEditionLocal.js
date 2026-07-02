'use strict';

const fs = require('fs');
const path = require('path');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function repoRootFromHere() {
  return path.join(__dirname, '..', '..');
}

function localArtJsonPath(editionDate, repoRoot = repoRootFromHere()) {
  if (!DATE_RE.test(editionDate)) return null;
  return path.join(repoRoot, 'public', 'art', `${editionDate}.json`);
}

function readLocalArtEditionMeta(editionDate, repoRoot = repoRootFromHere()) {
  const jsonPath = localArtJsonPath(editionDate, repoRoot);
  if (!jsonPath || !fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function listLocalArtEditionDates(repoRoot = repoRootFromHere()) {
  const artDir = path.join(repoRoot, 'public', 'art');
  if (!fs.existsSync(artDir)) return [];
  return fs
    .readdirSync(artDir)
    .filter((name) => DATE_RE.test(name.replace(/\.json$/, '')) && name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort((a, b) => b.localeCompare(a));
}

/** Merge raster/thumbnail from public/art/{date}.json when DB row is incomplete. */
function enrichArtRowFromFilesystem(row, repoRoot = repoRootFromHere()) {
  if (!row?.edition_date) return row;
  const local = readLocalArtEditionMeta(row.edition_date, repoRoot);
  if (!local) return row;

  const localSnap = local.signal_snapshot || {};
  const snap = { ...(row.signal_snapshot || {}) };

  if (!snap.raster_url) {
    snap.raster_url = localSnap.raster_url ?? local.raster_url ?? null;
  }
  if (!snap.thumbnail_url) {
    snap.thumbnail_url = localSnap.thumbnail_url ?? local.thumbnail_url ?? null;
  }
  if (!snap.raster_provider && (localSnap.raster_provider || local.raster_provider)) {
    snap.raster_provider = localSnap.raster_provider ?? local.raster_provider;
  }

  return {
    ...row,
    raster_url: row.raster_url ?? local.raster_url ?? snap.raster_url ?? null,
    thumbnail_url: row.thumbnail_url ?? local.thumbnail_url ?? snap.thumbnail_url ?? null,
    signal_snapshot: snap,
  };
}

function localThumbnailFallback(editionDate, repoRoot = repoRootFromHere()) {
  if (!DATE_RE.test(editionDate)) return null;
  const thumbPath = path.join(repoRoot, 'public', 'art', `${editionDate}-thumb.jpg`);
  if (fs.existsSync(thumbPath)) return `/art/${editionDate}-thumb.jpg`;
  return null;
}

function localRowFromMeta(editionDate, local, repoRoot = repoRootFromHere()) {
  const snap = local.signal_snapshot || {};
  return {
    edition_date: editionDate,
    seed: local.seed,
    svg: local.svg,
    copy: local.copy,
    generated_at: local.generated_at || new Date().toISOString(),
    raster_url: local.raster_url ?? snap.raster_url ?? null,
    thumbnail_url: local.thumbnail_url ?? snap.thumbnail_url ?? null,
    signal_snapshot: {
      ...snap,
      raster_url: snap.raster_url ?? local.raster_url ?? null,
      thumbnail_url: snap.thumbnail_url ?? local.thumbnail_url ?? null,
    },
  };
}

/** DB rows plus any editions only present under public/art/*.json */
async function listArtEditionsMerged(listArtEditions, { limit = 30, repoRoot = repoRootFromHere() } = {}) {
  const rows = await listArtEditions({ limit: Math.max(limit, 60) });
  const byDate = new Map();

  for (const row of rows) {
    const enriched = enrichArtRowFromFilesystem(row, repoRoot);
    byDate.set(enriched.edition_date, enriched);
  }

  for (const date of listLocalArtEditionDates(repoRoot)) {
    if (byDate.has(date)) continue;
    const local = readLocalArtEditionMeta(date, repoRoot);
    if (!local) continue;
    byDate.set(date, localRowFromMeta(date, local, repoRoot));
  }

  return Array.from(byDate.values())
    .sort((a, b) => String(b.edition_date).localeCompare(String(a.edition_date)))
    .slice(0, limit);
}

/** DB row, else public/art/{date}.json — never throws. */
async function loadArtEditionResolved(editionDate, { loadArtEdition, repoRoot = repoRootFromHere() } = {}) {
  if (!DATE_RE.test(editionDate)) return null;

  let row = null;
  if (loadArtEdition) {
    try {
      row = await loadArtEdition(editionDate);
    } catch {
      row = null;
    }
  }

  if (row) return enrichArtRowFromFilesystem(row, repoRoot);

  const local = readLocalArtEditionMeta(editionDate, repoRoot);
  if (!local) return null;
  return enrichArtRowFromFilesystem(localRowFromMeta(editionDate, local, repoRoot), repoRoot);
}

/** Most recent edition from DB + local JSON merge. */
async function loadLatestArtEditionResolved({ loadArtEditions, repoRoot = repoRootFromHere(), limit = 1 } = {}) {
  if (!loadArtEditions) return null;
  const rows = await listArtEditionsMerged(loadArtEditions, { limit: Math.max(limit, 5), repoRoot });
  const first = rows[0];
  return first ? enrichArtRowFromFilesystem(first, repoRoot) : null;
}

module.exports = {
  readLocalArtEditionMeta,
  listLocalArtEditionDates,
  enrichArtRowFromFilesystem,
  localThumbnailFallback,
  localRowFromMeta,
  listArtEditionsMerged,
  loadArtEditionResolved,
  loadLatestArtEditionResolved,
  repoRootFromHere,
};
