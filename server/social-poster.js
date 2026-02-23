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

// ─── Config ──────────────────────────────────────────────────────────────────
const PREVIEW_MODE = process.argv.includes('--preview');
const FORCE_TYPE   = process.argv.find(a => a.startsWith('--type='))?.split('=')[1] || null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rotate content types by day of week so we never repeat two days in a row
const DAILY_ROTATION = [
  'weekly_stats',      // Sunday
  'hot_match',         // Monday
  'startup_spotlight', // Tuesday
  'hot_match',         // Wednesday
  'sector_insight',    // Thursday
  'startup_spotlight', // Friday
  'vc_signal',         // Saturday
];

// ─── Data Fetchers ────────────────────────────────────────────────────────────
async function fetchHotMatch(supabase) {
  const { data } = await supabase
    .from('startup_investor_matches')
    .select(`
      match_score,
      startup_uploads ( name, one_liner, total_god_score, sector ),
      investors ( name, firm_name, sectors )
    `)
    .order('match_score', { ascending: false })
    .limit(10);

  if (!data?.length) return null;
  // Pick a random top-10 match for variety
  return data[Math.floor(Math.random() * data.length)];
}

async function fetchStartupSpotlight(supabase) {
  const { data } = await supabase
    .from('startup_uploads')
    .select('name, one_liner, total_god_score, sector, team, solution, traction_score')
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
    supabase.from('startup_uploads').select('name, total_god_score, sector')
      .eq('status', 'approved').order('total_god_score', { ascending: false }).limit(1),
  ]);
  return { newStartups: newStartups || 0, newMatches: newMatches || 0, topStartup: topStartup?.[0] };
}

async function fetchSectorInsight(supabase) {
  const { data } = await supabase
    .from('startup_uploads')
    .select('sector')
    .eq('status', 'approved')
    .not('sector', 'is', null);

  if (!data?.length) return null;
  const counts = {};
  for (const { sector } of data) { counts[sector] = (counts[sector] || 0) + 1; }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 5).map(([sector, count]) => ({ sector, count }));
}

async function fetchVCSignal(supabase) {
  const { data } = await supabase
    .from('investors')
    .select('name, firm_name, sectors, stage, investment_thesis')
    .not('investment_thesis', 'is', null)
    .limit(20);

  if (!data?.length) return null;
  return data[Math.floor(Math.random() * data.length)];
}

// ─── AI Copy Generator ────────────────────────────────────────────────────────
async function generateCopy(post_type, rawData) {
  const baseContext = `You write social media posts for pythh.ai — an AI-powered startup-investor matchmaking platform. 
Posts should feel authentic, data-driven, and exciting to the startup ecosystem community (founders, VCs, angels).
Never use generic filler phrases. Be specific. Be punchy. Use the real data provided.`;

  const platforms = {
    twitter: `Write a tweet of MAX 260 characters (leave room for a URL). 
Use 2-3 relevant hashtags like #startups #VC #founders. End with a CTA to visit pythh.ai.`,
    linkedin: `Write a LinkedIn post of 150-250 words with a professional but engaging tone. 
Include 3-5 hashtags. Reference pythh.ai as the source. Paragraph breaks for readability.`,
    threads: `Write a Threads post (conversational, max 500 chars). No formal hashtags needed — just casual and interesting.`,
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

  return { twitter, linkedin, threads, default: twitter };
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

  // Determine today's content type
  const dayOfWeek = new Date().getDay(); // 0 = Sunday
  const post_type = FORCE_TYPE || DAILY_ROTATION[dayOfWeek];
  console.log(`[social-poster] Post type: ${post_type}`);

  // Fetch relevant data
  let rawData = null;
  try {
    if (post_type === 'hot_match')         rawData = await fetchHotMatch(supabase);
    if (post_type === 'startup_spotlight') rawData = await fetchStartupSpotlight(supabase);
    if (post_type === 'weekly_stats')      rawData = await fetchWeeklyStats(supabase);
    if (post_type === 'sector_insight')    rawData = await fetchSectorInsight(supabase);
    if (post_type === 'vc_signal')         rawData = await fetchVCSignal(supabase);
  } catch (e) {
    console.error('[social-poster] Data fetch failed:', e.message);
    process.exit(1);
  }

  if (!rawData) {
    console.warn('[social-poster] No data available for post type:', post_type);
    process.exit(0);
  }

  // Generate AI copy
  let content;
  try {
    console.log('[social-poster] Generating AI copy...');
    content = await generateCopy(post_type, rawData);
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
