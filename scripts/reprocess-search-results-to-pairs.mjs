#!/usr/bin/env node
/**
 * Reprocess funding_evidence_search_results → match_validation_evidence pairs
 * using end-of-day event timestamps for date-only rows (Phase 2 date-precision fix).
 *
 * Usage:
 *   node scripts/reprocess-search-results-to-pairs.mjs --since=2026-08-25
 *   node scripts/reprocess-search-results-to-pairs.mjs --since=2026-08-25 --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';

const require = createRequire(import.meta.url);
const { isIssuerPrimary } = require('../server/lib/matchEvidenceSourceTier.js');

const apply = process.argv.includes('--apply');
const sinceArg = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1] || '2026-08-25';

const url = resolveSupabaseRestUrl().url;
const key = resolveSupabaseServiceKey();
if (!url || !key || !process.env.DATABASE_URL) throw new Error('Missing env');

const db = createClient(url, key, { auth: { persistSession: false } });

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});

function eventAtFromDate(value) {
  const iso = value instanceof Date ? value.toISOString() : String(value || '');
  const day = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return `${day}T23:59:59.999Z`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`bad event_date: ${value}`);
  // If timestamp is midnight UTC, treat as date-only precision.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return `${d.toISOString().slice(0, 10)}T23:59:59.999Z`;
  }
  return d.toISOString();
}

async function resolveReviewerId() {
  if (process.env.PYTHH_REVIEWER_USER_ID) return process.env.PYTHH_REVIEWER_USER_ID;
  const email = process.env.OWNER_EMAILS?.split(',')[0]?.trim() || 'ugobe07@gmail.com';
  const { rows } = await pool.query('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [email]);
  if (!rows[0]?.id) throw new Error(`No auth.users row for ${email} — set PYTHH_REVIEWER_USER_ID`);
  return rows[0].id;
}

async function main() {
  const since = new Date(sinceArg).toISOString();
  const { rows } = await pool.query(
    `
    SELECT r.id, r.startup_id, r.investor_id, r.investor_name_raw, r.event_date,
           r.source_url, r.source_title, r.source_provider, r.raw_payload,
           s.name AS startup_name
    FROM funding_evidence_search_results r
    JOIN startup_uploads s ON s.id = r.startup_id
    WHERE s.created_at >= $1::timestamptz
      AND s.source_type = 'url'
      AND r.investor_id IS NOT NULL
      AND r.event_date IS NOT NULL
      AND r.source_url IS NOT NULL
    ORDER BY r.created_at DESC
    `,
    [since],
  );

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    since: sinceArg,
    candidates: rows.length,
    paired: 0,
    paired_via_firm_alias: 0,
    verified: 0,
    skipped_no_pre_match: 0,
    samples: [],
  };

  let reviewer = null;

  /** Strip legal/vehicle suffixes so "Susquehanna Venture Capital" ≈ "Susquehanna". */
  function firmStem(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .replace(/(?:ventures?|capital|partners?|partner|fund|group|llc|inc|lp)$/g, '');
  }

  async function findPreMatch(row, eventAt) {
    const { data: direct } = await db
      .from('startup_investor_matches')
      .select('id, created_at, investor_id')
      .eq('startup_id', row.startup_id)
      .eq('investor_id', row.investor_id)
      .lt('created_at', eventAt)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (direct) return { match: direct, via: 'investor_id', paired_investor_id: row.investor_id };

    // Firm-alias fallback: search may resolve a duplicate investor row while an
    // earlier match already exists under a sibling firm label (same stem).
    const target = firmStem(row.investor_name_raw);
    if (target.length < 8) return null;
    const { rows: early } = await pool.query(
      `
      SELECT m.id, m.created_at, m.investor_id, COALESCE(i.firm, i.name) AS firm
      FROM startup_investor_matches m
      JOIN investors i ON i.id = m.investor_id
      WHERE m.startup_id = $1 AND m.created_at < $2::timestamptz
      ORDER BY m.created_at ASC
      `,
      [row.startup_id, eventAt],
    );
    for (const e of early) {
      const stem = firmStem(e.firm);
      if (stem.length < 8) continue;
      if (stem === target) {
        return { match: e, via: 'firm_alias', paired_investor_id: e.investor_id };
      }
    }
    return null;
  }

  for (const row of rows) {
    const eventAt = eventAtFromDate(row.event_date);
    const found = await findPreMatch(row, eventAt);

    if (!found) {
      summary.skipped_no_pre_match += 1;
      continue;
    }

    const { match, via, paired_investor_id } = found;
    if (via === 'firm_alias') summary.paired_via_firm_alias = (summary.paired_via_firm_alias || 0) + 1;

    const issuer = isIssuerPrimary(row.source_url);
    summary.paired += 1;
    if (issuer) summary.verified += 1;
    if (summary.samples.length < 15) {
      summary.samples.push({
        startup: row.startup_name,
        investor: row.investor_name_raw,
        eventAt,
        match_at: match.created_at,
        issuer_primary: issuer,
        via,
        source_url: row.source_url,
      });
    }

    if (!apply) continue;

    if (issuer && !reviewer) reviewer = await resolveReviewerId();

    const payload = {
      match_id: match.id,
      startup_id: row.startup_id,
      investor_id: paired_investor_id,
      evidence_type: 'funding',
      event_at: eventAt,
      source_url: row.source_url,
      source_provider: row.source_provider || 'gemini_google_search',
      source_record_type: 'web_search',
      source_record_id: `${row.startup_id}:${row.source_url}:${paired_investor_id}`,
      resolution_method: 'name_exact_unique',
      resolution_confidence: via === 'firm_alias' ? 0.85 : 0.9,
      raw_payload: {
        ...(row.raw_payload || {}),
        ...(via === 'firm_alias'
          ? { firm_alias_from_investor_id: row.investor_id, firm_alias_via: via }
          : {}),
      },
      ...(issuer
        ? {
            verified: true,
            review_status: 'verified',
            verified_at: new Date().toISOString(),
            verified_by: reviewer,
          }
        : {}),
    };
    const { error } = await db.from('match_validation_evidence').upsert(payload, {
      onConflict: 'match_id,evidence_type,source_url,event_at',
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`${row.startup_name}: ${error.message}`);
  }

  await pool.end();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
