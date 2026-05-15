#!/usr/bin/env node
/**
 * Deal Positioning Engine
 *
 * For each startup × investor pairing (from pythh_matches), uses the VC's
 * thesis profile (vc_intelligence) to generate perfectly targeted positioning:
 *   - What angle to use based on how this VC thinks
 *   - What to emphasize vs. downplay
 *   - Subject line + opening paragraph optimized for their style
 *   - Thesis alignment score
 *
 * Usage:
 *   node scripts/intelligence/position-deals.js --startup=<id>    # one startup, all matched investors
 *   node scripts/intelligence/position-deals.js --investor=<id>   # one investor, top startup matches
 *   node scripts/intelligence/position-deals.js --limit=50        # batch mode
 *   node scripts/intelligence/position-deals.js --dry-run
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OAI_KEY = process.env.OPENAI_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');
const STARTUP_ID   = (process.argv.find(a => a.startsWith('--startup='))  || '').replace('--startup=', '')  || null;
const INVESTOR_ID  = (process.argv.find(a => a.startsWith('--investor=')) || '').replace('--investor=', '') || null;
const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '--limit=20').split('=')[1]);
const CONCURRENCY = 3;

function sb()    { return createClient(SB_URL, SB_KEY); }
function openai(){ return new OpenAI({ apiKey: OAI_KEY }); }

function buildPositioningPrompt(startup, investor, vcIntel) {
  const thesisSummary  = vcIntel?.thesis_summary || 'Unknown thesis';
  const sectorPrefs    = (vcIntel?.sector_preferences || []).join(', ') || 'unknown';
  const stagePrefs     = (vcIntel?.stage_preferences  || []).join(', ') || 'unknown';
  const signals        = (vcIntel?.investment_signals  || []).map(s => s.signal).join(', ') || 'unknown';
  const redFlags       = (vcIntel?.red_flags           || []).join(', ') || 'none known';
  const style          = vcIntel?.communication_style  || 'unknown';
  const personality    = vcIntel?.personality_profile  || 'unknown';
  const outreachHook   = vcIntel?.best_outreach_hook   || '';
  const keyThemes      = (vcIntel?.key_themes          || []).join(', ') || '';

  const startupContext = [
    `Company: ${startup.name}`,
    startup.tagline     ? `Tagline: ${startup.tagline}` : '',
    startup.description ? `Description: ${startup.description?.slice(0, 400)}` : '',
    startup.sectors     ? `Sectors: ${(startup.sectors || []).join(', ')}` : '',
    startup.stage       ? `Stage: ${startup.stage}` : '',
    startup.total_god_score != null ? `Quality (GOD) Score: ${startup.total_god_score}/100` : '',
    startup.team_score  != null ? `Pillar scores — Team: ${startup.team_score}, Traction: ${startup.traction_score}, Market: ${startup.market_score}, Product: ${startup.product_score}` : '',
    startup.total_funding_usd ? `Total funding: $${Math.round(startup.total_funding_usd / 1e6)}M` : '',
    startup.pitch       ? `Pitch: ${startup.pitch?.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n');

  return {
    system: `You are a venture capital deal positioning expert. Your job is to analyze a startup and an investor's thesis profile, then craft the exact positioning strategy that will resonate with that specific investor.

Think like an FBI profiler: use everything you know about this investor's patterns, language, and psychology to identify the perfect angle.

Return ONLY valid JSON:
{
  "thesis_alignment": 0-100,
  "sector_fit": "perfect|strong|adjacent|stretch",
  "stage_fit": "on-target|early|late",
  "positioning_angle": "The core hook/narrative that connects this startup to this investor's worldview",
  "key_signals": ["3-5 startup attributes that directly align with their thesis — be specific"],
  "signals_to_avoid": ["startup aspects that conflict with their thesis or preferences"],
  "suggested_subject": "Subject line optimized for their communication style",
  "suggested_opening": "Opening paragraph (2-3 sentences) that speaks their language",
  "talking_points": [
    {"point": "specific talking point", "evidence": "evidence from startup data", "investor_resonance": "why this lands with this specific investor"}
  ]
}`,
    user: `INVESTOR PROFILE:
Firm: ${investor.name || investor.firm}
Thesis: ${thesisSummary}
Sector preferences: ${sectorPrefs}
Stage preferences: ${stagePrefs}
Investment signals (what they look for): ${signals}
Red flags (what they avoid): ${redFlags}
Communication style: ${style}
Personality profile: ${personality}
Key themes: ${keyThemes}
Best outreach hook: ${outreachHook}

STARTUP PROFILE:
${startupContext}

Generate the deal positioning strategy for pitching this startup to this specific investor.`,
  };
}

async function generatePositioning(startup, investor, vcIntel) {
  const { system, user } = buildPositioningPrompt(startup, investor, vcIntel);
  const ai = openai();

  const resp = await ai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
  });

  return JSON.parse(resp.choices[0]?.message?.content || '{}');
}

async function processStartupInvestorPair(startup, investor, vcIntel) {
  const label = `${startup.name} → ${investor.name}`;
  console.log(`  ${label}`);

  let pos;
  try {
    pos = await generatePositioning(startup, investor, vcIntel);
  } catch (e) {
    console.error(`    ✗ LLM error: ${e.message}`);
    return;
  }

  if (!pos.positioning_angle) return;

  console.log(`    align=${pos.thesis_alignment} fit=${pos.sector_fit}/${pos.stage_fit}`);
  console.log(`    angle: ${pos.positioning_angle?.slice(0, 80)}`);

  if (!DRY_RUN) {
    const client = sb();
    const { error } = await client.from('vc_deal_positioning').upsert({
      startup_id:       startup.id,
      investor_id:      investor.id,
      intel_id:         vcIntel?.id || null,
      thesis_alignment: pos.thesis_alignment,
      sector_fit:       pos.sector_fit,
      stage_fit:        pos.stage_fit,
      positioning_angle: pos.positioning_angle,
      key_signals:      pos.key_signals || [],
      signals_to_avoid: pos.signals_to_avoid || [],
      suggested_subject: pos.suggested_subject,
      suggested_opening: pos.suggested_opening,
      talking_points:   pos.talking_points || [],
      model_used:       'gpt-4o',
      refreshed_at:     new Date().toISOString(),
    }, { onConflict: 'startup_id,investor_id' });

    if (error) console.error(`    ✗ DB: ${error.message}`);
    else console.log(`    ✅ Saved`);
  }

  return pos;
}

async function runBatch(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
  }
}

async function main() {
  console.log('🎯 Deal Positioning Engine');
  console.log('═'.repeat(50));
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode');
  if (!OAI_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

  const client = sb();

  // Load vc_intelligence profiles (investor_id → profile)
  const { data: intelRows } = await client.from('vc_intelligence')
    .select('id, investor_id, firm_name, thesis_summary, sector_preferences, stage_preferences, investment_signals, red_flags, communication_style, personality_profile, key_themes, best_outreach_hook')
    .not('profiled_at', 'is', null);

  const intelByInvestor = new Map((intelRows || []).map(r => [r.investor_id, r]));
  console.log(`VC intelligence profiles loaded: ${intelByInvestor.size}`);

  // Build pairs to position
  let pairs = [];

  if (STARTUP_ID) {
    // One startup, find its top matches
    const { data: startup } = await client.from('startup_uploads')
      .select('id, name, tagline, description, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, total_funding_usd, pitch')
      .eq('id', STARTUP_ID).single();

    const { data: matches } = await client.from('pythh_matches')
      .select('investor_id, match_score')
      .eq('startup_id', STARTUP_ID)
      .order('match_score', { ascending: false })
      .limit(LIMIT);

    const investorIds = (matches || []).map(m => m.investor_id);
    if (!investorIds.length) { console.log('No matches found for startup'); process.exit(0); }

    const { data: investors } = await client.from('investors')
      .select('id, name, firm, url').in('id', investorIds);

    for (const inv of (investors || [])) {
      pairs.push({ startup, investor: inv, vcIntel: intelByInvestor.get(inv.id) });
    }

  } else if (INVESTOR_ID) {
    const { data: investor } = await client.from('investors')
      .select('id, name, firm, url').eq('id', INVESTOR_ID).single();
    const vcIntel = intelByInvestor.get(INVESTOR_ID);

    const { data: matches } = await client.from('pythh_matches')
      .select('startup_id, match_score')
      .eq('investor_id', INVESTOR_ID)
      .order('match_score', { ascending: false })
      .limit(LIMIT);

    const startupIds = (matches || []).map(m => m.startup_id);
    const { data: startups } = await client.from('startup_uploads')
      .select('id, name, tagline, description, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, total_funding_usd, pitch')
      .in('id', startupIds);

    for (const su of (startups || [])) {
      pairs.push({ startup: su, investor, vcIntel });
    }

  } else {
    // Batch: find pairs where we have vc_intelligence but no positioning yet
    const { data: unpositioned } = await client.from('pythh_matches')
      .select('startup_id, investor_id, match_score')
      .order('match_score', { ascending: false })
      .limit(LIMIT * 3);

    const positioned = await client.from('vc_deal_positioning')
      .select('startup_id, investor_id');
    const posSet = new Set((positioned.data || []).map(p => `${p.startup_id}:${p.investor_id}`));

    const fresh = (unpositioned || []).filter(m =>
      intelByInvestor.has(m.investor_id) && !posSet.has(`${m.startup_id}:${m.investor_id}`)
    ).slice(0, LIMIT);

    const startupIds  = [...new Set(fresh.map(m => m.startup_id))];
    const investorIds = [...new Set(fresh.map(m => m.investor_id))];

    const [startupRes, investorRes] = await Promise.all([
      client.from('startup_uploads').select('id, name, tagline, description, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, total_funding_usd, pitch').in('id', startupIds),
      client.from('investors').select('id, name, firm, url').in('id', investorIds),
    ]);

    const startupMap  = new Map((startupRes.data  || []).map(r => [r.id, r]));
    const investorMap = new Map((investorRes.data || []).map(r => [r.id, r]));

    pairs = fresh.map(m => ({
      startup:  startupMap.get(m.startup_id),
      investor: investorMap.get(m.investor_id),
      vcIntel:  intelByInvestor.get(m.investor_id),
    })).filter(p => p.startup && p.investor);
  }

  console.log(`\nPositioning ${pairs.length} startup-investor pairs...\n`);

  let done = 0;
  await runBatch(pairs, CONCURRENCY, async ({ startup, investor, vcIntel }) => {
    try { await processStartupInvestorPair(startup, investor, vcIntel); done++; } catch (e) { console.error('  ✗', e.message); }
  });

  console.log(`\n✅ Done — ${done}/${pairs.length} positioned`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
