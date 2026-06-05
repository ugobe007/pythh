#!/usr/bin/env node
/**
 * Production OAuth smoke tests (no real Google login required).
 * Run: node scripts/smoke-oauth-prod.mjs
 */
const ORIGIN = process.env.SMOKE_ORIGIN || "https://pythh.ai";

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

async function main() {
  // 1) Callback forwards code to /account (not login?missing_code)
  const cb = await fetch(
    `${ORIGIN}/api/auth/supabase/callback?code=smoke-test-code`,
    { redirect: "manual" },
  );
  const loc = cb.headers.get("location") || "";
  if (cb.status !== 302) fail(`callback status ${cb.status}, expected 302`);
  else if (!loc.includes("/account") || !loc.includes("code=smoke-test-code")) {
    fail(`callback location wrong: ${loc}`);
  } else pass(`callback forwards to account (${loc})`);

  // 2) Callback without code → account (not missing_code login)
  const cb2 = await fetch(`${ORIGIN}/api/auth/supabase/callback`, { redirect: "manual" });
  const loc2 = cb2.headers.get("location") || "";
  if (cb2.status !== 302) fail(`callback no-code status ${cb2.status}`);
  else if (loc2.includes("missing_code")) fail(`callback no-code still returns missing_code`);
  else if (!loc2.includes("/account")) fail(`callback no-code location: ${loc2}`);
  else pass(`callback without code → ${loc2}`);

  // 3) Prod bundle + early hash sync script
  const html = await fetch(`${ORIGIN}/`).then((r) => r.text());
  const m = html.match(/index-([A-Za-z0-9_-]+)\.js/);
  if (!m) fail("could not find index bundle in HTML");
  else {
    const js = await fetch(`${ORIGIN}/assets/index-${m[1]}.js`).then((r) => r.text());
    if (!js.includes("/api/auth/supabase/callback")) {
      fail("bundle missing server OAuth callback redirect");
    } else if (!js.includes("pythh_pkce_verifier")) {
      fail("bundle missing PKCE session backup");
    } else pass("bundle has server callback redirect + PKCE backup");
  }
  if (!html.includes("pythh-oauth-hash-sync.js")) {
    fail("index.html missing pythh-oauth-hash-sync.js script tag");
  } else pass("index.html loads early OAuth hash sync");
  const hashJsRes = await fetch(`${ORIGIN}/pythh-oauth-hash-sync.js`);
  if (!hashJsRes.ok) fail(`pythh-oauth-hash-sync.js HTTP ${hashJsRes.status}`);
  else {
    const hashJs = await hashJsRes.text();
    if (!hashJs.includes("sync-supabase")) fail("pythh-oauth-hash-sync.js missing sync call");
    else pass("pythh-oauth-hash-sync.js served from prod");
  }

  // 4) auth.me without cookie is null
  const me = await fetch(`${ORIGIN}/api/trpc/auth.me?input=${encodeURIComponent("{}")}`).then(
    (r) => r.json(),
  );
  const user = me?.result?.data?.json;
  if (user != null) fail("auth.me without cookie should be null");
  else pass("auth.me unauthenticated returns null");

  // 5) sync-supabase rejects empty token
  const syncRes = await fetch(`${ORIGIN}/api/auth/sync-supabase`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: "" }),
  });
  if (syncRes.ok) fail("sync-supabase should reject empty token");
  else pass(`sync-supabase rejects empty token (${syncRes.status})`);

  if (failures.length) {
    console.error(`\n${failures.length} smoke test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll OAuth smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
