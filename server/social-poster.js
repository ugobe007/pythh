// --- FILE: server/social-poster.js ---
// Daily Social Media Poster — runs via PM2 cron at 9am
// Generates AI-written copy and posts to all configured platforms.
//
// Usage:
//   node server/social-poster.js             # post today's content
//   node server/social-poster.js --preview   # generate copy but do NOT post
//   node server/social-poster.js --type hot_match  # force a specific content type

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OpenAI = require('openai');
const { getSupabaseClient } = require('./lib/supabaseClient');
const { postToAllPlatforms, getEnabledPlatforms } = require('./services/socialMediaService');
const { generateNewsletter } = require('./newsletter-generator');

// ─── Config ──────────────────────────────────────────────────────────────────
const PREVIEW_MODE = process.argv.includes('--preview');
const FORCE_TYPE   = process.argv.find(a => a.startsWith('--type='))?.split('=')[1] || null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rotate content types — only fires Mon (1), Wed (3), Fri (5)
const DAILY_ROTATION = {
  1: 'hot_match',     // Monday   — start the week with a signal
  3: 'daily_digest',  // Wednesday — full digest with link to pythh.ai/newsletter
  5: 'sector_insight', // Friday  — end of week pattern
};

// ─── Data Fetchers ────────────────────────────────────────────────────────────
async function fetchHotMatch(supabase) {
  // No FK relationships in DB — do manual join
  const { data: matches } = await supabase
    .from('startup_investor_matches')
    .select('startup_id, investor_id, match_score')
    .not('startup_id', 'is', null)
    .not('investor_id', 'is', null)
    .order('match_score', { ascending: false })
    .limit(10);

  if (!matches?.length) return null;
  const match = matches[Math.floor(Math.random() * matches.length)];

  const [{ data: startups }, { data: investors }] = await Promise.all([
    supabase.from('startup_uploads').select('name, tagline, total_god_score, sectors, website').eq('id', match.startup_id).limit(1),
    supabase.from('investors').select('name, firm_name, sectors, twitter_url, twitter_handle').eq('id', match.investor_id).limit(1),
  ]);

  return {
    match_score: match.match_score,
    startup: startups?.[0] || null,
    investor: investors?.[0] || null,
  };
}

async function fetchStartupSpotlight(supabase) {
  const { data } = await supabase
    .from('startup_uploads')
    .select('name, tagline, total_god_score, sectors, team_score, pitch, traction_score, website')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .limit(20);

  if (!data?.length) return null;
  return data[Math.floor(Math.random() * data.length)];
}

async function fetchWeeklyStats(supabase) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: newStartups }, { count: newMatches }, { data: topStartup }] = await Promise.all([
    supabase.from('startup_uploads').select('id', { count: 'exact', head: true })
      .eq('status', 'approved').gte('created_at', oneWeekAgo),
    supabase.from('startup_investor_matches').select('id', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo),
    supabase.from('startup_uploads').select('name, total_god_score, sectors')
      .eq('status', 'approved').order('total_god_score', { ascending: false }).limit(1),
  ]);
  return { newStartups: newStartups || 0, newMatches: newMatches || 0, topStartup: topStartup?.[0] };
}

async function fetchSectorInsight(supabase) {
  const { data } = await supabase
    .from('startup_uploads')
    .select('sectors')
    .eq('status', 'approved')
    .not('sectors', 'is', null);

  if (!data?.length) return null;
  const counts = {};
  for (const { sectors } of data) { const key = Array.isArray(sectors) ? sectors[0] : sectors; if(key) counts[key] = (counts[key] || 0) + 1; }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 5).map(([sector, count]) => ({ sector, count }));
}

async function fetchVCSignal(supabase) {
  const { data } = await supabase
    .from('investors')
    .select('name, firm_name, sectors, stage, investment_thesis, twitter_url, twitter_handle')
    .not('investment_thesis', 'is', null)
    .limit(20);

  if (!data?.length) return null;
  return data[Math.floor(Math.random() * data.length)];
}

// ─── Daily Digest Fetcher ─────────────────────────────────────────────────────
async function fetchDailyDigest() {
  const data = await generateNewsletter({ bust: true });
  if (!data) return null;
  // Summarise for copy: top match, #1 ranked startup, hottest sector
  return {
    topMatch:     data.hotMatches?.[0] || null,
    topStartup:   data.leaderboard?.[0] || null,
    hotSector:    data.sectorTrends?.[0] || null,
    darkHorse:    data.darkHorse || null,
    newArrivals:  data.newArrivals?.length || 0,
    newsCount:    data.news?.length || 0,
    date:         data.date,
    link:         'https://pythh.ai/newsletter',
  };
}

// ─── Social Enrichment Helpers ──────────────────────────────────────────────────

// "Branch.io" -> "#Branchio", "Sequoia Capital" -> "#SequoiaCapital"
function toHashtag(name) {
  if (!name) return null;
  const clean = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  return clean ? `#${clean}` : null;
}

// "https://twitter.com/sequoia" or "sequoia" -> "@sequoia"
function urlToHandle(urlOrHandle) {
  if (!urlOrHandle) return null;
  const s = String(urlOrHandle).trim();
  if (!s) return null;
  if (s.startsWith('@')) return s;
  const m = s.match(/(?:twitter\.com|x\.com)\/([^/?#\s]+)/i);
  if (m?.[1]) {
    const handle = m[1].toLowerCase();
    if (!['home', 'intent', 'search', 'i', 'messages', 'notifications'].includes(handle)) {
      return '@' + m[1];
    }
  }
  // bare handle (no URL, no spaces, valid chars)
  if (/^[a-zA-Z0-9_]{1,50}$/.test(s)) return '@' + s;
  return null;
}

// "11x.ai" -> "https://11x.ai", "https://branch.io" -> unchanged
function toHttpsUrl(website) {
  if (!website) return null;
  const s = String(website).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return 'https://' + s;
}

// Returns { hashtags: string[], mentions: string[], url: string|null }
function buildSocialEnrichment(post_type, rawData) {
  const hashtags = [];
  const mentions = [];
  let url = null;

  if (post_type === 'hot_match' && rawData) {
    if (rawData.startup?.name)  hashtags.push(toHashtag(rawData.startup.name));
    const investorName = rawData.investor?.firm_name || rawData.investor?.name;
    if (investorName) hashtags.push(toHashtag(investorName));
    // @mention investor if handle available
    const investorHandle = urlToHandle(rawData.investor?.twitter_handle) ||
                           urlToHandle(rawData.investor?.twitter_url);
    if (investorHandle) mentions.push(investorHandle);
    // startup website -> link card
    url = toHttpsUrl(rawData.startup?.website);

  } else if (post_type === 'startup_spotlight' && rawData) {
    if (rawData.name) hashtags.push(toHashtag(rawData.name));
    url = toHttpsUrl(rawData.website);

  } else if (post_type === 'daily_digest' && rawData) {
    const startupName = rawData.topStartup?.name || rawData.topMatch?.startup?.name;
    if (startupName) hashtags.push(toHashtag(startupName));
    const investorName = rawData.topMatch?.investor?.firm_name || rawData.topMatch?.investor?.name;
    if (investorName) hashtags.push(toHashtag(investorName));
    const investorHandle = urlToHandle(rawData.topMatch?.investor?.twitter_handle) ||
                           urlToHandle(rawData.topMatch?.investor?.twitter_url);
    if (investorHandle) mentions.push(investorHandle);
    url = toHttpsUrl(rawData.topMatch?.startup?.website) ||
          toHttpsUrl(rawData.topStartup?.website) ||
          rawData.link || null;

  } else if (post_type === 'vc_signal' && rawData) {
    const investorName = rawData.firm_name || rawData.name;
    if (investorName) hashtags.push(toHashtag(investorName));
    const handle = urlToHandle(rawData.twitter_handle) || urlToHandle(rawData.twitter_url);
    if (handle) mentions.push(handle);
  }

  return {
    hashtags: [...new Set(hashtags.filter(Boolean))],
    mentions: [...new Set(mentions.filter(Boolean))],
    url,
  };
}

// Safety net: append any tags/mentions/URL the AI forgot to include
function appendSocialTags(text, { hashtags, mentions, url }, platform) {
  let result = text;

  // Twitter: fixed 23-char cost per URL regardless of length, so budget accordingly
  const URL_COST = url ? 24 : 0; // 23 chars + 1 space
  const TWITTER_LIMIT = 280;

  // Append missing @mentions first (higher engagement value)
  const missingMentions = mentions.filter(m => !result.includes(m));
  // Append missing hashtags
  const missingHashtags = hashtags.filter(h => !result.includes(h));

  const tagStr = [
    ...missingMentions,
    ...missingHashtags,
  ].join(' ');

  if (tagStr) {
    const addition = ' ' + tagStr;
    if (platform === 'twitter') {
      const budget = TWITTER_LIMIT - URL_COST;
      if ((result + addition).length <= budget) {
        result = result + addition;
      } else {
        result = result.slice(0, budget - addition.length).trimEnd() + addition;
      }
    } else {
      result = result + '\n' + tagStr;
    }
  }

  // Append URL last (Twitter renders as link card; LinkedIn/Threads as inline link)
  if (url) {
    const alreadyHasUrl = result.includes(url) ||
      (url.startsWith('https://') && result.includes(url.replace('https://', '')));
    if (!alreadyHasUrl) {
      result = platform === 'twitter'
        ? result.trimEnd() + ' ' + url
        : result + '\n' + url;
    }
  }

  return result;
}

// ─── AI Copy Generator ────────────────────────────────────────────────────────
async function generateCopy(post_type, rawData, enrichment = {}) {
  const { hashtags = [], mentions = [], url = null } = enrichment;
  const baseContext = `You write social media posts for pythh.ai — an AI system that scores startups and matches them to investors.
Your tone: quiet confidence. You're sitting on signal most people don't have access to.
Never explain what pythh.ai does. Never use generic startup-speak. Never write ads.
Write like you're sharing something interesting you noticed — not selling something.
Be specific. Be brief. Leave them wanting more.`;

  const tagInstructions = [
    hashtags.length ? `REQUIRED hashtags (include in your post): ${hashtags.join(' ')}` : '',
    mentions.length ? `REQUIRED @mentions (include in your post): ${mentions.join(' ')}` : '',
    url        ? `A link will be appended automatically — do NOT include the URL in your text.` : '',
  ].filter(Boolean).join('\n');

  const platforms = {
    twitter: post_type === 'daily_digest'
      ? `Write a single tweet, MAX 220 characters (a link will be auto-appended). No exclamation points.\n${tagInstructions}\nTease the week's most interesting signal find — one specific data point or match. End with: pythh.ai/newsletter`
      : `Write a single tweet, MAX 220 characters (a link will be auto-appended). No exclamation points.\n${tagInstructions}\nNo direct CTA — just an observation or a question that makes a founder or VC stop scrolling.\nEnd with a quiet signal, not a pitch. pythh.ai can appear naturally but doesn't need to.`,
    linkedin: post_type === 'daily_digest'
      ? `Write a LinkedIn digest post of 150-250 words. Lead with the most interesting match or startup signal from the data.\n${tagInstructions}\nInclude 3-5 hashtags total. End with "Full digest: pythh.ai/newsletter"`
      : `Write a LinkedIn post of 150-250 words with a professional but engaging tone.\n${tagInstructions}\nInclude 3-5 hashtags total. Reference pythh.ai as the source. Paragraph breaks for readability.`,
    threads: `Write a Threads post (conversational, max 500 chars).\n${tagInstructions}\nKeep it casual and interesting.`,
  };

  const dataSummary = JSON.stringify(rawData, null, 2).slice(0, 800);

  const generateForPlatform = async (platform, promptHint) => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.85,
      max_tokens: 400,
      messages: [
        { role: 'system', content: `${baseContext}\n\n${promptHint}` },
        {
          role: 'user', content:
`Post type: ${post_type}
Raw data:
${dataSummary}

Write the ${platform} post now. Return ONLY the post text, nothing else.`
        },
      ],
    });
    return completion.choices[0].message.content.trim();
  };

  const [twitter, linkedin, threads] = await Promise.all([
    generateForPlatform('twitter',  platforms.twitter),
    generateForPlatform('linkedin', platforms.linkedin),
    generateForPlatform('threads',  platforms.threads),
  ]);

  // Safety net: ensure all required tags + URL are present
  return {
    twitter:  appendSocialTags(twitter,  enrichment, 'twitter'),
    linkedin: appendSocialTags(linkedin, enrichment, 'linkedin'),
    threads:  appendSocialTags(threads,  enrichment, 'threads'),
    default:  appendSocialTags(twitter,  enrichment, 'twitter'),
  };
}

// ─── Log to ai_logs ───────────────────────────────────────────────────────────
async function logToAILogs(supabase, { post_type, platforms_posted, total_platforms, preview }) {
  try {
    await supabase.from('ai_logs').insert({
      type: 'social',
      action: preview ? 'daily_preview' : 'daily_post',
      input_data: { post_type },
      output_data: { platforms_posted, total_platforms, preview },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[social-poster] ai_logs insert failed:', e.message);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[social-poster] Starting — ${new Date().toISOString()}`);
  console.log(`[social-poster] Mode: ${PREVIEW_MODE ? 'PREVIEW (no posts sent)' : 'LIVE'}`);

  const supabase = getSupabaseClient();
  const enabledPlatforms = getEnabledPlatforms();

  if (enabledPlatforms.length === 0 && !PREVIEW_MODE) {
    console.log('[social-poster] No platforms configured — set env vars to enable posting.');
    console.log('[social-poster] See SOCIAL_MEDIA_SETUP.md for credential setup.');
    process.exit(0);
  }

  console.log(`[social-poster] Enabled platforms: ${enabledPlatforms.join(', ') || 'none'}`);

  // Determine today's content type (runs Mon/Wed/Fri — fallback for manual runs)
  const dayOfWeek = new Date().getDay(); // 0 = Sunday
  const post_type = FORCE_TYPE || DAILY_ROTATION[dayOfWeek] || 'startup_spotlight';
  console.log(`[social-poster] Post type: ${post_type} (day ${dayOfWeek})`);

  // Fetch relevant data
  let rawData = null;
  try {
    if (post_type === 'hot_match')         rawData = await fetchHotMatch(supabase);
    if (post_type === 'startup_spotlight') rawData = await fetchStartupSpotlight(supabase);
    if (post_type === 'weekly_stats')      rawData = await fetchWeeklyStats(supabase);
    if (post_type === 'sector_insight')    rawData = await fetchSectorInsight(supabase);
    if (post_type === 'vc_signal')         rawData = await fetchVCSignal(supabase);
    if (post_type === 'daily_digest')      rawData = await fetchDailyDigest();
  } catch (e) {
    console.error('[social-poster] Data fetch failed:', e.message);
    process.exit(1);
  }

  if (!rawData) {
    console.warn('[social-poster] No data available for post type:', post_type);
    process.exit(0);
  }

  // Generate AI copy
  const enrichment = buildSocialEnrichment(post_type, rawData);
  console.log(`[social-poster] Hashtags: ${enrichment.hashtags.join(' ') || '(none)'}`);
  console.log(`[social-poster] Mentions: ${enrichment.mentions.join(' ') || '(none)'}`);
  console.log(`[social-poster] URL: ${enrichment.url || '(none)'}`);

  let content;
  try {
    console.log('[social-poster] Generating AI copy...');
    content = await generateCopy(post_type, rawData, enrichment);
  } catch (e) {
    console.error('[social-poster] AI copy generation failed:', e.message);
    process.exit(1);
  }

  // Print preview
  console.log('\n── GENERATED COPY ─────────────────────────────────────────');
  console.log('TWITTER:\n', content.twitter);
  console.log('\nLINKEDIN:\n', content.linkedin);
  console.log('\nTHREADS:\n', content.threads);
  console.log('───────────────────────────────────────────────────────────\n');

  if (PREVIEW_MODE) {
    console.log('[social-poster] Preview mode — exiting without posting.');
    await logToAILogs(supabase, { post_type, platforms_posted: 0, total_platforms: enabledPlatforms.length, preview: true });
    process.exit(0);
  }

  // Post to all platforms
  let results = [];
  try {
    results = await postToAllPlatforms({ post_type, content, metadata: { rawData } });
  } catch (e) {
    console.error('[social-poster] Posting failed:', e.message);
    process.exit(1);
  }

  const posted = results.filter(r => r.status === 'posted').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`[social-poster] Done — ${posted} posted, ${failed} failed`);

  await logToAILogs(supabase, {
    post_type,
    platforms_posted: posted,
    total_platforms: results.length,
    preview: false,
  });

  process.exit(failed > 0 && posted === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[social-poster] Unhandled error:', err);
  process.exit(1);
});
