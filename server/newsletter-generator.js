// --- FILE: server/newsletter-generator.js ---
// The Pythh Daily Brief — assembles an authority-grade daily intelligence report
// from Supabase. Used by: GET /api/newsletter/today, GET /api/newsletter/:date,
// scripts/send-daily-brief.js, social-poster.js
//
// Sections produced:
//   editorial        — "PYTHIA's Take": a sharp daily synthesis (hybrid LLM + template)
//   hottestStartups  — top GOD startups WITH the "why" (pillar + signal breakdown)
//   signalsThatMatter— platform-wide signal momentum (which dimensions are spiking)
//   topMatches       — most interesting investor↔startup matches WITH reasoning
//   moneyMoves       — new investments / funding rounds detected from the press
//   vcNews           — capital & investor news (segmented from the radar)
//   radarNews        — everything else PYTHIA picked up
//   sectorTrends, leaderboard, scoreMovers, investorOfWeek — legacy compatibility

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getSupabaseClient } = require('./lib/supabaseClient');

// Simple in-memory cache: regenerate at most once per hour
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Signal dimension metadata — caps mirror startup_signal_scores CHECK constraints.
const DIM_META = [
  { key: 'capital_convergence',   label: 'Capital Convergence', cap: 2.0, blurb: 'investors circling the same names' },
  { key: 'investor_receptivity',  label: 'Investor Receptivity', cap: 2.5, blurb: 'warming sentiment from funds' },
  { key: 'execution_velocity',    label: 'Execution Velocity',   cap: 2.0, blurb: 'shipping and hiring acceleration' },
  { key: 'news_momentum',         label: 'News Momentum',        cap: 1.5, blurb: 'press and mention velocity' },
  { key: 'founder_language_shift', label: 'Founder Conviction',  cap: 2.0, blurb: 'founders changing how they talk' },
];

const PILLAR_META = [
  { key: 'team_score',     label: 'team' },
  { key: 'traction_score', label: 'traction' },
  { key: 'market_score',   label: 'market' },
  { key: 'product_score',  label: 'product' },
  { key: 'vision_score',   label: 'vision' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function safeQuery(fn) {
  try { return await fn(); } catch { return null; }
}

function firstOf(embedded) {
  if (!embedded) return null;
  return Array.isArray(embedded) ? embedded[0] || null : embedded;
}

// Build a short "why this scores" string from pillar sub-scores + signals.
function buildWhy(startup, signal) {
  const bits = [];
  const pillars = PILLAR_META
    .map((p) => ({ label: p.label, val: Number(startup[p.key]) || 0 }))
    .filter((p) => p.val > 0)
    .sort((a, b) => b.val - a.val);
  if (pillars.length) {
    const top = pillars.slice(0, 2).map((p) => `${p.label} ${p.val}`).join(' · ');
    bits.push(`Strongest on ${top}`);
  }
  if (signal) {
    const dims = DIM_META
      .map((d) => ({ label: d.label, val: Number(signal[d.key]) || 0, cap: d.cap }))
      .filter((d) => d.val > 0)
      .sort((a, b) => b.val / b.cap - a.val / a.cap);
    if (dims.length) bits.push(`live signal: ${dims[0].label}`);
  }
  const flags = [];
  if (startup.is_oversubscribed) flags.push('round oversubscribed');
  if (startup.is_competitive) flags.push('competitive round');
  if (startup.has_followon) flags.push('insider follow-on');
  if (startup.is_repeat_founder) flags.push('repeat founder');
  if (flags.length) bits.push(flags[0]);
  return bits.join(' · ') || 'Composite GOD score across all pillars';
}

// ── Section fetchers ───────────────────────────────────────────────────────────
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
    .select('id, name, firm, sectors, stage')
    .eq('id', topId)
    .limit(1);

  const investor = inv?.[0];
  if (!investor) return null;

  return {
    ...investor,
    firm_name: investor.firm || null,
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
    .limit(10);

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

// Hottest startups WITH "why they score" — leaderboard joined to signal scores.
async function fetchHottestStartups(supabase) {
  const { data: top } = await supabase
    .from('startup_uploads')
    .select(
      'id, name, tagline, website, sectors, total_god_score, team_score, traction_score, market_score, product_score, vision_score, is_oversubscribed, is_competitive, has_followon, is_repeat_founder'
    )
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(6);

  if (!top?.length) return [];

  const ids = top.map((s) => s.id);
  const { data: signals } = await supabase
    .from('startup_signal_scores')
    .select('startup_id, signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity')
    .in('startup_id', ids);

  const sigMap = Object.fromEntries((signals || []).map((s) => [s.startup_id, s]));

  return top.map((s) => {
    const sig = sigMap[s.id] || null;
    return {
      id: s.id,
      name: s.name,
      tagline: s.tagline || null,
      website: s.website || null,
      sectors: s.sectors || [],
      total_god_score: s.total_god_score,
      pillars: PILLAR_META.map((p) => ({ label: p.label, value: Number(s[p.key]) || 0 })),
      signals_total: sig ? Number(sig.signals_total) || 0 : null,
      why: buildWhy(s, sig),
    };
  });
}

// Platform-wide signal momentum — which dimensions are spiking right now.
async function fetchSignalsThatMatter(supabase) {
  const { data: rows } = await supabase
    .from('startup_signal_scores')
    .select(
      'startup_id, signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity, as_of, startup_uploads!inner ( name, sectors, total_god_score, status )'
    )
    .eq('startup_uploads.status', 'approved')
    .order('as_of', { ascending: false })
    .limit(400);

  if (!rows?.length) return null;

  const sums = Object.fromEntries(DIM_META.map((d) => [d.key, 0]));
  for (const r of rows) {
    for (const d of DIM_META) sums[d.key] += Number(r[d.key]) || 0;
  }
  const n = rows.length;
  const dimensions = DIM_META.map((d) => {
    const avg = sums[d.key] / n;
    return {
      key: d.key,
      label: d.label,
      blurb: d.blurb,
      avg: Math.round(avg * 100) / 100,
      cap: d.cap,
      pct: Math.round((avg / d.cap) * 100),
    };
  }).sort((a, b) => b.pct - a.pct);

  const leading = dimensions[0];

  // Exemplars: startups leading on the dominant dimension right now.
  const exemplars = rows
    .map((r) => ({
      startup_id: r.startup_id,
      name: firstOf(r.startup_uploads)?.name || null,
      sectors: firstOf(r.startup_uploads)?.sectors || [],
      total_god_score: firstOf(r.startup_uploads)?.total_god_score || null,
      value: Number(r[leading.key]) || 0,
    }))
    .filter((r) => r.name && r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  return {
    coverage: n,
    dimensions,
    leading,
    exemplars,
  };
}

// Most interesting matches — WITH PYTHIA's reasoning, not just a score.
async function fetchTopMatches(supabase) {
  const { data: rawMatches } = await supabase
    .from('startup_investor_matches')
    .select('startup_id, investor_id, match_score, reasoning, why_you_match')
    .not('startup_id', 'is', null)
    .not('investor_id', 'is', null)
    .order('match_score', { ascending: false })
    .limit(400);

  if (!rawMatches?.length) return [];

  // De-dupe by startup so the brief shows variety, not one startup x5.
  const seen = new Set();
  const sample = [];
  for (const m of rawMatches) {
    if (seen.has(m.startup_id)) continue;
    seen.add(m.startup_id);
    sample.push(m);
    if (sample.length >= 6) break;
  }

  const startupIds = [...new Set(sample.map((m) => m.startup_id))];
  const investorIds = [...new Set(sample.map((m) => m.investor_id))];

  const [{ data: startups }, { data: investors }] = await Promise.all([
    supabase.from('startup_uploads').select('id, name, tagline, sectors, total_god_score').in('id', startupIds),
    supabase.from('investors').select('id, name, firm, sectors').in('id', investorIds),
  ]);

  const startupMap = Object.fromEntries((startups || []).map((s) => [s.id, s]));
  const investorMap = Object.fromEntries(
    (investors || []).map((i) => [i.id, { ...i, firm_name: i.firm || null }])
  );

  return sample
    .map((m) => {
      const why = Array.isArray(m.why_you_match) ? m.why_you_match.filter(Boolean) : [];
      const reasoning = (m.reasoning && String(m.reasoning).trim())
        || (why.length ? why.slice(0, 2).join(' · ') : null);
      return {
        match_score: Math.round(m.match_score),
        reasoning,
        why_you_match: why.slice(0, 3),
        startup: startupMap[m.startup_id] || null,
        investor: investorMap[m.investor_id] || null,
      };
    })
    .filter((m) => m.startup && m.investor);
}

// ── Editorial: "PYTHIA's Take" (hybrid LLM + deterministic template) ───────────
const PYTHIA_VOICE = [
  'You are PYTHIA, the signal-intelligence engine behind Pythh.ai.',
  'You write a short, sharp daily brief intro for founders and VCs.',
  'Voice: authoritative, specific, a little contrarian — like a top analyst who sees the market before it moves.',
  'Use the real data given. Reference real startup names, sectors, and the dominant signal.',
  'No hype words ("excited", "thrilled", "game-changing"), no exclamation points, no emojis.',
  'Explain WHY today matters — what the capital flows and signals imply. 2-4 sentences, ~55 words max.',
].join(' ');

function templateEditorial(ctx) {
  const parts = [];
  if (ctx.topStartup) {
    parts.push(
      `${ctx.topStartup.name} tops the board at GOD ${ctx.topStartup.total_god_score}${ctx.topStartup.lead ? `, carried by ${ctx.topStartup.lead}` : ''}.`
    );
  }
  if (ctx.leadingSignal) {
    parts.push(
      `Across ${ctx.coverage || 'the'} tracked names, ${ctx.leadingSignal.label.toLowerCase()} is the dominant signal right now — ${ctx.leadingSignal.blurb}.`
    );
  }
  if (ctx.fundingCount) {
    parts.push(`${ctx.fundingCount} new round${ctx.fundingCount === 1 ? '' : 's'} crossed the wire in the last week.`);
  }
  if (ctx.topMatch) {
    parts.push(`Sharpest pairing on the board: ${ctx.topMatch}.`);
  }
  return parts.join(' ') || 'PYTHIA is recalibrating today\u2019s signals. Full board below.';
}

async function generateEditorial(ctx) {
  const fallback = templateEditorial(ctx);
  if (!process.env.OPENAI_API_KEY) return { text: fallback, source: 'template' };
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 160,
      messages: [
        { role: 'system', content: PYTHIA_VOICE },
        {
          role: 'user',
          content: `Today's data:\n${JSON.stringify(ctx, null, 2)}\n\nWrite PYTHIA's Take now. Return ONLY the paragraph.`,
        },
      ],
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    if (text && text.length > 20) return { text, source: 'pythia' };
    return { text: fallback, source: 'template' };
  } catch (e) {
    console.error('[newsletter] editorial LLM failed:', e.message);
    return { text: fallback, source: 'template' };
  }
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
  // News window: prefer fresh, but fall back across a few days so the brief is
  // never empty if the scraper hasn't run in the last 24h.
  const newsWindow = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    leaderboardResult,
    sectorRowsResult,
    darkHorseResult,
    newArrivalsResult,
    newsResult,
    investorOfWeek,
    fundingRounds,
    scoreMovers,
    hottestStartups,
    signalsThatMatter,
    topMatches,
  ] = await Promise.all([
    // GOD score leaderboard (legacy field)
    supabase
      .from('startup_uploads')
      .select('id, name, tagline, total_god_score, traction_score, team_score, sectors')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .limit(8),

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
      .gte('created_at', newsWindow)
      .not('article_title', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),

    safeQuery(() => fetchInvestorOfWeek(supabase, weekAgo)),
    safeQuery(() => fetchFundingRounds(supabase, weekAgo)),
    safeQuery(() => fetchGODScoreMovers(supabase, weekAgo)),
    safeQuery(() => fetchHottestStartups(supabase)),
    safeQuery(() => fetchSignalsThatMatter(supabase)),
    safeQuery(() => fetchTopMatches(supabase)),
  ]);

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
    .map(([sector, count]) => ({ sector, count, avg_score: Math.round(sectorScoreSum[sector] / count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── News: clean + segment into capital news vs general radar ────────────────
  const cleanedNews = (newsItems || [])
    .filter(n => n.article_title && n.article_url)
    .map(n => ({
      title:    n.article_title,
      url:      n.article_url,
      source:   n.rss_source || 'RSS',
      date:     n.article_date || null,
      company:  n.name || null,
      funding:  n.funding_amount ? `${n.funding_amount}${n.funding_stage ? ' ' + n.funding_stage : ''}` : null,
      investors: Array.isArray(n.investors_mentioned) ? n.investors_mentioned : [],
    }));

  const isCapitalNews = (n) =>
    n.funding || (n.investors && n.investors.length) ||
    /\b(raise[sd]?|funding|round|seed|series|invest|capital|fund|backs?|valuation|acqui)/i.test(n.title || '');

  const vcNews = cleanedNews.filter(isCapitalNews).slice(0, 6);
  const radarNews = cleanedNews.filter((n) => !isCapitalNews(n)).slice(0, 6);

  // ── Hot matches (legacy shape, enriched with reasoning) ─────────────────────
  const hotMatches = (topMatches || []).map((m) => ({
    match_score: m.match_score,
    reasoning: m.reasoning,
    startup: m.startup,
    investor: m.investor,
  }));

  // ── Editorial context + generation ──────────────────────────────────────────
  const topHot = (hottestStartups && hottestStartups[0]) || null;
  const topHotLead = topHot?.pillars
    ? [...topHot.pillars].sort((a, b) => b.value - a.value).slice(0, 2).map((p) => p.label).join(' and ')
    : null;
  const editorialCtx = {
    topStartup: topHot ? { name: topHot.name, total_god_score: topHot.total_god_score, lead: topHotLead } : null,
    leadingSignal: signalsThatMatter?.leading
      ? { label: signalsThatMatter.leading.label, blurb: signalsThatMatter.leading.blurb, pct: signalsThatMatter.leading.pct }
      : null,
    coverage: signalsThatMatter?.coverage || null,
    topSectors: sectorTrends.slice(0, 3).map((s) => s.sector),
    fundingCount: (fundingRounds || []).length,
    topMatch: hotMatches[0]
      ? `${hotMatches[0].startup?.name} × ${hotMatches[0].investor?.firm_name || hotMatches[0].investor?.name} (${hotMatches[0].match_score}%)`
      : null,
  };
  const editorial = await generateEditorial(editorialCtx);

  const result = {
    date:             new Date().toISOString().split('T')[0],
    generated_at:     new Date().toISOString(),
    editorial,                                 // { text, source }
    hottestStartups:  hottestStartups || [],
    signalsThatMatter: signalsThatMatter || null,
    topMatches:       topMatches || [],
    moneyMoves:       fundingRounds || [],
    vcNews,
    radarNews,
    // Legacy / compatibility fields
    hotMatches,
    leaderboard:      leaderboard || [],
    sectorTrends,
    darkHorse:        darkHorseRows?.[0] || null,
    newArrivals:      newArrivals || [],
    news:             cleanedNews,
    investorOfWeek:   investorOfWeek || null,
    fundingRounds:    fundingRounds  || [],
    scoreMovers:      scoreMovers    || [],
  };

  _cache   = result;
  _cacheTs = now;

  await saveEdition(supabase, result.date, result);

  return result;
}

module.exports = { generateNewsletter, loadEdition, DIM_META };
