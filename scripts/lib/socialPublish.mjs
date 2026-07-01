/**
 * Shared X / LinkedIn publish helpers for outbound scripts.
 */

import { createRequire } from 'node:module';
import https from 'node:https';

const require = createRequire(import.meta.url);

export function hasTwitterCredentials() {
  return Boolean(
    process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET,
  );
}

export function hasLinkedInOrgCredentials() {
  return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID);
}

export async function postToX(text) {
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

export async function postToLinkedInOrg(text) {
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

export async function logOutboundPost(sb, { platform, channel, postId, campaign, dryRun }) {
  if (!sb || dryRun) return;
  try {
    await sb.from('ai_logs').insert({
      operation: 'outbound_post_published',
      status: 'success',
      output: {
        platform,
        channel,
        post_id: postId || null,
        campaign,
        source: 'outbound_professional',
      },
    });
  } catch (e) {
    console.warn('  ⚠️  telemetry log failed:', e.message);
  }
}
