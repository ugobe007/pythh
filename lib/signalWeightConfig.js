'use strict';

const { DEFAULT_SIGNAL_WEIGHT_CONFIG, DIMENSION_KEYS } = require('./signalWeightDefaults');

/** @type {typeof DEFAULT_SIGNAL_WEIGHT_CONFIG | null} */
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60_000;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeWeightMaps(base, patch) {
  if (!patch || typeof patch !== 'object') return { ...base };
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = mergeWeightMaps(base[k] || {}, v);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Merge DB overrides onto defaults (partial patch supported).
 * @param {Partial<typeof DEFAULT_SIGNAL_WEIGHT_CONFIG>} overrides
 */
function mergeSignalWeightConfig(overrides) {
  const base = deepClone(DEFAULT_SIGNAL_WEIGHT_CONFIG);
  if (!overrides || typeof overrides !== 'object') return base;

  if (overrides.version) base.version = String(overrides.version);
  if (typeof overrides.totalCap === 'number') base.totalCap = overrides.totalCap;

  if (overrides.dimensionCaps) {
    base.dimensionCaps = mergeWeightMaps(base.dimensionCaps, overrides.dimensionCaps);
  }
  if (overrides.dimensionClassWeights) {
    base.dimensionClassWeights = mergeWeightMaps(base.dimensionClassWeights, overrides.dimensionClassWeights);
  }
  if (overrides.newsSourceWeights) {
    base.newsSourceWeights = mergeWeightMaps(base.newsSourceWeights, overrides.newsSourceWeights);
  }
  if (overrides.classPriorityWeights) {
    base.classPriorityWeights = mergeWeightMaps(base.classPriorityWeights, overrides.classPriorityWeights);
  }

  return base;
}

function validateSignalWeightConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['config must be an object'] };
  }

  const capSum = DIMENSION_KEYS.reduce((s, k) => s + (Number(config.dimensionCaps?.[k]) || 0), 0);
  const totalCap = Number(config.totalCap);
  if (!Number.isFinite(totalCap) || totalCap < 1 || totalCap > 15) {
    errors.push('totalCap must be between 1 and 15');
  }
  if (Math.abs(capSum - totalCap) > 0.01) {
    errors.push(`dimension caps sum (${capSum.toFixed(2)}) must equal totalCap (${totalCap})`);
  }

  for (const k of DIMENSION_KEYS) {
    const v = Number(config.dimensionCaps?.[k]);
    if (!Number.isFinite(v) || v < 0.1 || v > 5) {
      errors.push(`dimensionCaps.${k} must be between 0.1 and 5`);
    }
  }

  const checkMap = (name, map, max = 3) => {
    if (!map || typeof map !== 'object') return;
    for (const [key, val] of Object.entries(map)) {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        errors.push(`${name}.${key} must be between 0 and ${max}`);
      }
    }
  };

  for (const dim of DIMENSION_KEYS) {
    if (dim !== 'news_momentum') {
      checkMap(`dimensionClassWeights.${dim}`, config.dimensionClassWeights?.[dim]);
    }
  }
  checkMap('newsSourceWeights', config.newsSourceWeights);
  checkMap('classPriorityWeights', config.classPriorityWeights, 5);

  return { ok: errors.length === 0, errors, capSum };
}

function setCachedSignalWeightConfig(config) {
  _cache = deepClone(config);
  _cacheAt = Date.now();
}

function getCachedSignalWeightConfig() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return deepClone(_cache);
  return null;
}

/** Sync read — cached active config or defaults. */
function getActiveSignalWeightConfigSync() {
  return getCachedSignalWeightConfig() || deepClone(DEFAULT_SIGNAL_WEIGHT_CONFIG);
}

/**
 * Load active config from Supabase (with in-memory cache).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function loadSignalWeightConfig(supabase) {
  const cached = getCachedSignalWeightConfig();
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('signal_weight_config')
      .select('config, version, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.warn('[signalWeightConfig] load error:', error.message);
      const defaults = deepClone(DEFAULT_SIGNAL_WEIGHT_CONFIG);
      setCachedSignalWeightConfig(defaults);
      return defaults;
    }

    const merged = mergeSignalWeightConfig(data?.config || {});
    if (data?.version) merged.version = data.version;
    setCachedSignalWeightConfig(merged);
    return merged;
  } catch (e) {
    console.warn('[signalWeightConfig] load exception:', e.message);
    const defaults = deepClone(DEFAULT_SIGNAL_WEIGHT_CONFIG);
    setCachedSignalWeightConfig(defaults);
    return defaults;
  }
}

/**
 * Persist full config to DB + history.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {typeof DEFAULT_SIGNAL_WEIGHT_CONFIG} config
 * @param {{ comment?: string, updatedBy?: string }} meta
 */
async function saveSignalWeightConfig(supabase, config, meta = {}) {
  const validation = validateSignalWeightConfig(config);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const payload = deepClone(config);
  const now = new Date().toISOString();

  const { error: upErr } = await supabase.from('signal_weight_config').upsert(
    {
      id: 1,
      config: payload,
      version: payload.version || 'signals_v1',
      updated_at: now,
      updated_by: meta.updatedBy || 'admin',
    },
    { onConflict: 'id' }
  );
  if (upErr) return { ok: false, errors: [upErr.message] };

  await supabase.from('signal_weight_history').insert({
    config: payload,
    version: payload.version,
    comment: meta.comment || null,
    created_by: meta.updatedBy || 'admin',
  }).catch(() => {});

  setCachedSignalWeightConfig(payload);
  return { ok: true, config: payload };
}

function getDefaultSignalWeightConfig() {
  return deepClone(DEFAULT_SIGNAL_WEIGHT_CONFIG);
}

module.exports = {
  DIMENSION_KEYS,
  DEFAULT_SIGNAL_WEIGHT_CONFIG,
  mergeSignalWeightConfig,
  validateSignalWeightConfig,
  getDefaultSignalWeightConfig,
  getActiveSignalWeightConfigSync,
  loadSignalWeightConfig,
  saveSignalWeightConfig,
  setCachedSignalWeightConfig,
};
