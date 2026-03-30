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

const { createClient } = require('@supabase/supabase-js');
const OpenAI           = require('openai');

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
  'fundraising_signal', 'growth_signal', 'product_signal', 'expansion_signal',
  'enterprise_signal', 'efficiency_signal', 'distress_signal', 'exit_signal',
  'acquisition_signal', 'exploratory_signal', 'buyer_signal', 'buyer_pain_signal',
  'investor_interest_signal', 'investor_rejection_signal', 'partnership_signal',
  'hiring_signal', 'revenue_signal', 'market_signal',
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
  "signal_type": "event | intent | posture | demand | distress | investor | buyer | talent | market",
  "signal_strength": <number 0.0-1.0>,
  "confidence": <number 0.0-1.0>,
  "evidence_quality": "confirmed | inferred | stated | speculative",
  "modality": "active | passive | conditional | hedged | stated",
  "posture": "confident | cautious | optimistic | neutral | uncertain",
  "action_tag": "<short snake_case label e.g. raise_funding, hire_engineers, launch_product>",
  "meaning": "<1 sentence plain-English interpretation>",
  "is_ambiguous": false,
  "has_negation": false,
  "intensity": [],
  "who_cares": { "investors": false, "vendors": false, "acquirers": false, "recruiters": false }
}

Valid primary_signal values: ${VALID_CLASSES.join(', ')}

Rules:
- Include a signal for ANY sentence mentioning growth, hiring, fundraising, product launches, partnerships, expansion, revenue, customers, or strategic moves
- Be generous: a startup describing what it does implies a product_signal or market_signal
- Confidence reflects certainty of classification (not business outcome)
- fundraising: "raised $5M" → 0.95, "seeking investment" → 0.70, "building for growth" → 0.55
- Return {"signals": []} ONLY for sentences that are pure noise, legal boilerplate, or HTML artifacts
- Every signal object MUST include entity_index and sentence_index

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
  const ed = row.extracted_data || {};
  const TEXT_FIELDS = ['description','pitch','problem','solution','value_proposition','market','tagline'];
  const text = TEXT_FIELDS.map(f => toStr(ed[f])).filter(s => s && s.length > 2).join('. ');
  if (text.length < 20) return [];
  return text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= 40 && s.length <= 600)
    .slice(0, 20); // max sentences per entity to control cost
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

  // From startup_uploads (via extracted_data)
  const uploadIds = entities.map(e => e.startup_upload_id).filter(Boolean);
  const uploadMap = {};
  const UPAGE = 500;
  for (let i = 0; i < uploadIds.length; i += UPAGE) {
    const { data: rows } = await supabase
      .from('startup_uploads')
      .select('id, extracted_data')
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
  const FLUSH_SIZE  = 100;

  async function flush(force = false) {
    if (!DRY_RUN && (force || signalBuf.length >= FLUSH_SIZE)) {
      const s = signalBuf.splice(0, signalBuf.length);
      const t = timelineBuf.splice(0, timelineBuf.length);
      if (s.length) {
        const { error } = await supabase.from('pythh_signal_events').insert(s);
        if (error) { stats.errors++; }
        else stats.signals_written += s.length;
      }
      if (t.length) {
        try { await supabase.from('pythh_signal_timeline').insert(t); } catch { /* optional table */ }
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
        source_type:       'description',
        source_url:        null,
        detected_at:       now,
        raw_sentence:      sentence,
        signal_object:     sig,
        primary_signal:    sig.primary_signal,
        signal_type:       sig.signal_type       || null,
        signal_strength:   parseFloat(sig.signal_strength) || null,
        confidence:        conf,
        evidence_quality:  sig.evidence_quality  || 'inferred',
        actor_type:        'actor_startup',
        action_tag:        sig.action_tag        || 'action_inferred',
        modality:          sig.modality          || null,
        intensity:         Array.isArray(sig.intensity) ? sig.intensity : [],
        posture:           sig.posture           || null,
        is_costly_action:  false,
        is_ambiguous:      sig.is_ambiguous      || false,
        is_multi_signal:   false,
        has_negation:      sig.has_negation      || false,
        sub_signals:       [],
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
        source_type:      'description',
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
