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
  // Check for all possible environment variable names
  const supabaseUrl = process.env.VITE_SUPABASE_URL ||
                      process.env.SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 
                      process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                      process.env.VITE_SUPABASE_ANON_KEY ||
                      process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required. Check .env file in project root.');
  }
  
  if (!supabaseKey) {
    throw new Error('SUPABASE_KEY environment variable is required. Check .env file in project root.');
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
