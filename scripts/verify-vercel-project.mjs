#!/usr/bin/env node
/**
 * CI preflight — confirm VERCEL_TOKEN + ORG + PROJECT resolve to the pythh project.
 * Usage: VERCEL_TOKEN=… VERCEL_ORG_ID=… VERCEL_PROJECT_ID=… node scripts/verify-vercel-project.mjs
 */

const token = process.env.VERCEL_TOKEN;
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;
const expectedName = process.env.VERCEL_EXPECTED_PROJECT || 'pythh';

if (!token || !orgId || !projectId) {
  console.error('::error::Missing VERCEL_TOKEN, VERCEL_ORG_ID, or VERCEL_PROJECT_ID');
  process.exit(1);
}

const url = `https://api.vercel.com/v9/projects/${projectId}?teamId=${orgId}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`::error::Vercel API ${res.status}: ${body.error?.message || res.statusText}`);
  console.error('Check GitHub secrets VERCEL_ORG_ID + VERCEL_PROJECT_ID match the pythh project (Settings → General).');
  process.exit(1);
}

const name = body.name || body.slug;
if (name !== expectedName) {
  console.error(`::error::VERCEL_PROJECT_ID points to "${name}", expected "${expectedName}"`);
  process.exit(1);
}

console.log(`✅ Vercel project verified: ${name} (${projectId})`);
