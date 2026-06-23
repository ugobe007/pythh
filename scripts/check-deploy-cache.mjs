#!/usr/bin/env node
/**
 * Post-deploy verification — pythh.ai + Fly bundle parity, cache headers.
 *
 * Usage: npm run check:deploy-cache
 */

const ORIGIN = 'https://pythh.ai';
const FLY = 'https://hot-honey.fly.dev';

async function head(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const cc = res.headers.get('cache-control') || '—';
  const cdn = res.headers.get('cdn-cache-control') || '—';
  const vercel = res.headers.get('x-vercel-cache') || '—';
  const age = res.headers.get('age') || '—';
  const html = await res.text();
  const asset = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1] ?? '—';
  const placeholder = /pythh fly proxy/i.test(html);
  return { status: res.status, cc, cdn, vercel, age, asset, placeholder, ok: res.ok && !placeholder };
}

async function main() {
  console.log('\n🔍 Deploy cache check\n');
  const [home, fly] = await Promise.all([head(`${ORIGIN}/?t=${Date.now()}`), head(`${FLY}/?t=${Date.now()}`)]);

  console.log('pythh.ai /');
  console.log(`  status=${home.status} asset=${home.asset} placeholder=${home.placeholder}`);
  console.log(`  cache-control=${home.cc}`);
  console.log(`  cdn-cache-control=${home.cdn} x-vercel-cache=${home.vercel} age=${home.age}`);

  console.log('\nFly /');
  console.log(`  status=${fly.status} asset=${fly.asset}`);
  console.log(`  cache-control=${fly.cc}`);

  if (home.ok) {
    console.log('\n✅ pythh.ai homepage OK');
    process.exit(0);
  }
  console.error('\n❌ pythh.ai homepage still broken or cached placeholder');
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
