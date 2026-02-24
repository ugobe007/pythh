// --- FILE: server/newsletter-generator.js ---
// Daily Signal Digest — assembles newsletter data from Supabase
// Used by: GET /api/newsletter/today, GET /api/newsletter/:date, social-poster.js

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getSupabaseClient } = require('./lib/supabaseClient');

// Simple in-memory cache: regenerate at most once per hour
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Helpers ──────────────────────────────────────────────────────────────────
async function safeQuery(fn) {
  try { return await fn(); } catch { return null; }
}

// ── New section fetchers ──────────────────────────────────────────────────────
async function fetchInvestorOfWeek(supabase, weekAgo) {
  const { data: recent } = await supabase
    .from('startup_investor_matches')
    .select('investor_id, match_score')
    .gte('created_at', weekAgo)
    .not('investor_id', 'is', null)
    .order('match_score', { ascending: false })
    .limit(200);

  if (!recent?.length) return null;

  const counts = {};
  const scoreSum = {};
  for (const r of recent) {
    counts[r.investor_id]   = (counts[r.investor_id]   || 0) + 1;
    scoreSum[r.investor_id] = (scoreSum[r.investor_id] || 0) + (r.match_score || 0);
  }
  const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topId) return null;

  const { data: inv } = await supabase
    .from('investors')
    .select('id, name, firm_name, sectors, stage, investment_thesis')
    .eq('id', topId)
    .limit(1);

  const investor = inv?.[0];
  if (!investor) return null;

  return {
    ...investor,
    match_count: counts[topId],
    avg_match_score: Math.round(scoreSum[topId] / counts[topId]),
  };
}

async function fetchFundingRounds(supabase, weekAgo) {
  const { data } = await supabase
    .from('discovered_startups')
    .select('name, funding_amount, funding_stage, investors_mentioned, article_url, article_date, rss_source')
    .gte('created_at', weekAgo)
    .not('funding_amount', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8);

  if (!data?.length) return [];

  return data
    .filter(r => r.funding_amount && r.name)
    .map(r => ({
      company:   r.name,
      amount:    r.funding_amount,
      stage:     r.funding_stage || null,
      investors: r.investors_mentioned || [],
      url:       r.article_url || null,
      source:    r.rss_source || 'RSS',
      date:      r.article_date || null,
    }));
}

async function fetchGODScoreMovers(supabase, weekAgo) {
  const { data: history } = await supabase
    .from('score_history')
    .select('startup_id, old_score, new_score, created_at')
    .gte('created_at', weekAgo)
    .not('old_score', 'is', null)
    .not('new_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!history?.length) return [];

  // Keep largest move per startup
  const bestMove = {};
  for (const h of history) {
    const delta = (h.new_score || 0) - (h.old_score || 0);
    const abs   = Math.abs(delta);
    if (!bestMove[h.startup_id] || abs > Math.abs(bestMove[h.startup_id].delta)) {
      bestMove[h.startup_id] = { startup_id: h.startup_id, old_score: h.old_score, new_score: h.new_score, delta };
    }
  }

  const movers = Object.values(bestMove)
    .filter(m => Math.abs(m.delta) >= 10)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  if (!movers.length) return [];

  const ids = movers.map(m => m.startup_id);
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('id, name, tagline, sectors, total_god_score')
    .in('id', ids);

  const startupMap = Object.fromEntries((startups || []).map(s => [s.id, s]));

  return movers
    .map(m => ({ ...startupMap[m.startup_id], old_score: m.old_score, new_score: m.new_score, delta: m.delta }))
    .filter(m => m.name);
}

// ── Edition persistence ───────────────────────────────────────────────────────
async function saveEdition(supabase, editionDate, data) {
  try {
    const { error } = await supabase
      .from('newsletter_editions')
      .upsert({ edition_date: editionDate, data, generated_at: data.generated_at, updated_at: new Date().toISOString() }, { onConflict: 'edition_date' });
    if (error && !error.message.includes('does not exist')) {
      console.error('[newsletter] saveEdition error:', error.message);
    }
  } catch (e) {
    console.error('[newsletter] saveEdition exception:', e.message);
  }
}

async function loadEdition(editionDate) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('newsletter_editions')
      .select('data')
      .eq('edition_date', editionDate)
      .single();
    if (error || !data) return null;
    return data.data;
  } catch {
    return null;
  }
}

async function generateNewsletter({ bust = false } = {}) {
  const now = Date.now();
  if (!bust && _cache && now - _cacheTs < CACHE_TTL_MS) {
    return _cache;
  }

  const supabase = getSupabaseClient();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [
    rawMatchesResult,
    leaderboardResult,
    sectorRowsResult,
    darkHorseResult,
    newArrivalsResult,
    newsResult,
    investorOfWeek,
    fundingRounds,
    scoreMovers,
  ] = await Promise.all([
    // Top matches by score
    supabase
      .from('startup_investor_matches')
      .select('startup_id, investor_id, match_score')
      .not('startup_id', 'is', null)
      .not('investor_id', 'is', null)
      .order('match_score', { ascending: false })
      .limit(20),

    // GOD score leaderboard
    supabase
      .from('startup_uploads')
      .select('id, name, tagline, total_god_score, traction_score, team_score, sectors')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .limit(5),

    // All approved startups (for sector analysis)
    supabase
      .from('startup_uploads')
      .select('sectors, total_god_score')
      .eq('status', 'approved')
      .not('sectors', 'is', null),

    // Dark horse: high momentum, moderate GOD (sleeper picks)
    supabase
      .from('startup_uploads')
      .select('name, tagline, total_god_score, momentum_score, sectors')
      .eq('status', 'approved')
      .gte('momentum_score', 60)
      .lte('total_god_score', 75)
      .order('momentum_score', { ascending: false })
      .limit(5),

    // Recently approved (last 7 days)
    supabase
      .from('startup_uploads')
      .select('name, tagline, sectors, total_god_score, created_at')
      .eq('status', 'approved')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(6),

    // Recent RSS-scraped news (last 24h)
    supabase
      .from('discovered_startups')
      .select('name, article_title, article_url, article_date, rss_source, funding_amount, funding_stage, investors_mentioned')
      .gte('created_at', dayAgo)
      .not('article_title', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),

    // Investor of the week
    safeQuery(() => fetchInvestorOfWeek(supabase, weekAgo)),
    // Funding rounds from RSS
    safeQuery(() => fetchFundingRounds(supabase, weekAgo)),
    // GOD score movers ≥10pt
    safeQuery(() => fetchGODScoreMovers(supabase, weekAgo)),
  ]);

  // Destructure standard query results
  const rawMatches   = rawMatchesResult?.data;
  const leaderboard  = leaderboardResult?.data;
  const sectorRows   = sectorRowsResult?.data;
  const darkHorseRows = darkHorseResult?.data;
  const newArrivals  = newArrivalsResult?.data;
  const newsItems    = newsResult?.data;

  // ── Sector trends ──────────────────────────────────────────────────────────
  const sectorCounts = {};
  const sectorScoreSum = {};
  for (const row of sectorRows || []) {
    const secs = Array.isArray(row.sectors) ? row.sectors : [row.sectors].filter(Boolean);
    for (const s of secs) {
      if (!s) continue;
      sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      sectorScoreSum[s] = (sectorScoreSum[s] || 0) + (row.total_god_score || 0);
    }
  }
  const sectorTrends = Object.entries(sectorCounts)
    .map(([sector, count]) => ({
      sector,
      count,
      avg_score: Math.round(sectorScoreSum[sector] / count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Hot matches (enrich with names) ───────────────────────────────────────
  let hotMatches = [];
  if (rawMatches?.length) {
    const sample = rawMatches.slice(0, 5);
    const startupIds = [...new Set(sample.map(m => m.startup_id))];
    const investorIds = [...new Set(sample.map(m => m.investor_id))];

    const [{ data: startups }, { data: investors }] = await Promise.all([
      supabase
        .from('startup_uploads')
        .select('id, name, tagline, sectors, total_god_score')
        .in('id', startupIds),
      supabase
        .from('investors')
        .select('id, name, firm_name, sectors')
        .in('id', investorIds),
    ]);

    const startupMap = Object.fromEntries((startups || []).map(s => [s.id, s]));
    const investorMap = Object.fromEntries((investors || []).map(i => [i.id, i]));

    hotMatches = sample
      .map(m => ({
        match_score: Math.round(m.match_score),
        startup:  startupMap[m.startup_id]  || null,
        investor: investorMap[m.investor_id] || null,
      }))
      .filter(m => m.startup && m.investor);
  }

  // ── News items (clean up) ─────────────────────────────────────────────────
  const news = (newsItems || [])
    .filter(n => n.article_title && n.article_url)
    .map(n => ({
      title:    n.article_title,
      url:      n.article_url,
      source:   n.rss_source || 'RSS',
      date:     n.article_date || null,
      company:  n.name || null,
      funding:  n.funding_amount ? `${n.funding_amount}${n.funding_stage ? ' ' + n.funding_stage : ''}` : null,
      investors: n.investors_mentioned || [],
    }));

  const result = {
    date:             new Date().toISOString().split('T')[0],
    generated_at:     new Date().toISOString(),
    hotMatches,
    leaderboard:      leaderboard || [],
    sectorTrends,
    darkHorse:        darkHorseRows?.[0] || null,
    newArrivals:      newArrivals || [],
    news,
    investorOfWeek:   investorOfWeek || null,
    fundingRounds:    fundingRounds  || [],
    scoreMovers:      scoreMovers    || [],
  };

  _cache   = result;
  _cacheTs = now;

  // Persist as a named edition (silent fail if table doesn't exist yet)
  const editionDate = result.date;
  await saveEdition(supabase, editionDate, result);

  return result;
}

module.exports = { generateNewsletter, loadEdition };
