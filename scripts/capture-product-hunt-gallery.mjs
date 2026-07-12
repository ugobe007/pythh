#!/usr/bin/env node
/**
 * Capture Product Hunt gallery screenshots (1270×760, 16:9).
 *
 *   node scripts/capture-product-hunt-gallery.mjs
 *   node scripts/capture-product-hunt-gallery.mjs --base https://pythh.ai
 *   node scripts/capture-product-hunt-gallery.mjs --base http://localhost:5173
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'assets', 'product-hunt-gallery');
const BASE = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] || 'https://pythh.ai';
const VIEWPORT = { width: 1270, height: 760, deviceScaleFactor: 2 };

const SHOTS = [
  { file: '01-home-hero.png', path: '/', wait: 2500, label: 'Home — URL hero' },
  { file: '02-platform-engine.png', path: '/platform', wait: 2000, label: 'Platform — signal engine' },
  { file: '03-portfolio-oracle.png', path: '/portfolio', wait: 3500, label: 'Oracle portfolio scoreboard' },
  { file: '04-explore-rankings.png', path: '/explore', wait: 2500, label: 'Explore startups' },
  { file: '05-investor-rankings.png', path: '/investors', wait: 2500, label: 'Investor rankings' },
  { file: '06-methodology-god.png', path: '/methodology', wait: 2000, label: 'GOD score methodology' },
];

async function capture(page, { file, path: route, wait }) {
  const url = `${BASE.replace(/\/$/, '')}${route}`;
  console.log(`  📸 ${file} ← ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({
    path: path.join(OUT_DIR, file),
    type: 'png',
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n🖼  Product Hunt gallery capture`);
  console.log(`   base: ${BASE}`);
  console.log(`   size: ${VIEWPORT.width}×${VIEWPORT.height} @${VIEWPORT.deviceScaleFactor}x`);
  console.log(`   out:  ${OUT_DIR}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1270,760'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    for (const shot of SHOTS) {
      try {
        await capture(page, shot);
      } catch (e) {
        console.warn(`   ⚠ skipped ${shot.file}: ${e.message}`);
      }
    }

    // Optional: matches page if data loads
    try {
      await capture(page, {
        file: '07-matches.png',
        path: '/matches',
        wait: 4000,
        label: 'Matches',
      });
    } catch {
      console.warn('   ⚠ skipped 07-matches.png');
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✅ Gallery saved to assets/product-hunt-gallery/\n`);
  console.log('Product Hunt upload order (recommended):');
  SHOTS.forEach((s, i) => console.log(`  ${i + 1}. ${s.file} — ${s.label}`));
  console.log('  7. 07-matches.png — match results (if captured)\n');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
