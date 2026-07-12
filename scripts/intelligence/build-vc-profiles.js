#!/usr/bin/env node
/**
 * VC Profile Builder — LLM Thesis Extraction
 *
 * Reads raw scraped data from vc_intelligence, then uses GPT-4o to extract:
 *   - Investment thesis summary
 *   - Sector / stage preferences
 *   - What they look for (signals) and avoid (red flags)
 *   - Communication style + personality profile
 *   - Best outreach hook
 *
 * This builds the "FBI dossier" layer on top of raw scraped data.
 *
 * Usage:
 *   node scripts/intelligence/build-vc-profiles.js           # unprofiled only (resume)
 *   node scripts/intelligence/build-vc-profiles.js --all     # re-profile all (expensive)
 *   node scripts/intelligence/build-vc-profiles.js --limit=50
 *   node scripts/intelligence/build-vc-profiles.js --provider=gemini
 *   node scripts/intelligence/build-vc-profiles.js --model=gpt-4o-mini
 *   node scripts/intelligence/build-vc-profiles.js --firm=a16z
 *   node scripts/intelligence/build-vc-profiles.js --dry-run
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { groupIntelRecordsByFirm } = require('../../lib/investorFirmDedup.mjs');
const { parseLimitArg } = require('../../lib/investorUniverse.mjs');

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = (
  process.env.GEMINI_API_KEY ||
  process.env.AISTUDIO_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  ''
).trim();
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const argv = process.argv.slice(2);
const DRY_RUN     = argv.includes('--dry-run');
const RE_PROFILE  = argv.includes('--all');
const FIRM_FILTER = (argv.find(a => a.startsWith('--firm=')) || '').replace('--firm=', '').toLowerCase();
const NO_DEDUP = argv.includes('--no-dedup');
const LIMIT = parseLimitArg(argv, { defaultZero: true });
const DELAY_MS = (() => {
  const a = argv.find((x) => x.startsWith('--delay='));
  return a ? Math.max(0, parseInt(a.split('=')[1], 10) || 0) : 2000;
})();
const CONCURRENCY = (() => {
  const a = argv.find((x) => x.startsWith('--concurrency='));
  return a ? Math.max(1, parseInt(a.split('=')[1], 10) || 1) : 1;
})();
const PROVIDER = (() => {
  const a = argv.find((x) => x.startsWith('--provider='));
  if (a) return a.split('=')[1].toLowerCase();
  return GEMINI_KEY && !OAI_KEY ? 'gemini' : 'openai';
})();
const MODEL = (() => {
  const a = argv.find((x) => x.startsWith('--model='));
  if (a) return a.split('=').slice(1).join('=');
  if (PROVIDER === 'gemini') return process.env.GEMINI_PROFILE_MODEL || 'gemini-2.5-flash';
  return process.env.VC_PROFILE_MODEL || 'gpt-4o-mini';
})();
const MAX_OUTPUT_TOKENS = (() => {
  const env = parseInt(process.env.VC_PROFILE_MAX_TOKENS || '', 10);
  if (Number.isFinite(env) && env > 0) return env;
  return PROVIDER === 'gemini' ? 8192 : 1800;
})();
const MIN_SOURCES = (() => {
  const a = argv.find((x) => x.startsWith('--min-sources='));
  if (a) return Math.max(0, parseInt(a.split('=')[1], 10) || 0);
  return parseInt(process.env.VC_PROFILE_MIN_SOURCES || '1', 10) || 0;
})();

let quotaExhausted = false;
let llmOk = 0;
let llmFailed = 0;
let llmSkipped = 0;

function sb()    { return createClient(SB_URL, SB_KEY); }
function openai(){ return new OpenAI({ apiKey: OAI_KEY }); }

// ── Build the profiling prompt ───────────────────────────────────────────────
function buildProfilePrompt(record) {
  const articles = [
    ...(record.rss_articles || []),
    ...(record.blog_posts   || []),
  ];

  const contentSample = articles
    .slice(0, 8)
    .map(a => `Title: ${a.title}\nExcerpt: ${a.excerpt || ''}`)
    .join('\n---\n');

  const topPhrases = (record.language_patterns || [])
    .slice(0, 20)
    .map(p => p.phrase)
    .join(', ');

  const detectedSignals = ((record.portfolio_signals || [])[0]?.signals || []).join(', ');

  return {
    system: `You are a venture capital research analyst. Your job is to build an investor thesis profile — think of it as an FBI dossier on how this investor thinks, what they value, and how to best approach them.

Be precise, analytical, and evidence-based. Extract patterns from the content provided. Do not invent information not supported by the text.

Return ONLY valid JSON matching this exact schema:
{
  "thesis_summary": "2-3 sentence synthesis of their investment thesis",
  "sector_preferences": ["sector1", "sector2"],
  "stage_preferences": ["seed", "series-a"],
  "check_size_range": {"min_usd": 250000, "max_usd": 5000000},
  "investment_signals": [
    {"signal": "what they look for", "weight": 0.9, "evidence_quote": "direct quote if available"}
  ],
  "red_flags": ["things they avoid or have publicly criticized"],
  "value_add_claims": ["what they claim to offer beyond capital"],
  "language_patterns": [{"phrase": "key phrase they use", "context": "when/how they use it"}],
  "personality_profile": "analytical|storyteller|contrarian|operator|thesis-driven|community-builder",
  "communication_style": "dense|accessible|metrics-first|narrative-first|philosophical",
  "key_themes": ["theme1", "theme2"],
  "typical_intro_path": "warm intro|cold email|conference|demo day|twitter|portfolio referral",
  "best_outreach_hook": "what angle/framing resonates most with this investor based on their patterns"
}`,
    user: `Firm: ${record.firm_name}
Website: ${record.firm_url || 'unknown'}
Detected interest signals: ${detectedSignals || 'none detected'}
Top recurring phrases: ${topPhrases || 'none'}

Recent content sample:
${contentSample || '(No content available — base profile on firm name and any known context)'}

Build the investor thesis profile.`,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function recordHasContent(record) {
  const articles = [...(record.rss_articles || []), ...(record.blog_posts || [])];
  return (
    articles.length > 0 ||
    (record.language_patterns || []).length > 0 ||
    ((record.portfolio_signals || [])[0]?.signals || []).length > 0
  );
}

const LOW_QUALITY_THESIS = [
  /cannot be determined/i,
  /cannot be constructed/i,
  /insufficient data/i,
  /no content was provided/i,
  /no venture capital investment thesis/i,
  /investment thesis cannot/i,
];

function isLowQualityProfile(profile, record) {
  const thesis = (profile.thesis_summary || '').trim();
  if (!thesis || thesis.length < 40) return true;
  if (LOW_QUALITY_THESIS.some((re) => re.test(thesis))) return true;
  const style = `${profile.personality_profile || ''} ${profile.communication_style || ''}`.toLowerCase();
  if (style.includes('n/a') || style.includes('null') || style.includes('insufficient')) return true;
  const sources = record.source_count || 0;
  const sectors = (profile.sector_preferences || []).filter(Boolean);
  if (sources < MIN_SOURCES && !recordHasContent(record)) return true;
  if (sources === 0 && sectors.length === 0) return true;
  return false;
}

function shouldSkipRecord(record) {
  const sources = record.source_count || 0;
  if (sources >= MIN_SOURCES) return false;
  if (recordHasContent(record)) return false;
  return true;
}

function isQuotaError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes('exceeded your current quota') ||
    msg.includes('insufficient_quota') ||
    msg.includes('billing hard limit') ||
    msg.includes('not enough quota')
  );
}

function isRateLimitError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
}

async function withLlmRetry(fn, label) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (isQuotaError(e)) {
        quotaExhausted = true;
        throw e;
      }
      if (!isRateLimitError(e) || attempt === maxAttempts) throw e;
      const wait = attempt * 5000;
      console.warn(`    ⚠ ${label} rate limited — retry ${attempt}/${maxAttempts} in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

// ── Call LLM and parse JSON ───────────────────────────────────────────────────
async function extractThesisProfileOpenAI(record) {
  const { system, user } = buildProfilePrompt(record);
  const ai = openai();

  const resp = await ai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function extractThesisProfileGemini(record) {
  const { system, user } = buildProfilePrompt(record);
  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const json = await res.json();
  if (!res.ok) {
    const errMsg = JSON.stringify(json.error || json).slice(0, 400);
    throw new Error(`${res.status} ${errMsg}`);
  }

  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const raw = parts.map((p) => p.text || '').join('').trim() || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    const reason = candidate?.finishReason || 'unknown';
    console.warn(`    ⚠ Gemini JSON parse failed (finishReason=${reason}, len=${raw.length})`);
    return {};
  }
}

async function extractThesisProfile(record) {
  if (PROVIDER === 'gemini') {
    if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
    return withLlmRetry(() => extractThesisProfileGemini(record), record.firm_name);
  }
  if (!OAI_KEY) throw new Error('OPENAI_API_KEY not set');
  return withLlmRetry(() => extractThesisProfileOpenAI(record), record.firm_name);
}

// ── Process a single vc_intelligence record ───────────────────────────────────
async function saveProfileForRecords(records, profile) {
  const payload = {
    thesis_summary: profile.thesis_summary,
    sector_preferences: profile.sector_preferences || [],
    stage_preferences: profile.stage_preferences || [],
    check_size_range: profile.check_size_range || {},
    investment_signals: profile.investment_signals || [],
    red_flags: profile.red_flags || [],
    value_add_claims: profile.value_add_claims || [],
    language_patterns: profile.language_patterns || [],
    personality_profile: profile.personality_profile,
    communication_style: profile.communication_style,
    key_themes: profile.key_themes || [],
    typical_intro_path: profile.typical_intro_path,
    best_outreach_hook: profile.best_outreach_hook,
    profiled_at: new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.log(`    [dry-run] Hook: ${profile.best_outreach_hook}`);
    return;
  }

  const client = sb();
  for (const record of records) {
    const { error } = await client.from('vc_intelligence')
      .update({
        ...payload,
        profile_version: (record.profile_version || 1) + 1,
      })
      .eq('id', record.id);

    if (error) console.error(`    ✗ DB error (${record.firm_name}): ${error.message}`);
  }
  const n = records.length;
  console.log(`    ✅ Profile saved${n > 1 ? ` → ${n} rows` : ''}`);
}

async function profileFirmGroup(group) {
  const record = group.representative;
  const aliasNote = group.records.length > 1 ? ` [${group.records.length} rows]` : '';
  console.log(`  → ${record.firm_name} (${record.source_count || 0} sources)${aliasNote}`);

  if (shouldSkipRecord(record)) {
    llmSkipped++;
    console.log(`    ⏭ skipped — no scrape content (needs sources or RSS/blog data)`);
    return;
  }

  let profile;
  try {
    profile = await extractThesisProfile(record);
    llmOk++;
  } catch (e) {
    llmFailed++;
    if (isQuotaError(e)) {
      console.error(`\n⛔ LLM quota exhausted — stopping. Resume later with unprofiled-only run (no --all).`);
      console.error(`   ${e.message}`);
      quotaExhausted = true;
      return;
    }
    console.error(`    ✗ LLM error: ${e.message}`);
    return;
  }

  if (!profile.thesis_summary) {
    console.log('    ⚠️  Empty profile returned — not saved');
    return;
  }

  if (isLowQualityProfile(profile, record)) {
    llmSkipped++;
    console.log('    ⚠️  Low-quality profile — not saved (will retry after more scrape data)');
    return;
  }

  console.log(`    thesis: ${profile.thesis_summary?.slice(0, 80)}...`);
  console.log(`    sectors: ${(profile.sector_preferences || []).join(', ')}`);
  console.log(`    style: ${profile.personality_profile} / ${profile.communication_style}`);

  await saveProfileForRecords(group.records, profile);
}

async function runBatch(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    if (quotaExhausted) break;
    const slice = items.slice(i, i + concurrency);
    for (const item of slice) {
      if (quotaExhausted) break;
      await fn(item);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
  }
}

async function main() {
  console.log('🧠 VC Profile Builder (LLM Thesis Extraction)');
  console.log('═'.repeat(50));
  console.log('Run at:', new Date().toISOString());
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode — no DB writes');
  console.log(`Provider: ${PROVIDER} · model: ${MODEL} · max tokens: ${MAX_OUTPUT_TOKENS} · min sources: ${MIN_SOURCES} · concurrency: ${CONCURRENCY} · delay: ${DELAY_MS}ms`);
  if (RE_PROFILE) console.log('⚠️  --all mode: re-profiling every row (expensive)');
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} firm groups`);
  if (PROVIDER === 'openai' && !OAI_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
  if (PROVIDER === 'gemini' && !GEMINI_KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

  const client = sb();

  const pageSize = 200;
  let page = 0;
  const records = [];

  while (true) {
    let query = client
      .from('vc_intelligence')
      .select('*')
      .order('scraped_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (!RE_PROFILE) query = query.is('profiled_at', null);
    if (FIRM_FILTER) query = query.ilike('firm_name', `%${FIRM_FILTER}%`);

    const { data, error } = await query;
    if (error) { console.error('DB:', error.message); process.exit(1); }
    if (!data?.length) break;
    records.push(...data);
    if (!RE_PROFILE || data.length < pageSize) break;
    page++;
  }

  if (!records.length) {
    console.log('No unprofiled investors found. Use --all to re-profile.');
    process.exit(0);
  }

  const firmGroups = NO_DEDUP
    ? records.map((rec) => ({ representative: rec, records: [rec] }))
    : groupIntelRecordsByFirm(records);

  let groupsToRun = firmGroups;
  if (LIMIT > 0) groupsToRun = groupsToRun.slice(0, LIMIT);

  const aliasRows = records.length - firmGroups.length;
  console.log(`\nProfiling ${records.length} rows → ${firmGroups.length} unique firms` +
    (LIMIT > 0 ? ` · running ${groupsToRun.length} this batch` : '') + '...');
  if (aliasRows > 0 && !NO_DEDUP) {
    console.log(`   firm dedup: skipping ${aliasRows} duplicate LLM calls\n`);
  } else {
    console.log('');
  }

  let done = 0;
  await runBatch(groupsToRun, CONCURRENCY, async (group) => {
    try {
      await profileFirmGroup(group);
      if (!quotaExhausted) done += group.records.length;
    } catch (e) {
      llmFailed++;
      console.error('  ✗', group.representative.firm_name, e.message);
    }
  });

  console.log(`\n✅ Done — ${done}/${records.length} rows profiled (${groupsToRun.length} firm groups)`);
  console.log(`   LLM ok: ${llmOk} · failed: ${llmFailed} · skipped: ${llmSkipped}` +
    (quotaExhausted ? ' · stopped early (quota)' : ''));
  if (quotaExhausted || llmFailed > 0) {
    console.log('   Resume: node scripts/intelligence/build-vc-profiles.js --limit=50 --provider=gemini --delay=2000');
    console.log('   Run ONE process at a time — do not overlap with pipeline sync/scrape jobs.');
  }
  process.exit(quotaExhausted ? 2 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
