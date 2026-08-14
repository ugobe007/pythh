#!/usr/bin/env node
/** Discover source-hosted profile video evidence. Defaults to dry-run. */

import { config } from 'dotenv';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

config();
const require = createRequire(import.meta.url);
const { youtubeEmbedUrl, scoreVideoCandidate, discoveryQueries } = require('../lib/videoEvidence');

const argv = process.argv.slice(2);
const flag = (name) => {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const WRITE = argv.includes('--write');
const ENTITY_TYPE = flag('--entity-type');
const ENTITY_ID = flag('--entity-id');
const LIMIT = Math.min(50, Math.max(1, Number.parseInt(flag('--limit') || '10', 10)));
const MIN_CONFIDENCE = Number.parseFloat(flag('--min-confidence') || '0.75');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');
if (!YOUTUBE_API_KEY) throw new Error('Missing YOUTUBE_API_KEY');
if (ENTITY_TYPE && !['startup', 'investor'].includes(ENTITY_TYPE)) throw new Error('entity-type must be startup or investor');

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession:false } });

function domainFromUrl(value) {
  try { return new URL(/^https?:\/\//i.test(value || '') ? value : `https://${value}`).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

async function loadEntities() {
  if (ENTITY_TYPE === 'startup') {
    let query = db.from('startup_uploads').select('id,name,website,company_website,status').eq('status', 'approved').not('name', 'is', null).limit(LIMIT);
    if (ENTITY_ID) query = query.eq('id', ENTITY_ID);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({ entityType:'startup', id:row.id, name:row.name, domain:domainFromUrl(row.website || row.company_website) }));
  }
  if (ENTITY_TYPE === 'investor') {
    let query = db.from('investors').select('id,name,firm,url,status').not('firm', 'is', null).limit(LIMIT);
    if (ENTITY_ID) query = query.eq('id', ENTITY_ID);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({ entityType:'investor', id:row.id, name:row.firm || row.name, domain:domainFromUrl(row.url) }));
  }
  throw new Error('Pass --entity-type=startup|investor');
}

async function youtubeSearch(query) {
  const params = new URLSearchParams({ part:'snippet', type:'video', videoCaption:'closedCaption', maxResults:'8', q:query, key:YOUTUBE_API_KEY });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal:AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`YouTube search ${response.status}: ${data.error?.message || 'request failed'}`);
  return data.items || [];
}

function classifyContent(entityType, query) {
  if (entityType === 'startup') return /demo/i.test(query) ? 'demo' : 'founder_interview';
  return /thesis|invest/i.test(query) ? 'investment_thesis' : 'investor_interview';
}

async function saveCandidate(entity, item, resolution, contentType) {
  const videoId = item.id?.videoId;
  const snippet = item.snippet || {};
  const row = {
    entity_type:entity.entityType, entity_id:entity.id, platform:'youtube', external_video_id:videoId,
    source_url:`https://www.youtube.com/watch?v=${videoId}`, embed_url:youtubeEmbedUrl(videoId),
    title:snippet.title || null, channel_name:snippet.channelTitle || null,
    thumbnail_url:snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
    published_at:snippet.publishedAt || null, content_type:contentType, rights_status:'embed_only',
    resolution_status:'candidate', resolution_confidence:resolution.score,
    metadata:{ resolution_reasons:resolution.reasons }, last_refreshed_at:new Date().toISOString(),
    refresh_due_at:new Date(Date.now() + 30 * 86400000).toISOString(), updated_at:new Date().toISOString(),
  };
  if (!WRITE) return row;
  const { error } = await db.from('profile_video_sources').upsert(row, { onConflict:'platform,external_video_id,entity_type,entity_id' });
  if (error) throw error;
  return row;
}

async function main() {
  const entities = await loadEntities();
  let accepted = 0, rejected = 0;
  console.log(`Video evidence discovery · ${WRITE ? 'WRITE CANDIDATES' : 'DRY RUN'} · ${entities.length} ${ENTITY_TYPE}(s)`);
  for (const entity of entities) {
    const seen = new Set();
    for (const query of discoveryQueries(entity)) {
      const items = await youtubeSearch(query);
      for (const item of items) {
        const videoId = item.id?.videoId;
        if (!videoId || seen.has(videoId)) continue;
        seen.add(videoId);
        const resolution = scoreVideoCandidate({ entityName:entity.name, entityDomain:entity.domain, title:item.snippet?.title, description:item.snippet?.description, channelTitle:item.snippet?.channelTitle, kind:entity.entityType });
        if (resolution.score < MIN_CONFIDENCE) { rejected++; continue; }
        await saveCandidate(entity, item, resolution, classifyContent(entity.entityType, query));
        accepted++;
        console.log(`→ ${entity.name}: ${item.snippet?.title} (${resolution.score})`);
      }
    }
  }
  console.log(`Done · candidates ${accepted} · rejected ${rejected}`);
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
