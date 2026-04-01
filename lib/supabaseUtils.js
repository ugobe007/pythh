'use strict';

/**
 * lib/supabaseUtils.js
 *
 * Shared Supabase infrastructure for all pipeline scripts.
 *
 * Why this exists:
 *   Every pipeline script was independently re-implementing batching, pagination,
 *   chunked .in() queries, and idempotency checks — with different (wrong) chunk
 *   sizes in each copy. This is the single source of truth for all DB access patterns.
 *
 * Rules enforced here:
 *   - IN_CHUNK_SIZE = 100  (100 UUIDs ≈ 3.6KB URL, safely under PostgREST 8KB limit)
 *   - INSERT_BATCH = 200   (optimal insert batch size)
 *   - All paginated fetches loop until data.length < pageSize
 *
 * Usage:
 *   const { fetchAll, fetchByIds, deleteByIds, insertInBatches, upsertInBatches,
 *           getAlreadyIngestedToday } = require('../lib/supabaseUtils');
 */

// PostgREST encodes .in() filters in the URL query string.
// 100 UUIDs × 36 chars each ≈ 3.6KB — safely under the typical 8KB nginx/PostgREST limit.
// 200 UUIDs ≈ 7.2KB — intermittently fails. 500 UUIDs — reliably fails silently.
const IN_CHUNK_SIZE  = 100;
const INSERT_BATCH   = 200;
const UPSERT_BATCH   = 50;   // smaller for upserts — each row is a full read+write

/**
 * Paginate a Supabase query until all rows are fetched.
 *
 * @param {Function} buildQuery - (fromIdx, toIdx) => SupabaseQueryBuilder
 *   The caller builds the query with .range(from, to) applied.
 * @param {number} [pageSize=1000]
 * @returns {Promise<{data: any[], error: Error|null}>}
 *
 * @example
 *   const { data } = await fetchAll((from, to) =>
 *     supabase.from('pythh_signal_events').select('id, entity_id').range(from, to)
 *   );
 */
async function fetchAll(buildQuery, pageSize = 1000) {
  const rows  = [];
  let   offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error)                     return { data: rows, error };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize)    break;
    offset += pageSize;
  }
  return { data: rows, error: null };
}

/**
 * Fetch rows for a large list of IDs using safe chunked .in() queries.
 * Never passes more than IN_CHUNK_SIZE IDs per request.
 *
 * @param {Object}   supabase     - Supabase client
 * @param {string}   table        - Table name
 * @param {string}   idColumn     - Column to filter (e.g. 'entity_id')
 * @param {string[]} ids          - Full list of IDs
 * @param {string}   [selectFields='*']
 * @param {Function} [extraFilter=null] - (query) => query — apply extra .eq()/.gte()/etc.
 * @returns {Promise<any[]>}
 */
async function fetchByIds(supabase, table, idColumn, ids, selectFields = '*', extraFilter = null) {
  const rows = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    let q = supabase
      .from(table)
      .select(selectFields)
      .in(idColumn, ids.slice(i, i + IN_CHUNK_SIZE));
    if (extraFilter) q = extraFilter(q);
    const { data, error } = await q;
    if (error) console.error(`fetchByIds(${table}) error:`, error.message);
    else rows.push(...(data || []));
  }
  return rows;
}

/**
 * Delete rows by a large list of IDs using safe chunked .in() queries.
 *
 * @param {Object}   supabase   - Supabase client
 * @param {string}   table      - Table name
 * @param {string}   idColumn   - Column to filter
 * @param {string[]} ids        - IDs to delete
 * @returns {Promise<boolean>}  true if no errors
 */
async function deleteByIds(supabase, table, idColumn, ids) {
  let errors = 0;
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in(idColumn, ids.slice(i, i + IN_CHUNK_SIZE));
    if (error) { console.error(`deleteByIds(${table}) error:`, error.message); errors++; }
  }
  return errors === 0;
}

/**
 * Insert rows in batches, logging progress.
 *
 * @param {Object}   supabase   - Supabase client
 * @param {string}   table      - Table name
 * @param {Object[]} rows       - Rows to insert
 * @param {number}   [batchSize=INSERT_BATCH]
 * @returns {Promise<{inserted: number, errors: number}>}
 */
async function insertInBatches(supabase, table, rows, batchSize = INSERT_BATCH) {
  let inserted = 0;
  let errors   = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`insertInBatches(${table}) error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      process.stdout.write('.');
    }
  }
  return { inserted, errors };
}

/**
 * Upsert rows in batches with conflict resolution.
 *
 * @param {Object}   supabase    - Supabase client
 * @param {string}   table       - Table name
 * @param {Object[]} rows        - Rows to upsert
 * @param {string}   onConflict  - Conflict column(s) for ON CONFLICT clause
 * @param {number}   [batchSize=UPSERT_BATCH]
 * @returns {Promise<{upserted: number, errors: number}>}
 */
async function upsertInBatches(supabase, table, rows, onConflict, batchSize = UPSERT_BATCH) {
  let upserted = 0;
  let errors   = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`upsertInBatches(${table}) error:`, error.message);
      errors++;
    } else {
      upserted += batch.length;
    }
  }
  return { upserted, errors };
}

/**
 * Idempotency guard: returns the set of entity IDs that already have
 * signals from the given source_type ingested today (UTC).
 *
 * Call this before processing to skip already-processed entities.
 *
 * @param {Object}   supabase    - Supabase client
 * @param {string[]} entityIds   - Entity IDs to check
 * @param {string}   sourceType  - e.g. 'structured_metrics' | 'llm_enrichment'
 * @returns {Promise<Set<string>>}
 */
async function getAlreadyIngestedToday(supabase, entityIds, sourceType) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const seen  = new Set();
  for (let i = 0; i < entityIds.length; i += IN_CHUNK_SIZE) {
    const { data } = await supabase
      .from('pythh_signal_events')
      .select('entity_id')
      .in('entity_id', entityIds.slice(i, i + IN_CHUNK_SIZE))
      .eq('source_type', sourceType)
      .gte('detected_at', `${today}T00:00:00Z`);
    for (const r of (data || [])) seen.add(r.entity_id);
  }
  return seen;
}

module.exports = {
  IN_CHUNK_SIZE,
  INSERT_BATCH,
  UPSERT_BATCH,
  fetchAll,
  fetchByIds,
  deleteByIds,
  insertInBatches,
  upsertInBatches,
  getAlreadyIngestedToday,
};
