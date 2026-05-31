#!/usr/bin/env node
/**
 * Verify LinkedIn Developer + company page API access for social posting.
 *
 * Usage:
 *   LINKEDIN_ACCESS_TOKEN=... LINKEDIN_ORGANIZATION_ID=... node scripts/verify-linkedin-setup.mjs
 *   node scripts/verify-linkedin-setup.mjs --preview   # dry-run post copy only
 *
 * Note: The numeric code LinkedIn emails for account verification is NOT the API token.
 * You need an OAuth access token from developer.linkedin.com with w_organization_social.
 */
import 'dotenv/config';

const token = process.env.LINKEDIN_ACCESS_TOKEN;
const orgId = process.env.LINKEDIN_ORGANIZATION_ID;

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

async function linkedInGet(path) {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

console.log('\nLinkedIn setup check for Pythh social posting\n');

if (!token) fail('LINKEDIN_ACCESS_TOKEN is not set');
if (!orgId) fail('LINKEDIN_ORGANIZATION_ID is not set (numeric company page ID)');

ok(`Organization ID configured: ${orgId}`);

const me = await linkedInGet('/v2/userinfo');
if (me.status === 200) {
  ok(`Token valid — signed in as ${me.body?.name || me.body?.email || 'unknown'}`);
} else if (me.status === 401) {
  fail('Access token rejected (401). Generate a new token at developer.linkedin.com — email verification codes are not API tokens.');
} else {
  console.log(`⚠️  /v2/userinfo returned ${me.status}:`, JSON.stringify(me.body).slice(0, 200));
}

const orgs = await linkedInGet('/v2/organizationalEntityAcls?q=roleAssignee');
if (orgs.status === 200 && orgs.body?.elements?.length) {
  const ids = orgs.body.elements
    .map((e) => e.organizationalTarget?.replace('urn:li:organization:', ''))
    .filter(Boolean);
  ok(`Token can admin ${ids.length} organization(s): ${ids.join(', ')}`);
  if (!ids.includes(String(orgId))) {
    console.log(`⚠️  LINKEDIN_ORGANIZATION_ID=${orgId} not in your admin list. Use one of: ${ids.join(', ')}`);
  }
} else {
  console.log(`⚠️  Could not list org admin roles (${orgs.status}). You may still be able to post if the app has w_organization_social.`);
}

if (process.argv.includes('--preview')) {
  console.log('\nPreview mode — no post sent.');
  console.log('To test a real post locally: node server/social-poster.js --preview');
  process.exit(0);
}

console.log('\nNext steps if posting still fails:');
console.log('  1. developer.linkedin.com → your app → Products → enable "Share on LinkedIn"');
console.log('  2. Token scopes must include w_organization_social');
console.log('  3. Add secrets to GitHub Actions: LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORGANIZATION_ID');
console.log('  4. Test: node server/social-poster.js --preview\n');
