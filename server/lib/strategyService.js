/**
 * Signal Strategy Activation Service (Canonical)
 * 
 * Evaluates signal patterns and activates/resolves strategies.
 * Authority order: Lens → Timing → Category (never violated)
 * 
 * Strategies are NEVER user-created, only system-activated based on rules.
 * This is oracle posture, not coaching.
 * 
 * Tables (canonical schema):
 * - signal_strategies: Library (id TEXT PK, title, lens_id, priority, description, etc.)
 * - signal_strategy_rules: Data-driven activation logic
 * - founder_strategy_instances: Per-founder active strategies (RLS protected)
 * - strategy_precedents: Anonymized founder stories ("locker-room wisdom")
 */

const { createClient } = require('@supabase/supabase-js');

// Lazy init Supabase client
let supabase = null;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

/**
 * Find matching strategy rules for a signal pattern
 * @param {Object} signals - { lens_id, timing_state, sector, strength, volatility, persistence_days }
 * @returns {Promise<Array>} Matching rules with strategy details
 */
async function findMatchingRules(signals) {
  const { lens_id, timing_state, sector, strength = 0, volatility = 0, persistence_days = 0 } = signals;

  const db = getSupabase();
  
  // Get all rules for this lens
  const { data: rules, error } = await db
    .from('signal_strategy_rules')
    .select(`
      id,
      strategy_id,
      timing_state,
      min_strength,
      max_strength,
      min_persistence_days,
      max_volatility,
      sector,
      lens_id
    `)
    .eq('lens_id', lens_id);

  if (error) {
    console.error('[strategyService] Error fetching rules:', error);
    return [];
  }

  // Filter rules by signal conditions
  const matchingRules = (rules || []).filter(rule => {
    // Timing state match (null = any)
    if (rule.timing_state && rule.timing_state !== timing_state) return false;
    
    // Strength range
    if (rule.min_strength !== null && strength < rule.min_strength) return false;
    if (rule.max_strength !== null && strength > rule.max_strength) return false;
    
    // Persistence
    if (rule.min_persistence_days !== null && persistence_days < rule.min_persistence_days) return false;
    
    // Volatility
    if (rule.max_volatility !== null && volatility > rule.max_volatility) return false;
    
    // Sector match (null = any)
    if (rule.sector && rule.sector !== sector) return false;
    
    return true;
  });

  return matchingRules;
}

/**
 * Evaluate and activate strategies for a founder
 * 
 * Algorithm (Lens → Timing → Category):
 * 1. Find applicable strategies for lens_id
 * 2. Filter by timing state
 * 3. Optionally filter by category/sector
 * 4. Pick highest priority (lowest number)
 * 5. Ensure no conflicting active strategy at higher priority
 * 6. Upsert instance (idempotent)
 * 
 * @param {string} userId - Founder's user ID
 * @param {string|null} startupId - Startup ID if claimed
 * @param {Object} signals - { lens_id, timing_state, strength, persistence_days, volatility, sector }
 * @returns {Promise<Object>} { activated: [], resolved: [], unchanged: [] }
 */
async function evaluateStrategiesForFounder(userId, startupId, signals) {
  const { lens_id, timing_state, strength = 0, persistence_days = 0, volatility = 0, sector = null } = signals;
  
  const results = { activated: [], resolved: [], unchanged: [] };
  
  if (!userId || !lens_id) {
    console.warn('[strategyService] Missing userId or lens_id');
    return results;
  }
  
  const db = getSupabase();
  
  // 1. Find matching rules for this lens + timing
  const matchingRules = await findMatchingRules(signals);
  
  if (matchingRules.length === 0) {
    // No matching rules - check if we need to resolve existing instances
    await resolveExpiredInstances(db, userId, startupId, lens_id, timing_state, strength);
    return results;
  }
  
  // 2. Get strategy details for matching rules
  const strategyIds = [...new Set(matchingRules.map(r => r.strategy_id))];
  
  const { data: strategies, error: stratError } = await db
    .from('signal_strategies')
    .select('*')
    .in('id', strategyIds)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  
  if (stratError || !strategies?.length) {
    console.error('[strategyService] Error fetching strategies:', stratError);
    return results;
  }
  
  // 3. Pick highest priority strategy (lowest priority number)
  const topStrategy = strategies[0];
  
  // 4. Check for existing active instance
  const { data: existingInstances } = await db
    .from('founder_strategy_instances')
    .select('id, strategy_id, status')
    .eq('user_id', userId)
    .eq('lens_id', lens_id)
    .eq('status', 'active');
  
  const existingForThisStrategy = existingInstances?.find(i => i.strategy_id === topStrategy.id);
  
  if (existingForThisStrategy) {
    // Already active - update reassess date
    const reassess_at = new Date(Date.now() + topStrategy.reassess_days * 24 * 60 * 60 * 1000).toISOString();
    
    await db
      .from('founder_strategy_instances')
      .update({ reassess_at, strength, context: { updated_at: new Date().toISOString() } })
      .eq('id', existingForThisStrategy.id);
    
    results.unchanged.push({ strategy_id: topStrategy.id, instance_id: existingForThisStrategy.id });
  } else {
    // Resolve any other active strategies for this lens (priority conflict)
    const otherActive = existingInstances?.filter(i => i.strategy_id !== topStrategy.id) || [];
    for (const other of otherActive) {
      await db
        .from('founder_strategy_instances')
        .update({ status: 'expired', resolved_at: new Date().toISOString() })
        .eq('id', other.id);
      results.resolved.push({ strategy_id: other.strategy_id, reason: 'superseded' });
    }
    
    // 5. Create new instance
    const reassess_at = new Date(Date.now() + topStrategy.reassess_days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: newInstance, error: insertError } = await db
      .from('founder_strategy_instances')
      .insert({
        user_id: userId,
        startup_id: startupId,
        strategy_id: topStrategy.id,
        lens_id,
        sector,
        timing_state,
        strength,
        evidence: null, // Will be populated separately
        status: 'active',
        reassess_at,
        context: {
          persistence_days,
          volatility,
          source: 'signals_engine',
          activated_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[strategyService] Error creating instance:', insertError);
    } else {
      results.activated.push({
        instance_id: newInstance.id,
        strategy_id: topStrategy.id,
        title: topStrategy.title
      });
    }
  }
  
  return results;
}

/**
 * Resolve instances when conditions no longer hold
 */
async function resolveExpiredInstances(db, userId, startupId, lens_id, timing_state, strength) {
  // Find active instances for this lens that may need resolution
  const { data: activeInstances } = await db
    .from('founder_strategy_instances')
    .select(`
      id,
      strategy_id,
      timing_state as original_timing,
      strength as original_strength,
      reassess_at
    `)
    .eq('user_id', userId)
    .eq('lens_id', lens_id)
    .eq('status', 'active');
  
  if (!activeInstances?.length) return;
  
  for (const instance of activeInstances) {
    let shouldResolve = false;
    let resolution = 'expired';
    
    // Check if timing state changed significantly
    if (instance.original_timing !== timing_state) {
      // Warming → Prime = positive
      if (instance.original_timing === 'warming' && timing_state === 'prime') {
        shouldResolve = true;
        resolution = 'resolved_positive';
      }
      // Any → Cooling = negative
      else if (timing_state === 'cooling' && instance.original_timing !== 'cooling') {
        shouldResolve = true;
        resolution = 'resolved_negative';
      }
    }
    
    // Check if strength improved significantly (+15)
    if (!shouldResolve && strength - (instance.original_strength || 0) >= 15) {
      shouldResolve = true;
      resolution = 'resolved_positive';
    }
    
    // Check if strength dropped significantly (-20)
    if (!shouldResolve && (instance.original_strength || 0) - strength >= 20) {
      shouldResolve = true;
      resolution = 'resolved_negative';
    }
    
    // Check if past reassess date
    if (!shouldResolve && instance.reassess_at && new Date(instance.reassess_at) < new Date()) {
      shouldResolve = true;
      resolution = 'expired';
    }
    
    if (shouldResolve) {
      await db
        .from('founder_strategy_instances')
        .update({
          status: resolution,
          resolved_at: new Date().toISOString()
        })
        .eq('id', instance.id);
    }
  }
}

/**
 * Get active strategy instances for a founder with full strategy details + precedents
 * 
 * @param {string} userId
 * @param {string|null} startupId
 * @returns {Promise<Array>} Strategy instances with joined data
 */
async function getFounderStrategies(userId, startupId = null) {
  const db = getSupabase();
  
  let query = db
    .from('founder_strategy_instances')
    .select(`
      id,
      strategy_id,
      lens_id,
      sector,
      timing_state,
      strength,
      evidence,
      status,
      activated_at,
      reassess_at,
      resolved_at,
      context,
      strategy:signal_strategies(
        id,
        title,
        description,
        why_it_matters,
        action_vectors,
        reassess_days,
        priority
      )
    `)
    .eq('user_id', userId)
    .order('activated_at', { ascending: false });
  
  if (startupId) {
    query = query.eq('startup_id', startupId);
  }
  
  const { data: instances, error } = await query;
  
  if (error) {
    console.error('[strategyService] Error fetching founder strategies:', error);
    return [];
  }
  
  // Fetch precedents for active strategies
  const activeStrategyIds = instances
    ?.filter(i => i.status === 'active')
    .map(i => i.strategy_id) || [];
  
  let precedentsMap = {};
  if (activeStrategyIds.length > 0) {
    const { data: precedents } = await db
      .from('strategy_precedents')
      .select('strategy_id, summary, lens_id, timing_state')
      .in('strategy_id', activeStrategyIds)
      .eq('visibility', 'public');
    
    for (const p of precedents || []) {
      if (!precedentsMap[p.strategy_id]) {
        precedentsMap[p.strategy_id] = [];
      }
      precedentsMap[p.strategy_id].push(p.summary);
    }
  }
  
  // Flatten and format response
  return (instances || []).map(i => ({
    id: i.id,
    strategy_id: i.strategy_id,
    lens_id: i.lens_id,
    sector: i.sector,
    timing_state: i.timing_state,
    strength: i.strength,
    status: i.status,
    activated_at: i.activated_at,
    reassess_at: i.reassess_at,
    resolved_at: i.resolved_at,
    // From joined strategy
    title: i.strategy?.title,
    description: i.strategy?.description,
    why_it_matters: i.strategy?.why_it_matters || [],
    action_vectors: i.strategy?.action_vectors || [],
    // Precedents (locker-room wisdom)
    precedents: precedentsMap[i.strategy_id] || []
  }));
}

/**
 * Get a single strategy instance by ID (for Signal Readiness Brief)
 */
async function getStrategyInstance(instanceId) {
  const db = getSupabase();
  
  const { data: instance, error } = await db
    .from('founder_strategy_instances')
    .select(`
      *,
      strategy:signal_strategies(*)
    `)
    .eq('id', instanceId)
    .single();
  
  if (error || !instance) return null;
  
  // Get precedents
  const { data: precedents } = await db
    .from('strategy_precedents')
    .select('summary')
    .eq('strategy_id', instance.strategy_id)
    .eq('visibility', 'public')
    .limit(3);
  
  return {
    ...instance,
    title: instance.strategy?.title,
    description: instance.strategy?.description,
    why_it_matters: instance.strategy?.why_it_matters || [],
    action_vectors: instance.strategy?.action_vectors || [],
    precedents: (precedents || []).map(p => p.summary)
  };
}

/**
 * Manually resolve a strategy instance
 */
async function resolveStrategyInstance(instanceId, resolution) {
  const db = getSupabase();
  
  const validResolutions = ['resolved_positive', 'resolved_negative', 'expired'];
  if (!validResolutions.includes(resolution)) {
    throw new Error(`Invalid resolution: ${resolution}`);
  }
  
  const { data, error } = await db
    .from('founder_strategy_instances')
    .update({
      status: resolution,
      resolved_at: new Date().toISOString()
    })
    .eq('id', instanceId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get all strategies in the library (for admin)
 */
async function getStrategyLibrary() {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('signal_strategies')
    .select('*')
    .order('priority', { ascending: true });
  
  if (error) {
    console.error('[strategyService] Error fetching library:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get precedents for a strategy
 */
async function getStrategyPrecedents(strategyId) {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('strategy_precedents')
    .select('*')
    .eq('strategy_id', strategyId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[strategyService] Error fetching precedents:', error);
    return [];
  }
  
  return data || [];
}

module.exports = {
  findMatchingRules,
  evaluateStrategiesForFounder,
  getFounderStrategies,
  getStrategyInstance,
  resolveStrategyInstance,
  getStrategyLibrary,
  getStrategyPrecedents
};
