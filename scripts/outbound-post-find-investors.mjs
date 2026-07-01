#!/usr/bin/env node
/**
 * Publish find-investors outbound copy (playbook: agents/growth/outbound/find-investors-playbook.md).
 *
 * Usage:
 *   node scripts/outbound-post-find-investors.mjs --channel all
 *   node scripts/outbound-post-find-investors.mjs --channel reddit_startups --dry-run
 *   node scripts/outbound-post-find-investors.mjs --channel linkedin
 *   node scripts/outbound-post-find-investors.mjs --channel x
 */

import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const argVal = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (f) => args.includes(f);

const CHANNEL = argVal('--channel', 'all');
const DRY_RUN = hasFlag('--dry-run');

const POSTS = {
  reddit_startups: {
    platform: 'reddit',
    subreddit: 'startups',
    title: 'I built a free tool that shows which VCs match your startup URL (no network required)',
    body: `Raising without warm intros is brutal — most founder tools assume you already know who to talk to.

I built Pythh to flip that: paste your startup URL and it returns investor matches ranked by thesis fit + timing signals (who's actively deploying in your sector/stage).

Preview is free (3 matches visible). Signup unlocks full list + intro workflow.

Try it: https://pythh.ai/find-investors?utm_source=reddit_startups&utm_medium=community&utm_campaign=find_investors

Happy to answer questions on how matching works. Not trying to spam — genuinely looking for feedback from founders in the 0→1 raise.`,
    submitUrl:
      'https://www.reddit.com/r/startups/submit',
  },
  linkedin: {
    platform: 'linkedin',
    body: `Most founders waste weeks building investor lists from Crunchbase exports and Twitter threads.

We built something simpler: paste your startup URL → see investors ranked by thesis fit + live deployment signals.

Built for first-time founders without warm intros.

Free preview (no signup): https://pythh.ai/find-investors?utm_source=linkedin&utm_medium=social&utm_campaign=find_investors

If you're raising pre-seed/seed — try it and tell me what's missing.`,
  },
  x: {
    platform: 'x',
    body: `Raising without intros?

Paste your startup URL → see which investors actually fit your stage + sector.

Free preview, no signup: https://pythh.ai/find-investors?utm_source=twitter&utm_medium=social&utm_campaign=find_investors

Built for founders starting from zero network. Feedback welcome.`,
  },
};

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function logOutbound({ platform, channel, postId, dryRun }) {
  if (!sb || dryRun) return;
  try {
    await sb.from('ai_logs').insert({
      operation: 'outbound_post_published',
      status: 'success',
      output: {
        platform,
        channel,
        post_id: postId || null,
        campaign: 'find_investors',
        source: 'outbound_post_find_investors',
      },
    });
  } catch (e) {
    console.warn('  ⚠️  telemetry log failed:', e.message);
  }
}

async function postX(text) {
  const { TwitterApi } = require('twitter-api-v2');
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });
  const result = await client.readWrite.v2.tweet({ text });
  return result.data?.id;
}

async function postToLinkedInOrg(text) {
  const https = require('https');
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID;
  const body = JSON.stringify({
    author: `urn:li:organization:${orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.linkedin.com',
        path: '/v2/ugcPosts',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LinkedIn API error ${res.statusCode}: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runChannel(key) {
  const post = POSTS[key];
  if (!post) {
    console.error(`Unknown channel: ${key}`);
    return { ok: false, channel: key };
  }

  console.log(`\n── ${key} (${post.platform}) ──`);

  if (key === 'reddit_startups') {
    const url = `${post.submitUrl}?title=${encodeURIComponent(post.title)}&text=${encodeURIComponent(post.body)}`;
    console.log('Title:', post.title);
    console.log('Submit URL (open in browser while logged into Reddit):');
    console.log(url);
    if (DRY_RUN) {
      console.log('  📋 DRY RUN — Reddit requires manual publish in browser');
      return { ok: true, channel: key, mode: 'manual_url' };
    }
    await logOutbound({ platform: 'reddit', channel: key, postId: 'manual_submit', dryRun: false });
    console.log('  ℹ️  Reddit API not configured — use submit URL above to publish');
    return { ok: true, channel: key, mode: 'manual_url', submitUrl: url };
  }

  if (key === 'linkedin') {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const orgId = process.env.LINKEDIN_ORGANIZATION_ID;
    if (!token || !orgId) {
      console.log(post.body);
      console.log('\n  ⚠️  LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORGANIZATION_ID not set — copy post above to LinkedIn');
      if (DRY_RUN) return { ok: true, channel: key, mode: 'manual_copy' };
      await logOutbound({ platform: 'linkedin', channel: key, postId: 'manual_copy', dryRun: false });
      return { ok: true, channel: key, mode: 'manual_copy' };
    }
    if (DRY_RUN) {
      console.log('  📋 DRY RUN — would post to LinkedIn org', orgId);
      console.log(post.body);
      return { ok: true, channel: key, mode: 'api_dry' };
    }
    try {
      const result = await postToLinkedInOrg(post.body);
      console.log('  ✅ LinkedIn posted:', result.id);
      await logOutbound({ platform: 'linkedin', channel: key, postId: result.id, dryRun: false });
      return { ok: true, channel: key, postId: result.id };
    } catch (e) {
      console.error('  ❌ LinkedIn failed:', e.message);
      return { ok: false, channel: key, error: e.message };
    }
  }

  if (key === 'x') {
    const hasTwitter =
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET;
    if (!hasTwitter) {
      console.log(post.body);
      console.log('\n  ⚠️  Twitter/X API keys not set');
      return { ok: false, channel: key, mode: 'missing_credentials' };
    }
    if (DRY_RUN) {
      console.log('  📋 DRY RUN — would tweet:');
      console.log(post.body);
      return { ok: true, channel: key, mode: 'api_dry' };
    }
    try {
      const id = await postX(post.body);
      console.log('  ✅ X posted:', id);
      await logOutbound({ platform: 'x', channel: key, postId: id, dryRun: false });
      return { ok: true, channel: key, postId: id };
    } catch (e) {
      console.error('  ❌ X failed:', e.message);
      return { ok: false, channel: key, error: e.message };
    }
  }

  return { ok: false, channel: key };
}

async function main() {
  const channels =
    CHANNEL === 'all'
      ? ['linkedin', 'x']
      : CHANNEL.split(',').map((s) => s.trim()).filter(Boolean);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Find Investors — Outbound Post', DRY_RUN ? '(DRY RUN)' : '');
  console.log(' Channels:', channels.join(', '));
  console.log('═══════════════════════════════════════════════════════════════');

  const results = [];
  for (const ch of channels) {
    results.push(await runChannel(ch));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\nSummary:', results.map((r) => `${r.channel}: ${r.ok ? 'ok' : 'fail'}`).join(', '));

  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
