#!/usr/bin/env node
/** Verify candidate videos with Gemini video understanding and publish timestamped evidence. */

import { config } from 'dotenv';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

config();
const require = createRequire(import.meta.url);
const { evidenceHash, normalizeConfidence, validateSnippet } = require('../lib/videoEvidence');

const argv = process.argv.slice(2);
const flag = (name) => {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

const WRITE = argv.includes('--write');
const LIMIT = Math.min(5, Math.max(1, Number.parseInt(flag('--limit') || '1', 10)));
const SOURCE_ID = flag('--source-id');
const MAX_PUBLISH = Math.min(5, Math.max(1, Number.parseInt(flag('--max-publish') || '3', 10)));
const MODEL = process.env.GEMINI_VIDEO_MODEL || 'gemini-3.6-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false } });

const TYPES = {
  startup:['product_demo','product_capability','customer_problem','traction_claim','team_claim','market_claim','fundraising_claim','timing_signal'],
  investor:['investment_thesis','stage_preference','sector_preference','check_size','geography_preference','portfolio_reasoning','timing_signal'],
};

async function loadCandidates() {
  let query = db.from('profile_video_sources')
    .select('*')
    .eq('resolution_status', 'candidate')
    .order('resolution_confidence', { ascending:false })
    .limit(LIMIT);
  if (SOURCE_ID) query = query.eq('id', SOURCE_ID);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function entityFor(source) {
  const table = source.entity_type === 'startup' ? 'startup_uploads' : 'investors';
  const fields = source.entity_type === 'startup'
    ? 'id,name,website,company_website,description,sectors,stage'
    : 'id,name,firm,url,bio,investment_thesis,sectors,stage';
  const { data, error } = await db.from(table).select(fields).eq('id', source.entity_id).maybeSingle();
  if (error) throw error;
  return data;
}

function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function inspectVideo(source, entity) {
  const entityName = source.entity_type === 'investor' ? (entity.firm || entity.name) : entity.name;
  const allowedTypes = TYPES[source.entity_type];
  const prompt = `You are verifying public video evidence for Pythh.
Entity type: ${source.entity_type}
Canonical entity: ${entityName}
Canonical website: ${entity.website || entity.company_website || entity.url || ''}
Known sectors: ${JSON.stringify(entity.sectors || [])}
Known stage: ${JSON.stringify(entity.stage || [])}

Watch the supplied video. Reject it unless the featured company/person/fund is clearly the canonical entity above. Do not rely only on a shared name.
If it matches, identify at most 3 useful evidence windows. Each window must be 30-90 seconds, grounded in spoken or clearly visible content, and useful to a founder or investor evaluating fit.
Allowed evidence types: ${allowedTypes.join(', ')}.
The excerpt must accurately transcribe or tightly paraphrase what is said in that exact window; never invent a quote.

Return JSON only:
{"identity_match":boolean,"identity_confidence":number,"identity_reason":"string","snippets":[{"start_seconds":integer,"end_seconds":integer,"evidence_type":"allowed value","transcript_excerpt":"string","normalized_claim":{},"confidence":number}]}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method:'POST',
    headers:{ 'x-goog-api-key':GEMINI_API_KEY, 'content-type':'application/json' },
    body:JSON.stringify({
      contents:[{ role:'user', parts:[{ file_data:{ file_uri:source.source_url } }, { text:prompt }] }],
      generationConfig:{ responseMimeType:'application/json', temperature:0.1 },
    }),
    signal:AbortSignal.timeout(180000),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${json.error?.message || 'video inspection failed'}`);
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  return parseJson(text);
}

function acceptedSnippets(source, result) {
  if (result.identity_match !== true || normalizeConfidence(result.identity_confidence) < 0.9) return [];
  return (Array.isArray(result.snippets) ? result.snippets : []).slice(0, 3).flatMap((raw) => {
    const snippet = {
      entityType:source.entity_type,
      evidenceType:String(raw.evidence_type || ''),
      startSeconds:Number(raw.start_seconds),
      endSeconds:Number(raw.end_seconds),
      excerpt:String(raw.transcript_excerpt || '').trim(),
    };
    const confidence = normalizeConfidence(raw.confidence);
    if (confidence < 0.85 || !validateSnippet(snippet).ok) return [];
    return [{ ...snippet, normalizedClaim:raw.normalized_claim || {}, confidence }];
  });
}

async function rejectSource(source, result) {
  if (!WRITE) return;
  const { error } = await db.from('profile_video_sources').update({
    resolution_status:'rejected',
    metadata:{ ...(source.metadata || {}), verification:{ identity_match:false, confidence:normalizeConfidence(result.identity_confidence), reason:result.identity_reason || 'identity_not_verified', model:MODEL } },
    updated_at:new Date().toISOString(),
  }).eq('id', source.id);
  if (error) throw error;
}

async function publish(source, result, snippets) {
  if (!WRITE) return;
  for (const snippet of snippets) {
    const row = {
      video_source_id:source.id,
      entity_type:source.entity_type,
      entity_id:source.entity_id,
      start_seconds:snippet.startSeconds,
      end_seconds:snippet.endSeconds,
      transcript_excerpt:snippet.excerpt.slice(0, 1200),
      evidence_type:snippet.evidenceType,
      normalized_claim:snippet.normalizedClaim,
      confidence:snippet.confidence,
      verification_status:'verified',
      extractor_version:`gemini-video:${MODEL}:v1`,
      evidence_hash:evidenceHash({ platform:source.platform, externalVideoId:source.external_video_id, entityType:source.entity_type, entityId:source.entity_id, startSeconds:snippet.startSeconds, endSeconds:snippet.endSeconds, evidenceType:snippet.evidenceType, excerpt:snippet.excerpt }),
      updated_at:new Date().toISOString(),
    };
    const { error } = await db.from('profile_video_snippets').upsert(row, { onConflict:'evidence_hash' });
    if (error) throw error;
  }
  const { error } = await db.from('profile_video_sources').update({
    resolution_status:'verified',
    metadata:{ ...(source.metadata || {}), verification:{ identity_match:true, confidence:normalizeConfidence(result.identity_confidence), reason:result.identity_reason || '', model:MODEL } },
    updated_at:new Date().toISOString(),
  }).eq('id', source.id);
  if (error) throw error;
}

async function main() {
  const sources = await loadCandidates();
  let published = 0, rejected = 0, deferred = 0;
  console.log(`Video verification · ${WRITE ? 'WRITE' : 'DRY RUN'} · ${sources.length} candidate(s) · model ${MODEL}`);
  for (const source of sources) {
    if (published >= MAX_PUBLISH) break;
    const entity = await entityFor(source);
    if (!entity) { deferred++; continue; }
    try {
      const result = await inspectVideo(source, entity);
      const snippets = acceptedSnippets(source, result);
      if (result.identity_match !== true || normalizeConfidence(result.identity_confidence) < 0.9) {
        await rejectSource(source, result);
        rejected++;
        console.log(`× ${source.title}: identity rejected (${normalizeConfidence(result.identity_confidence).toFixed(2)})`);
      } else if (!snippets.length) {
        deferred++;
        console.log(`· ${source.title}: identity matched, no evidence window passed`);
      } else {
        await publish(source, result, snippets);
        published++;
        console.log(`✓ ${source.title}: ${snippets.length} verified snippet(s)`);
      }
    } catch (error) {
      deferred++;
      console.warn(`! ${source.title}: ${error.message}`);
    }
  }
  console.log(`Done · published sources ${published} · rejected ${rejected} · deferred ${deferred}`);
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
