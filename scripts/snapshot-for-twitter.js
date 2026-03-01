#!/usr/bin/env node
/**
 * Pythh Twitter Snapshot Generator
 * ===================================
 * Takes polished screenshots of pythh.ai pages and composites
 * them into a Twitter-ready card (1200×675px) with the pythh.ai brandmark.
 *
 * Usage:
 *   node scripts/snapshot-for-twitter.js             # all shots
 *   node scripts/snapshot-for-twitter.js live        # investor signals only
 *   node scripts/snapshot-for-twitter.js rankings    # rankings only
 *   node scripts/snapshot-for-twitter.js explore     # explore only
 *
 * Output: public/snapshots/pythh-<slug>-<timestamp>.png
 */

const puppeteer = require('puppeteer');
const sharp     = require('sharp');
const fs        = require('fs');
const path      = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL    = 'https://pythh.ai';
const OUT_DIR     = path.join(__dirname, '../public/snapshots');
const HISTORY_FILE = path.join(__dirname, '../.snapshot-history.json');
const CARD_W      = 1200;   // Twitter card width
const CARD_H      = 675;    // Twitter card height (16:9)
const VIEWPORT    = { width: 1400, height: 900 };
const ICON_SIZE   = 52;

// Accent cyan from app theme
const ACCENT = '#4dd9e0';

// Pythh icon path
const ICON_PATH = [
  path.join(__dirname, '../public/images/pythh-logo-square.png'),
  path.join(__dirname, '../public/images/delphi-pythia-icon-in-glyph-style-vector_glowing.jpg'),
].find(fs.existsSync);

// ── History tracking (prevents startup repeats) ──────────────────────────────
function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return []; }
}
function saveHistory(ids) {
  // Keep last 50 entries
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(ids.slice(-50), null, 2));
}

// Pages to capture: slug → { url, waitFor, scrollY, cropY (top % of page) }
const SHOTS = {
  live: {
    label:   'Live Investor Signals',
    url:     `${BASE_URL}/live`,
    waitFor: '.signal-flow, [class*="signal"], [class*="Signal"], table, .live',
    delay:   3500,   // let the live ticker animate a bit
    scrollY: 0,
  },
  rankings: {
    label:   'Startup Rankings',
    url:     `${BASE_URL}/rankings`,
    waitFor: 'table, [class*="rank"], [class*="Rank"], [class*="leaderboard"]',
    delay:   2500,
    scrollY: 0,
  },
  explore: {
    label:   'Explore Startups',
    url:     `${BASE_URL}/explore`,
    waitFor: '[class*="card"], [class*="startup"], [class*="grid"]',
    delay:   2500,
    scrollY: 0,
  },
  matches: {
    label:   'Investor Matches',
    url:     null, // resolved at runtime — random from top 20
    waitFor: '[data-testid*="match-table"], [class*="match"], table',
    delay:   4500,
    scrollY: 0,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString().slice(0,19).replace(/[T:]/g, '-');
}

async function waitForAny(page, selectors, timeout = 8000) {
  const sel = selectors.split(',').map(s => s.trim());
  return Promise.race(
    sel.map(s =>
      page.waitForSelector(s, { timeout }).catch(() => null)
    )
  );
}

async function screenshotPage(browser, slug, cfg) {
  console.log(`\n📷  Capturing: ${cfg.label} (${cfg.url})`);

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Dark mode via prefers-color-scheme
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

  // Suppress auth modals / cookie banners
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('pythh_dismissed_modal', 'true');
    localStorage.setItem('cookieConsent', 'true');
  });

  await page.goto(cfg.url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for key content
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  await waitForAny(page, cfg.waitFor).catch(() => {});
  await sleep(cfg.delay);

  // Scroll to desired Y
  if (cfg.scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), cfg.scrollY);
    await sleep(600);
  }

  // Hide noisy UI: nav, footers, modals, scroll indicators
  await page.evaluate(() => {
    const hide = [
      'nav', 'footer', '[class*="cookie"]', '[class*="modal"]',
      '[class*="banner"]', '[class*="toast"]', '[class*="scroll-indicator"]',
      '[class*="CookieConsent"]', '[id*="cookie"]',
    ];
    hide.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.tagName.toLowerCase() !== 'nav' || el.closest('main')) return; // keep inner navs
        el.style.visibility = 'hidden';
      });
    });
    // Also hide the top nav entirely
    document.querySelectorAll('nav').forEach(el => el.style.display = 'none');
  }).catch(() => {});

  // Full-page screenshot (PNG)
  const rawBuf = await page.screenshot({ type: 'png', fullPage: false });
  await page.close();

  return rawBuf;
}

async function buildCard(rawBuf, cfg, slug) {
  const timestamp = ts();
  const outFile   = path.join(OUT_DIR, `pythh-${slug}-${timestamp}.png`);

  // Resize screenshot to fit card width
  const shot = await sharp(rawBuf)
    .resize(CARD_W, CARD_H, { fit: 'cover', position: 'top' })
    .toBuffer();

  // Build SVG overlay: dark vignette + branding
  // Icon is composited separately as a raster layer
  const iconX = CARD_W - ICON_SIZE - 28;
  const iconY = CARD_H - ICON_SIZE - 20;

  const svg = `
<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Bottom vignette for legibility -->
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%"  stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.78"/>
    </linearGradient>
    <!-- Top vignette (lighter) -->
    <linearGradient id="topVig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="black" stop-opacity="0.35"/>
      <stop offset="18%" stop-color="black" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Vignettes -->
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#vignette)"/>
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#topVig)"/>

  <!-- Bottom-left: label -->
  <text
    x="36" y="${CARD_H - 54}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="17"
    font-weight="400"
    letter-spacing="4"
    fill="${ACCENT}"
    opacity="0.9"
  >${cfg.label.toUpperCase()}</text>

  <!-- Bottom-left: timestamp -->
  <text
    x="36" y="${CARD_H - 28}"
    font-family="ui-monospace, 'SF Mono', Menlo, monospace"
    font-size="12"
    fill="white"
    opacity="0.45"
  >${new Date().toUTCString()}</text>

  <!-- Bottom-right: pythh.ai wordmark (sits left of icon) -->
  <text
    x="${iconX - 12}" y="${CARD_H - 34}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="20"
    font-weight="400"
    fill="white"
    text-anchor="end"
    opacity="0.88"
  >pythh.ai</text>

  <!-- Thin accent bottom line -->
  <line x1="30" y1="${CARD_H - 8}" x2="${CARD_W - 30}" y2="${CARD_H - 8}"
    stroke="${ACCENT}" stroke-width="1.5" stroke-opacity="0.4"/>
</svg>`;

  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();

  // Composite layers: screenshot → vignette overlay → icon
  const layers = [{ input: overlay, blend: 'over' }];

  if (ICON_PATH) {
    const iconBuf = await sharp(ICON_PATH)
      .resize(ICON_SIZE, ICON_SIZE, { fit: 'cover' })
      .png()
      .toBuffer();
    layers.push({ input: iconBuf, top: iconY, left: iconX, blend: 'over' });
  }

  await sharp(shot)
    .composite(layers)
    .png({ compressionLevel: 8 })
    .toFile(outFile);

  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`   ✅  ${path.basename(outFile)} (${kb} KB)`);
  return outFile;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const target = process.argv[2]; // optional slug filter

  const toCapture = target
    ? Object.entries(SHOTS).filter(([k]) => k === target)
    : Object.entries(SHOTS);

  if (toCapture.length === 0) {
    console.error(`❌  Unknown target "${target}". Options: ${Object.keys(SHOTS).join(', ')}`);
    process.exit(1);
  }

  // Ensure output dir
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Resolve dynamic URLs
  if (SHOTS.matches.url === null) {
    try {
      const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
      const { data } = await sb.from('startup_uploads')
        .select('id,name')
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false })
        .limit(20);
      if (data?.length) {
        const history = loadHistory();
        // Exclude recently used IDs; fall back to full list if all used
        const pool = data.filter(s => !history.includes(s.id));
        const candidates = pool.length > 0 ? pool : data;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        SHOTS.matches.url = `${BASE_URL}/signal-matches?startup=${pick.id}`;
        saveHistory([...history, pick.id]);
        const freshLabel = pool.length > 0 ? '' : ' (pool reset)';
        console.log(`🎲 Picked startup: ${pick.name}${freshLabel}`);
      }
    } catch (e) {
      SHOTS.matches.url = `${BASE_URL}/signal-matches?startup=f2420c2e-0952-4fe3-aad9-aff033918c6a`;
      console.warn('⚠️  Could not resolve top startup, using fallback');
    }
  }

  console.log('🔮 Pythh Twitter Snapshot Generator');
  console.log('=====================================');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📐 Card size: ${CARD_W}×${CARD_H}px`);

  const browser = await puppeteer.launch({
    headless: 'new',   // new headless mode (quieter)
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
    ],
  });

  const saved = [];

  for (const [slug, cfg] of toCapture) {
    try {
      const rawBuf = await screenshotPage(browser, slug, cfg);
      const file   = await buildCard(rawBuf, cfg, slug);
      saved.push(file);
    } catch (err) {
      console.error(`   ⚠️  Failed "${slug}": ${err.message}`);
    }
  }

  await browser.close();

  if (saved.length) {
    console.log('\n📂 Output files:');
    saved.forEach(f => console.log(`   ${f}`));
    console.log('\n💡 Tip: run with a slug to grab one shot — e.g. node scripts/snapshot-for-twitter.js live');
  }
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
