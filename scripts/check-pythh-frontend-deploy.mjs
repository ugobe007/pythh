#!/usr/bin/env node
/**
 * Verify pythh.ai serves a fresh frontend (via Fly proxy or matching pythh-build).
 */
import { execSync } from 'node:child_process';

const ORIGIN = process.env.APP_URL?.replace(/\/$/, '') || 'https://pythh.ai';
const FLY = 'https://hot-honey.fly.dev';
const expected =
  process.env.EXPECTED_SHA?.trim() ||
  execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

// Root `/` may be a Vercel placeholder until proxy-only redeploy; probe known routes.
const PROBE_PATHS = ['/', '/signup/investor'];

async function fetchHtml(url, path) {
  return fetch(`${url}${path}?t=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
  }).then((r) => r.text());
}

function isPlaceholderHome(html) {
  return /pythh fly proxy/i.test(html) || html.length < 200;
}

function assetHash(html) {
  const m = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  return m?.[1] ?? null;
}

function buildMeta(html) {
  const m = html.match(/name="pythh-build"\s+content="([^"]+)"/);
  return m?.[1] ?? null;
}

const [liveHomeHtml, liveRouteHtml, flyHtml] = await Promise.all([
  fetchHtml(ORIGIN, PROBE_PATHS[0]),
  fetchHtml(ORIGIN, PROBE_PATHS[1]),
  fetchHtml(FLY, '/'),
]);
const liveHtml = isPlaceholderHome(liveHomeHtml) ? liveRouteHtml : liveHomeHtml;
const liveMeta = buildMeta(liveHtml);
const liveAsset = assetHash(liveHtml);
const flyAsset = assetHash(flyHtml);
const homeBroken = isPlaceholderHome(liveHomeHtml);

console.log(`Expected (local HEAD): ${expected}`);
console.log(`Live  (${ORIGIN}/):           home=${homeBroken ? 'PLACEHOLDER' : 'ok'} asset=${assetHash(liveHomeHtml) ?? '—'}`);
console.log(`Live  (${ORIGIN}${PROBE_PATHS[1]}): asset=${assetHash(liveRouteHtml) ?? '—'}`);
console.log(`Fly   (${FLY}):        asset=${flyAsset ?? '—'}`);

if (liveMeta && (liveMeta.startsWith(expected.slice(0, 7)) || liveMeta === expected)) {
  console.log('✅ pythh-build matches HEAD');
  process.exit(0);
}

if (liveAsset && flyAsset && liveAsset === flyAsset) {
  console.log('✅ pythh.ai asset bundle matches Fly (proxy OK)');
  if (homeBroken) {
    console.warn('⚠️  Homepage / still Vercel placeholder — redeploy **pythh** project on Vercel (proxy-only vercel.json)');
    process.exit(1);
  }
  process.exit(0);
}

if (flyHtml.includes('signup/investor') || (flyAsset && liveAsset === flyAsset)) {
  console.log('✅ Fly has current routes');
}

console.error('❌ Stale frontend on pythh.ai — redeploy Vercel (vercel.json proxy) + confirm Fly Deploy passed');
process.exit(1);
