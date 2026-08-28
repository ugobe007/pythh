#!/usr/bin/env node
/**
 * Phase 2 ops: force-match resolved search-result funders missing from
 * startup_investor_matches. Does NOT backdate created_at — future Hit@5 only.
 *
 * Usage:
 *   node scripts/force-match-from-search-results.mjs --startup=Yardstik
 *   node scripts/force-match-from-search-results.mjs --startup=Yardstik --apply
 *   node scripts/force-match-from-search-results.mjs --since=2026-08-25 --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';

const require = createRequire(import.meta.url);
const { calculateMatch } = require('./matching/generate-matches.js');

const apply = process.argv.includes('--apply');
const startupArg = process.argv.find((a) => a.startsWith('--startup='))?.split('=')[1];
const sinceArg = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1] || '2026-08-25';
const algorithmVersion = 'v3.5-force-sr';

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

const url = resolveSupabaseRestUrl().url;
const key = resolveSupabaseServiceKey();
const db = createClient(url, key, { auth: { persistSession: false } });
const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});

async function main() {
  const params = [];
  let where = `
    r.investor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM startup_investor_matches m
      WHERE m.startup_id = r.startup_id AND m.investor_id = r.investor_id
    )
  `;
  if (startupArg) {
    params.push(startupArg);
    where += ` AND s.name ILIKE $${params.length}`;
  } else {
    params.push(sinceArg);
    where += ` AND s.created_at >= $${params.length}::timestamptz AND s.source_type = 'url'`;
  }

  const { rows } = await pool.query(
    `
    SELECT DISTINCT ON (r.startup_id, r.investor_id)
      r.startup_id, r.investor_id, r.investor_name_raw, r.source_url, r.event_date,
      s.name AS startup_name, s.description, s.sectors, s.stage, s.total_god_score,
      s.team_score, s.traction_score, s.market_score, s.product_score, s.vision_score,
      s.location, s.website, i.name AS investor_name, i.firm, i.type, i.investor_type,
      i.sectors AS inv_sectors, i.stage AS inv_stage, i.investment_thesis, i.is_individual
    FROM funding_evidence_search_results r
    JOIN startup_uploads s ON s.id = r.startup_id
    JOIN investors i ON i.id = r.investor_id
    WHERE ${where}
    ORDER BY r.startup_id, r.investor_id, r.created_at DESC
    `,
    params,
  );

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    candidates: rows.length,
    upserted: 0,
    skipped_individual: 0,
    samples: [],
  };

  for (const row of rows) {
    if (row.is_individual === true) {
      summary.skipped_individual += 1;
      continue;
    }
    const startup = {
      id: row.startup_id,
      name: row.startup_name,
      description: row.description,
      sectors: row.sectors,
      stage: row.stage,
      total_god_score: row.total_god_score,
      team_score: row.team_score,
      traction_score: row.traction_score,
      market_score: row.market_score,
      product_score: row.product_score,
      vision_score: row.vision_score,
      location: row.location,
      website: row.website,
    };
    const investor = {
      id: row.investor_id,
      name: row.investor_name,
      firm: row.firm || row.investor_name,
      type: row.type,
      investor_type: row.investor_type,
      sectors: row.inv_sectors,
      stage: row.inv_stage,
      investment_thesis: row.investment_thesis,
    };
    const match = calculateMatch(startup, investor);
    const score = Math.max(Number(match?.score) || 0, 55);
    if (summary.samples.length < 20) {
      summary.samples.push({
        startup: row.startup_name,
        investor: row.investor_name,
        score,
        event_date: row.event_date,
        source_url: row.source_url,
      });
    }
    if (!apply) continue;
    const { error } = await db.from('startup_investor_matches').upsert(
      {
        startup_id: row.startup_id,
        investor_id: row.investor_id,
        match_score: score,
        algorithm_version: algorithmVersion,
        fit_analysis: {
          forced_from_search_result: true,
          source_url: row.source_url,
          event_date: row.event_date,
          reasons: match?.reasons || [],
        },
      },
      { onConflict: 'startup_id,investor_id', ignoreDuplicates: false },
    );
    if (error) throw new Error(`${row.startup_name}/${row.investor_name}: ${error.message}`);
    summary.upserted += 1;
  }

  await pool.end();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
