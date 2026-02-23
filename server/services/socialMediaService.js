// --- FILE: server/services/socialMediaService.js ---
// Social Media Posting Service
// Handles Twitter/X, LinkedIn, Instagram, and Threads
// Each platform is auto-skipped if credentials are missing — add platforms incrementally.

'use strict';

const { getSupabaseClient } = require('../lib/supabaseClient');

// ============================================================
// PLATFORM: TWITTER / X
// Requires: TWITTER_API_KEY, TWITTER_API_SECRET,
//           TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
// ============================================================
async function postToTwitter(text) {
  const { TwitterApi } = require('twitter-api-v2');
  const client = new TwitterApi({
    appKey:           process.env.TWITTER_API_KEY,
    appSecret:        process.env.TWITTER_API_SECRET,
    accessToken:      process.env.TWITTER_ACCESS_TOKEN,
    accessSecret:     process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });
  const rwClient = client.readWrite;
  const result = await rwClient.v2.tweet(text);
  return { platform: 'twitter', post_id: result.data.id };
}

// ============================================================
// PLATFORM: LINKEDIN
// Requires: LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORGANIZATION_ID
// OAuth 2.0 token — must be refreshed manually every 60 days (see setup guide)
// ============================================================
async function postToLinkedIn(text) {
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
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.linkedin.com',
      path: '/v2/ugcPosts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const parsed = JSON.parse(data);
          resolve({ platform: 'linkedin', post_id: parsed.id });
        } else {
          reject(new Error(`LinkedIn API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// PLATFORM: THREADS (Meta)
// Requires: THREADS_ACCESS_TOKEN, THREADS_ACCOUNT_ID
// Get via Meta Developer App + Threads API approval
// ============================================================
async function postToThreads(text) {
  const https = require('https');
  const token = process.env.THREADS_ACCESS_TOKEN;
  const accountId = process.env.THREADS_ACCOUNT_ID;

  // Step 1: Create a media container
  const createBody = new URLSearchParams({
    media_type: 'TEXT',
    text,
    access_token: token,
  }).toString();

  const containerId = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.threads.net',
      path: `/v1.0/${accountId}/threads`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(createBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.id) resolve(json.id);
        else reject(new Error(`Threads container error: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(createBody);
    req.end();
  });

  // Step 2: Publish the container
  const publishBody = new URLSearchParams({
    creation_id: containerId,
    access_token: token,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.threads.net',
      path: `/v1.0/${accountId}/threads_publish`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(publishBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.id) resolve({ platform: 'threads', post_id: json.id });
        else reject(new Error(`Threads publish error: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(publishBody);
    req.end();
  });
}

// ============================================================
// PLATFORM: INSTAGRAM
// Requires: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID
// NOTE: Instagram Graph API only supports photo/video posts from business accounts.
// Text-only posts are not supported. This posts a text-over-image using a 
// simple background image. For full image posts, upgrade to use image generation.
// ============================================================
async function postToInstagram(text) {
  // Instagram Graph API requires an image URL — we skip text-only posts
  // TODO: Wire up image generation (Dall-E or Canva API) for real Instagram posts
  throw new Error('Instagram text-only posts not supported by Graph API. Wire up image generation first.');
}

// ============================================================
// RECORD POST TO DB
// ============================================================
async function recordPost({ platform, post_type, content, status, post_id, error, metadata }) {
  try {
    const supabase = getSupabaseClient();
    const { error: dbError } = await supabase.from('social_posts').insert({
      platform,
      post_type,
      content,
      status,
      post_id: post_id || null,
      error: error || null,
      metadata: metadata || {},
      posted_at: status === 'posted' ? new Date().toISOString() : null,
    });
    if (dbError) console.error(`[social] DB record error:`, dbError.message);
  } catch (e) {
    console.error(`[social] Failed to record post:`, e.message);
  }
}

// ============================================================
// CHECK WHICH PLATFORMS ARE CONFIGURED
// ============================================================
function getEnabledPlatforms() {
  const platforms = [];
  if (process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN) {
    platforms.push('twitter');
  }
  if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID) {
    platforms.push('linkedin');
  }
  if (process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_ACCOUNT_ID) {
    platforms.push('threads');
  }
  if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    platforms.push('instagram');
  }
  return platforms;
}

// ============================================================
// MAIN: POST TO ALL ENABLED PLATFORMS
// Returns array of results per platform
// ============================================================
async function postToAllPlatforms({ post_type, content, metadata = {} }) {
  const platforms = getEnabledPlatforms();
  if (platforms.length === 0) {
    console.log('[social] No platforms configured — skipping post');
    return [];
  }

  const results = [];

  for (const platform of platforms) {
    try {
      let result;
      if (platform === 'twitter')   result = await postToTwitter(content.twitter || content.default);
      if (platform === 'linkedin')  result = await postToLinkedIn(content.linkedin || content.default);
      if (platform === 'threads')   result = await postToThreads(content.threads || content.default);
      if (platform === 'instagram') result = await postToInstagram(content.instagram || content.default);

      await recordPost({
        platform,
        post_type,
        content: content[platform] || content.default,
        status: 'posted',
        post_id: result?.post_id,
        metadata,
      });

      console.log(`[social] ✅ Posted to ${platform}: ${result?.post_id}`);
      results.push({ platform, status: 'posted', post_id: result?.post_id });

    } catch (err) {
      console.error(`[social] ❌ Failed to post to ${platform}:`, err.message);
      await recordPost({
        platform,
        post_type,
        content: content[platform] || content.default,
        status: 'failed',
        error: err.message,
        metadata,
      });
      results.push({ platform, status: 'failed', error: err.message });
    }
  }

  return results;
}

module.exports = { postToAllPlatforms, getEnabledPlatforms, recordPost };
