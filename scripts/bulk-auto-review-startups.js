#!/usr/bin/env node
/**
 * Bulk auto-review for startup_uploads — approve or reject without opening the admin UI row-by-row.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PRIMARY (use this for the RSS / scraper pending queue)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/bulk-auto-review-startups.js --rss-pending              # dry run
 *   node scripts/bulk-auto-review-startups.js --rss-pending --execute    # apply
 *
 *   URL + description correlate policy (lib/startupCorrelatePolicy.js — logic/ontology/name gate + context):
 *   node scripts/bulk-auto-review-startups.js --rss-pending --correlate-policy
 *   node scripts/bulk-auto-review-startups.js --rss-pending --correlate-policy --execute
 *   Rejects get admin_notes prefix: [correlate-policy] <reason> | channel=…
 *
 *   Automation (no manual runs): PM2 app `pending-startup-triage` (daily 06:30 UTC) or
 *   npm run pending:auto-triage — same flags as --execute line above.
 *
 *   Golden tests (full filename — .js required):
 *   npm run test:correlate-policy
 *   node tests/startup-correlate-policy.test.js
 *
 *   npm requires `--` before script flags:  npm run bulk:rss-pending -- --min-god=40 --execute
 *   Or:  npm run bulk:rss-pending:floor   (same as --rss-pending --min-god=40)
 *
 * Only rows with status = pending are loaded. Exactly one of four outcomes:
 *
 *   1. SKIP — submitted_email is set (real founder submission). Never changed.
 *   2. REJECT — obvious bad rows only:
 *        empty name, isGarbage(name), entity_gate = junk
 *        optional: --reject-below-god=N (null or score < N)
 *        Missing website/domain alone does NOT reject (RSS often leaves website null but has
 *        source_url); those rows stay pending until URL is normalized or you reject manually.
 *   3. APPROVE — not skipped/rejected, and total_god_score >= --min-god (default 50 in this mode).
 *        Many RSS rows sit at GOD 40; approving at 40 only checks URL + name, so almost anyone with
 *        a domain passes. Use --min-god=40 only when you intentionally want to clear that floor.
 *        Web presence = website, company_website, or source_url (RSS article link from scraper).
 *   4. LEAVE PENDING — not bad enough to reject but score is still below min_god (enrich or review later).
 *
 * Optional: --min-god=48   --reject-below-god=38   --strict-http-approve   --limit=5000
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LEGACY (explicit flags; for non-RSS workflows)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/bulk-auto-review-startups.js --execute --min-god=70
 *   node scripts/bulk-auto-review-startups.js --execute --reject-garbage --approve-status=pending
 *
 * Requires: SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY), VITE_SUPABASE_URL
 *
 * Recovery — rows wrongly rejected for “no website” while still valid RSS pipeline entities:
 *   UPDATE public.startup_uploads SET status = 'pending',
 *     admin_notes = trim(both E'\n' from coalesce(admin_notes,'') || E'\n[recovered] no_website false positive'),
 *     reviewed_at = NULL, updated_at = now()
 *   WHERE status = 'rejected' AND (
 *     admin_notes ILIKE '%no http(s) website%'
 *     OR admin_notes ILIKE '%no usable website or domain%'
 *     OR admin_notes ILIKE '%no usable website/domain/source_url%'
 *   );
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbage } = require('./cleanup-garbage');
const { evaluateStartupCorrelatePolicy } = require('../lib/startupCorrelatePolicy');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const EXECUTE = argv.includes('--execute');
const RSS_PENDING = argv.includes('--rss-pending');
/** When set with --rss-pending: reject rows that fail evaluateStartupCorrelatePolicy (URL or anchored description + name gate). */
const CORRELATE_POLICY = argv.includes('--correlate-policy');

const NO_APPROVE = argv.includes('--no-approve');
const REJECT_GARBAGE = argv.includes('--reject-garbage');
const REJECT_JUNK_GATE = argv.includes('--reject-junk-gate');
const REJECT_NON_HTTP = argv.includes('--reject-non-http');
const REQUIRE_WEBSITE = !argv.includes('--no-require-website');
const STRICT_HTTP_APPROVE = argv.includes('--strict-http-approve');
const SCRAPER_ONLY = !argv.includes('--no-scraper-only');

function argNum(name, def) {
  const a = argv.find((x) => x.startsWith(`${name}=`));
  if (!a) return def;
  const v = parseFloat(a.split('=')[1]);
  return Number.isFinite(v) ? v : def;
}

function argList(name, defCsv) {
  const a = argv.find((x) => x.startsWith(`${name}=`));
  if (!a) return defCsv.split(',').map((s) => s.trim()).filter(Boolean);
  return a
    .split('=')[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** RSS pending: default 50 so the GOD floor (~40) is not treated as “good enough” for auto-approve. */
const MIN_GOD = argNum('--min-god', RSS_PENDING ? 50 : 65);
const LIMIT = Math.min(argNum('--limit', 10000), 100000);
const APPROVE_STATUSES = new Set(argList('--approve-status', 'pending'));
const REJECT_STATUSES = new Set(argList('--reject-status', 'pending,reviewing'));
const BATCH = 80;

const rejectBelowArg = argv.find((x) => x.startsWith('--reject-below-god='));
const REJECT_BELOW_GOD = rejectBelowArg ? parseFloat(rejectBelowArg.split('=')[1]) : NaN;
const REJECT_BELOW_GOD_ON = Number.isFinite(REJECT_BELOW_GOD);

const NOTE_APPROVE =
  'Auto-approved by bulk-auto-review-startups.js (GOD≥min, website/domain, name checks). Revert in admin if wrong.';
const NOTE_REJECT_EMPTY = 'Auto-rejected by bulk-auto-review-startups.js (empty name).';
const NOTE_REJECT_GARBAGE = 'Auto-rejected by bulk-auto-review-startups.js (isGarbage/name rules).';
const NOTE_REJECT_JUNK_GATE = 'Auto-rejected by bulk-auto-review-startups.js (entity_gate=junk).';
const NOTE_REJECT_NON_HTTP =
  'Auto-rejected by bulk-auto-review-startups.js (no usable website/domain/source_url on record).';
const NOTE_REJECT_LOW_GOD = (n) =>
  `Auto-rejected by bulk-auto-review-startups.js (total_god_score < ${n}).`;

/** Auditing prefix for correlate-policy rejects (filter in SQL: admin_notes LIKE '[correlate-policy]%'). */
const CORRELATE_AUDIT_PREFIX = '[correlate-policy] ';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const PLACEHOLDER_WEB = new Set(['n/a', 'na', 'none', 'null', 'tbd', '-', '.', '..', 'unknown']);

function webTrim(s) {
  return String(s || '').trim();
}

function isPlaceholderWeb(s) {
  const t = webTrim(s).toLowerCase();
  return t.length === 0 || PLACEHOLDER_WEB.has(t);
}

function looksLikeDomainOrUrl(s) {
  const t = webTrim(s);
  if (t.length < 4 || isPlaceholderWeb(t)) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^ftp:\/\//i.test(t)) return true;
  if (/^www\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  return false;
}

/** RSS rows often have website=null while source_url holds the article (ssot-rss-scraper). */
function hasWebPresence(row) {
  return (
    looksLikeDomainOrUrl(row.website) ||
    looksLikeDomainOrUrl(row.company_website) ||
    looksLikeDomainOrUrl(row.source_url)
  );
}

function hasStrictHttpScheme(row) {
  const a = webTrim(row.website);
  const b = webTrim(row.company_website);
  const c = webTrim(row.source_url);
  return /^https?:\/\//i.test(a) || /^https?:\/\//i.test(b) || /^https?:\/\//i.test(c);
}

function hasFounderEmail(row) {
  return row.submitted_email != null && String(row.submitted_email).trim() !== '';
}

function webOkForApprove(row) {
  if (!REQUIRE_WEBSITE) return true;
  return STRICT_HTTP_APPROVE ? hasStrictHttpScheme(row) : hasWebPresence(row);
}

/**
 * RSS pending sweep: one ordered decision per row (no overlapping reject vs approve flags).
 * @returns {{ kind: 'skip'|'reject'|'approve'|'leave', key?: string, note?: string, reason?: string }}
 */
function classifyRssPending(row) {
  if (hasFounderEmail(row)) {
    return { kind: 'skip', reason: 'founder_submission' };
  }

  const name = (row.name || '').trim();
  if (!CORRELATE_POLICY) {
    if (!name) {
      return { kind: 'reject', key: 'empty_name', note: NOTE_REJECT_EMPTY };
    }
    if (isGarbage(name)) {
      return { kind: 'reject', key: 'garbage', note: NOTE_REJECT_GARBAGE };
    }
  }
  if (String(row.entity_gate || '').toLowerCase() === 'junk') {
    return { kind: 'reject', key: 'junk_gate', note: NOTE_REJECT_JUNK_GATE };
  }
  if (REJECT_BELOW_GOD_ON) {
    const g = row.total_god_score;
    if (g == null || !Number.isFinite(Number(g)) || Number(g) < REJECT_BELOW_GOD) {
      return { kind: 'reject', key: `below_god_${REJECT_BELOW_GOD}`, note: NOTE_REJECT_LOW_GOD(REJECT_BELOW_GOD) };
    }
  }

  if (CORRELATE_POLICY) {
    const cr = evaluateStartupCorrelatePolicy(row);
    if (!cr.ok) {
      const tail = `channel=${cr.channel} ctx_chars=${cr.checks.context_chars} anchored=${cr.checks.anchored} url=${cr.checks.url}`;
      const note = `${CORRELATE_AUDIT_PREFIX}${cr.reason || 'reject'} | ${tail} | bulk-auto-review-startups.js --rss-pending --correlate-policy`;
      return { kind: 'reject', key: 'correlate', note };
    }
    const score = row.total_god_score;
    if (score == null || !Number.isFinite(Number(score)) || Number(score) < MIN_GOD) {
      return { kind: 'leave', reason: `god_below_${MIN_GOD}` };
    }
    return { kind: 'approve' };
  }

  if (!name) {
    return { kind: 'reject', key: 'empty_name', note: NOTE_REJECT_EMPTY };
  }
  if (isGarbage(name)) {
    return { kind: 'reject', key: 'garbage', note: NOTE_REJECT_GARBAGE };
  }

  const score = row.total_god_score;
  if (score == null || !Number.isFinite(Number(score)) || Number(score) < MIN_GOD) {
    return { kind: 'leave', reason: `god_below_${MIN_GOD}` };
  }
  if (REQUIRE_WEBSITE && !webOkForApprove(row)) {
    return { kind: 'leave', reason: STRICT_HTTP_APPROVE ? 'no_strict_http' : 'no_resolvable_url' };
  }
  return { kind: 'approve' };
}

function passesApproveGate(row) {
  const name = row.name?.trim() || '';
  if (!name) return { ok: false, reason: 'empty_name' };
  if (SCRAPER_ONLY && hasFounderEmail(row)) {
    return { ok: false, reason: 'has_submitted_email' };
  }
  if (String(row.entity_gate || '').toLowerCase() === 'junk') {
    return { ok: false, reason: 'entity_gate_junk' };
  }
  const score = row.total_god_score;
  if (score == null || !Number.isFinite(Number(score)) || Number(score) < MIN_GOD) {
    return { ok: false, reason: `god_below_${MIN_GOD}` };
  }
  if (!webOkForApprove(row)) {
    return { ok: false, reason: STRICT_HTTP_APPROVE ? 'no_strict_http_website' : 'no_website' };
  }
  if (isGarbage(name)) return { ok: false, reason: 'garbage_name' };
  return { ok: true, reason: 'ok' };
}

function rejectRule(row) {
  if (!REJECT_STATUSES.has(row.status)) return null;
  const name = row.name?.trim() || '';

  if (REJECT_GARBAGE && name && isGarbage(name)) {
    return { key: 'garbage', note: NOTE_REJECT_GARBAGE };
  }
  if (REJECT_JUNK_GATE && String(row.entity_gate || '').toLowerCase() === 'junk') {
    return { key: 'junk_gate', note: NOTE_REJECT_JUNK_GATE };
  }
  if (REJECT_NON_HTTP && !hasWebPresence(row)) {
    return { key: 'no_website', note: NOTE_REJECT_NON_HTTP };
  }
  if (REJECT_BELOW_GOD_ON) {
    const g = row.total_god_score;
    if (g == null || !Number.isFinite(Number(g)) || Number(g) < REJECT_BELOW_GOD) {
      return { key: `below_god_${REJECT_BELOW_GOD}`, note: NOTE_REJECT_LOW_GOD(REJECT_BELOW_GOD) };
    }
  }
  return null;
}

async function logAi(type, payload) {
  try {
    await sb.from('ai_logs').insert({
      type,
      status: EXECUTE ? 'executed' : 'dry_run',
      message: payload.summary || type,
      details: payload,
      created_at: new Date().toISOString(),
    });
  } catch (_) {
    /* best-effort */
  }
}

function statusesToFetch() {
  const u = new Set();
  for (const s of APPROVE_STATUSES) u.add(s);
  for (const s of REJECT_STATUSES) u.add(s);
  return [...u];
}

async function fetchCandidates(statuses, extraSelect = '') {
  const rows = [];
  const PAGE = 500;
  const baseSelect =
    'id, name, status, website, company_website, source_url, total_god_score, entity_gate, submitted_email, created_at';
  const select = extraSelect ? `${baseSelect},${extraSelect}` : baseSelect;
  let from = 0;
  while (rows.length < LIMIT) {
    const take = Math.min(PAGE, LIMIT - rows.length);
    const { data, error } = await sb
      .from('startup_uploads')
      .select(select)
      .in('status', statuses)
      .order('created_at', { ascending: true })
      .range(from, from + take - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < take) break;
    from += take;
  }
  return rows;
}

async function applyBatched(ids, status, adminNotes, allowedStatuses) {
  const now = new Date().toISOString();
  let applied = 0;
  const statusList = [...allowedStatuses];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error } = await sb
      .from('startup_uploads')
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_at: now,
        updated_at: now,
      })
      .in('id', chunk)
      .in('status', statusList);
    if (error) console.error('  batch update error:', error.message);
    else applied += chunk.length;
    process.stdout.write(`  applied ${Math.min(i + BATCH, ids.length)}/${ids.length}\r`);
  }
  console.log('');
  return applied;
}

const PENDING_ONLY = new Set(['pending']);

async function runRssPendingSweep() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  RSS PENDING QUEUE  —  ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  min_god (approve): ${MIN_GOD}`);
  if (!argv.some((x) => x.startsWith('--min-god='))) {
    console.log(
      '  note: default min_god=50 — many RSS rows sit at GOD≈40; that band stays pending unless you pass --min-god=40.'
    );
  }
  console.log(
    `  web presence: ${REQUIRE_WEBSITE ? (STRICT_HTTP_APPROVE ? 'require https?:// (website or source_url)' : 'http(s), bare domain, or source_url') : 'not required'}`
  );
  console.log(`  reject if GOD < : ${REJECT_BELOW_GOD_ON ? REJECT_BELOW_GOD : 'off'}`);
  console.log(`  correlate policy:   ${CORRELATE_POLICY ? 'ON (reject with [correlate-policy] notes)' : 'OFF'}`);
  console.log('');

  const rssExtra = CORRELATE_POLICY ? 'description, pitch, tagline, extracted_data' : '';
  const all = await fetchCandidates(['pending'], rssExtra);
  console.log(`  fetched pending: ${all.length} (limit ${LIMIT})\n`);

  const rejectBuckets = new Map();
  const rejectByReason = {};
  const toApprove = [];
  let skipFounder = 0;
  const leaveByReason = {};
  /** Rows left pending only because total_god_score < MIN_GOD (RSS scores often clamp at 40). */
  let leaveScoreN = 0;
  let leaveScoreMin = Infinity;
  let leaveScoreMax = -Infinity;

  for (const row of all) {
    const c = classifyRssPending(row);
    if (c.kind === 'skip') {
      skipFounder += 1;
    } else if (c.kind === 'reject') {
      if (!rejectBuckets.has(c.note)) rejectBuckets.set(c.note, []);
      rejectBuckets.get(c.note).push(row.id);
      rejectByReason[c.key] = (rejectByReason[c.key] || 0) + 1;
    } else if (c.kind === 'approve') {
      toApprove.push(row);
    } else {
      const rk = c.reason || 'unknown';
      leaveByReason[rk] = (leaveByReason[rk] || 0) + 1;
      if (rk.startsWith('god_below_')) {
        const g = Number(row.total_god_score);
        if (Number.isFinite(g)) {
          leaveScoreN += 1;
          leaveScoreMin = Math.min(leaveScoreMin, g);
          leaveScoreMax = Math.max(leaveScoreMax, g);
        }
      }
    }
  }

  let totalReject = 0;
  for (const ids of rejectBuckets.values()) totalReject += ids.length;

  console.log('── Outcomes (each row counts once) ──');
  console.log(`  skip (founder):     ${skipFounder}`);
  console.log(`  reject:             ${totalReject}`, rejectByReason);
  console.log(`  approve:            ${toApprove.length}`);
  console.log(`  leave pending:      ${JSON.stringify(leaveByReason)}`);
  if (leaveScoreN > 0 && Number.isFinite(leaveScoreMin)) {
    console.log(
      `  → ${leaveScoreN} rows are only “stuck” below min_god (GOD range ${leaveScoreMin}–${leaveScoreMax}; rss scraper floors weak rows at 40). Not URL junk — raise scores via signal-pipeline / recalc, or approve the floor with: npm run bulk:rss-pending:floor -- --execute`
    );
  } else if (Object.keys(leaveByReason).length) {
    const nr = leaveByReason.no_resolvable_url || 0;
    const ns = leaveByReason.no_strict_http || 0;
    if (nr + ns > 0) {
      console.log(
        `  → ${nr + ns} left pending for URL fields (website / company_website / source_url); fix extractors if this dominates.`
      );
    }
  }

  toApprove.slice(0, 20).forEach((r) => {
    console.log(`    ✓ ${r.name?.slice(0, 56)} | god:${r.total_god_score}`);
  });
  if (toApprove.length > 20) console.log(`    ... +${toApprove.length - 20} more`);

  if (!EXECUTE) {
    await logAi('bulk_auto_review_rss_pending', {
      dry_run: true,
      skip_founder: skipFounder,
      would_approve: toApprove.length,
      would_reject: totalReject,
      leave: leaveByReason,
      min_god: MIN_GOD,
      correlate_policy: CORRELATE_POLICY,
      summary: `rss-pending dry-run`,
    });
    const execHint = CORRELATE_POLICY
      ? '\n💡 Run with --rss-pending --correlate-policy --execute to apply.'
      : '\n💡 Run with --rss-pending --execute to apply (add --correlate-policy for URL+description gate).';
    console.log(execHint);
    console.log('══════════════════════════════════════════════════════════════\n');
    return;
  }

  let rejected = 0;
  for (const [note, ids] of rejectBuckets) {
    const n = await applyBatched(ids, 'rejected', note, PENDING_ONLY);
    rejected += n;
    console.log(`  ✅ Rejected: ${n} (bucket ${ids.length})`);
  }

  let approved = 0;
  if (toApprove.length) {
    approved = await applyBatched(
      toApprove.map((r) => r.id),
      'approved',
      `${NOTE_APPROVE} min_god=${MIN_GOD} (--rss-pending${CORRELATE_POLICY ? ' --correlate-policy' : ''})`,
      PENDING_ONLY
    );
    console.log(`  ✅ Approved: ${approved}`);
  }

  await logAi('bulk_auto_review_rss_pending', {
    dry_run: false,
    approved,
    rejected,
    min_god: MIN_GOD,
    correlate_policy: CORRELATE_POLICY,
    summary: `rss-pending executed`,
  });
  console.log('══════════════════════════════════════════════════════════════\n');
}

async function runLegacyBulkReview() {
  const anyReject =
    REJECT_GARBAGE || REJECT_JUNK_GATE || REJECT_NON_HTTP || REJECT_BELOW_GOD_ON;
  if (!anyReject && NO_APPROVE) {
    console.error('Nothing to do: --no-approve with no reject flags.');
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  BULK AUTO-REVIEW (legacy) — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log(
    `  fetch statuses: ${[...new Set([...APPROVE_STATUSES, ...REJECT_STATUSES])].join(', ')}`
  );
  console.log(
    `  min_god (approve): ${MIN_GOD} | require website: ${REQUIRE_WEBSITE} | strict http: ${STRICT_HTTP_APPROVE} | scraper_only: ${SCRAPER_ONLY}`
  );
  console.log(
    `  reject flags: garbage=${REJECT_GARBAGE} junk_gate=${REJECT_JUNK_GATE} non_http=${REJECT_NON_HTTP} below_god=${REJECT_BELOW_GOD_ON ? REJECT_BELOW_GOD : 'off'}`
  );

  const all = await fetchCandidates(statusesToFetch());
  console.log(`  fetched: ${all.length} (limit ${LIMIT})\n`);

  const rejectBuckets = new Map();
  const rejectByReason = {};
  const toApprove = [];
  const approveSkip = {};

  for (const row of all) {
    const rr = anyReject ? rejectRule(row) : null;
    if (rr) {
      if (!rejectBuckets.has(rr.note)) rejectBuckets.set(rr.note, []);
      rejectBuckets.get(rr.note).push(row.id);
      rejectByReason[rr.key] = (rejectByReason[rr.key] || 0) + 1;
      continue;
    }
    if (!NO_APPROVE && APPROVE_STATUSES.has(row.status)) {
      const g = passesApproveGate(row);
      if (g.ok) toApprove.push(row);
      else approveSkip[g.reason] = (approveSkip[g.reason] || 0) + 1;
    }
  }

  let totalRejectIds = 0;
  for (const ids of rejectBuckets.values()) totalRejectIds += ids.length;

  console.log('── Summary ──');
  console.log(`  would reject: ${totalRejectIds}`, rejectByReason);
  if (!NO_APPROVE) {
    console.log(`  would approve: ${toApprove.length}`);
    console.log(`  not approved:`, JSON.stringify(approveSkip));
  }

  toApprove.slice(0, 25).forEach((r) => {
    console.log(`    ✓ ${r.name?.slice(0, 56)} | god:${r.total_god_score}`);
  });
  if (toApprove.length > 25) console.log(`    ... +${toApprove.length - 25} more`);

  if (!EXECUTE) {
    await logAi('bulk_auto_review', {
      dry_run: true,
      would_approve: toApprove.length,
      would_reject: totalRejectIds,
      reject_by_reason: rejectByReason,
      min_god: MIN_GOD,
      summary: `dry-run approve ${toApprove.length} reject ${totalRejectIds}`,
    });
    console.log('\n💡 Run with --execute to apply (rejects first, then approves).');
    console.log('══════════════════════════════════════════════════════════════\n');
    return;
  }

  let rejected = 0;
  for (const [note, ids] of rejectBuckets) {
    const n = await applyBatched(ids, 'rejected', note, REJECT_STATUSES);
    rejected += n;
    console.log(`  ✅ Rejected batch (${ids.length} rows): ${n} applied`);
  }

  const approveIds = toApprove.map((r) => r.id);
  let approved = 0;
  if (!NO_APPROVE && approveIds.length) {
    approved = await applyBatched(
      approveIds,
      'approved',
      `${NOTE_APPROVE} min_god=${MIN_GOD}`,
      APPROVE_STATUSES
    );
    console.log(`  ✅ Approved: ${approved}`);
  }

  await logAi('bulk_auto_review', {
    dry_run: false,
    approved,
    rejected,
    min_god: MIN_GOD,
    summary: `executed approve ${approved} reject ${rejected}`,
  });
  console.log('══════════════════════════════════════════════════════════════\n');
}

async function main() {
  if (RSS_PENDING) {
    await runRssPendingSweep();
    return;
  }
  await runLegacyBulkReview();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
