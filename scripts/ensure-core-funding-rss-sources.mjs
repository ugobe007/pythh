#!/usr/bin/env node
/**
 * Upsert CORE_FUNDING_RSS_SOURCES into rss_sources (active, high priority).
 * Leaves broken first-party Dealroom/AngelList feeds inactive.
 *
 *   node scripts/ensure-core-funding-rss-sources.mjs
 *   node scripts/ensure-core-funding-rss-sources.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  BROKEN_FIRST_PARTY_CORE_FEEDS,
  CORE_FUNDING_RSS_SOURCES,
} from '../lib/coreFundingRssSources.mjs';

const apply = process.argv.includes('--apply');
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service environment');
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: existing, error: readError } = await db
  .from('rss_sources')
  .select('name,url,active,priority,category')
  .in('url', [
    ...CORE_FUNDING_RSS_SOURCES.map((s) => s.url),
    ...BROKEN_FIRST_PARTY_CORE_FEEDS,
  ]);
if (readError) throw new Error(readError.message);

const byUrl = new Map((existing || []).map((row) => [row.url, row]));
const planned = CORE_FUNDING_RSS_SOURCES.map((source) => {
  const row = byUrl.get(source.url);
  return {
    name: source.name,
    url: source.url,
    category: source.category,
    priority: source.priority,
    active: true,
    action: row ? (row.active && row.priority >= source.priority ? 'ok' : 'update') : 'insert',
  };
});

if (apply) {
  for (const source of CORE_FUNDING_RSS_SOURCES) {
    const { error } = await db.from('rss_sources').upsert(
      {
        name: source.name,
        url: source.url,
        category: source.category,
        priority: source.priority,
        active: true,
      },
      { onConflict: 'url' },
    );
    if (error) throw new Error(`${source.url}: ${error.message}`);
  }
  if (BROKEN_FIRST_PARTY_CORE_FEEDS.length) {
    const { error } = await db
      .from('rss_sources')
      .update({ active: false })
      .in('url', BROKEN_FIRST_PARTY_CORE_FEEDS);
    if (error) throw new Error(`deactivate broken: ${error.message}`);
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      sources: planned,
      kept_inactive: BROKEN_FIRST_PARTY_CORE_FEEDS,
    },
    null,
    2,
  ),
);
