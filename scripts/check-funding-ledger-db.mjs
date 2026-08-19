#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  query_timeout: 10_000,
});

try {
  await client.connect();
  const { rows } = await client.query(`
    SELECT
      current_database() AS database,
      current_user AS role,
      to_regclass('public.funding_evidence_events')::text AS evidence_events,
      to_regclass('public.funding_evidence_participants')::text AS participants,
      to_regclass('public.funding_prediction_evaluations')::text AS evaluations,
      to_regclass('public.funding_prediction_misses')::text AS misses
  `);
  console.log(JSON.stringify(rows[0], null, 2));
} finally {
  await client.end().catch(() => {});
}
