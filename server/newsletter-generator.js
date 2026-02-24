// --- FILE: server/newsletter-generator.js ---
// Daily Signal Digest — assembles newsletter data from Supabase
// Used by: GET /api/newsletter/today, social-poster.js (daily_digest type)

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getSupabaseClient } = require('./lib/supabaseClient');

// Simple in-memory cache: regenerate at most once per hour
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function generateNewsletter({ bust = false } = {}) {
  const now = Date.now();
  if (!bust && _cache && now - _cacheTs < CACHE_TTL_MS) {
    return _cache;
  }

  const supabase = getSupabaseClient();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: rawMatches },
    { data: leaderboard },
    { data: sectorRows },
    { data: darkHorseRows },
    { data: newArrivals },
    { data: newsItems },
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
  ]);

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
  };

  _cache  = result;
  _cacheTs = now;
  return result;
}

module.exports = { generateNewsletter };
