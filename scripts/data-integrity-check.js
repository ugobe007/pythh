#!/usr/bin/env node
/**
 * DATA INTEGRITY CHECK
 * ════════════════════════════════════════════════════════════════════════════
 * Validates canonical columns in startup_uploads for plausibility.
 * Catches values that pattern extractors write blindly and that slip through
 * into the scoring pipeline.
 *
 * Run after any enrichment/promotion pass to confirm nothing is corrupted.
 *
 * Checks:
 *   1. customer_count  — capped at 500k (auto) / 10M (manual)
 *   2. arr_usd         — capped at $500M (startup ≠ public company)
 *   3. revenue_usd     — capped at $500M
 *   4. growth_rate     — capped at 1000% monthly (anything higher = bad parse)
 *   5. tagline         — reject ObjectID / hex-hash strings
 *   6. name            — flag article-fragment names (headline patterns)
 *   7. website         — flag news/article URLs (not company homepages)
 *
 * Usage:
 *   node scripts/data-integrity-check.js              # report only
 *   node scripts/data-integrity-check.js --fix        # auto-null the bad values
 *   node scripts/data-integrity-check.js --fix --verbose
 */

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { classifySuspiciousStartupWebsite } = require('../lib/suspiciousStartupWebsite');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const APPLY = process.argv.includes('--fix');
const VERBOSE = process.argv.includes('--verbose');
const PAGE = 1000;

// ── Bounds ────────────────────────────────────────────────────────────────────
const BOUNDS = {
  customer_count: { auto: 500_000, manual: 10_000_000 },
  arr_usd:        { auto: 500_000_000, manual: 500_000_000 },
  revenue_usd:    { auto: 500_000_000, manual: 500_000_000 },
  growth_rate:    { auto: 1_000, manual: 1_000 },       // % monthly
};

// ── Patterns that indicate corrupted text fields ───────────────────────────────
const HASH_PATTERN   = /^[0-9a-f]{12,}$/i;              // MongoDB ObjectIDs, SHA hashes

// DEFINITE_JUNK: patterns so specific that any match = reject, even with a website.
// These are publisher bylines, time words, and sentence fragments — never company names.
const DEFINITE_JUNK = [
  /^(bloomberg|reuters|techcrunch|forbes|wsj|wired|cnbc|fortune|axios|venturebeat)\b/i,
  /^(yesterday|today|tomorrow|this week|last week|this month)\b/i,
  /\b(today|yesterday)\s*$/i,
  /^(joins?|hits?|raises?|secures?|closes?|announces?|gets?|seeks?)\s*$/i,
  /^(and|or|to|in|by|of|for|with|from|on|at|as|is|are|was|were|the|a|an)\s+/i,
  /\b(bloomberg|reuters|techcrunch|forbes|wsj|wired|cnbc)\b.*\b(bloomberg|reuters|techcrunch)\b/i, // "Bloomberg Bloomberg"
];

// ARTICLE_FRAGMENT: patterns that strongly suggest a headline fragment — reject if no website.
const ARTICLE_FRAGMENT = [
  /^(the|a|an|by|and|or|in|to|how|why|what|when|where)\s+/i,
  /(raises?|secured|closes?|announces?|joins|hits|gets)\s*$/i,
  /\b(today|yesterday|this week|this month)\b/i,
  /^(techcrunch|forbes|bloomberg|reuters|wsj|wired|cnbc)\b/i,
];

function isDefiniteJunk(name) {
  if (!name) return false;
  return DEFINITE_JUNK.some(p => p.test(name.trim()));
}

function isArticleFragment(name) {
  if (!name) return false;
  return ARTICLE_FRAGMENT.some(p => p.test(name.trim()));
}

// ── Pagination helper ─────────────────────────────────────────────────────────
async function paginate(buildQuery) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + PAGE - 1);
    if (error) { console.error('Paginate error:', error.message); break; }
    if (!data || data.length === 0) break;
    rows.push(...data);
    process.stdout.write(`\r  Loaded ${rows.length}…`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  process.stdout.write('\r');
  return rows;
}

// ── Apply fix helper ─────────────────────────────────────────────────────────
async function applyFix(ids, field, label) {
  const CHUNK = 100;
  let ok = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('startup_uploads')
      .update({ [field]: null })
      .in('id', slice);
    if (error) console.error(`  ✗ ${label} batch error:`, error.message);
    else ok += slice.length;
  }
  console.log(`  ✓ Nulled ${field} on ${ok} records (${label})`);
}

// ── Write results to ai_logs so every health check is visible in one place ────
async function logToAiLogs(totalIssues, issues, applied) {
  try {
    const summary = {
      total_issues: totalIssues,
      fixed: applied,
      customer_count:  issues.customer_count?.length  || 0,
      arr_usd:         issues.arr_usd?.length          || 0,
      revenue_usd:     issues.revenue_usd?.length      || 0,
      growth_rate:     issues.growth_rate?.length      || 0,
      tagline_hash:    issues.tagline_hash?.length     || 0,
      definite_junk:   issues.definite_junk?.length    || 0,
      name_fragment:   issues.name_fragment?.length    || 0,
      suspicious_website: issues.suspicious_website?.length || 0,
      bad_maturity_level: issues.bad_maturity_level?.length || 0,
    };
    await supabase.from('ai_logs').insert({
      type: 'data_integrity_check',
      status: totalIssues === 0 ? 'pass' : (applied ? 'fixed' : 'warn'),
      message: totalIssues === 0
        ? 'All fields within bounds. No integrity issues.'
        : `${totalIssues} issue(s) found${applied ? ' and fixed' : ' (report only)'}.`,
      details: summary,
      created_at: new Date().toISOString(),
    });
  } catch (_) {
    // ai_logs write is best-effort — don't fail the script if table is missing
  }
}

async function main() {
  console.log(`\n🔍  DATA INTEGRITY CHECK  ${APPLY ? '[FIX MODE]' : '[REPORT ONLY]'}\n`);

  console.log('  Loading startup_uploads…');
  const rows = await paginate((from, to) =>
    supabase
      .from('startup_uploads')
      .select('id, name, source_type, customer_count, arr_usd, revenue_usd, growth_rate, tagline, website, submitted_email, maturity_level')
      .eq('status', 'approved')
      .range(from, to)
  );
  console.log(`  Loaded ${rows.length} approved records\n`);

  const issues = {
    customer_count:   [],
    arr_usd:          [],
    revenue_usd:      [],
    growth_rate:      [],
    tagline_hash:     [],
    definite_junk:    [],
    name_fragment:    [],
    suspicious_website: [],
    bad_maturity_level: [],
  };

  const MATURITY_OK = new Set([
    null,
    undefined,
    'freshman',
    'sophomore',
    'junior',
    'senior',
    'graduate',
    'phd',
  ]);

  for (const r of rows) {
    const isManual = r.source_type === 'manual';

    for (const col of ['customer_count', 'arr_usd', 'revenue_usd', 'growth_rate']) {
      const val = r[col];
      if (val === null || val === undefined) continue;
      const cap = isManual ? BOUNDS[col].manual : BOUNDS[col].auto;
      if (val > cap) issues[col].push({ id: r.id, name: r.name, val, cap, src: r.source_type });
    }

    if (r.tagline && HASH_PATTERN.test(r.tagline.trim()))
      issues.tagline_hash.push({ id: r.id, name: r.name, tagline: r.tagline });

    if (!isManual && isDefiniteJunk(r.name)) {
      issues.definite_junk.push({ id: r.id, name: r.name, src: r.source_type });
      continue;
    }

    if (!isManual && isArticleFragment(r.name) && !r.website)
      issues.name_fragment.push({ id: r.id, name: r.name, src: r.source_type });

    const ws = classifySuspiciousStartupWebsite(r.website);
    if (ws.suspicious) {
      issues.suspicious_website.push({
        id: r.id,
        name: r.name,
        website: r.website,
        reason: ws.reason,
        src: r.source_type,
      });
    }

    if (r.maturity_level != null && String(r.maturity_level).trim() !== '') {
      const ml = String(r.maturity_level).toLowerCase().trim();
      if (!MATURITY_OK.has(ml)) {
        issues.bad_maturity_level.push({ id: r.id, name: r.name, maturity_level: r.maturity_level });
      }
    }
  }

  let totalIssues = Object.values(issues).reduce((s, l) => s + l.length, 0);

  for (const [key, list] of Object.entries(issues)) {
    if (list.length === 0) { console.log(`  ✅  ${key}: no issues`); continue; }
    console.log(`\n  ⚠️  ${key}: ${list.length} issue(s)`);
    const show = VERBOSE ? list : list.slice(0, 5);
    show.forEach((r) => {
      let detail;
      if (r.val !== undefined) {
        detail = `  value=${r.val?.toLocaleString()}, cap=${r.cap?.toLocaleString()}, src=${r.src}`;
      } else if (r.tagline) {
        detail = `  tagline="${r.tagline}"`;
      } else if (key === 'suspicious_website' && r.website) {
        detail = `  website="${String(r.website).slice(0, 70)}" (${r.reason})`;
      } else if (key === 'bad_maturity_level') {
        detail = `  maturity_level="${r.maturity_level}"`;
      } else {
        detail = `  name="${r.name}"`;
      }
      console.log(`     "${(r.name || '').slice(0, 35)}"${detail}`);
    });
    if (!VERBOSE && list.length > 5) console.log(`     … and ${list.length - 5} more (--verbose)`);
  }

  console.log(`\n  Total issues found: ${totalIssues}`);

  if (totalIssues === 0) {
    console.log('  ✅  All fields within expected bounds.\n');
    await logToAiLogs(0, issues, false);
    return;
  }

  if (!APPLY) {
    console.log('\n  Run with --fix to auto-null numeric/tagline issues, reject junk names, null bad maturity.');
    console.log('  (suspicious_website is report-only — review before clearing website manually.)\n');
    await logToAiLogs(totalIssues, issues, false);
    return;
  }

  console.log('\n  Applying fixes…\n');

  for (const col of ['customer_count', 'arr_usd', 'revenue_usd', 'growth_rate']) {
    if (issues[col].length > 0) await applyFix(issues[col].map(r => r.id), col, col);
  }
  if (issues.tagline_hash.length > 0)
    await applyFix(issues.tagline_hash.map(r => r.id), 'tagline', 'hash taglines');

  if (issues.definite_junk.length > 0) {
    const REASON = 'Auto-rejected by data-integrity-check: publisher byline or time-word — not a startup name.';
    const CHUNK = 100;
    let ok = 0;
    for (let i = 0; i < issues.definite_junk.length; i += CHUNK) {
      const slice = issues.definite_junk.slice(i, i + CHUNK).map(r => r.id);
      const { error } = await supabase.from('startup_uploads')
        .update({ status: 'rejected', admin_notes: REASON, updated_at: new Date().toISOString() })
        .in('id', slice);
      if (error) console.error('  ✗ definite_junk reject error:', error.message);
      else ok += slice.length;
    }
    console.log(`  ✓ Rejected ${ok} definite-junk entries`);
  }

  if (issues.name_fragment.length > 0) {
    const REASON = 'Auto-rejected by data-integrity-check: article-fragment name with no website.';
    const CHUNK = 100;
    let ok = 0;
    for (let i = 0; i < issues.name_fragment.length; i += CHUNK) {
      const slice = issues.name_fragment.slice(i, i + CHUNK).map(r => r.id);
      const { error } = await supabase.from('startup_uploads')
        .update({ status: 'rejected', admin_notes: REASON, updated_at: new Date().toISOString() })
        .in('id', slice);
      if (error) console.error('  ✗ name_fragment reject error:', error.message);
      else ok += slice.length;
    }
    console.log(`  ✓ Rejected ${ok} article-fragment names`);
  }

  if (issues.bad_maturity_level.length > 0) {
    await applyFix(
      issues.bad_maturity_level.map((r) => r.id),
      'maturity_level',
      'invalid maturity_level (not in canonical enum)'
    );
  }

  await logToAiLogs(totalIssues, issues, true);
  console.log('\n  ✓ All fixes applied. Run recalculate-scores.ts to refresh GOD scores.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
