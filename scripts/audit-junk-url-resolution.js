#!/usr/bin/env node
/**
 * Audit rejected junk startups that still carry a website field.
 * Fetches each domain and classifies: plausible company site vs parking / dead / wrong entity.
 *
 * Usage:
 *   node scripts/audit-junk-url-resolution.js
 *   node scripts/audit-junk-url-resolution.js --sample=200
 *   node scripts/audit-junk-url-resolution.js --all
 *   node scripts/audit-junk-url-resolution.js --json > junk-url-audit.json
 */

'use strict';

require('dotenv').config({ quiet: true });
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { classifySuspiciousStartupWebsite } = require('../lib/suspiciousStartupWebsite');
const { normalizeNameForSearch } = require('../server/services/inferenceService');

const NOTE = 'auto-rejected: entity_gate=junk + GOD<40 (data-tightening cleanup)';
const CONCURRENCY = Number(process.env.AUDIT_URL_CONCURRENCY || 15);
const TIMEOUT_MS = Number(process.env.AUDIT_URL_TIMEOUT_MS || 5000);

const argv = process.argv.slice(2);
const jsonMode = argv.includes('--json');
const runAll = argv.includes('--all');
const sampleArg = argv.find((a) => a.startsWith('--sample='));
const sampleSize = runAll ? Infinity : Number(sampleArg?.split('=')[1] || 200);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PARKING_PATTERNS = [
  /domain (?:is )?for sale/i,
  /buy this domain/i,
  /this domain (?:may be|is) for sale/i,
  /parked free/i,
  /sedoparking/i,
  /godaddy.*parking/i,
  /hugedomains/i,
  /afternic/i,
  /dan\.com/i,
  /namecheap.*marketplace/i,
  /is available for purchase/i,
  /make an offer on this domain/i,
];

const PLACEHOLDER_PATTERNS = [
  /welcome to nginx/i,
  /apache2 ubuntu default page/i,
  /it works!/i,
  /under construction/i,
  /coming soon/i,
  /future home of/i,
];

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

function nameTokens(name) {
  const core = normalizeNameForSearch(name) || name || '';
  const cleaned = core
    .replace(/\b(inc|llc|ltd|corp|co|the|startup|raises?|raised?|secures?)\b/gi, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return [slugify(cleaned)].filter(Boolean);
  return [...new Set(words.map((w) => w.toLowerCase()))];
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]{1,200})/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractOgSite(html) {
  const m = html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  return m ? m[1].trim() : '';
}

function domainSlug(url) {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    return host.split('.')[0] || '';
  } catch {
    return '';
  }
}

function nameMatchesSite(name, url, html) {
  const tokens = nameTokens(name);
  const slug = domainSlug(url);
  const nameSlug = slugify(tokens[0] || name);
  if (slug && nameSlug && (slug.includes(nameSlug) || nameSlug.includes(slug))) return 'domain_slug';

  const hay = [
    extractTitle(html),
    extractOgSite(html),
    html.slice(0, 8000),
  ].join(' ').toLowerCase();

  for (const t of tokens) {
    if (t.length >= 4 && hay.includes(t.toLowerCase())) return 'name_in_page';
  }
  return null;
}

function isHeadlinePitch(pitch) {
  const p = (pitch || '').trim();
  if (p.length < 20) return false;
  return /\b(raises?|raised?|secures?|secured?|closes?|closed?|bags?|earmarks?)\s+[\$€£¥₹]?[\d,.]+\s*([kmb]|\bmillion\b|\bbillion\b)/i.test(p)
    || /[-–]\s*(techcrunch|reuters|forbes|finsmes|venturebeat|axios|sifted)/i.test(p);
}

async function fetchSite(url) {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    const res = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      timeout: TIMEOUT_MS,
      maxRedirects: 4,
      validateStatus: (s) => s < 500,
    });
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      html: (res.data || '').toString().slice(0, 120000),
      finalUrl: res.request?.res?.responseUrl || fullUrl,
    };
  } catch (e) {
    return {
      ok: false,
      status: e.response?.status || 0,
      html: '',
      error: e.code || e.message,
    };
  }
}

function classifyRow(row, fetchResult) {
  const url = row.website || row.company_website;
  const suspicious = classifySuspiciousStartupWebsite(url);
  if (suspicious.suspicious) {
    return { verdict: 'news_url', detail: suspicious.reason };
  }

  if (!fetchResult.ok || !fetchResult.html || fetchResult.html.length < 80) {
    return {
      verdict: 'unreachable',
      detail: fetchResult.error || `HTTP ${fetchResult.status || 'fail'}`,
    };
  }

  const html = fetchResult.html;
  if (PARKING_PATTERNS.some((p) => p.test(html))) {
    return { verdict: 'parking', detail: 'domain marketplace / for sale' };
  }
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(html)) && html.length < 5000) {
    return { verdict: 'placeholder', detail: 'default or stub page' };
  }

  const match = nameMatchesSite(row.name, url, html);
  if (match) {
    return { verdict: 'plausible', detail: match };
  }

  return { verdict: 'wrong_or_unrelated', detail: 'loads but name/domain mismatch' };
}

async function loadCohort() {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, website, company_website, pitch, total_god_score, entity_gate_reason')
      .eq('status', 'rejected')
      .eq('admin_notes', NOTE)
      .or('website.not.is.null,company_website.not.is.null')
      .order('total_god_score', { ascending: false })
      .range(from, from + 499);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 500) break;
    from += 500;
  }
  return rows;
}

async function mapPool(items, limit, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function main() {
  const allRows = await loadCohort();
  const rows = Number.isFinite(sampleSize) ? allRows.slice(0, sampleSize) : allRows;

  if (!jsonMode) {
    console.log(`\n🔍 Junk URL resolution audit`);
    console.log(`   Cohort: ${allRows.length} rejected junk rows with URLs`);
    console.log(`   Checking: ${rows.length} (${runAll ? 'all' : `sample=${sampleSize}`})`);
    console.log(`   Concurrency: ${CONCURRENCY}, timeout: ${TIMEOUT_MS}ms\n`);
  }

  const results = await mapPool(rows, CONCURRENCY, async (row) => {
    const url = row.website || row.company_website;
    const fetchResult = await fetchSite(url);
    const { verdict, detail } = classifyRow(row, fetchResult);
    return {
      id: row.id,
      name: row.name,
      url,
      god: row.total_god_score,
      headlinePitch: isHeadlinePitch(row.pitch),
      verdict,
      detail,
      httpStatus: fetchResult.status || null,
    };
  });

  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;

  const plausible = results.filter((r) => r.verdict === 'plausible');
  const plausibleHeadline = plausible.filter((r) => r.headlinePitch);
  const plausibleClean = plausible.filter((r) => !r.headlinePitch);
  const clearBadUrl = results.filter((r) =>
    ['parking', 'unreachable', 'wrong_or_unrelated', 'news_url', 'placeholder'].includes(r.verdict),
  );

  if (jsonMode) {
    console.log(JSON.stringify({ total: allRows.length, checked: results.length, counts, results }, null, 2));
    return;
  }

  console.log('Verdict breakdown:');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((v / results.length) * 100);
    console.log(`  ${k.padEnd(22)} ${String(v).padStart(5)}  (${pct}%)`);
  }

  const extrapolate = (n) => Math.round((n / results.length) * allRows.length);

  console.log(`\nExtrapolated to full ${allRows.length} URL-holding junk rows:`);
  console.log(`  plausible (real site):     ~${extrapolate(counts.plausible || 0)}`);
  console.log(`  parking / for sale:        ~${extrapolate(counts.parking || 0)}`);
  console.log(`  unreachable:               ~${extrapolate(counts.unreachable || 0)}`);
  console.log(`  wrong or unrelated site:   ~${extrapolate(counts.wrong_or_unrelated || 0)}`);
  console.log(`  news/article URL:          ~${extrapolate(counts.news_url || 0)}`);
  console.log(`  placeholder/stub:          ~${extrapolate(counts.placeholder || 0)}`);

  console.log(`\nPlausible breakdown:`);
  console.log(`  RSS headline pitch + real domain:  ${plausibleHeadline.length} (~${extrapolate(plausibleHeadline.length)}) — reject still correct (RSS scrape, not founder record)`);
  console.log(`  Real site, no headline pitch:    ${plausibleClean.length} (~${extrapolate(plausibleClean.length)}) — review for possible restore`);

  console.log(`\nClear bad URLs (parking/dead/wrong/news): ${clearBadUrl.length} (${Math.round((clearBadUrl.length / results.length) * 100)}%)`);

  console.log(`\n⚠️  Restore candidates (plausible + no headline pitch):`);
  plausibleClean.slice(0, 20).forEach((r) => {
    console.log(`  [GOD ${r.god}] ${r.name.slice(0, 36).padEnd(36)} | ${r.url} | ${r.detail}`);
  });

  console.log(`\nRSS scrape with real domain (correctly rejected):`);
  plausibleHeadline.slice(0, 12).forEach((r) => {
    console.log(`  [GOD ${r.god}] ${r.name.slice(0, 36).padEnd(36)} | ${r.url}`);
  });

  console.log('\nSample confirmed junk (parking/unreachable):');
  results
    .filter((r) => r.verdict === 'parking' || r.verdict === 'unreachable')
    .slice(0, 12)
    .forEach((r) => {
      console.log(`  ${r.name.slice(0, 32).padEnd(32)} | ${r.url} | ${r.verdict} (${r.detail})`);
    });

  console.log('\nSample wrong/unrelated (guessed domain):');
  results
    .filter((r) => r.verdict === 'wrong_or_unrelated')
    .slice(0, 12)
    .forEach((r) => {
      console.log(`  ${r.name.slice(0, 32).padEnd(32)} | ${r.url} | ${r.detail}`);
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
