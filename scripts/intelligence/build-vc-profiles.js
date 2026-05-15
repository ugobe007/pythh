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
 *   node scripts/intelligence/build-vc-profiles.js           # all unprofiledinvestors
 *   node scripts/intelligence/build-vc-profiles.js --all     # re-profile all
 *   node scripts/intelligence/build-vc-profiles.js --firm=a16z
 *   node scripts/intelligence/build-vc-profiles.js --dry-run
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OAI_KEY = process.env.OPENAI_API_KEY;

const DRY_RUN     = process.argv.includes('--dry-run');
const RE_PROFILE  = process.argv.includes('--all');
const FIRM_FILTER = (process.argv.find(a => a.startsWith('--firm=')) || '').replace('--firm=', '').toLowerCase();
const CONCURRENCY = 3;

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

// ── Call GPT-4o and parse JSON ────────────────────────────────────────────────
async function extractThesisProfile(record) {
  const { system, user } = buildProfilePrompt(record);
  const ai = openai();

  const resp = await ai.chat.completions.create({
    model:       'gpt-4o',
    temperature: 0.2,
    max_tokens:  1800,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── Process a single vc_intelligence record ───────────────────────────────────
async function profileRecord(record) {
  console.log(`  → ${record.firm_name} (${record.source_count || 0} sources)`);

  let profile;
  try {
    profile = await extractThesisProfile(record);
  } catch (e) {
    console.error(`    ✗ LLM error: ${e.message}`);
    return;
  }

  if (!profile.thesis_summary) {
    console.log('    ⚠️  Empty profile returned');
    return;
  }

  console.log(`    thesis: ${profile.thesis_summary?.slice(0, 80)}...`);
  console.log(`    sectors: ${(profile.sector_preferences || []).join(', ')}`);
  console.log(`    style: ${profile.personality_profile} / ${profile.communication_style}`);

  if (!DRY_RUN) {
    const client = sb();
    const { error } = await client.from('vc_intelligence')
      .update({
        thesis_summary:     profile.thesis_summary,
        sector_preferences: profile.sector_preferences || [],
        stage_preferences:  profile.stage_preferences  || [],
        check_size_range:   profile.check_size_range   || {},
        investment_signals: profile.investment_signals || [],
        red_flags:          profile.red_flags          || [],
        value_add_claims:   profile.value_add_claims   || [],
        language_patterns:  profile.language_patterns  || [],
        personality_profile: profile.personality_profile,
        communication_style: profile.communication_style,
        key_themes:         profile.key_themes         || [],
        typical_intro_path: profile.typical_intro_path,
        best_outreach_hook: profile.best_outreach_hook,
        profiled_at:        new Date().toISOString(),
        profile_version:    (record.profile_version || 1) + 1,
      })
      .eq('id', record.id);

    if (error) console.error(`    ✗ DB error: ${error.message}`);
    else console.log(`    ✅ Profile saved`);
  } else {
    console.log(`    [dry-run] Hook: ${profile.best_outreach_hook}`);
  }
}

async function runBatch(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
  }
}

async function main() {
  console.log('🧠 VC Profile Builder (LLM Thesis Extraction)');
  console.log('═'.repeat(50));
  console.log('Run at:', new Date().toISOString());
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode — no DB writes');
  if (!OAI_KEY)  { console.error('OPENAI_API_KEY not set'); process.exit(1); }

  const client = sb();

  let query = client.from('vc_intelligence').select('*').order('scraped_at', { ascending: false }).limit(200);
  if (!RE_PROFILE) query = query.is('profiled_at', null);
  if (FIRM_FILTER) query = query.ilike('firm_name', `%${FIRM_FILTER}%`);

  const { data: records, error } = await query;
  if (error) { console.error('DB:', error.message); process.exit(1); }
  if (!records?.length) { console.log('No unprofiledinvestors found. Use --all to re-profile.'); process.exit(0); }

  console.log(`\nProfiling ${records.length} investors...\n`);

  let done = 0;
  await runBatch(records, CONCURRENCY, async (rec) => {
    try { await profileRecord(rec); done++; } catch (e) { console.error('  ✗', rec.firm_name, e.message); }
  });

  console.log(`\n✅ Done — ${done}/${records.length} profiles built`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
