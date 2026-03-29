/**
 * Shared Supabase Client for Backend Services
 * ============================================
 * Reusable client with environment variable validation
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
// Load from project root .env (not server/.env)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function getSupabaseClient() {
  // Check for all possible environment variable names (trim — Fly/secret typos may leave whitespace,
  // which is truthy in JS but fails validateSupabaseUrl inside createClient).
  const rawUrl = process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  const rawKey = process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;
  const supabaseKey = typeof rawKey === 'string' ? rawKey.trim() : '';

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL environment variable is required. On Fly: set [env] in fly.toml or `fly secrets set SUPABASE_URL=...`; empty secrets override fly.toml.',
    );
  }

  try {
    const u = new URL(supabaseUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('not http(s)');
    }
  } catch {
    throw new Error(
      `SUPABASE_URL is not a valid HTTP(S) URL (got ${JSON.stringify(supabaseUrl.slice(0, 48))}…). Check Fly secrets do not override with a bad value.`,
    );
  }

  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY is required. On Fly: `fly secrets set SUPABASE_SERVICE_KEY=...` or set VITE_SUPABASE_ANON_KEY in [env].',
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

/** PostgREST returns at most 1000 rows per request — paginate for correct aggregates. */
const STARTUP_UPLOAD_PAGE = 1000;

/**
 * @param {ReturnType<typeof createClient>} supabase
 * @param {string} selectColumns
 * @param {(q: import('@supabase/supabase-js').PostgrestFilterBuilder) => import('@supabase/supabase-js').PostgrestFilterBuilder} applyFilters
 */
async function paginateStartupUploads(supabase, selectColumns, applyFilters) {
  const all = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from('startup_uploads')
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(from, from + STARTUP_UPLOAD_PAGE - 1);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < STARTUP_UPLOAD_PAGE) break;
    from += STARTUP_UPLOAD_PAGE;
  }
  return all;
}

// Create singleton instance
let supabaseInstance = null;

module.exports = {
  get supabase() {
    if (!supabaseInstance) {
      supabaseInstance = getSupabaseClient();
    }
    return supabaseInstance;
  },
  getSupabaseClient,
  paginateStartupUploads,
};
