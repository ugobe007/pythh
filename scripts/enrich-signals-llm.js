#!/usr/bin/env node
/**
 * ENRICH SIGNALS — LLM Second-Pass Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * For entities that the rule-based parser could not classify, this script sends
 * their raw sentences to GPT-4o-mini for intelligent signal classification.
 *
 * Architecture:
 *   Rule-based parser  → fast, free, high precision, ~3% coverage today
 *   LLM second-pass    → slower, costs ~$0.001/entity, higher recall
 *
 * The LLM is instructed to use the same Pythh signal schema so output is
 * directly compatible with pythh_signal_events.
 *
 * Usage:
 *   node scripts/enrich-signals-llm.js                    # dry-run
 *   node scripts/enrich-signals-llm.js --apply
 *   node scripts/enrich-signals-llm.js --apply --limit 200
 *   node scripts/enrich-signals-llm.js --apply --min-conf 0.55
 *
 * Cost estimate: ~$0.30 per 1000 entities at gpt-4o-mini pricing
 * Required env: OPENAI_API_KEY (or VITE_OPENAI_API_KEY)
 */

'use strict';
require('dotenv').config();

const { createClient }    = require('@supabase/supabase-js');
const OpenAI              = require('openai');
const { insertInBatches,
        getAlreadyIngestedToday,
        fetchByIds }      = require('../lib/supabaseUtils');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('❌ Missing OPENAI_API_KEY. Add it to your .env file.');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ── CLI flags ──────────────────────────────────────────────────────────────
function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN    = !process.argv.includes('--apply');
const LIMIT      = +(argVal('--limit',     '500'));
const MIN_CONF   = +(argVal('--min-conf',  '0.50'));
const MODEL      =   argVal('--model',     'gpt-4o-mini');
const BATCH_SIZE = +(argVal('--batch',     '5'));  // entities per LLM call

// ── Pythh signal classes the LLM must use ─────────────────────────────────
const VALID_CLASSES = [
  // Core business lifecycle
  'fundraising_signal', 'growth_signal', 'revenue_signal', 'product_signal',
  'expansion_signal', 'enterprise_signal', 'efficiency_signal', 'distress_signal',
  'exit_signal', 'acquisition_signal', 'partnership_signal', 'hiring_signal',
  // Investor signals
  'investor_interest_signal', 'investor_rejection_signal',
  // Buyer signals
  'buyer_signal', 'buyer_pain_signal', 'buyer_budget_signal',
  // GTM / market
  'gtm_signal', 'demand_signal', 'market_signal',
  // Founder psychology (LinkedIn/X — precedes events by 3–12 months)
  'founder_psychology_signal',
  // Low certainty
  'exploratory_signal',
];

// ── Valid postures (mirrors signalOntology.js POSTURE_MAP) ────────────────
const VALID_POSTURES = [
  'posture_confident',         // high conviction, positive momentum
  'posture_euphoric',          // peak excitement — milestone or launch
  'posture_disciplined',       // controlled growth, efficiency-minded
  'posture_urgent',            // time-sensitive, high urgency
  'posture_distressed',        // under pressure / survival mode
  'posture_frustrated',        // friction / difficulty — pre-pivot warning
  'posture_defensive',         // resilience framing, holding steady
  'posture_combative',         // competitive aggression
  'posture_cautious_optimism', // hedged positive
  'posture_experimental',      // iterating / discovering
  'posture_speed',             // bias for action, shipping fast
  'posture_grateful',          // gratitude — often precedes fundraise/milestone
  'posture_ambiguous',         // hedging, uncertain
  'posture_reflective',        // looking back — milestone or wind-down
  'posture_transparent',       // vulnerability / honesty — often precedes hard news
  'posture_mission',           // values/purpose-driven narrative
  'posture_neutral',           // no strong posture signal
];

// ── System prompt for LLM ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a signal classification engine for Pythh, a startup intelligence platform.
Your job is to analyze sentences from startup descriptions and news articles and extract structured business signals.

Return a JSON OBJECT with a "signals" key containing an array of signal objects.
Each signal object must follow this schema exactly:
{
  "entity_index": <0-based int — which company in the batch>,
  "sentence_index": <0-based int — which sentence for that company>,
  "sentence": "the original sentence text",
  "primary_signal": "<one of the valid signal classes>",
  "alternate_signal": "<second-best class if ambiguous, else null>",
  "signal_type": "event | intent | posture | demand | distress | investor | buyer | talent | market | psychology | efficiency | exit",
  "signal_strength": <number 0.0-1.0>,
  "confidence": <number 0.0-1.0>,
  "evidence_quality": "confirmed | inferred | stated | speculative",
  "modality": "active | passive | conditional | hedged | stated",
  "posture": "<one of the valid posture values>",
  "action_tag": "<short snake_case label e.g. raise_funding, hire_engineers, launch_product>",
  "meaning": "<1 sentence plain-English interpretation>",
  "is_ambiguous": <true if language is hedged, weak, or mixed — else false>,
  "has_negation": <true if sentence negates the signal — else false>,
  "intensity": [],
  "who_cares": { "investors": false, "vendors": false, "acquirers": false, "recruiters": false }
}

Valid primary_signal values: ${VALID_CLASSES.join(', ')}
Valid posture values: ${VALID_POSTURES.join(', ')}

## Signal classification rules:

### Coverage — be generous:
- ANY sentence mentioning growth, hiring, fundraising, product, partnerships, expansion, revenue, customers, or strategic moves → classify it
- A startup describing what it does implies product_signal or market_signal at minimum
- A founder describing emotions or journey → founder_psychology_signal

### Confidence calibration:
- Confirmed event ("raised $5M", "launched today"): strength 0.85–1.00, confidence 0.90–1.00
- Active intent ("we are raising", "currently hiring"): strength 0.70–0.85, confidence 0.80–0.90
- Stated intent ("we plan to", "we will launch"): strength 0.55–0.75, confidence 0.65–0.80
- Hedged / speculative ("may raise", "considering expansion"): strength 0.30–0.55, confidence 0.40–0.65, is_ambiguous: true
- Vague / aspirational ("we want to grow"): strength 0.25–0.45, confidence 0.35–0.55, is_ambiguous: true

### Ambiguity rule:
- Set is_ambiguous: true for: may, might, could, possibly, considering, exploring, hoping, planning, looking to, if all goes well
- When is_ambiguous: true, always populate alternate_signal with the next-best classification

### Founder psychology signals (founder_psychology_signal):
- Gratitude + excitement ("couldn't be more excited", "humbled by support") → strength 0.70–0.80, likely precedes fundraise/launch
- Reflective / farewell ("on to next adventure", "bittersweet", "stepping back") → strength 0.75–0.88, likely precedes shutdown/departure
- Reconsideration ("revisiting roadmap", "customers kept asking for") → strength 0.70–0.80, pivot likely

### Colloquial / informal language:
- "snags $X", "bags funding", "scores round", "pockets $Xm" → fundraising_signal, confirmed (0.90)
- "landed customer", "notched a win", "crushing it" → growth_signal (0.80–0.90)
- "hockey-stick growth", "off the charts", "on fire" → growth_signal, posture_euphoric (0.80–0.90)
- "running out of runway", "X months of runway" → distress_signal (0.85–0.95)
- "sunsetting", "winding down", "shutting down" → distress_signal, confirmed (1.00)
- "dogfooding", "build in public" → product_signal (0.65–0.70)
- "first paying customer", "hit $XM ARR", "turned profitable" → revenue_signal (0.90–0.95)

### who_cares matrix:
- investors: fundraising, growth, revenue, exit, acquisition, founder_psychology
- vendors: buyer_signal, buyer_pain, buyer_budget, gtm, demand_signal
- acquirers: exit, acquisition, distress, growth at scale, efficiency
- recruiters: hiring_signal, partnership_signal, expansion_signal

### Exclude (return empty signals array):
- Pure HTML artifacts, legal boilerplate, cookie notices, navigation text, or sentences with zero business content

Return ONLY valid JSON. No markdown, no text outside the JSON object.`;

// ── Text extraction (mirrors ingest-pythh-signals.js) ─────────────────────
function toStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join('. ');
  if (typeof v === 'object') return Object.values(v).map(toStr).filter(Boolean).join('. ');
  return String(v).trim();
}

function extractSentences(row) {
  // Text lives in top-level columns (description, pitch, etc.) AND
  // may also be nested in extracted_data for legacy rows.
  const ed = row.extracted_data || {};

  // Priority: top-level columns first (richer, more specific)
  const TOP_FIELDS = [
    'description', 'pitch', 'execution_signals', 'grit_signals',
    'team_signals', 'problem', 'solution', 'value_proposition',
    'contrarian_belief', 'why_now', 'unfair_advantage', 'tagline',
  ];
  // Also check inside extracted_data as fallback
  const ED_FIELDS = ['description','pitch','problem','solution','value_proposition','market','tagline'];

  const parts = [
    ...TOP_FIELDS.map(f => toStr(row[f])),
    ...ED_FIELDS.map(f => toStr(ed[f])),
  ].filter(s => s && s.length > 2);

  // Deduplicate (extracted_data sometimes mirrors top-level columns)
  const seen = new Set();
  const unique = parts.filter(p => { if (seen.has(p)) return false; seen.add(p); return true; });

  const text = unique.join('. ');
  if (text.length < 20) return [];
  return text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= 40 && s.length <= 600)
    .slice(0, 20); // max 20 sentences per entity to control LLM cost
}

// ── Call LLM for a batch of entity+sentences ──────────────────────────────
async function classifyWithLLM(entityBatch) {
  // Build user prompt
  const userContent = entityBatch.map(({ entity, sentences }) => {
    return `Company: ${entity.name}\nSentences:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }).join('\n\n---\n\n');

  const prompt = `Classify the business signals in these startup sentences.\n\n${userContent}\n\nReturn a JSON object with a "signals" key containing an array of signal objects. Include "entity_index" (0-based, which company) and "sentence_index" (0-based, which sentence) on each object.`;

  if (process.env.LLM_DEBUG) {
    console.log('\n[LLM PROMPT PREVIEW]', userContent.slice(0, 400));
  }

  let raw;
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    });
    raw = response.choices[0]?.message?.content;
  } catch (err) {
    return { error: err.message, results: [] };
  }

  let parsed;
  try {
    const obj = JSON.parse(raw);
    parsed = Array.isArray(obj) ? obj : (obj.signals || obj.results || obj.data || []);
  } catch {
    return { error: 'JSON parse failed', results: [] };
  }

  if (process.env.LLM_DEBUG) {
    console.log('\n[LLM RAW]', raw?.slice(0, 500));
    console.log('[LLM PARSED count]', parsed?.length);
  }

  return { results: parsed };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🤖 LLM SIGNAL ENRICHMENT');
  console.log('═'.repeat(60));
  console.log(`Mode:       ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Model:      ${MODEL}`);
  console.log(`Limit:      ${LIMIT} entities`);
  console.log(`Min conf:   ${MIN_CONF}`);
  console.log(`Batch size: ${BATCH_SIZE} entities/call`);
  console.log('═'.repeat(60) + '\n');

  // ── Load entities with zero signals ────────────────────────────────────
  console.log('📥 Loading entities with zero signals...');
  const { data: entWithSig } = await supabase
    .from('pythh_signal_events')
    .select('entity_id')
    .limit(20000);
  const hasSignals = new Set((entWithSig || []).map(e => e.entity_id));

  // Load entities — prioritize those with startup_upload_id (richer text)
  const PAGE = 500;
  let entities = [];
  let offset = 0;

  // Pass 1: discovered_startups entities, newest first (RSS-enriched articles land here)
  while (entities.length < LIMIT) {
    const { data: page } = await supabase
      .from('pythh_entities')
      .select('id, name, startup_upload_id, discovered_startup_id, created_at')
      .eq('is_active', true)
      .is('startup_upload_id', null)
      .not('discovered_startup_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (!page?.length) break;
    for (const e of page) {
      if (!hasSignals.has(e.id)) entities.push(e);
    }
    if (page.length < PAGE) break;
    offset += PAGE;
    if (entities.length >= LIMIT) break;
  }

  // Pass 2: startup_upload entities, newest first (fill remaining slots)
  if (entities.length < LIMIT) {
    offset = 0;
    while (entities.length < LIMIT) {
      const { data: page } = await supabase
        .from('pythh_entities')
        .select('id, name, startup_upload_id, discovered_startup_id, created_at')
        .eq('is_active', true)
        .not('startup_upload_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (!page?.length) break;
      for (const e of page) {
        if (!hasSignals.has(e.id)) entities.push(e);
      }
      if (page.length < PAGE) break;
      offset += PAGE;
      if (entities.length >= LIMIT) break;
    }
  }

  entities = entities.slice(0, LIMIT);
  console.log(`   Entities with 0 signals: ${entities.length.toLocaleString()}\n`);

  if (!entities.length) {
    console.log('✅ All entities already have signals. Nothing to do.');
    return;
  }

  // ── Load text from BOTH startup_uploads and discovered_startups ────────
  console.log('📝 Loading startup text...');

  // From startup_uploads — select top-level text columns + extracted_data for fallback
  // Chunk size kept small (100) to stay under PostgREST URL length limits.
  // 500 UUIDs × 36 chars = ~18KB URL which PostgREST silently truncates to 0 results.
  const UPAGE = 100;

  const uploadIds = entities.map(e => e.startup_upload_id).filter(Boolean);
  const uploadMap = {};
  for (let i = 0; i < uploadIds.length; i += UPAGE) {
    const { data: rows } = await supabase
      .from('startup_uploads')
      .select(`id, extracted_data,
        description, pitch, execution_signals, grit_signals, team_signals,
        problem, solution, value_proposition, contrarian_belief, why_now,
        unfair_advantage, tagline`)
      .in('id', uploadIds.slice(i, i + UPAGE));
    for (const r of (rows || [])) uploadMap[r.id] = r;
  }

  // From discovered_startups (via description + article_title + problem/solution)
  const discoveredIds = entities.map(e => e.discovered_startup_id).filter(Boolean);
  const discoveredMap = {};
  for (let i = 0; i < discoveredIds.length; i += UPAGE) {
    const { data: rows } = await supabase
      .from('discovered_startups')
      .select('id, description, article_title, problem, solution, value_proposition')
      .in('id', discoveredIds.slice(i, i + UPAGE));
    for (const r of (rows || [])) discoveredMap[r.id] = r;
  }

  // Build entity+sentences list — check both sources
  const workItems = [];
  for (const entity of entities) {
    let sentences = [];

    if (entity.startup_upload_id && uploadMap[entity.startup_upload_id]) {
      sentences = extractSentences(uploadMap[entity.startup_upload_id]);
    }

    if (!sentences.length && entity.discovered_startup_id && discoveredMap[entity.discovered_startup_id]) {
      const ds = discoveredMap[entity.discovered_startup_id];
      // Build a pseudo extracted_data from discovered_startups fields
      const pseudoUpload = {
        extracted_data: {
          description:       ds.description,
          problem:           ds.problem,
          solution:          ds.solution,
          value_proposition: ds.value_proposition,
          tagline:           ds.article_title,
        }
      };
      sentences = extractSentences(pseudoUpload);
    }

    // Skip entities with no real text — the fallback "X is a startup." is useless
    const totalChars = sentences.reduce((n, s) => n + s.length, 0);
    if (sentences.length >= 1 && totalChars >= 60) workItems.push({ entity, sentences });
  }
  console.log(`   Entities with parseable text: ${workItems.length.toLocaleString()}\n`);

  if (!workItems.length) {
    console.log('⚠️  No entities have parseable text. Data enrichment (R1) needed first.');
    return;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    entities_processed: 0,
    llm_calls: 0,
    signals_returned: 0,
    signals_written: 0,
    signals_rejected_conf: 0,
    signals_rejected_class: 0,
    errors: 0,
    cost_estimate_usd: 0,
    by_class: {},
  };

  const signalBuf   = [];
  const timelineBuf = [];

  async function flush(force = false) {
    if (!DRY_RUN && (force || signalBuf.length >= 200)) {
      if (signalBuf.length) {
        const { inserted, errors } = await insertInBatches(supabase, 'pythh_signal_events', signalBuf);
        stats.signals_written += inserted;
        stats.errors += errors;
        signalBuf.length = 0;
      }
      if (timelineBuf.length) {
        await insertInBatches(supabase, 'pythh_signal_timeline', timelineBuf);
        timelineBuf.length = 0;
      }
    }
  }

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // ── Process in batches ────────────────────────────────────────────────────
  for (let i = 0; i < workItems.length; i += BATCH_SIZE) {
    const batch = workItems.slice(i, i + BATCH_SIZE);
    stats.llm_calls++;

    const { results, error } = await classifyWithLLM(batch);

    if (error) {
      stats.errors++;
      process.stdout.write(`\r  [${i}/${workItems.length}] LLM error: ${error.slice(0,40)}  `);
      continue;
    }

    // Rough token cost estimate (gpt-4o-mini: ~$0.15/1M input, $0.60/1M output)
    stats.cost_estimate_usd += 0.0001 * batch.length;
    stats.signals_returned += results.length;

    for (const sig of results) {
      if (!sig || typeof sig !== 'object') continue;

      // Validate class
      if (!VALID_CLASSES.includes(sig.primary_signal)) {
        stats.signals_rejected_class++;
        continue;
      }

      // Validate confidence
      const conf = parseFloat(sig.confidence) || 0;
      if (conf < MIN_CONF) {
        stats.signals_rejected_conf++;
        continue;
      }

      // Map back to entity
      const ei = sig.entity_index ?? 0;
      const { entity, sentences } = batch[ei] || batch[0];
      const si = sig.sentence_index ?? 0;
      const sentence = sentences[si] || sig.sentence || '';

      stats.by_class[sig.primary_signal] = (stats.by_class[sig.primary_signal] || 0) + 1;

      if (DRY_RUN) {
        console.log(`\n   [DRY] ${entity.name}: "${sentence.slice(0, 60)}" → ${sig.primary_signal} (${conf.toFixed(2)})`);
        stats.signals_written++;
        continue;
      }

      signalBuf.push({
        entity_id:         entity.id,
        source:            'llm_enrichment',
        source_type:       'llm_enrichment',
        source_url:        null,
        detected_at:       now,
        raw_sentence:      sentence,
        signal_object:     {
          ...sig,
          alternate_signal: VALID_CLASSES.includes(sig.alternate_signal) ? sig.alternate_signal : null,
          posture:          VALID_POSTURES.includes(sig.posture) ? sig.posture : 'posture_neutral',
        },
        primary_signal:    sig.primary_signal,
        signal_type:       sig.signal_type       || null,
        signal_strength:   parseFloat(sig.signal_strength) || null,
        confidence:        conf,
        evidence_quality:  sig.evidence_quality  || 'inferred',
        actor_type:        'actor_startup',
        action_tag:        sig.action_tag        || 'action_inferred',
        modality:          sig.modality          || null,
        intensity:         Array.isArray(sig.intensity) ? sig.intensity : [],
        posture:           VALID_POSTURES.includes(sig.posture) ? sig.posture : null,
        is_costly_action:  false,
        is_ambiguous:      sig.is_ambiguous      || false,
        is_multi_signal:   false,
        has_negation:      sig.has_negation      || false,
        sub_signals:       sig.alternate_signal && VALID_CLASSES.includes(sig.alternate_signal)
                             ? [{ signal: sig.alternate_signal, confidence: +(conf * 0.7).toFixed(3) }]
                             : [],
        who_cares:         sig.who_cares         || {},
        likely_stage:      null,
        likely_needs:      [],
        urgency:           null,
      });

      timelineBuf.push({
        entity_id:        entity.id,
        event_date:       today,
        signal_class:     sig.primary_signal,
        signal_type:      sig.signal_type      || null,
        signal_strength:  parseFloat(sig.signal_strength) || null,
        confidence:       conf,
        evidence_quality: sig.evidence_quality || 'inferred',
        is_costly_action: false,
        summary:          sig.meaning          || sig.primary_signal,
        source:           'llm_enrichment',
        source_type:      'llm_enrichment',
        source_url:       null,
      });
    }

    stats.entities_processed += batch.length;
    await flush();

    const pct = Math.round((i + batch.length) / workItems.length * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${workItems.length} entities (${pct}%)  `);

    // Rate limiting: ~1 call/s to stay within free tier limits
    await new Promise(r => setTimeout(r, 200));
  }

  await flush(true);

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Entities processed:      ${stats.entities_processed}`);
  console.log(`LLM API calls made:      ${stats.llm_calls}`);
  console.log(`Signals returned by LLM: ${stats.signals_returned}`);
  console.log(`Rejected (low conf):     ${stats.signals_rejected_conf}`);
  console.log(`Rejected (bad class):    ${stats.signals_rejected_class}`);
  console.log(`Written to DB:           ${DRY_RUN ? '(dry-run) ' + stats.signals_written : stats.signals_written}`);
  console.log(`Errors:                  ${stats.errors}`);
  console.log(`Est. cost:               ~$${stats.cost_estimate_usd.toFixed(4)}`);

  if (Object.keys(stats.by_class).length) {
    console.log('\nSignals by class:');
    Object.entries(stats.by_class).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) =>
      console.log(`  ${String(v).padStart(5)}  ${k}`)
    );
  }

  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to write LLM signals to the database.');
  } else if (stats.signals_written > 0) {
    console.log('\n✅ LLM enrichment complete. Run compute-trajectories.js --apply to update trajectories.');
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
