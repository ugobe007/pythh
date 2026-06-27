'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FINDINGS_PATH = path.join(__dirname, '../../agents/research/findings-registry.json');
const TAXONOMY_PATH = path.join(__dirname, '../../agents/research/friction-taxonomy.json');
const SOURCES_PATH = path.join(__dirname, '../../agents/research/signal-sources.json');
const NORTH_STAR_PATH = path.join(__dirname, '../../agents/north-star.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadFindingsRegistry() {
  return loadJson(FINDINGS_PATH);
}

function classifyHeadline(text, taxonomy) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const cat of taxonomy.categories || []) {
    const matched = (cat.keywords || []).filter((kw) => lower.includes(kw.toLowerCase()));
    if (matched.length) {
      hits.push({
        category_id: cat.id,
        label: cat.label,
        audience: cat.audience,
        matched_keywords: matched,
        score: matched.length,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** Minimal RSS title extractor — no dependency. */
function parseRssTitles(xml, limit = 15) {
  const titles = [];
  const re = /<title(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) && titles.length < limit + 2) {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    if (t && !t.toLowerCase().includes('rss') && t.length > 12) titles.push(t);
  }
  return titles.slice(0, limit);
}

async function fetchRssFeed(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'PythhResearchBot/1.0 (+https://pythh.ai)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRssTitles(xml);
  } finally {
    clearTimeout(timer);
  }
}

async function scanRssFeeds(sources, taxonomy, { maxFeeds = 4 } = {}) {
  const feeds = (sources.rss_feeds || []).slice(0, maxFeeds);
  const results = [];
  for (const feed of feeds) {
    try {
      const titles = await fetchRssFeed(feed.url);
      const classified = titles.map((title) => ({
        title,
        source_id: feed.id,
        friction: classifyHeadline(title, taxonomy),
      }));
      const withFriction = classified.filter((c) => c.friction.length > 0);
      results.push({
        feed_id: feed.id,
        url: feed.url,
        titles_scanned: titles.length,
        friction_hits: withFriction.length,
        samples: withFriction.slice(0, 5),
        top_titles: titles.slice(0, 8),
      });
    } catch (e) {
      results.push({ feed_id: feed.id, url: feed.url, error: e.message });
    }
  }
  return results;
}

async function sampleStartupEvents(supabase, { days = 7, limit = 200 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('startup_events')
    .select('source_title, publisher, event_type, occurred_at, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function sampleFounderDemandEvents(supabase, { days = 7, limit = 200 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('founder_demand_events')
    .select('event_type, startup_id, startup_url, startup_name, match_count, source, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === 'PGRST205' || /does not exist/i.test(error.message || '')) {
      return { rows: [], missing_table: true };
    }
    throw error;
  }
  return { rows: data || [], missing_table: false };
}

async function getSignupVelocity(supabase, { days = 7 } = {}) {
  const { getFunnelCounts } = require('./funnelTelemetry');
  const funnel = await getFunnelCounts(supabase, { days, excludeProbes: true });
  const f = funnel.ai_logs || {};
  const g = funnel.growth_events || {};

  const signups =
    (g.founder_signup_completed || 0) +
    (f.lookup_signup_completed || 0) +
    (f.login_completed || 0) +
    (g.investor_signup_completed || 0);
  const perDay = days ? signups / days : 0;

  const northStar = loadJson(NORTH_STAR_PATH);
  const target = northStar.milestones?.find((m) => m.phase === 'target')?.signups_per_day || 100;

  return {
    window_days: days,
    url_submitted: f.url_submitted || 0,
    signups_total: signups,
    signups_per_day: Math.round(perDay * 100) / 100,
    target_signups_per_day: target,
    gap_to_target: Math.round((target - perDay) * 100) / 100,
    pct_of_target: target ? Math.round((perDay / target) * 1000) / 10 : 0,
    by_operation: {
      url_submitted: f.url_submitted || 0,
      login_completed: f.login_completed || 0,
      lookup_signup_completed: f.lookup_signup_completed || 0,
      checkout_completed: f.checkout_completed || 0,
      founder_signup_completed: g.founder_signup_completed || 0,
      investor_signup_completed: g.investor_signup_completed || 0,
    },
    url_attribution: {
      ai_logs_only: f.url_submitted_ai_logs_only ?? null,
      founder_url_growth: f.founder_url_submitted_growth ?? null,
      founder_demand: f.founder_demand_url_submitted ?? null,
    },
  };
}

async function buildResearchSnapshot(supabase, { days = 7 } = {}) {
  const taxonomy = loadJson(TAXONOMY_PATH);
  const sources = loadJson(SOURCES_PATH);
  const northStar = loadJson(NORTH_STAR_PATH);
  const findings = loadFindingsRegistry();

  const [rss, events, founderDemand, velocity] = await Promise.all([
    scanRssFeeds(sources, taxonomy),
    sampleStartupEvents(supabase, { days }).catch((e) => ({ error: e.message })),
    sampleFounderDemandEvents(supabase, { days }).catch((e) => ({ error: e.message, rows: [] })),
    getSignupVelocity(supabase, { days }).catch((e) => ({ error: e.message })),
  ]);

  const eventList = Array.isArray(events) ? events : [];
  const founderDemandRows = founderDemand?.rows || [];
  const eventFriction = eventList
    .map((ev) => {
      const text = ev.source_title || ev.headline || '';
      const friction = classifyHeadline(text, taxonomy);
      if (!friction.length) return null;
      return {
        headline: text,
        publisher: ev.publisher,
        event_type: ev.event_type,
        friction: friction[0],
      };
    })
    .filter(Boolean)
    .slice(0, 25);

  const categoryRollup = {};
  for (const item of eventFriction) {
    const id = item.friction.category_id;
    categoryRollup[id] = (categoryRollup[id] || 0) + 1;
  }
  for (const feed of rss) {
    for (const s of feed.samples || []) {
      const id = s.friction[0]?.category_id;
      if (id) categoryRollup[id] = (categoryRollup[id] || 0) + 1;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    north_star: northStar.goal,
    signup_velocity: velocity,
    rss_scan: rss,
    internal_events: {
      sampled: eventList.length,
      founder_demand_sampled: founderDemandRows.length,
      founder_demand_missing_table: Boolean(founderDemand?.missing_table),
      friction_hits: eventFriction.length,
      top_friction_categories: Object.entries(categoryRollup)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id, count]) => ({ category_id: id, count })),
      samples: eventFriction.slice(0, 12),
      founder_demand_samples: founderDemandRows.slice(0, 8),
    },
    open_findings: (findings.findings || []).filter((f) => f.status === 'open').length,
    competitor_watch: sources.competitor_watch || [],
  };
}

async function syncFindingsToDb(supabase) {
  const registry = loadFindingsRegistry();
  const rows = (registry.findings || []).map((f) => ({
    finding_id: f.id,
    signal_type: f.type || f.signal_type || 'market',
    friction_category: f.friction_category || null,
    audience: f.audience || 'both',
    title: f.title || f.signal?.slice(0, 200) || f.id,
    problem: f.founder_problem || f.problem || null,
    opportunity: f.pythh_opportunity || f.opportunity || null,
    evidence: f.evidence || {},
    confidence: f.confidence || 'medium',
    status: f.status || 'open',
    handoff: f.handoff || null,
    payload: f,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return { synced: 0 };
  const { error } = await supabase.from('research_findings').upsert(rows, { onConflict: 'finding_id' });
  if (error) throw error;
  return { synced: rows.length };
}

module.exports = {
  loadFindingsRegistry,
  classifyHeadline,
  scanRssFeeds,
  sampleStartupEvents,
  sampleFounderDemandEvents,
  getSignupVelocity,
  buildResearchSnapshot,
  syncFindingsToDb,
  FINDINGS_PATH,
};
