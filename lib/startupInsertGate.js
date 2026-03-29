/**
 * STARTUP INSERT GATE
 * ===================
 * Single point of enforcement for all startup inserts.
 * Validates names before insert; logs rejections for monitoring.
 *
 * Usage:
 *   const gate = require('./lib/startupInsertGate');
 *   const result = await gate.insertDiscovered({ name, website, ... });
 *   const result = await gate.insertStartupUpload({ name, ... });
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('./startupNameValidator');

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase credentials');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Optional: set a custom supabase client (e.g. from script)
 */
function setSupabase(client) {
  _supabase = client;
}

/**
 * Log rejection for monitoring (override via opts.onReject)
 * When enabled, logs to startup_insert_rejections table for analysis
 */
async function defaultRejectLog(name, reason, source) {
  if (process.env.DEBUG_STARTUP_GATE === '1') {
    console.warn(`[gate] Rejected: "${name}" (${reason}) [${source}]`);
  }
  // Log to DB for monitoring (fire-and-forget)
  if (process.env.LOG_STARTUP_REJECTIONS === '1') {
    const supabase = getSupabase();
    supabase
      .from('startup_insert_rejections')
      .insert({ name: String(name).slice(0, 200), reason, source })
      .then(() => {})
      .catch(() => {}); // Silent - don't block inserts
  }
}

/**
 * Insert into discovered_startups.
 * Validates name; rejects garbage. Returns { ok, id, error, skipped }.
 *
 * @param {Object} data - Startup data
 * @param {Object} opts - { checkDuplicates, onReject }
 */
async function insertDiscovered(data, opts = {}) {
  const { checkDuplicates = true, onReject = defaultRejectLog } = opts;
  const supabase = getSupabase();

  const name = data.name?.trim();
  if (!name || name.length < 2) {
    onReject(name || '(empty)', 'empty_name', 'discovered');
    return { ok: false, error: 'Name required (min 2 chars)' };
  }

  const check = isValidStartupName(name);
  if (!check.isValid) {
    onReject(name, check.reason, 'discovered');
    return { ok: false, error: `invalid_name: ${check.reason}` };
  }

  if (checkDuplicates) {
    const { data: existing } = await supabase
      .from('discovered_startups')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { ok: true, skipped: true, id: existing.id };
    }
  }

  const record = {
    name,
    website: data.website && data.website !== 'null' ? String(data.website).trim() : null,
    description: data.description || null,
    funding_amount: data.funding_amount || null,
    funding_stage: data.funding_stage || null,
    investors_mentioned: Array.isArray(data.investors_mentioned) ? data.investors_mentioned : (Array.isArray(data.investors) ? data.investors : null),
    article_url: data.article_url || data.source_url || null,
    article_title: data.article_title || null,
    article_date: data.article_date ? (data.article_date instanceof Date ? data.article_date.toISOString() : new Date(data.article_date).toISOString()) : null,
    rss_source: data.rss_source || data.source_name || null,
    sectors: Array.isArray(data.sectors) ? data.sectors : null,
    value_proposition: data.value_proposition || null,
    problem: data.problem || null,
    solution: data.solution || null,
    market_size: data.market_size || null,
    team_companies: Array.isArray(data.team_companies) ? data.team_companies : null,
    has_technical_cofounder: data.has_technical_cofounder || false,
    is_launched: data.is_launched || false,
    has_demo: data.has_demo || false,
    has_revenue: data.has_revenue || false,
    lead_investor: data.lead_investor || null,
    execution_signals: Array.isArray(data.execution_signals) ? data.execution_signals : null,
    team_signals: Array.isArray(data.team_signals) ? data.team_signals : null,
    grit_signals: Array.isArray(data.grit_signals) ? data.grit_signals : null,
    metadata: data.metadata || null,
    discovered_at: data.discovered_at || new Date().toISOString(),
    created_at: data.created_at || new Date().toISOString(),
    imported_to_startups: false,
  };

  const { data: inserted, error } = await supabase
    .from('discovered_startups')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message)) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, id: inserted?.id };
}

/**
 * Insert into startup_uploads.
 * Validates name; rejects garbage. Pass full record; gate only validates name.
 *
 * @param {Object} record - Full startup_uploads record
 * @param {Object} opts - { skipDuplicateCheck, onReject }
 */
async function insertStartupUpload(record, opts = {}) {
  const { skipDuplicateCheck = false, onReject = defaultRejectLog } = opts;
  const supabase = getSupabase();

  const name = record.name?.trim();
  if (!name || name.length < 2) {
    onReject(name || '(empty)', 'empty_name', 'startup_uploads');
    return { ok: false, error: 'Name required (min 2 chars)' };
  }

  const check = isValidStartupName(name);
  if (!check.isValid) {
    onReject(name, check.reason, 'startup_uploads');
    return { ok: false, error: `invalid_name: ${check.reason}` };
  }

  if (!skipDuplicateCheck) {
    const { data: existing } = await supabase
      .from('startup_uploads')
      .select('id')
      .ilike('name', name)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true, skipped: true, id: existing[0].id };
    }
  }

  const { data: inserted, error } = await supabase
    .from('startup_uploads')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message)) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, id: inserted?.id, data: inserted };
}

/**
 * Batch insert discovered startups. Validates each; inserts only valid.
 * Returns { saved, skipped, errors }.
 */
async function insertDiscoveredBatch(items, opts = {}) {
  const results = { saved: 0, skipped: 0, errors: 0 };
  for (const item of items) {
    const r = await insertDiscovered(item, opts);
    if (r.ok) {
      if (r.skipped) results.skipped++;
      else results.saved++;
    } else {
      results.errors++;
    }
  }
  return results;
}

module.exports = {
  insertDiscovered,
  insertStartupUpload,
  insertDiscoveredBatch,
  getSupabase,
  setSupabase,
};
