#!/usr/bin/env node
import 'dotenv/config';
import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 25), 1), 250);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return net.isIPv6(address) && (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:'));
}

async function safeSourceUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('private or unresolved source host');
  return parsed;
}

function articleExcerpt(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,nav,footer,header,aside,form').remove();
  const roots = $('article').length ? $('article') : $('main').length ? $('main') : $('body');
  return roots.find('p').map((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).get()
    .filter(text => text.length >= 40).join(' ').slice(0, 5000);
}

async function fetchExcerpt(sourceUrl) {
  const parsed = await safeSourceUrl(sourceUrl);
  const response = await fetch(parsed, {
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: { 'user-agent': 'PythhFundingEvidence/1.0 (+https://pythh.ai)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error('source is not HTML');
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > 2_000_000) throw new Error('source exceeds size limit');
  const html = (await response.text()).slice(0, 2_000_000);
  const excerpt = articleExcerpt(html);
  if (excerpt.length < 80) throw new Error('no usable article text');
  return excerpt;
}

async function main() {
  const { data: rows, error } = await db.from('startup_events')
    .select('id,event_id,source_url,source_title,semantic_context,created_at')
    .in('event_type', ['FUNDING', 'INVESTMENT'])
    .order('created_at', { ascending: false })
    .limit(limit * 4);
  if (error) throw error;
  const candidates = (rows || []).filter(row => !row.semantic_context?.funding_evidence_excerpt).slice(0, limit);
  const results = [];
  for (const row of candidates) {
    try {
      const excerpt = await fetchExcerpt(row.source_url);
      if (apply) {
        const semanticContext = { ...(row.semantic_context || {}), funding_evidence_excerpt: `${row.source_title || ''} ${excerpt}`.trim().slice(0, 5000), funding_evidence_excerpt_source: 'source_page' };
        const { error: updateError } = await db.from('startup_events').update({ semantic_context: semanticContext }).eq('id', row.id);
        if (updateError) throw updateError;
      }
      results.push({ event_id: row.event_id, status: apply ? 'written' : 'available', excerpt_chars: excerpt.length });
    } catch (error) {
      results.push({ event_id: row.event_id, status: 'skipped', reason: error.message });
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: candidates.length, available: results.filter(row => row.status !== 'skipped').length, results }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
