#!/usr/bin/env node
/**
 * Fail when pythh.ai frontend build SHA does not match expected Git commit.
 *
 * Usage:
 *   npm run check:deploy-sha
 *   EXPECTED_SHA=abc123 npm run check:deploy-sha
 *   node scripts/verify-prod-build-sha.mjs --json
 */

import { execSync } from 'node:child_process';

const JSON_OUT = process.argv.includes('--json');
const ORIGIN = (process.env.BASE || 'https://pythh.ai').replace(/\/$/, '');
const MAX_ATTEMPTS = Number(process.env.DEPLOY_SHA_ATTEMPTS || 12);
const RETRY_MS = Number(process.env.DEPLOY_SHA_RETRY_MS || 15000);

function expectedSha() {
  return (
    process.env.EXPECTED_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  );
}

function shaMatches(deployed, expected) {
  if (!deployed || !expected) return false;
  const d = deployed.toLowerCase();
  const e = expected.toLowerCase();
  return d === e || d.startsWith(e) || e.startsWith(d);
}

async function fetchBuildSha() {
  const res = await fetch(`${ORIGIN}/?t=${Date.now()}`, { redirect: 'follow' });
  const html = await res.text();
  const m = html.match(/name="pythh-build"\s+content="([^"]+)"/i);
  return {
    ok: res.ok,
    status: res.status,
    deployed_sha: m?.[1]?.trim() || null,
    placeholder: /pythh fly proxy/i.test(html),
  };
}

async function main() {
  const expected = expectedSha();
  let last = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await fetchBuildSha();
    if (last.placeholder) {
      last.error = 'homepage still serving Fly placeholder';
    } else if (!last.deployed_sha) {
      last.error = 'pythh-build meta tag missing (stale deploy or build plugin off)';
    } else if (shaMatches(last.deployed_sha, expected)) {
      const report = {
        ok: true,
        origin: ORIGIN,
        expected_sha: expected,
        deployed_sha: last.deployed_sha,
        attempt,
      };
      if (JSON_OUT) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`\n✅ Deploy SHA match (${attempt}/${MAX_ATTEMPTS})`);
        console.log(`   expected=${expected.slice(0, 12)}…`);
        console.log(`   deployed=${last.deployed_sha.slice(0, 12)}…\n`);
      }
      process.exit(0);
    } else {
      last.error = `SHA mismatch: deployed=${last.deployed_sha?.slice(0, 12)} expected=${expected.slice(0, 12)}`;
    }

    if (attempt < MAX_ATTEMPTS) {
      if (!JSON_OUT) console.log(`   attempt ${attempt}: ${last.error} — retry in ${RETRY_MS / 1000}s…`);
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }

  const report = {
    ok: false,
    origin: ORIGIN,
    expected_sha: expected,
    deployed_sha: last?.deployed_sha || null,
    status: last?.status,
    error: last?.error || 'deploy SHA verify failed',
    attempts: MAX_ATTEMPTS,
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`\n❌ ${report.error}\n`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
