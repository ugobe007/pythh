#!/usr/bin/env node
/**
 * Analyze recent VC funding news → sector/stage/thesis themes for Signals + GOD calibration.
 *
 * Sources:
 *   - startup_events (RSS / SSOT FUNDING)
 *   - funding_outcomes (funded ledger)
 *   - startup_uploads (sectors, GOD components)
 *   - vc_intelligence (fresh firm scrape signals, optional)
 *
 * Usage:
 *   node scripts/analyze-vc-funding-themes.mjs
 *   node scripts/analyze-vc-funding-themes.mjs --days=45 --out=reports/vc-funding-themes.json
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DAYS = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=45').split('=')[1]) || 45;
const OUT =
  (process.argv.find((a) => a.startsWith('--out=')) || '').split('=')[1] ||
  `reports/vc-funding-themes-${new Date().toISOString().slice(0, 10)}.json`;

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const sinceIso = new Date(Date.now() - DAYS * 864e5).toISOString();
const sinceDate = sinceIso.slice(0, 10);

const THEME_RULES = [
  { key: 'ai_ml', re: /\b(ai|a\.i\.|artificial intelligence|machine learning|llm|generative|genai|foundation model|agentic)\b/i, why: 'AI/ML product or infrastructure' },
  { key: 'revenue_growth', re: /\b(revenue|arr|mrr|grew|growth|8x|10x|profitable|payback)\b/i, why: 'Traction / revenue proof in headline' },
  { key: 'enterprise_b2b', re: /\b(enterprise|b2b|saas|platform|workflow|ops|devtools|developer)\b/i, why: 'B2B / enterprise SaaS framing' },
  { key: 'climate_energy', re: /\b(climate|energy|carbon|nuclear|fusion|battery|solar|grid)\b/i, why: 'Climate / energy thesis' },
  { key: 'fintech', re: /\b(fintech|payments|banking|lending|insurance|insurtech|crypto|stablecoin)\b/i, why: 'Fintech / financial infra' },
  { key: 'health_bio', re: /\b(health|bio|biotech|pharma|clinical|medtech|therapeutics)\b/i, why: 'Health / bio' },
  { key: 'defense_space', re: /\b(defense|defence|aerospace|space|dual.?use|national security)\b/i, why: 'Defense / space' },
  { key: 'robotics_hardware', re: /\b(robot|robotics|hardware|semiconductor|chip|autonomous)\b/i, why: 'Robotics / hardware' },
  { key: 'seed_early', re: /\b(pre-?seed|seed|angel)\b/i, why: 'Early-stage round language' },
  { key: 'growth_late', re: /\b(series [cdef]|growth|late.?stage|secondary)\b/i, why: 'Growth / late-stage capital' },
  { key: 'valuation_focus', re: /\b(valuation|unicorn|billion|at \$)\b/i, why: 'Valuation / status signaling' },
  { key: 'team_founder', re: /\b(founder|ex-(google|meta|openai|stripe)|serial|operator)\b/i, why: 'Team / founder pedigree callout' },
];

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

function topN(map, n = 15) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ key: k, count: v }));
}

function themesFromText(text) {
  const t = String(text || '');
  const hit = [];
  for (const rule of THEME_RULES) {
    if (rule.re.test(t)) hit.push(rule.key);
  }
  return hit;
}

function normalizeSector(s) {
  const x = String(s || '').trim().toLowerCase();
  if (!x) return null;
  if (/\b(?:ai|ml|machine|llm|genai)/.test(x)) return 'AI/ML';
  if (/\b(?:crypto|web3|blockchain)/.test(x)) return 'Crypto/Web3';
  if (/\b(?:fintech|payment|bank|insur)/.test(x)) return 'FinTech';
  if (/\b(?:health|bio|pharma|life science)/.test(x) && !/\bmedia\b/.test(x)) return 'Health/Bio';
  if (/\b(?:climate|energy|clean|carbon)/.test(x)) return 'Climate/Energy';
  if (/\b(?:saas|enterprise|b2b|software)/.test(x)) return 'Enterprise/SaaS';
  if (/\b(?:robot|hardware|semi|chip)/.test(x)) return 'Hardware/Robotics';
  if (/\b(?:space|aero|defense|defence)/.test(x)) return 'Defense/Space';
  if (/\b(?:consumer|marketplace|e-?comm)/.test(x)) return 'Consumer';
  if (/\b(?:devtool|developer|infra|cloud|data)/.test(x)) return 'DevTools/Infra';
  if (/\bmedia\b/.test(x)) return 'Media';
  return s;
}

function roundBucket(r) {
  const s = String(r || '').toLowerCase();
  if (/pre.?seed|angel/.test(s)) return 'pre-seed/angel';
  if (/seed/.test(s)) return 'seed';
  if (/series.?a/.test(s) && !/series.?[b-z]/.test(s)) return 'series-a';
  if (/series.?b/.test(s)) return 'series-b';
  if (/series.?[c-z]|growth|late/.test(s)) return 'series-c+';
  if (/other|unknown|^$/.test(s)) return 'unknown';
  return s.slice(0, 24) || 'unknown';
}

async function fetchAll(table, select, filterFn) {
  const page = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    let q = sb.from(table).select(select).range(from, from + page - 1);
    q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    from += page;
    if (from > 20000) break;
  }
  return rows;
}

async function main() {
  console.log(`\n══ VC funding theme analysis (last ${DAYS}d since ${sinceDate}) ══\n`);

  const events = await fetchAll(
    'startup_events',
    'id,event_type,subject,object,entities,amounts,round,source_title,source_url,source_publisher,created_at,extraction_meta',
    (q) =>
      q
        .gte('created_at', sinceIso)
        .in('event_type', ['FUNDING', 'INVESTMENT'])
        .order('created_at', { ascending: false }),
  );

  // Broader: also take OTHER headlines that look like raises
  const recentAll = await fetchAll(
    'startup_events',
    'id,event_type,subject,object,entities,amounts,round,source_title,source_url,source_publisher,created_at',
    (q) => q.gte('created_at', sinceIso).order('created_at', { ascending: false }),
  );
  const raiseLike = recentAll.filter((e) => {
    const t = `${e.source_title || ''} ${e.subject || ''}`;
    return /\b(raises?|raised|secur(es|ed)|closes?|funding|series [a-f]|seed round)\b/i.test(t);
  });

  const outcomes = await fetchAll(
    'funding_outcomes',
    'id,startup_id,startup_name,outcome_type,funding_amount,funding_round,outcome_date,god_score_at_time,features_at_time,created_at',
    (q) =>
      q
        .eq('outcome_type', 'funded')
        .gte('outcome_date', sinceDate)
        .order('outcome_date', { ascending: false }),
  );

  // Dedupe noisy ledger rows (same startup + round + day)
  const outcomeSeen = new Set();
  const outcomesDeduped = [];
  for (const o of outcomes) {
    const day = String(o.outcome_date || '').slice(0, 10);
    const key = `${o.startup_id || o.startup_name}|${o.funding_round || ''}|${day}`;
    if (outcomeSeen.has(key)) continue;
    outcomeSeen.add(key);
    outcomesDeduped.push(o);
  }

  const startupIds = [...new Set(outcomesDeduped.map((o) => o.startup_id).filter(Boolean))];
  const startupsById = new Map();
  for (let i = 0; i < startupIds.length; i += 200) {
    const chunk = startupIds.slice(i, i + 200);
    const { data, error } = await sb
      .from('startup_uploads')
      .select(
        'id,name,sectors,stage,stage_estimate,total_god_score,team_score,traction_score,market_score,product_score,vision_score,tagline,description,latest_funding_round,lead_investor',
      )
      .in('id', chunk);
    if (error) throw new Error(error.message);
    for (const s of data || []) startupsById.set(s.id, s);
  }

  let vcIntel = [];
  try {
    vcIntel = await fetchAll(
      'vc_intelligence',
      'id,investor_id,firm_name,scraped_at,confidence,key_themes,sector_preferences,stage_preferences,investment_signals,thesis_summary',
      (q) => q.gte('scraped_at', sinceIso).order('scraped_at', { ascending: false }),
    );
  } catch (e) {
    console.warn('vc_intelligence skip:', e.message);
  }

  const sectorCounts = {};
  const roundCounts = {};
  const themeCounts = {};
  const whyExamples = {};
  const godBySector = {};
  const componentAvgs = { team: [], traction: [], market: [], product: [], vision: [], total: [] };
  const deals = [];

  const headlinePool = [
    ...events.map((e) => ({
      source: 'startup_events',
      title: e.source_title,
      subject: e.subject,
      round: e.round,
      url: e.source_url,
      publisher: e.source_publisher,
      at: e.created_at,
    })),
    ...raiseLike
      .filter((e) => e.event_type !== 'FUNDING' && e.event_type !== 'INVESTMENT')
      .map((e) => ({
        source: 'startup_events_raise_like',
        title: e.source_title,
        subject: e.subject,
        round: e.round,
        url: e.source_url,
        publisher: e.source_publisher,
        at: e.created_at,
      })),
  ];

  for (const h of headlinePool) {
    const themes = themesFromText(`${h.title} ${h.subject || ''}`);
    for (const th of themes) {
      bump(themeCounts, th);
      if (!whyExamples[th]) whyExamples[th] = [];
      if (whyExamples[th].length < 5) {
        whyExamples[th].push({ title: h.title, url: h.url, publisher: h.publisher });
      }
    }
    bump(roundCounts, roundBucket(h.round));
  }

  for (const o of outcomesDeduped) {
    const s = startupsById.get(o.startup_id);
    const title = o.features_at_time?.source_title || o.startup_name;
    const themes = themesFromText(
      `${title} ${o.startup_name} ${(s?.tagline || '')} ${(s?.description || '').slice(0, 280)}`,
    );
    for (const th of themes) bump(themeCounts, th);

    const sectors = (s?.sectors || []).map(normalizeSector).filter(Boolean);
    const primary = sectors[0] || 'Unknown';
    bump(sectorCounts, primary);
    bump(roundCounts, roundBucket(o.funding_round || o.features_at_time?.stage));

    if (!godBySector[primary]) godBySector[primary] = { n: 0, total: 0, traction: 0, market: 0, team: 0 };
    if (s?.total_god_score != null) {
      godBySector[primary].n += 1;
      godBySector[primary].total += Number(s.total_god_score) || 0;
      godBySector[primary].traction += Number(s.traction_score) || 0;
      godBySector[primary].market += Number(s.market_score) || 0;
      godBySector[primary].team += Number(s.team_score) || 0;
    }
    if (s) {
      if (s.team_score != null) componentAvgs.team.push(Number(s.team_score));
      if (s.traction_score != null) componentAvgs.traction.push(Number(s.traction_score));
      if (s.market_score != null) componentAvgs.market.push(Number(s.market_score));
      if (s.product_score != null) componentAvgs.product.push(Number(s.product_score));
      if (s.vision_score != null) componentAvgs.vision.push(Number(s.vision_score));
      if (s.total_god_score != null) componentAvgs.total.push(Number(s.total_god_score));
    }

    deals.push({
      name: o.startup_name,
      date: o.outcome_date,
      round: o.funding_round,
      amount: o.funding_amount,
      sectors,
      themes,
      god: s?.total_god_score ?? null,
      components: s
        ? {
            team: s.team_score,
            traction: s.traction_score,
            market: s.market_score,
            product: s.product_score,
            vision: s.vision_score,
          }
        : null,
      title,
      url: o.features_at_time?.source_url || null,
    });
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const componentMeans = Object.fromEntries(
    Object.entries(componentAvgs).map(([k, arr]) => [k, avg(arr) != null ? Number(avg(arr).toFixed(2)) : null]),
  );

  const sectorGod = Object.entries(godBySector)
    .filter(([, v]) => v.n >= 2)
    .map(([sector, v]) => ({
      sector,
      n: v.n,
      avg_god: Number((v.total / v.n).toFixed(1)),
      avg_traction: Number((v.traction / v.n).toFixed(2)),
      avg_market: Number((v.market / v.n).toFixed(2)),
      avg_team: Number((v.team / v.n).toFixed(2)),
    }))
    .sort((a, b) => b.n - a.n);

  // VC intel theme sniff from recent scrapes
  const vcThemeCounts = {};
  const vcSamples = [];
  for (const row of vcIntel.slice(0, 200)) {
    const blob = [
      row.thesis_summary,
      JSON.stringify(row.key_themes || []),
      JSON.stringify(row.sector_preferences || []),
      JSON.stringify(row.stage_preferences || []),
      JSON.stringify(row.investment_signals || []),
    ].join(' ');
    const themes = themesFromText(blob);
    for (const th of themes) bump(vcThemeCounts, th);
    if (vcSamples.length < 12 && (themes.length || row.sector_preferences)) {
      vcSamples.push({
        firm: row.firm_name,
        confidence: row.confidence,
        themes,
        sectors: row.sector_preferences,
        stages: row.stage_preferences,
        key_themes: row.key_themes,
        scraped_at: row.scraped_at,
      });
    }
  }

  // Calibration implications vs live weights
  const liveWeights = { team: 0.22, traction: 0.30, market: 0.20, product: 0.15, vision: 0.13 };
  const themeRank = topN(themeCounts, 12);
  const implications = [];

  const aiShare = (themeCounts.ai_ml || 0) / Math.max(1, headlinePool.length + outcomesDeduped.length);
  const revShare = (themeCounts.revenue_growth || 0) / Math.max(1, headlinePool.length + outcomesDeduped.length);
  const teamShare = (themeCounts.team_founder || 0) / Math.max(1, headlinePool.length + outcomesDeduped.length);

  if (revShare >= 0.12 || (componentMeans.traction != null && componentMeans.traction >= (componentMeans.vision || 0))) {
    implications.push({
      area: 'GOD.componentWeights.traction',
      observation: `Revenue/growth language appears in ~${(revShare * 100).toFixed(0)}% of recent raise text; funded cohort mean traction=${componentMeans.traction}`,
      suggestion: 'Keep traction ≥ 0.28–0.32; do not revert to vision-heavy weighting.',
      live: liveWeights.traction,
    });
  }
  if (aiShare >= 0.2) {
    implications.push({
      area: 'Signals.market + sector priors',
      observation: `AI/ML themes in ~${(aiShare * 100).toFixed(0)}% of raise corpus`,
      suggestion: 'Boost market/news_momentum for AI infra & applied AI; watch for AI-label inflation without traction.',
      live: liveWeights.market,
    });
  }
  if (teamShare < 0.08) {
    implications.push({
      area: 'GOD.componentWeights.team',
      observation: `Founder/pedigree callouts rare (~${(teamShare * 100).toFixed(0)}%) in press vs product/traction`,
      suggestion: 'Team weight 0.22 is fine as a floor; avoid raising team above traction for press-led calibration.',
      live: liveWeights.team,
    });
  }
  implications.push({
    area: 'GOD.componentWeights.vision',
    observation: `Vision mean in funded cohort=${componentMeans.vision}; vision theme not dominant in headlines`,
    suggestion: 'Keep vision ≤ 0.13 until proof-cohort gate (≥5 verified post-prediction pairs) clears a retune.',
    live: liveWeights.vision,
  });
  implications.push({
    area: 'Signals.capital_convergence',
    observation: `Rounds mix: ${JSON.stringify(Object.fromEntries(topN(roundCounts, 6).map((x) => [x.key, x.count])))}`,
    suggestion: 'Weight seed/Series A velocity higher in signal→GOD bridge than late-stage vanity raises.',
    live: null,
  });

  const report = {
    generated_at: new Date().toISOString(),
    window_days: DAYS,
    since: sinceDate,
    counts: {
      startup_events_funding: events.length,
      raise_like_headlines: raiseLike.length,
      funding_outcomes: outcomes.length,
      funding_outcomes_deduped: outcomesDeduped.length,
      startups_joined: startupsById.size,
      vc_intelligence_rows: vcIntel.length,
      headline_pool: headlinePool.length,
    },
    themes: {
      top: themeRank,
      examples: whyExamples,
    },
    sectors: {
      top: topN(sectorCounts, 15),
      god_by_sector: sectorGod,
    },
    rounds: topN(roundCounts, 10),
    funded_cohort_god_components: componentMeans,
    live_god_weights: liveWeights,
    vc_intel_themes: topN(vcThemeCounts, 10),
    vc_intel_samples: vcSamples,
    implications,
    sample_deals: deals.slice(0, 40),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}\n`);

  console.log('Counts:', report.counts);
  console.log('\nTop themes:');
  for (const t of themeRank) console.log(`  ${t.count.toString().padStart(4)}  ${t.key}`);
  console.log('\nTop sectors (funded outcomes):');
  for (const s of report.sectors.top) console.log(`  ${s.count.toString().padStart(4)}  ${s.key}`);
  console.log('\nRounds:');
  for (const r of report.rounds) console.log(`  ${r.count.toString().padStart(4)}  ${r.key}`);
  console.log('\nFunded cohort GOD component means:', componentMeans);
  console.log('\nCalibration implications:');
  for (const i of implications) {
    console.log(`\n• ${i.area}`);
    console.log(`  obs: ${i.observation}`);
    console.log(`  → ${i.suggestion}`);
  }

  console.log('\nSample deals:');
  for (const d of deals.slice(0, 15)) {
    console.log(
      `  - ${d.date?.slice?.(0, 10) || '?'} ${d.name} [${d.round || '?'}] sectors=${(d.sectors || []).join('|') || '—'} themes=${d.themes.join(',') || '—'} GOD=${d.god ?? '—'}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
