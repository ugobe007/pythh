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
const {
  generatePythhArtEdition,
  saveArtEdition,
  loadArtEdition,
  ensureArtEditionRaster,
  refreshStaleTodayEdition,
} = require('../server/lib/pythhArtGenerator');
const { enrichArtRowFromFilesystem } = require('../server/lib/artEditionLocal');

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const targetDate = dateArg ? dateArg.split('=')[1] : null;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'public', 'art');

async function persistLocalEdition(edition) {
  fs.mkdirSync(outDir, { recursive: true });
  const svgPath = path.join(outDir, `${edition.edition_date}.svg`);
  if (edition.svg) fs.writeFileSync(svgPath, edition.svg);

  const metaPath = path.join(outDir, `${edition.edition_date}.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        edition_date: edition.edition_date,
        seed: edition.seed,
        copy: edition.copy,
        raster_url: edition.raster_url,
        thumbnail_url: edition.thumbnail_url,
        raster_provider: edition.raster_provider,
        raster_model: edition.raster_model,
        signal_snapshot: edition.signal_snapshot,
        generated_at: edition.generated_at,
      },
      null,
      2,
    ),
  );
  console.log(`[pythh-art] Local meta → ${metaPath}`);
}

async function main() {
  console.log('[pythh-art] Loading market signals…');

  if (process.env.SIGNAL_ART_RASTER !== '0') {
    const { getGeminiApiKey } = require('../server/lib/signalArtGemini');
    if (!getGeminiApiKey()) {
      console.error('[pythh-art] GEMINI_API_KEY missing — set repo secret or export locally');
      process.exit(1);
    }
  }

  const today = targetDate || new Date().toISOString().slice(0, 10);
  let existing = await loadArtEdition(today);

  if (existing && !FORCE) {
    const enriched = enrichArtRowFromFilesystem(existing, repoRoot);
    const snap = enriched.signal_snapshot || {};
    const provider = enriched.raster_provider ?? snap.raster_provider;
    const hasRaster = enriched.raster_url ?? snap.raster_url;
    const needsGeminiRegen = hasRaster && provider === 'svg_fallback' && !process.env.SIGNAL_ART_SVG_FALLBACK;

    if (hasRaster && !needsGeminiRegen) {
      if (process.env.PYTHH_ART_REFRESH_STALE === '1') {
        const refreshed = await refreshStaleTodayEdition(enriched, {
          repoRoot,
          generateNewsletter,
          today,
        });
        if (refreshed && refreshed !== enriched) {
          await persistLocalEdition(refreshed);
          try {
            await saveArtEdition(refreshed);
            console.log(`[pythh-art] Refreshed stale ${today} (new layout for same signal fingerprint)`);
          } catch (e) {
            console.warn('[pythh-art] Refresh save failed (local copy kept):', e.message);
          }
          return;
        }
      }
      console.log(`[pythh-art] ${today} already has raster — use --force to regenerate`);
      return;
    }

    if (needsGeminiRegen) {
      console.log(`[pythh-art] ${today} has svg_fallback raster — regenerating via Gemini…`);
    } else if (!hasRaster) {
      console.log(`[pythh-art] ${today} exists without raster — backfilling…`);
      const backfilled = await ensureArtEditionRaster(enriched, { repoRoot });
      const raster = backfilled.raster_url ?? backfilled.signal_snapshot?.raster_url;
      if (raster) {
        await persistLocalEdition(backfilled);
        try {
          await saveArtEdition(backfilled);
        } catch (e) {
          console.warn('[pythh-art] Backfill save failed (local copy kept):', e.message);
        }
        console.log(`[pythh-art] Backfill OK: ${raster}`);
        return;
      }
      console.warn('[pythh-art] Backfill failed — generating fresh edition');
    }
  }

  let edition;
  try {
    const newsletter = await generateNewsletter({ bust: true });
    if (targetDate) newsletter.date = targetDate;

    edition = await generatePythhArtEdition(newsletter, {
      repoRoot,
      generateRaster: !DRY,
    });
  } catch (e) {
    console.error('[pythh-art] Generation failed:', e.message || e);
    if (existing) {
      console.warn('[pythh-art] Keeping previous edition for today');
      if (process.env.GITHUB_ACTIONS === 'true' || process.env.SIGNAL_ART_REQUIRE_GEMINI === '1') {
        process.exitCode = 1;
      }
      return;
    }
    throw e;
  }

  console.log(`[pythh-art] Edition ${edition.edition_date} · seed=${edition.seed}`);
  if (edition.raster_url) {
    console.log(`[pythh-art] Raster (${edition.raster_provider || 'gemini'}): ${edition.raster_url}`);
  } else if (edition.signal_snapshot?.raster_error) {
    const err = edition.signal_snapshot.raster_error;
    console.error(`[pythh-art] Raster missing: ${err.reason} — ${err.error || err.hint || ''}`);
    if (process.env.GITHUB_ACTIONS === 'true' || process.env.SIGNAL_ART_REQUIRE_GEMINI === '1') {
      process.exitCode = 1;
    }
  } else if (process.env.GITHUB_ACTIONS === 'true' || process.env.SIGNAL_ART_REQUIRE_GEMINI === '1') {
    console.error('[pythh-art] Raster missing — Gemini required in CI');
    process.exitCode = 1;
  }

  await persistLocalEdition(edition);
  const svgPath = path.join(outDir, `${edition.edition_date}.svg`);
  console.log(`[pythh-art] SVG → ${svgPath}`);

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
    console.log('[pythh-art] Saved to pythh_art_editions (raster/thumbnail in signal_snapshot)');
  } catch (e) {
    if (/does not exist/i.test(e.message || '')) {
      console.warn('[pythh-art] Table missing — run migration 20260627000000_pythh_art_editions.sql');
    }
    console.warn('[pythh-art] Supabase save failed (local edition kept):', e.message || e);
    process.exitCode = 0;
  }
}

main().catch((e) => {
  console.error('[pythh-art] Fatal:', e.message || e);
  process.exit(1);
});
