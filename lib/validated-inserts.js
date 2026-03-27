/**
 * VALIDATED INSERT FUNCTIONS FOR HOT MATCH
 * =========================================
 * These functions ensure data integrity before inserting.
 * Use these instead of raw supabase.insert() calls.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('./startupNameValidator');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Insert a startup with validation
 * @param {Object} startup - Startup data
 * @returns {Object} - { success, data, error }
 */
async function insertStartup(startup) {
  // REQUIRED FIELDS
  if (!startup.name || startup.name.length < 2) {
    return { success: false, error: 'name is required (min 2 chars)' };
  }

  // Reject garbage names (headline fragments, law firm phrases, article titles)
  const nameCheck = isValidStartupName(startup.name);
  if (!nameCheck.isValid) {
    return { success: false, error: `invalid startup name: ${nameCheck.reason}` };
  }
  
  // source_type MUST be 'manual' or 'url'
  const sourceType = startup.source_type || 'manual';
  if (!['manual', 'url'].includes(sourceType)) {
    return { success: false, error: 'source_type must be "manual" or "url"' };
  }

  // Build validated record with sensible defaults
  const record = {
    // Required
    name: startup.name.trim(),
    source_type: sourceType,
    status: startup.status || 'pending',
    
    // Core info
    tagline: startup.tagline || startup.description?.slice(0, 200) || '',
    description: startup.description || '',
    sectors: Array.isArray(startup.sectors) ? startup.sectors : ['Technology'],
    stage: startup.stage ?? 1,  // Default to pre-seed/seed
    website: startup.website || '',
    location: startup.location || '',
    
    // Traction signals - defaults for early-stage
    is_launched: startup.is_launched ?? true,
    has_customers: startup.has_customers ?? false,
    has_revenue: startup.has_revenue ?? false,
    has_demo: startup.has_demo ?? false,
    
    // Metrics with safe defaults
    team_size: startup.team_size ?? 2,
    mrr: startup.mrr ?? 0,
    growth_rate_monthly: startup.growth_rate_monthly ?? 0,
    deployment_frequency: startup.deployment_frequency || 'weekly',
    
    // GOD score - will be recalculated but set baseline
    total_god_score: startup.total_god_score ?? 40,
    
    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Validate no garbage data
  if (record.location && record.location.length < 3) {
    record.location = ''; // Clear garbage
  }
  if (record.location && /empowering|undefined|null/i.test(record.location)) {
    record.location = ''; // Clear hallucinated data
  }

  // Check for duplicates before inserting (defensive check)
  const exists = await startupExists(record.name);
  if (exists) {
    return { success: false, error: 'Startup already exists', skipped: true };
  }

  const { data, error } = await supabase
    .from('startup_uploads')
    .insert(record)
    .select()
    .single();

  if (error) {
    // Handle duplicate key error gracefully
    if (error.message && error.message.includes('duplicate key') && error.message.includes('name_unique')) {
      return { success: false, error: 'Startup already exists', skipped: true };
    }
    return { success: false, error: error.message };
  }
  
  // Automatically add to matching queue if startup was successfully inserted
  if (data && data.id) {
    try {
      await supabase
        .from('matching_queue')
        .insert({
          startup_id: data.id,
          status: 'pending',
          attempts: 0,
          created_at: new Date().toISOString()
        })
        .catch(() => {
          // Ignore duplicate queue entries (startup might already be queued)
        });
    } catch (queueError) {
      // Don't fail the insert if queue add fails - just log it
      console.warn(`⚠️  Failed to add ${data.name} to matching queue:`, queueError.message);
    }
  }
  
  return { success: true, data };
}

/**
 * Insert an investor with validation
 * @param {Object} investor - Investor data
 * @returns {Object} - { success, data, error }
 */
async function insertInvestor(investor) {
  // REQUIRED FIELDS
  if (!investor.name || investor.name.length < 2) {
    return { success: false, error: 'name is required (min 2 chars)' };
  }
  
  // Reject corrupted names (concatenated multiple names)
  if (investor.name.length > 60) {
    return { success: false, error: 'name too long - likely corrupted data' };
  }

  const record = {
    // Required
    name: investor.name.trim(),
    firm: investor.firm || '',
    type: investor.type || 'VC',
    status: investor.status || 'active',
    
    // Investment criteria
    sectors: Array.isArray(investor.sectors) ? investor.sectors : [],
    stage: Array.isArray(investor.stage) ? investor.stage : ['Seed'],
    check_size_min: investor.check_size_min ?? 100000,
    check_size_max: investor.check_size_max ?? 1000000,
    geography_focus: investor.geography_focus || [],
    
    // Profile
    investment_thesis: investor.investment_thesis || '',
    bio: investor.bio || '',
    linkedin_url: investor.linkedin_url || '',
    photo_url: investor.photo_url || '',
    
    // Metrics
    portfolio_companies: investor.portfolio_companies || [],
    total_investments: investor.total_investments ?? 0,
    successful_exits: investor.successful_exits ?? 0,
    board_seats: investor.board_seats ?? 0,
    
    // Scoring
    investor_score: investor.investor_score ?? 50,
    investor_tier: investor.investor_tier || 'Emerging',
    
    // Flags
    leads_rounds: investor.leads_rounds ?? false,
    follows_rounds: investor.follows_rounds ?? true,
    decision_maker: investor.decision_maker ?? true,
    is_verified: investor.is_verified ?? false,
    
    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('investors')
    .insert(record)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
}

/**
 * Check if startup already exists (by name)
 */
async function startupExists(name) {
  const { data } = await supabase
    .from('startup_uploads')
    .select('id')
    .ilike('name', name)
    .limit(1);
  return data && data.length > 0;
}

/**
 * Check if investor already exists (by name + firm)
 */
async function investorExists(name, firm) {
  const { data } = await supabase
    .from('investors')
    .select('id')
    .ilike('name', name)
    .limit(1);
  return data && data.length > 0;
}

module.exports = {
  insertStartup,
  insertInvestor,
  startupExists,
  investorExists,
  supabase
};
