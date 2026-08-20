#!/usr/bin/env node
/**
 * Recover missing startup websites so scoring/matching/evidence search can run.
 *
 * Targets approved startups with matches and no usable company URL.
 * Probes name-based domains + DuckDuckGo HTML; rejects publisher/investor domains.
 *
 * Usage:
 *   npm run outcomes:recover-urls -- --limit=50
 *   npm run outcomes:recover-urls -- --apply --limit=100
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const {
  isPlausibleStartupName,
  isPromotionSafeStartupName,
} = require('../server/lib/fundingEvidenceLedger.js');
const { syncQueueEarliestMatchAt } = require('../server/lib/syncQueueEarliestMatchAt.js');

const apply = process.argv.includes('--apply');
const limit = Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 50));
const delay = Math.max(0, Number(process.argv.find((a) => a.startsWith('--delay='))?.split('=')[1] || 300));

const PUBLISHER_RE =
  /\b(techcrunch|ventureburn|finsmes|forbes|bloomberg|reuters|axios|medium|substack|youtube|linkedin|twitter|crunchbase|pitchbook|wikipedia|businessinsider|theverge|wired|saastr|pulse2|eu-startups|techinafrica|thefintechtimes|asiatechdaily)\b/i;

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

function looksLikeHeadlineJunk(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 48) return true;
  if (/\b(revealed|appears?|reportedly|after|before|series [a-f]|raises?|raised|funding)\b/i.test(n)) return true;
  if (/^(record|major|months|visible|racist|tokens|west africa|go public)\b/i.test(n)) return true;
  if ((n.match(/\s+/g) || []).length >= 5) return true;
  return false;
}

function normalizeWebsite(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('.') || PUBLISHER_RE.test(host)) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

async function probeDomain(host) {
  const url = `https://${host}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'PythhUrlRecovery/1.0 (+https://pythh.ai)' },
    });
    if (![200, 301, 302, 303, 307, 308].includes(res.status) && res.status !== 200) {
      // accept 200 only for content check; redirects already followed
    }
    if (!res.ok && res.status !== 401 && res.status !== 403) return null;
    const finalHost = new URL(res.url).hostname.toLowerCase().replace(/^www\./, '');
    if (PUBLISHER_RE.test(finalHost)) return null;
    const html = (await res.text()).slice(0, 50000).toLowerCase();
    // Require some company-ish signal or just a live site with title
    if (html.includes('<html') || html.includes('<!doctype')) {
      return `https://${finalHost}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function duckDuckGoCandidates(name) {
  const q = encodeURIComponent(`"${name}" official website startup OR company -site:linkedin.com -site:crunchbase.com`);
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'user-agent': 'Mozilla/5.0 PythhUrlRecovery/1.0',
        accept: 'text/html',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const hrefs = [...html.matchAll(/uddg=([^&"]+)/g)].map((m) => {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return null;
      }
    });
    const out = [];
    for (const href of hrefs) {
      const norm = normalizeWebsite(href);
      if (norm) out.push(norm);
    }
    return [...new Set(out)].slice(0, 8);
  } catch {
    return [];
  }
}

function candidateHosts(name) {
  const slug = slugifyName(name);
  if (slug.length < 3) return [];
  const tlds = ['com', 'ai', 'io', 'co', 'so', 'app', 'dev'];
  return tlds.map((tld) => `${slug}.${tld}`);
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || !process.env.DATABASE_URL) {
  throw new Error('Need DATABASE_URL + Supabase service env');
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  scanned: 0,
  recovered: 0,
  skipped_junk_name: 0,
  failed: 0,
  timestamps_synced: 0,
  samples: [],
  errors: [],
};

const { rows: targets } = await pool.query(
  `
  SELECT s.id, s.name, s.website, s.company_domain, s.entity_gate, s.source_type,
         (SELECT count(*)::int FROM startup_investor_matches m WHERE m.startup_id = s.id) AS match_n,
         (SELECT min(m.created_at) FROM startup_investor_matches m WHERE m.startup_id = s.id) AS earliest_match
  FROM startup_uploads s
  WHERE s.status = 'approved'
    AND s.entity_gate IS DISTINCT FROM 'junk'
    AND (
      s.website IS NULL OR btrim(s.website) = ''
      OR s.entity_gate = 'needs_url'
      OR s.website ~* '(techcrunch|ventureburn|finsmes|medium|substack|linkedin|crunchbase|techinafrica|thefintechtimes)'
    )
    AND EXISTS (SELECT 1 FROM startup_investor_matches m WHERE m.startup_id = s.id)
  ORDER BY match_n DESC, s.created_at DESC NULLS LAST
  LIMIT $1
`,
  [limit],
);

summary.scanned = targets.length;

for (const row of targets) {
  try {
    if (
      !isPlausibleStartupName(row.name) ||
      !isPromotionSafeStartupName(row.name) ||
      looksLikeHeadlineJunk(row.name)
    ) {
      summary.skipped_junk_name += 1;
      continue;
    }

    const tried = [];
    let found = null;

    for (const host of candidateHosts(row.name)) {
      tried.push(host);
      found = await probeDomain(host);
      if (found) break;
      await sleep(80);
    }

    if (!found) {
      const ddg = await duckDuckGoCandidates(row.name);
      for (const cand of ddg) {
        const host = new URL(cand).hostname.replace(/^www\./, '');
        tried.push(host);
        found = await probeDomain(host);
        if (found) break;
      }
    }

    if (!found) {
      summary.failed += 1;
      continue;
    }

    const host = new URL(found).hostname.replace(/^www\./, '');
    const sample = { id: row.id, name: row.name, website: found, match_n: row.match_n, tried: tried.slice(0, 6) };

    if (!apply) {
      summary.samples.push({ ...sample, mode: 'dry-run' });
      summary.recovered += 1;
      continue;
    }

    const { error } = await db
      .from('startup_uploads')
      .update({
        website: found,
        company_domain: host,
        source_type: 'url',
        entity_gate: 'qualified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw new Error(error.message);

    // Ensure queue row exists / boost + rectify timestamp
    const earliest = row.earliest_match ? new Date(row.earliest_match).toISOString() : null;
    const { data: qRow } = await db
      .from('funding_evidence_search_queue')
      .select('startup_id, status, priority')
      .eq('startup_id', row.id)
      .maybeSingle();

    if (qRow) {
      await db
        .from('funding_evidence_search_queue')
        .update({
          priority: Math.max(Number(qRow.priority) || 0, 25000),
          status: qRow.status === 'processing' ? 'processing' : 'pending',
          earliest_match_at: earliest,
          updated_at: new Date().toISOString(),
          error_message: 'url_recovered:boost',
        })
        .eq('startup_id', row.id);
    } else if (earliest) {
      await db.from('funding_evidence_search_queue').insert({
        startup_id: row.id,
        status: 'pending',
        priority: 25000,
        earliest_match_at: earliest,
        updated_at: new Date().toISOString(),
        error_message: 'url_recovered:enqueued',
      });
    }

    const sync = await syncQueueEarliestMatchAt(db, row.id);
    if (sync.ok && sync.earliest_match_at) summary.timestamps_synced += 1;

    summary.recovered += 1;
    summary.samples.push({ ...sample, applied: true });
    await sleep(delay);
  } catch (err) {
    summary.errors.push({ id: row.id, name: row.name, error: String(err?.message || err) });
  }
}

await pool.end();
console.log(JSON.stringify(summary, null, 2));
