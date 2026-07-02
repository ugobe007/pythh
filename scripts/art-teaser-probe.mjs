#!/usr/bin/env node
/**
 * Verify /api/art/teaser returns a usable edition (used by signal-art-daily workflow + CI).
 *
 * Usage:
 *   node scripts/art-teaser-probe.mjs
 *   node scripts/art-teaser-probe.mjs --base https://pythh.ai
 */

const base = (
  process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] ||
  process.env.BASE ||
  'https://pythh.ai'
).replace(/\/$/, '');

const today = new Date().toISOString().slice(0, 10);

async function main() {
  const url = `${base}/api/art/teaser`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[art-probe] FAIL HTTP ${res.status} ${url}`);
    process.exit(1);
  }

  if (!body?.edition_date) {
    console.error('[art-probe] FAIL missing edition_date', body);
    process.exit(1);
  }

  const thumb =
    body.thumbnail_url ||
    (body.raster_url ? body.raster_url.replace(/(\d{4}-\d{2}-\d{2})(\.(jpg|jpeg|png))?(\?.*)?$/i, '$1-thumb.jpg$4') : null);

  if (thumb && thumb.startsWith('http')) {
    const img = await fetch(thumb, { method: 'HEAD' });
    if (!img.ok) {
      console.error(`[art-probe] FAIL thumbnail HTTP ${img.status} ${thumb}`);
      process.exit(1);
    }
  }

  const label = body.is_today === false || body.stale ? 'stale-fallback' : 'today';
  console.log(
    `[art-probe] OK ${label} edition=${body.edition_date} today=${today} title=${body.title || '(none)'}`,
  );
}

main().catch((e) => {
  console.error('[art-probe] FAIL', e.message || e);
  process.exit(1);
});
