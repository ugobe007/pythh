#!/usr/bin/env node
/**
 * Audit why funding-round participants miss pre-event matches.
 * Terminal: node scripts/audit-candidate-generation-misses.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveCanonicalEntity, normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

async function main() {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
  const q = async (sql, params) => (await pool.query(sql, params)).rows;

  const statusBreak = await q(`
    SELECT resolution_status, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE investor_id IS NULL)::int AS null_id
    FROM funding_evidence_participants
    WHERE participation_relation IS NOT NULL
      AND participant_role IS DISTINCT FROM 'unknown'
    GROUP BY 1 ORDER BY n DESC
  `);

  const topMissing = await q(`
    SELECT investor_name_raw AS name,
           COUNT(*)::int AS n,
           COUNT(DISTINCT funding_event_id)::int AS events
    FROM funding_evidence_participants
    WHERE investor_id IS NULL
      AND participation_relation IS NOT NULL
      AND participant_role IS DISTINCT FROM 'unknown'
      AND resolution_status IN ('not_in_universe','unresolved','ambiguous')
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 25
  `);

  const { rows: investors } = await pool.query(
    `SELECT id, name, firm, status, entity_gate, is_individual
     FROM investors
     WHERE COALESCE(status,'active') NOT IN ('inactive','rejected','deleted')`,
  );

  const resolvePreview = topMissing.slice(0, 15).map((row) => {
    const r = resolveCanonicalEntity(investors, row.name);
    return {
      name: row.name,
      n: row.n,
      norm: normalizeEntityName(row.name),
      status: r.status,
      matchKind: r.matchKind,
      resolved_to: r.row ? (r.row.firm || r.row.name) : null,
    };
  });

  const resolvedMiss = await q(`
    WITH proven AS (
      SELECT p.investor_id, e.startup_id,
             COALESCE(e.announced_at, e.occurred_at, e.discovered_at) AS event_at
      FROM funding_evidence_participants p
      JOIN funding_evidence_events e ON e.id = p.funding_event_id
      WHERE p.investor_id IS NOT NULL
        AND e.startup_id IS NOT NULL
        AND p.participation_relation IS NOT NULL
        AND p.participant_role IS DISTINCT FROM 'unknown'
    ),
    labeled AS (
      SELECT pr.*,
        EXISTS (
          SELECT 1 FROM startup_investor_matches m
          WHERE m.startup_id = pr.startup_id AND m.investor_id = pr.investor_id
            AND m.created_at < pr.event_at
        ) AS had_pre_event_match,
        i.entity_gate,
        i.status AS investor_status
      FROM proven pr
      JOIN investors i ON i.id = pr.investor_id
    )
    SELECT
      COUNT(*)::int AS proven_rows,
      COUNT(*) FILTER (WHERE had_pre_event_match)::int AS pre_event_matched,
      COUNT(*) FILTER (WHERE NOT had_pre_event_match)::int AS never_pre_matched,
      COUNT(*) FILTER (WHERE NOT had_pre_event_match AND entity_gate IS DISTINCT FROM 'qualified')::int AS miss_not_qualified,
      COUNT(*) FILTER (WHERE NOT had_pre_event_match AND COALESCE(entity_gate,'') = 'qualified')::int AS miss_but_qualified
    FROM labeled
  `);

  const missSectors = await q(`
    SELECT COALESCE(NULLIF(s.sectors[1],''),'unknown') AS sector, COUNT(*)::int AS n
    FROM funding_evidence_participants p
    JOIN funding_evidence_events e ON e.id = p.funding_event_id
    JOIN startup_uploads s ON s.id = e.startup_id
    WHERE p.investor_id IS NOT NULL
      AND p.participation_relation IS NOT NULL
      AND p.participant_role IS DISTINCT FROM 'unknown'
      AND NOT EXISTS (
        SELECT 1 FROM startup_investor_matches m
        WHERE m.startup_id = e.startup_id AND m.investor_id = p.investor_id
          AND m.created_at < COALESCE(e.announced_at, e.occurred_at, e.discovered_at)
      )
    GROUP BY 1 ORDER BY n DESC LIMIT 12
  `);

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    statusBreak,
    topMissing,
    resolvePreview,
    resolvedMiss: resolvedMiss[0] || null,
    missSectors,
  }, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
