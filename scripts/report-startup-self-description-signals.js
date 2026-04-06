#!/usr/bin/env node
/**
 * Top signals startups use to describe themselves — structured + lexical.
 *
 * Structured: frequency of strings in execution_signals, team_signals, grit_signals
 *   (columns + extracted_data), plus sector[] labels.
 * Lexical: top word unigrams and bigrams from combined self-description text
 *   (tagline, description, pitch, extracted value_prop / problem / solution / etc.).
 *
 * Usage:
 *   node scripts/report-startup-self-description-signals.js
 *   node scripts/report-startup-self-description-signals.js --json
 *   node scripts/report-startup-self-description-signals.js --source=tagline-only
 *   node scripts/report-startup-self-description-signals.js --status=approved --limit=5000
 *   node scripts/report-startup-self-description-signals.js --structured-cohort=tagline
 *   node scripts/report-startup-self-description-signals.js --lexical-filter=boilerplate
 *
 * --source=combined (default): theme buckets + lexical unigrams/bigrams use full narrative
 *   (tagline, description, pitch, extracted fields — same as ingest-pythh-signals).
 * --source=tagline-only: theme buckets + lexical unigrams/bigrams use tagline + extracted tagline only;
 *   theme % and lexical counts use denominator = startups with tagline length ≥ 8 (see scope).
 * --structured-cohort=all (default): execution/team/grit/sectors over all scoped startups.
 * --structured-cohort=tagline: same signals only for startups with tagline ≥ 8 chars (aligned with tagline cohort).
 * --lexical-filter=boilerplate: drop generic unigrams (company, startup) and bigrams ending in " company".
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ quiet: true });

const PAGE = 1000;
/** Min tagline length to include in tagline-only lexical/theme stats */
const MIN_TAGLINE_LEN = 8;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const SELECT = [
  'id',
  'status',
  'tagline',
  'description',
  'pitch',
  'sectors',
  'extracted_data',
  'execution_signals',
  'team_signals',
  'grit_signals',
].join(',');

/** EN stopwords + common RSS / press-release filler */
const STOP = new Set(
  [
    'the', 'and', 'for', 'that', 'with', 'from', 'this', 'have', 'has', 'had', 'been', 'were', 'they', 'their',
    'what', 'when', 'your', 'will', 'about', 'into', 'than', 'then', 'more', 'some', 'such', 'only', 'over',
    'also', 'just', 'most', 'both', 'many', 'other', 'using', 'after', 'before', 'being', 'each', 'these',
    'those', 'under', 'while', 'where', 'which', 'would', 'could', 'should', 'through', 'during', 'without',
    'within', 'across', 'against', 'among', 'itself', 'something', 'someone', 'everything', 'nothing',
    'another', 'further', 'otherwise', 'however', 'therefore', 'you', 'our', 'its', 'are', 'was', 'is', 'am',
    'be', 'do', 'did', 'does', 'done', 'can', 'may', 'might', 'must', 'shall', 'not', 'nor', 'yet', 'if', 'or',
    'as', 'at', 'an', 'of', 'to', 'in', 'on', 'by', 'up', 'off', 'out', 'we', 'he', 'she', 'it', 'his', 'her',
    'him', 'them', 'us', 'me', 'my', 'mine', 'let', 'say', 'said', 'says', 'get', 'got', 'go', 'went', 'come',
    'came', 'make', 'made', 'like', 'well', 'back', 'much', 'even', 'ever', 'every', 'too', 'very', 'per',
    'via', 'onto', 'non', 'all', 'any', 'one', 'two', 'first', 'new', 'now', 'here', 'there', 'how', 'why',
    'who', 'whom', 'whose', 'into', 'than', 'post', 'but',
  ],
);

function parseArgs(argv) {
  const out = {
    json: false,
    status: 'approved',
    limit: null,
    source: 'combined',
    structuredCohort: 'all',
    lexicalFilter: 'none',
  };
  for (const a of argv) {
    if (a === '--json') out.json = true;
    else if (a.startsWith('--status=')) out.status = a.slice('--status='.length) || 'approved';
    else if (a.startsWith('--limit=')) out.limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0);
    else if (a.startsWith('--source=')) {
      const v = (a.slice('--source='.length) || 'combined').toLowerCase();
      if (v === 'tagline-only' || v === 'tagline') out.source = 'tagline-only';
      else out.source = 'combined';
    } else if (a.startsWith('--structured-cohort=')) {
      const v = (a.slice('--structured-cohort='.length) || 'all').toLowerCase();
      out.structuredCohort = v === 'tagline' ? 'tagline' : 'all';
    } else if (a.startsWith('--lexical-filter=')) {
      const v = (a.slice('--lexical-filter='.length) || 'none').toLowerCase();
      out.lexicalFilter = v === 'boilerplate' ? 'boilerplate' : 'none';
    }
  }
  return out;
}

/** Heuristic drops for lexical “vocabulary” lists (not TF-IDF). */
const BOILERPLATE_UNIGRAMS = new Set(['company', 'startup']);

function filterBoilerplateLexical(entries) {
  return entries.filter((e) => {
    if (BOILERPLATE_UNIGRAMS.has(e.key)) return false;
    if (e.key.endsWith(' company')) return false;
    return true;
  });
}

/**
 * Narrative blocks startups use to describe themselves (aligned with ingest-pythh-signals).
 */
function combinedSelfDescriptionText(row) {
  const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  const parts = [
    row.tagline,
    row.description,
    row.pitch,
    ed.description,
    ed.pitch,
    ed.value_proposition,
    ed.problem,
    ed.solution,
    ed.product_description,
    ed.tagline,
    ed.market,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return sanitizeNarrative(parts.join(' \n '));
}

/** Drop HTML fragments and common syndication boilerplate so lexical counts reflect product language */
function sanitizeNarrative(raw) {
  let t = raw.replace(/<[^>]{0,200}>/g, ' ');
  t = t.replace(/\b(?:meta\s+charset|viewport|content=["'][^"']*["'])\b/gi, ' ');
  t = t.replace(/\b(?:getty images|shutterstock|istock)\b/gi, ' ');
  t = t.replace(/\bappeared\s+first\s+on\b[^.]*\.?/gi, ' ');
  t = t.replace(/\bon\s+pulse\b/gi, ' ');
  t = t.replace(/\bchallenges\s+in\s+addressing\b/gi, ' ');
  t = t.replace(/\baddressing\s+challenges\b/gi, ' ');
  t = t.replace(/\bchallenges\s+technology\b/gi, ' ');
  t = t.replace(/\bitemscope\b|\bitemtype\b|\bhttp-equiv\b|\bxmlns\b|\bitemprop\b/gi, ' ');
  return t;
}

function taglineOnlyText(row) {
  const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  const parts = [row.tagline, ed.tagline].map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  return sanitizeNarrative(parts.join(' '));
}

function isNoiseToken(t) {
  if (t.length < 2) return true;
  if (/^[a-f0-9]{12,}$/i.test(t)) return true;
  if (
    /^(html|class|meta|charset|div|span|script|body|head|style|viewport|itemscope|itemtype|itemprop|http-equiv|xmlns|property)$/i.test(t)
  ) {
    return true;
  }
  return false;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9%+\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length >= 2 && !STOP.has(t) && !isNoiseToken(t));
}

function countBigrams(tokens) {
  const m = new Map();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (STOP.has(a) || STOP.has(b)) continue;
    if (a.length < 2 || b.length < 2) continue;
    const key = `${a} ${b}`;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

function countUnigrams(tokens) {
  const m = new Map();
  for (const t of tokens) {
    if (t.length < 3) continue;
    m.set(t, (m.get(t) || 0) + 1);
  }
  return m;
}

function bump(map, key) {
  if (!key || typeof key !== 'string') return;
  const k = key.trim();
  if (k.length < 2) return;
  map.set(k, (map.get(k) || 0) + 1);
}

function bumpArr(map, arr) {
  if (!Array.isArray(arr)) return;
  for (const item of arr) {
    if (typeof item === 'string') bump(map, item);
  }
}

function topEntries(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

/** Curated buckets: how many startups' combined text matches (substring, case-insensitive) */
const LEX_BUCKETS = [
  { id: 'ai_ml', label: 'AI / ML', re: /\b(ai|ml|machine learning|llm|generative|neural|gpt|deep learning)\b/i },
  { id: 'saas_b2b', label: 'SaaS / B2B', re: /\b(saas|b2b|b-to-b|enterprise software|subscription)\b/i },
  { id: 'api_devtools', label: 'API / developer', re: /\b(api|sdk|developer|devtools|infrastructure as code)\b/i },
  { id: 'security', label: 'Security / identity', re: /\b(security|cyber|zero trust|identity|sso|encryption)\b/i },
  { id: 'fintech', label: 'Fintech / payments', re: /\b(fintech|payments|banking|lending|crypto|defi)\b/i },
  { id: 'health', label: 'Health / bio', re: /\b(health|healthcare|clinical|biotech|medical|fda|patients)\b/i },
  { id: 'climate', label: 'Climate / energy', re: /\b(climate|carbon|renewable|energy|sustainability|esg)\b/i },
  { id: 'data', label: 'Data / analytics', re: /\b(data|analytics|warehouse|etl|business intelligence)\b/i },
  { id: 'automation', label: 'Automation / workflow', re: /\b(automation|workflow|rpa|orchestration)\b/i },
  { id: 'marketplace', label: 'Marketplace / platform', re: /\b(marketplace|platform|network effects|two-sided)\b/i },
];

async function fetchAllStartups(supabase, statusFilter, limit) {
  let from = 0;
  const rows = [];
  for (;;) {
    let q = supabase.from('startup_uploads').select(SELECT).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) throw new Error(`startup_uploads: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (limit != null && rows.length >= limit) {
      return rows.slice(0, limit);
    }
    if (data.length < PAGE) break;
    from += data.length;
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const rows = await fetchAllStartups(supabase, args.status, args.limit);

  const execMap = new Map();
  const teamMap = new Map();
  const gritMap = new Map();
  const sectorMap = new Map();
  const uni = new Map();
  const bi = new Map();
  const taglineUni = new Map();
  const bucketCounts = Object.fromEntries(LEX_BUCKETS.map((b) => [b.id, 0]));

  const taglineOnlyMode = args.source === 'tagline-only';
  const structuredTaglineCohort = args.structuredCohort === 'tagline';

  let textChars = 0;
  let rowsWithText = 0;
  let rowsWithTagline = 0;
  /** Rows included in theme + lexical (tagline-only: tagline length ≥ MIN_TAGLINE_LEN; combined: all rows) */
  let lexicalThemeRows = 0;

  for (const row of rows) {
    const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};

    const combined = combinedSelfDescriptionText(row);
    const tl = taglineOnlyText(row);

    if (tl.length >= MIN_TAGLINE_LEN) rowsWithTagline += 1;

    const includeStructured = !structuredTaglineCohort || tl.length >= MIN_TAGLINE_LEN;
    if (includeStructured) {
      bumpArr(execMap, row.execution_signals);
      bumpArr(execMap, ed.execution_signals);
      bumpArr(teamMap, row.team_signals);
      bumpArr(teamMap, ed.team_signals);
      bumpArr(gritMap, row.grit_signals);
      bumpArr(gritMap, ed.grit_signals);

      if (Array.isArray(row.sectors)) {
        for (const s of row.sectors) {
          if (typeof s === 'string' && s.trim()) bump(sectorMap, s.trim());
        }
      }
    }

    if (taglineOnlyMode) {
      if (tl.length < MIN_TAGLINE_LEN) continue;
      lexicalThemeRows += 1;
      textChars += tl.length;
      if (tl.length >= 40) rowsWithText += 1;

      const lower = tl.toLowerCase();
      for (const b of LEX_BUCKETS) {
        if (b.re.test(lower)) bucketCounts[b.id] += 1;
      }

      const tokens = tokenize(tl);
      for (const [k, v] of countUnigrams(tokens)) {
        uni.set(k, (uni.get(k) || 0) + v);
        taglineUni.set(k, (taglineUni.get(k) || 0) + v);
      }
      for (const [k, v] of countBigrams(tokens)) {
        bi.set(k, (bi.get(k) || 0) + v);
      }
    } else {
      textChars += combined.length;
      if (combined.length >= 40) rowsWithText += 1;

      const lower = combined.toLowerCase();
      for (const b of LEX_BUCKETS) {
        if (b.re.test(lower)) bucketCounts[b.id] += 1;
      }

      const tokens = tokenize(combined);
      for (const [k, v] of countUnigrams(tokens)) {
        uni.set(k, (uni.get(k) || 0) + v);
      }
      for (const [k, v] of countBigrams(tokens)) {
        bi.set(k, (bi.get(k) || 0) + v);
      }

      if (tl.length >= MIN_TAGLINE_LEN) {
        for (const [k, v] of countUnigrams(tokenize(tl))) {
          taglineUni.set(k, (taglineUni.get(k) || 0) + v);
        }
      }
    }
  }

  const themeDenominator = taglineOnlyMode ? lexicalThemeRows : rows.length;
  const structuredDenominator = structuredTaglineCohort ? rowsWithTagline : rows.length;

  const rawUni = topEntries(uni, args.lexicalFilter === 'boilerplate' ? 200 : 60);
  const rawBi = topEntries(bi, args.lexicalFilter === 'boilerplate' ? 120 : 40);
  const rawTaglineUni = topEntries(taglineUni, args.lexicalFilter === 'boilerplate' ? 200 : 40);
  const uniOut =
    args.lexicalFilter === 'boilerplate' ? filterBoilerplateLexical(rawUni).slice(0, 60) : rawUni;
  const biOut =
    args.lexicalFilter === 'boilerplate' ? filterBoilerplateLexical(rawBi).slice(0, 40) : rawBi;
  const taglineUniOut =
    args.lexicalFilter === 'boilerplate' ? filterBoilerplateLexical(rawTaglineUni).slice(0, 40) : rawTaglineUni;

  const out = {
    generated_at: new Date().toISOString(),
    scope: {
      source: args.source,
      structured_cohort: args.structuredCohort,
      lexical_filter: args.lexicalFilter,
      status: args.status,
      row_limit: args.limit,
      startups: rows.length,
      theme_and_lexical_denominator: themeDenominator,
      startups_with_narrative_40plus_chars: rowsWithText,
      startups_with_tagline_8plus_chars: rowsWithTagline,
      min_tagline_len_for_lexical: MIN_TAGLINE_LEN,
      total_source_text_chars: textChars,
      structured_signals_denominator: structuredDenominator,
    },
    structured_signals: {
      execution_signals: topEntries(execMap, 40),
      team_signals: topEntries(teamMap, 40),
      grit_signals: topEntries(gritMap, 40),
      sectors: topEntries(sectorMap, 30),
    },
    lexical: {
      top_unigrams: uniOut,
      top_bigrams: biOut,
      tagline_only_top_unigrams: taglineUniOut,
    },
    theme_buckets: LEX_BUCKETS.map((b) => ({
      id: b.id,
      label: b.label,
      startups_matching: bucketCounts[b.id],
      pct: themeDenominator ? Math.round((bucketCounts[b.id] / themeDenominator) * 1000) / 1000 : 0,
    })).sort((a, b) => b.startups_matching - a.startups_matching),
    notes: [
      'Structured signals are exact strings from enrichment/inference (e.g. Product Launched, Has Customers).',
      'source=combined: theme + lexical use full narrative; theme % is share of all scoped startups.',
      'source=tagline-only: theme + lexical use tagline + extracted tagline only; rows without tagline ≥ min are excluded; theme % is share of startups in theme_and_lexical_denominator.',
      'tagline_only_top_unigrams duplicates tagline-sourced unigrams (in combined mode: tagline slice only; in tagline-only mode: same as top_unigrams).',
      'structured_cohort=tagline: execution/team/grit/sectors counts only include startups with tagline ≥ min_tagline_len_for_lexical; structured_signals_denominator matches.',
      'lexical_filter=boilerplate: drops unigrams company/startup and bigrams ending in " company" from lexical lists (heuristic, not TF-IDF).',
    ],
  };

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log('\n📣 Startup self-description signals\n');
  console.log(`Source: ${args.source}${taglineOnlyMode ? ' — theme + lexical from tagline (+ extracted tagline) only' : ' — theme + lexical from full narrative'}`);
  console.log(`Structured cohort: ${args.structuredCohort}${structuredTaglineCohort ? ' (signals only where tagline ≥ ' + MIN_TAGLINE_LEN + ' chars)' : ''}`);
  console.log(`Lexical filter: ${args.lexicalFilter}`);
  console.log(`Scope: ${out.scope.startups} startups (${args.status})`);
  if (args.limit) console.log(`Limit: ${args.limit}`);
  console.log(
    `Theme + lexical denominator: ${themeDenominator}${taglineOnlyMode ? ` (startups with tagline ≥ ${MIN_TAGLINE_LEN} chars)` : ' (all startups)'}`,
  );
  const textPctBase = taglineOnlyMode ? themeDenominator : rows.length;
  console.log(
    `Rows with ≥40 chars ${taglineOnlyMode ? 'tagline' : 'combined narrative'}: ${rowsWithText} (${textPctBase ? ((rowsWithText / textPctBase) * 100).toFixed(1) : 0}% of denominator)`,
  );
  console.log(`Rows with tagline (≥${MIN_TAGLINE_LEN} chars): ${rowsWithTagline}`);
  if (taglineOnlyMode && !structuredTaglineCohort) {
    console.log(
      `Note: structured signals below use all ${rows.length} startups. Use --structured-cohort=tagline to align with the tagline cohort (${rowsWithTagline}).`,
    );
  }
  console.log('');

  console.log(`── Theme buckets (regex, % of ${taglineOnlyMode ? 'tagline cohort' : 'all startups'}) ──`);
  for (const t of out.theme_buckets) {
    console.log(`  ${String(Math.round(t.pct * 100)).padStart(3)}%  ${t.label.padEnd(28)} (${t.startups_matching})`);
  }

  const structLabel = structuredTaglineCohort
    ? `Structured signals (tagline cohort: ${structuredDenominator} startups — tagline ≥ ${MIN_TAGLINE_LEN} chars)`
    : `Structured signals (all ${structuredDenominator} startups — enrichment / labels)`;
  console.log(`\n── ${structLabel} ──`);
  console.log('── Top execution_signals (exact strings) ──');
  for (const x of out.structured_signals.execution_signals.slice(0, 15)) {
    console.log(`  ${String(x.count).padStart(6)}  ${x.key}`);
  }

  console.log('\n── Top team_signals ──');
  for (const x of out.structured_signals.team_signals.slice(0, 12)) {
    console.log(`  ${String(x.count).padStart(6)}  ${x.key}`);
  }

  console.log('\n── Top sectors (labels) ──');
  for (const x of out.structured_signals.sectors.slice(0, 15)) {
    console.log(`  ${String(x.count).padStart(6)}  ${x.key}`);
  }

  const uniLabel = taglineOnlyMode ? 'Top word unigrams (tagline-only source)' : 'Top word unigrams (full narrative)';
  console.log(`\n── ${uniLabel} ──`);
  for (const x of out.lexical.top_unigrams.slice(0, 20)) {
    console.log(`  ${String(x.count).padStart(6)}  ${x.key}`);
  }

  const biLabel = taglineOnlyMode ? 'Top bigrams (tagline-only source)' : 'Top bigrams (full narrative)';
  console.log(`\n── ${biLabel} ──`);
  for (const x of out.lexical.top_bigrams.slice(0, 15)) {
    console.log(`  ${String(x.count).padStart(6)}  ${x.key}`);
  }

  if (!taglineOnlyMode) {
    console.log('\n── Top unigrams (tagline slice only, for comparison) ──');
    for (const x of out.lexical.tagline_only_top_unigrams.slice(0, 20)) {
      console.log(`  ${String(x.count).padStart(6)}  ${x.key}`);
    }
  }

  console.log(
    '\nJSON: node scripts/report-startup-self-description-signals.js --json [--source=tagline-only] [--structured-cohort=tagline] [--lexical-filter=boilerplate]\n',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
