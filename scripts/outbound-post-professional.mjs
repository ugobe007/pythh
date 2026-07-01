#!/usr/bin/env node
/**
 * Professional outbound — LinkedIn + X only (no Reddit).
 * Peter voice · thesis-fit weekly data · /find-investors CTA
 *
 * Usage:
 *   node scripts/outbound-post-professional.mjs --channel both
 *   node scripts/outbound-post-professional.mjs --channel linkedin --copy-only
 *   node scripts/outbound-post-professional.mjs --channel x --dry-run
 *   node scripts/outbound-post-professional.mjs --variant find_investors
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { generateWeeklyThesisReport } = require('../server/lib/weeklyThesisReport.js');
const {
  hasTwitterCredentials,
  hasLinkedInOrgCredentials,
  postToX,
  postToLinkedInOrg,
  logOutboundPost,
} = await import('./lib/socialPublish.mjs');

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (f) => args.includes(f);

const CHANNEL = argVal('--channel', 'both');
const VARIANT = argVal('--variant', 'weekly_thesis');
const DRY_RUN = hasFlag('--dry-run');
const COPY_ONLY = hasFlag('--copy-only');

const SITE = (process.env.SITE_URL || 'https://pythh.ai').replace(/\/$/, '');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function findInvestorsPosts() {
  const link = `${SITE}/find-investors?utm_source=linkedin&utm_medium=social&utm_campaign=find_investors`;
  const xLink = `${SITE}/find-investors?utm_source=x&utm_medium=social&utm_campaign=find_investors`;

  return {
    linkedin: `Peter · Pythh Match Desk

Most founders don't fail because the company is bad. They fail because the room was wrong — thesis misalignment, wrong stage, wrong timing.

We built Pythh for founders outside Silicon Valley who don't have exited founders coaching them on who to talk to and how to frame it.

Paste your startup URL → investors ranked by thesis fit + who's actively deploying in your sector.

Free preview: ${link}

If you're raising pre-seed/seed, try it and tell me what's missing. I reply.`,
    x: `Raising without a Bay Area network?

Paste your URL → see which investors actually fit your stage + sector (thesis + timing).

Free preview: ${xLink}

— Peter, Pythh Match Desk`,
    campaign: 'find_investors',
  };
}

async function weeklyThesisPosts() {
  const { report } = await generateWeeklyThesisReport(sb, { days: 7 });
  const s = report.sector;
  const sector = report.featured_sector || 'AI/ML';
  const top = (s.top_startups || [])
    .slice(0, 3)
    .map((r) => `${r.name} (${r.score})`)
    .join(', ');
  const link = `${SITE}/find-investors?utm_source=linkedin&utm_medium=social&utm_campaign=thesis_fit`;
  const xLink = `${SITE}/find-investors?utm_source=x&utm_medium=social&utm_campaign=thesis_fit`;

  return {
    linkedin: `Peter · Pythh Match Desk — Weekly ${sector} snapshot

This week: ${s.god70_plus} startups scored 70+ in ${sector}. ${s.investors?.active_early_stage || s.investors?.early_stage || '—'} investors actively covering pre-seed/seed.

Signal delta: ${s.new_7d} new names approved (${s.signal_delta >= 0 ? '+' : ''}${s.signal_delta ?? 0} vs prior week).

Most founders don't need more investor names. They need to know which firms are actually deploying in their thesis — and how to frame the conversation.

Top scored: ${top || 'see live rankings'}

Paste your startup URL → ranked shortlist in ~20 seconds (free):
${link}

Reply if you want help framing for a specific firm.`,
    x: `Pythh Weekly · ${sector}
${s.god70_plus} startups at GOD 70+ · ${s.investors?.active_early_stage || s.investors?.early_stage || '—'} pre-seed/seed investors · ${s.new_7d} new this week

Thesis fit > cold lists.

Paste your URL → ${xLink}

— Peter`,
    campaign: 'thesis_fit',
  };
}

async function resolvePosts() {
  if (VARIANT === 'find_investors') return findInvestorsPosts();
  return weeklyThesisPosts();
}

async function runLinkedIn(text, campaign) {
  console.log('\n── LinkedIn ──\n');
  console.log(text);
  console.log('\n────────────────');

  if (COPY_ONLY) {
    console.log('\n  📋 Copy-only — paste on your LinkedIn profile (Start a post). Personal posts outperform company pages for early traction.');
    return { ok: true, channel: 'linkedin', mode: 'copy_only' };
  }

  if (!hasLinkedInOrgCredentials()) {
    console.log('\n  ℹ️  No LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORGANIZATION_ID — post manually on your profile (recommended for founders).');
    await logOutboundPost(sb, { platform: 'linkedin', channel: 'linkedin', postId: 'manual_profile', campaign, dryRun: DRY_RUN });
    return { ok: true, channel: 'linkedin', mode: 'manual_profile' };
  }

  if (DRY_RUN) {
    console.log('\n  📋 DRY RUN — would post to LinkedIn org', process.env.LINKEDIN_ORGANIZATION_ID);
    return { ok: true, channel: 'linkedin', mode: 'api_dry' };
  }

  try {
    const result = await postToLinkedInOrg(text);
    console.log('\n  ✅ LinkedIn org posted:', result.id);
    await logOutboundPost(sb, { platform: 'linkedin', channel: 'linkedin', postId: result.id, campaign, dryRun: false });
    return { ok: true, channel: 'linkedin', postId: result.id };
  } catch (e) {
    console.error('\n  ❌ LinkedIn API failed:', e.message);
    console.log('  → Fall back: copy the text above to your personal LinkedIn profile.');
    return { ok: false, channel: 'linkedin', error: e.message };
  }
}

async function runX(text, campaign) {
  console.log('\n── X / Twitter ──\n');
  console.log(text);
  console.log('\n────────────────');

  if (!hasTwitterCredentials()) {
    console.log('\n  ⚠️  TWITTER_* keys not set in .env');
    return { ok: false, channel: 'x', mode: 'missing_credentials' };
  }

  if (DRY_RUN || COPY_ONLY) {
    console.log(`\n  📋 ${DRY_RUN ? 'DRY RUN' : 'Copy-only'} — ${COPY_ONLY ? 'paste at x.com/compose/post' : 'would tweet'}`);
    return { ok: true, channel: 'x', mode: DRY_RUN ? 'api_dry' : 'copy_only' };
  }

  try {
    const id = await postToX(text);
    console.log('\n  ✅ X posted:', id);
    await logOutboundPost(sb, { platform: 'x', channel: 'x', postId: id, campaign, dryRun: false });
    return { ok: true, channel: 'x', postId: id };
  } catch (e) {
    console.error('\n  ❌ X failed:', e.message);
    return { ok: false, channel: 'x', error: e.message };
  }
}

async function main() {
  const posts = await resolvePosts();
  const channels =
    CHANNEL === 'both'
      ? ['linkedin', 'x']
      : CHANNEL.split(',').map((s) => s.trim()).filter(Boolean);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Professional outbound (LinkedIn + X)', DRY_RUN ? '· DRY RUN' : '', COPY_ONLY ? '· COPY ONLY' : '');
  console.log(' Variant:', VARIANT, '| Campaign:', posts.campaign);
  console.log(' Channels:', channels.join(', '));
  console.log('═══════════════════════════════════════════════════════════════');

  const results = [];
  if (channels.includes('linkedin')) results.push(await runLinkedIn(posts.linkedin, posts.campaign));
  if (channels.includes('x')) results.push(await runX(posts.x, posts.campaign));

  console.log('\nSummary:', results.map((r) => `${r.channel}: ${r.ok ? r.mode || 'ok' : 'fail'}`).join(', '));

  const hardFail = results.filter((r) => !r.ok && r.mode === 'missing_credentials');
  if (hardFail.length && !COPY_ONLY) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
